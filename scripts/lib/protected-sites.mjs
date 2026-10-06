import { createHash } from 'node:crypto'
import polygonClipping from 'polygon-clipping'

// Only explicit zones of the same official named site, source category and
// instrument. Never join homonymous mountains or different protection regimes.
export function aggregateProtectedSites(features) {
  const groups = new Map(), ids = new Set(), result = []
  for (const feature of features) {
    const namespace = feature.id.match(/^physical-as-protected-area-(protected-(?:2|18))-/)?.[1]
    const p = feature.properties
    if (!namespace || !p.protectionZone || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) continue
    const identity = JSON.stringify([namespace, p.name])
    const key = JSON.stringify([identity, p.protectionInstrument])
    if (!groups.has(key)) groups.set(key, { identity, namespace, members: [] })
    groups.get(key).members.push(feature)
  }
  for (const { identity, namespace, members } of groups.values()) {
    if (members.length < 2) continue
    const id = `physical-as-protected-site-${namespace}-${createHash('sha1').update(identity).digest('hex').slice(0, 12)}`
    if (ids.has(id)) throw new Error('Identidad de espacio protegido ambigua entre instrumentos')
    ids.add(id)
    const coordinates = polygonClipping.union(...members.map(f => f.geometry.coordinates))
    if (!coordinates.length) throw new Error('Unión de zonas protegidas vacía')
    const points = coordinates.flat(2), xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    const properties = { ...members[0].properties, id, bbox, center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
      memberIds: members.map(f => f.id), protectionZone: '',
      geometryNote: `Unión de las zonas publicadas para este espacio y categoría de protección, sin rellenar huecos. Zonas: ${[...new Set(members.map(f => f.properties.protectionZone))].join('; ')}.${members[0].properties.protectionInstrument ? ` Instrumento: ${members[0].properties.protectionInstrument}.` : ''}`,
    }
    delete properties.legacyIds
    delete properties.geometryId
    result.push({ type: 'Feature', id, properties, geometry: { type: 'MultiPolygon', coordinates } })
    members.forEach(f => { f.properties.geometryId = id })
  }
  return result
}
