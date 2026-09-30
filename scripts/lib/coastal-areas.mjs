import proj4 from 'proj4'
import { XMLParser } from 'fast-xml-parser'
import polygonClipping from 'polygon-clipping'

export const COASTAL_AREA_KINDS = ['bay', 'gulf', 'delta', 'estuary']

export function geometryRole(feature) {
  const type = feature.geometry?.type
  if (['Polygon', 'MultiPolygon'].includes(type)) return 'area'
  if (['LineString', 'MultiLineString'].includes(type)) return 'line'
  return COASTAL_AREA_KINDS.includes(feature.properties.kind) ? 'label' : 'point'
}

const array = (value) => value == null ? [] : Array.isArray(value) ? value : [value]

export function parseDeltaUnits(xml) {
  const parsed = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false, processEntities: false }).parse(xml)
  const members = array(parsed.FeatureCollection?.featureMember)
  if (!members.length || members.length >= 1000) throw new Error('Consulta deltaica vacía o posiblemente truncada')
  const ids = new Set()
  return members.map(({ delta_enviro: item }) => {
    if (!item?.gid || ids.has(item.gid)) throw new Error('ID sedimentario ausente o duplicado')
    ids.add(item.gid)
    const multi = item.the_geom?.MultiPolygon
    if (!multi?.['@_srsName']?.endsWith('#4326')) throw new Error('CRS deltaico inesperado')
    const coordinates = array(multi.polygonMember).map(({ Polygon: polygon }) => {
      function ring(boundary) {
        const value = boundary?.LinearRing?.coordinates
        const text = typeof value === 'string' ? value : value?.['#text']
        if (typeof text !== 'string') throw new Error('Anillo GML vacío')
        const points = text.trim().split(/\s+/).map((pair) => pair.split(',').map(Number))
        if (points.length < 4 || !points.every((point) => point.length === 2 && point.every(Number.isFinite)) || points[0].join() !== points.at(-1).join()) throw new Error('Anillo GML no válido')
        return points
      }
      return [ring(polygon.outerBoundaryIs), ...array(polygon.innerBoundaryIs).map(ring)]
    })
    if (!coordinates.length) throw new Error('Unidad sin polígonos')
    return { id: item.gid, unit: item.layer, geometry: { type: 'MultiPolygon', coordinates } }
  })
}

export function unionDeltaEnvironments(environments) {
  // QHpd is the delta plain; QHm its marshes. QHprd and QHfd describe
  // submerged prodelta/delta-front deposits, not the emerged delta surface.
  if (!environments.some(({ unit }) => unit === 'QHpd') || !environments.some(({ unit }) => unit === 'QHm')) throw new Error('Faltan unidades de llanura deltaica o marismas')
  const emerged = environments.filter(({ unit }) => ['QHpd', 'QHm'].includes(unit))
  return { type: 'MultiPolygon', coordinates: polygonClipping.union(...emerged.map(({ geometry }) => geometry.coordinates)) }
}

export function parseDeltaEnvironments(xml) {
  return unionDeltaEnvironments(parseDeltaUnits(xml))
}

export async function detailedDeltaGeometry(query) {
  // A broad WMS query only inventories IDs and official vertices. GeoServer
  // generalises its output by query scale, so none of this geometry is published.
  const inventory = (await query([0.47, 40.49, 1.15, 40.85])).filter(({ unit }) => ['QHpd', 'QHm'].includes(unit))
  const detailed = await Promise.all(inventory.map(async (item) => {
    const [x, y] = item.geometry.coordinates[0][0][0]
    const matches = await query([x - 0.01, y - 0.01, x + 0.01, y + 0.01], 2048)
    const detail = matches.find(({ id, unit }) => id === item.id && unit === item.unit)
    if (!detail || detail.geometry.coordinates.flat(2).length < 50) throw new Error(`ICGC: falta geometría detallada para ${item.id}`)
    return detail
  }))
  return unionDeltaEnvironments(detailed)
}

export function reprojectGeometry(geometry, definition) {
  const converter = proj4(definition, 'EPSG:4326')
  function transform(value) {
    if (typeof value[0] === 'number') {
      const point = converter.forward(value.slice(0, 2))
      if (!point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Reproyección fuera de WGS84')
      return point.map((number) => Number(number.toFixed(5)))
    }
    return value.map(transform)
  }
  return { ...geometry, coordinates: transform(geometry.coordinates) }
}

export function geometryBox(geometry) {
  const points = geometry.coordinates.flat(geometry.type === 'MultiPolygon' ? 2 : 1)
  return points.reduce((box, [x, y]) => [Math.min(box[0], x), Math.min(box[1], y),
    Math.max(box[2], x), Math.max(box[3], y)], [Infinity, Infinity, -Infinity, -Infinity])
}

export function coastalNameKey(name) {
  return String(name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
    .replace(/^(ria|estuario|bahia)\s+(de\s+|del\s+)?/u, '')
}

export function matchingCoastalArea(feature, areas) {
  const type = feature.geometry?.type, properties = feature.properties
  // Hydrography also publishes axes explicitly named Ría/Estuario as rivers.
  // Resolve only a uniquely named, nearby official water surface, not a river
  // that merely empties into it. Keep the original source ID as a URL alias.
  const kind = properties.kind === 'river' && /^(ría|estuario)\s/iu.test(properties.name) ? 'estuary' : properties.kind
  if (!['Point', 'LineString', 'MultiLineString'].includes(type) || !COASTAL_AREA_KINDS.includes(kind)) return null
  const position = type === 'Point' ? feature.geometry.coordinates : properties.center
  if (!position) return null
  const [x, y] = position
  const matches = areas.filter(({ properties: p }) => p.kind === kind
    && coastalNameKey(p.name) === coastalNameKey(properties.name)
    && x >= p.bbox[0] - 0.05 && x <= p.bbox[2] + 0.05 && y >= p.bbox[1] - 0.05 && y <= p.bbox[3] + 0.05)
  return matches.length === 1 ? matches[0] : null
}
