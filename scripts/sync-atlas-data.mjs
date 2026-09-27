import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, 'public', 'data', 'atlas')
const VERSION = new Date().toISOString().slice(0, 10)

const SOURCES = {
  naturalEarth: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson',
  ign: 'https://api-features.ign.es/collections/administrativeunit/items',
  asturias: 'https://sig.asturias.es/servicios/rest/services',
  asturiasPlanning: 'https://sig.asturias.es/server/rest/services/VisorRPGUR/Visor_RPGUR/MapServer',
  sadeiNeighborhoods: 'https://www.sadei.es/tematico/aplicaciones/Mapas/Barrios/Mapa_Barrios_Urbanos_LeafLet/data/Barrios_2.js',
}

const EUROPE_BOUNDS = [-31.5, 27, 45, 72.5]

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Regionea-Atlas data pipeline' },
  })
  if (!response.ok) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750))
      return fetchJson(url, attempt + 1)
    }
    throw new Error(`${response.status} al descargar ${url}`)
  }
  return response.json()
}

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Regionea-Atlas data pipeline' },
  })
  if (!response.ok) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750))
      return fetchText(url, attempt + 1)
    }
    throw new Error(`${response.status} al descargar ${url}`)
  }
  return response.text()
}

function parseJavascriptGeoJson(source, variableName) {
  const prefix = `var ${variableName} = `
  const start = source.indexOf(prefix)
  const jsonStart = source.indexOf('{', start)
  const jsonEnd = source.lastIndexOf('}')
  if (start < 0 || jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error(`No se pudo interpretar ${variableName}`)
  }
  return JSON.parse(source.slice(jsonStart, jsonEnd + 1))
}

function arcgisQuery(service, layer, where = '1=1', outFields = '*') {
  const query = new URL(`${SOURCES.asturias}/${service}/MapServer/${layer}/query`)
  query.searchParams.set('where', where)
  query.searchParams.set('outFields', outFields)
  query.searchParams.set('returnGeometry', 'true')
  query.searchParams.set('outSR', '4326')
  query.searchParams.set('f', 'geojson')
  return query.toString()
}

function planningQuery(layer, where = '1=1') {
  const query = new URL(`${SOURCES.asturiasPlanning}/${layer}/query`)
  query.searchParams.set('where', where)
  query.searchParams.set('outFields', '*')
  query.searchParams.set('returnGeometry', 'true')
  query.searchParams.set('outSR', '4326')
  query.searchParams.set('f', 'geojson')
  return query.toString()
}

function ignQuery(filter) {
  const query = new URL(SOURCES.ign)
  query.searchParams.set('f', 'json')
  query.searchParams.set('limit', '100')
  query.searchParams.set('filter-lang', 'cql-text')
  query.searchParams.set('filter', filter)
  return query.toString()
}

function squareDistance(point, start, end) {
  let x = start[0]
  let y = start[1]
  let dx = end[0] - x
  let dy = end[1] - y
  if (dx || dy) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = end[0]
      y = end[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }
  dx = point[0] - x
  dy = point[1] - y
  return dx * dx + dy * dy
}

function simplifyLine(points, tolerance) {
  if (!points || points.length <= 4 || tolerance <= 0) return points
  const sqTolerance = tolerance * tolerance
  const markers = new Uint8Array(points.length)
  const stack = [0, points.length - 1]
  markers[0] = markers[points.length - 1] = 1
  while (stack.length) {
    const last = stack.pop()
    const first = stack.pop()
    let maxDistance = 0
    let index = 0
    for (let i = first + 1; i < last; i += 1) {
      const distance = squareDistance(points[i], points[first], points[last])
      if (distance > maxDistance) {
        index = i
        maxDistance = distance
      }
    }
    if (maxDistance > sqTolerance) {
      markers[index] = 1
      stack.push(first, index, index, last)
    }
  }
  return points.filter((_, index) => markers[index])
}

function roundPoint(point, precision = 5) {
  const factor = 10 ** precision
  return point.map((value) => Math.round(value * factor) / factor)
}

function simplifyGeometry(geometry, tolerance, precision = 5) {
  if (!geometry) return geometry
  const line = (coordinates, closed = false) => {
    const rounded = coordinates.map((point) => roundPoint(point, precision))
    const open = closed && rounded.length > 1 ? rounded.slice(0, -1) : rounded
    const simplified = simplifyLine(open, tolerance)
    if (closed && simplified.length >= 3) simplified.push([...simplified[0]])
    return closed && simplified.length < 4 ? rounded : simplified
  }
  switch (geometry.type) {
    case 'Point':
      return { ...geometry, coordinates: roundPoint(geometry.coordinates, precision) }
    case 'MultiPoint':
      return { ...geometry, coordinates: geometry.coordinates.map((point) => roundPoint(point, precision)) }
    case 'LineString':
      return { ...geometry, coordinates: line(geometry.coordinates) }
    case 'MultiLineString':
      return { ...geometry, coordinates: geometry.coordinates.map((item) => line(item)) }
    case 'Polygon':
      return { ...geometry, coordinates: geometry.coordinates.map((ring) => line(ring, true)) }
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => line(ring, true))),
      }
    default:
      return geometry
  }
}

function visitCoordinates(coordinates, visitor) {
  if (typeof coordinates?.[0] === 'number') {
    visitor(coordinates)
    return
  }
  coordinates?.forEach((item) => visitCoordinates(item, visitor))
}

function boundsForGeometry(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]
  visitCoordinates(geometry?.coordinates, ([x, y]) => {
    bounds[0] = Math.min(bounds[0], x)
    bounds[1] = Math.min(bounds[1], y)
    bounds[2] = Math.max(bounds[2], x)
    bounds[3] = Math.max(bounds[3], y)
  })
  return bounds.every(Number.isFinite) ? bounds.map((value) => Math.round(value * 1e5) / 1e5) : null
}

function ringAreaKm2(ring) {
  if (!ring || ring.length < 4) return 0
  const radius = 6_378_137
  let area = 0
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index]
    const next = ring[(index + 1) % ring.length]
    let longitudeDelta = (next[0] - current[0]) * Math.PI / 180
    if (longitudeDelta > Math.PI) longitudeDelta -= Math.PI * 2
    if (longitudeDelta < -Math.PI) longitudeDelta += Math.PI * 2
    const latitude1 = current[1] * Math.PI / 180
    const latitude2 = next[1] * Math.PI / 180
    area += longitudeDelta * (2 + Math.sin(latitude1) + Math.sin(latitude2))
  }
  return Math.abs(area * radius * radius / 2) / 1_000_000
}

function polygonAreaKm2(rings) {
  if (!rings?.length) return 0
  return Math.max(0, ringAreaKm2(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + ringAreaKm2(ring), 0))
}

function geometryAreaKm2(geometry) {
  if (geometry?.type === 'Polygon') return polygonAreaKm2(geometry.coordinates)
  if (geometry?.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaKm2(polygon), 0)
  }
  return null
}

function decorate(feature, properties, tolerance = 0) {
  const geometry = simplifyGeometry(feature.geometry, tolerance)
  const bbox = boundsForGeometry(geometry)
  return {
    type: 'Feature',
    id: properties.id,
    properties: {
      ...properties,
      bbox,
      center: bbox ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] : null,
    },
    geometry,
  }
}

function collection(features) {
  return { type: 'FeatureCollection', features }
}

function boundsForFeatures(features) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]
  features.forEach((feature) => {
    const featureBounds = feature.properties?.bbox || boundsForGeometry(feature.geometry)
    if (!featureBounds) return
    bounds[0] = Math.min(bounds[0], featureBounds[0])
    bounds[1] = Math.min(bounds[1], featureBounds[1])
    bounds[2] = Math.max(bounds[2], featureBounds[2])
    bounds[3] = Math.max(bounds[3], featureBounds[3])
  })
  return bounds.every(Number.isFinite) ? bounds.map((value) => Math.round(value * 1e5) / 1e5) : null
}

function inEurope(feature) {
  const bbox = boundsForGeometry(feature.geometry)
  if (!bbox) return false
  return !(bbox[2] < EUROPE_BOUNDS[0] || bbox[0] > EUROPE_BOUNDS[2] || bbox[3] < EUROPE_BOUNDS[1] || bbox[1] > EUROPE_BOUNDS[3])
}

function territoryCatalogEntry(feature) {
  const { geometry: _geometry, ...withoutGeometry } = feature
  return { ...withoutGeometry.properties }
}

async function writeJson(relativePath, value) {
  const target = path.join(OUTPUT, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  const body = `${JSON.stringify(value)}\n`
  await writeFile(target, body, 'utf8')
  return {
    url: `/data/atlas/${relativePath.replaceAll('\\', '/')}`,
    bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
  }
}

async function main() {
  await mkdir(OUTPUT, { recursive: true })

  const [countriesRaw, communitiesRaw, provincesRaw, comarcasRaw, concejosRaw, parroquiasRaw, neighborhoodsSource] = await Promise.all([
    fetchJson(`${SOURCES.naturalEarth}/ne_50m_admin_0_countries.geojson`),
    fetchJson(ignQuery("nationallevelname LIKE 'Comunidad%'")),
    fetchJson(ignQuery("nationallevelname='Provincia'")),
    fetchJson(planningQuery(55)),
    fetchJson(arcgisQuery('UnidadesAdministrativas', 2)),
    fetchJson(arcgisQuery('UnidadesAdministrativas', 3)),
    fetchText(SOURCES.sadeiNeighborhoods),
  ])

  const countries = countriesRaw.features
    .filter((feature) => feature.properties.CONTINENT === 'Europe')
    .map((feature) => {
      const code = feature.properties.ADM0_A3 || feature.properties.ISO_A3_EH || slugify(feature.properties.ADMIN)
      const name = feature.properties.NAME_ES || feature.properties.ADMIN
      return decorate(feature, {
        id: `country-${String(code).toLowerCase()}`,
        slug: slugify(name),
        name,
        localName: feature.properties.NAME || name,
        aliases: [feature.properties.ADMIN].filter(Boolean),
        kind: 'country',
        boundaryStatus: 'reference',
        parentId: null,
        population: Number(feature.properties.POP_EST) || null,
        areaKm2: roundMetric(geometryAreaKm2(feature.geometry)),
        density: null,
        referenceYear: Number(feature.properties.POP_YEAR) || null,
        sourceId: 'natural-earth',
      }, 0)
    })

  const communities = communitiesRaw.features
    .filter((feature) => !feature.properties.nameunit.startsWith('Territorios no asociados'))
    .map((feature) => {
      const code = String(feature.properties.nationalcode).slice(2, 4)
      const name = feature.properties.nameunit
      return decorate(feature, {
        id: `es-ccaa-${code}`,
        slug: slugify(name),
        name,
        localName: name,
        aliases: [],
        kind: 'autonomous-community',
        boundaryStatus: 'official',
        parentId: 'country-esp',
        population: null,
        areaKm2: roundMetric(geometryAreaKm2(feature.geometry)),
        density: null,
        referenceYear: null,
        sourceId: 'ign-administrative-units',
      }, 0.007)
    })

  const provinces = provincesRaw.features
    .filter((feature) => !feature.properties.nameunit.startsWith('Territorios no asociados'))
    .map((feature) => {
    const nationalCode = String(feature.properties.nationalcode)
    const communityCode = nationalCode.slice(2, 4)
    const provinceCode = nationalCode.slice(4, 6)
    const name = feature.properties.nameunit
    return decorate(feature, {
      id: `es-prov-${provinceCode}`,
      slug: slugify(name),
      name,
      localName: name,
      aliases: [],
      kind: 'province',
      boundaryStatus: 'official',
      parentId: communityCode === '03' ? 'es-as' : `es-ccaa-${communityCode}`,
      population: null,
      areaKm2: roundMetric(geometryAreaKm2(feature.geometry)),
      density: null,
      referenceYear: null,
      sourceId: 'ign-administrative-units',
    }, 0.003)
    })

  const concejoIdByName = new Map()
  const concejos = concejosRaw.features.map((feature) => {
    const code = String(feature.properties.codigo_ine).padStart(5, '0')
    const name = titleCase(feature.properties.concejo)
    const localName = titleCase(feature.properties.conceyu)
    const id = `es-as-concejo-${code}`
    concejoIdByName.set(feature.properties.concejo, id)
    return decorate(feature, {
      id,
      slug: slugify(name),
      name,
      localName,
      aliases: localName !== name ? [localName] : [],
      kind: 'municipality',
      boundaryStatus: 'official',
      parentId: 'es-as',
      population: null,
      areaKm2: roundMetric(feature.properties['st_area(shape)'] / 1e6),
      density: null,
      referenceYear: null,
      sourceId: 'sitpa-administrative-units',
    }, 0.0008)
  })

  const comarcas = comarcasRaw.features.map((feature) => {
    const name = titleCase(feature.properties.nombre)
    return decorate(feature, {
      id: `es-as-comarca-${slugify(name)}`,
      slug: `comarca-${slugify(name)}`,
      name: `Comarca de ${name}`,
      localName: name,
      aliases: [name],
      kind: 'functional-region',
      boundaryStatus: 'official',
      parentId: 'es-as',
      population: feature.properties.padro_2021,
      areaKm2: roundMetric(feature.properties['st_area(shape)'] / 1e6),
      density: roundMetric(feature.properties.densidad),
      referenceYear: 2021,
      sourceId: 'sitpa-functional-regions',
    }, 0.0012)
  })

  const parishes = parroquiasRaw.features.map((feature) => {
    const name = titleCase(feature.properties.topo_ofi)
    const code = String(feature.properties.code).padStart(6, '0')
    return decorate(feature, {
      id: `es-as-parish-${code}`,
      slug: `${slugify(feature.properties.concejo)}-${slugify(name)}`,
      name,
      localName: name,
      aliases: [],
      kind: 'parish',
      boundaryStatus: 'statistical',
      parentId: concejoIdByName.get(feature.properties.concejo) || 'es-as',
      population: null,
      areaKm2: roundMetric(feature.properties['st_area(shape)'] / 1e6),
      density: null,
      referenceYear: null,
      sourceId: 'sadei-parishes',
    }, 0.00028)
  })

  const neighborhoodsRaw = parseJavascriptGeoJson(neighborhoodsSource, 'json_Barrios_2')
  const neighborhoodParents = new Map([
    ['Gijón / Xixón', 'es-as-concejo-33024'],
    ['Oviedo / Uviéu', 'es-as-concejo-33044'],
  ])
  const neighborhoods = neighborhoodsRaw.features
    .filter((feature) => neighborhoodParents.has(feature.properties.parro))
    .map((feature) => {
      const name = titleCase(feature.properties.Barrio)
      const code = String(feature.properties.CodeB).toLowerCase()
      return decorate(feature, {
        id: `es-as-neighborhood-${code}`,
        slug: `${slugify(feature.properties.parro)}-${slugify(name)}`,
        name,
        localName: name,
        aliases: [],
        kind: 'neighborhood',
        boundaryStatus: 'statistical',
        parentId: neighborhoodParents.get(feature.properties.parro),
        population: null,
        areaKm2: roundMetric(geometryAreaKm2(feature.geometry)),
        density: null,
        referenceYear: 2024,
        sourceId: 'sadei-neighborhoods',
      }, 0.00004)
    })

  const asturiasCommunity = communities.find((feature) => feature.properties.id === 'es-ccaa-03')
  if (asturiasCommunity) {
    asturiasCommunity.properties.id = 'es-as'
    asturiasCommunity.id = 'es-as'
    asturiasCommunity.properties.slug = 'asturias'
    asturiasCommunity.properties.name = 'Asturias'
    asturiasCommunity.properties.localName = 'Asturies'
    asturiasCommunity.properties.aliases = ['Principado de Asturias', 'Principáu d’Asturies']
  }

  for (const country of countries) {
    if (country.properties.population != null && country.properties.areaKm2) {
      country.properties.density = roundMetric(country.properties.population / country.properties.areaKm2)
    }
  }

  const protectedLayerIds = [1, 2, 3, 6, 7]
  const [peaksRaw, rangesRaw, riversRaw, reservoirsRaw, lakesRaw, parksRaw] = await Promise.all([
    fetchJson(arcgisQuery('NombresGeograficos', 2, "layer='030422' AND elevation>=1000", 'objectid,text,elevation,layer,descripción')),
    fetchJson(arcgisQuery('NombresGeograficos', 2, "layer='030424'", 'objectid,text,elevation,layer,descripción')),
    fetchJson(arcgisQuery('Hidrografia', 4, "nombre IS NOT NULL AND tipo='Línea de eje de río' AND st_length(shape)>5000", 'objectid,nombre,tipo,st_length(shape)')),
    fetchJson(arcgisQuery('Hidrografia', 1)),
    fetchJson(arcgisQuery('Hidrografia', 2)),
    Promise.all(protectedLayerIds.map((layer) => fetchJson(arcgisQuery('EspaciosProtegidos', layer)))),
  ])

  const physical = [
    ...peaksRaw.features.map((feature) => physicalFeature(feature, 'peak', feature.properties.text, {
      elevationM: roundMetric(feature.properties.elevation),
    }, 0, 'names-030422')),
    ...rangesRaw.features.map((feature) => physicalFeature(feature, 'range', feature.properties.text, {}, 0, 'names-030424')),
    ...riversRaw.features.map((feature) => physicalFeature(feature, 'river', feature.properties.nombre, {
      lengthKm: roundMetric(feature.properties['st_length(shape)'] / 1000),
    }, 0.00012, 'hydro-4')),
    ...reservoirsRaw.features.map((feature) => physicalFeature(feature, 'reservoir', feature.properties.nombre || feature.properties.NOMBRE, {}, 0, 'hydro-1')),
    ...lakesRaw.features.map((feature) => physicalFeature(feature, 'lake', feature.properties.nombre || feature.properties.NOMBRE, {}, 0, 'hydro-2')),
    ...parksRaw.flatMap((group, index) => group.features.map((feature) => physicalFeature(
      feature,
      'protected-area',
      feature.properties.nombre || feature.properties.NOMBRE || feature.properties.dl_nombre,
      { protectionType: feature.properties.tipo || feature.properties.TIPO || null },
      0.0002,
      `protected-${protectedLayerIds[index]}`,
    ))),
  ].filter((feature) => feature.properties.name)

  const [naturalRiversRaw, naturalLakesRaw, naturalRegionsRaw, naturalPeaksRaw] = await Promise.all([
    fetchJson(`${SOURCES.naturalEarth}/ne_50m_rivers_lake_centerlines.geojson`),
    fetchJson(`${SOURCES.naturalEarth}/ne_50m_lakes.geojson`),
    fetchJson(`${SOURCES.naturalEarth}/ne_50m_geography_regions_polys.geojson`),
    fetchJson(`${SOURCES.naturalEarth}/ne_50m_geography_regions_elevation_points.geojson`),
  ])
  const naturalRegionKinds = {
    'Range/mtn': 'range', Plateau: 'range', Valley: 'valley', Coast: 'coast',
  }
  const physicalEurope = [
    ...naturalRiversRaw.features.filter(inEurope).map((feature) => naturalPhysical(feature, 'river')),
    ...naturalLakesRaw.features.filter(inEurope).map((feature) => naturalPhysical(feature, 'lake')),
    ...naturalRegionsRaw.features
      .filter(inEurope)
      .filter((feature) => naturalRegionKinds[feature.properties.FEATURECLA])
      .map((feature) => naturalPhysical(feature, naturalRegionKinds[feature.properties.FEATURECLA])),
    ...naturalPeaksRaw.features
      .filter(inEurope)
      .filter((feature) => feature.properties.featurecla === 'mountain')
      .map((feature) => naturalPhysical(feature, 'peak', { elevationM: roundMetric(feature.properties.elevation) })),
  ].filter((feature) => feature.properties.name)

  const territoryCollections = {
    countries: collection(countries),
    communities: collection(communities),
    provinces: collection(provinces),
    comarcas: collection(comarcas),
    concejos: collection(concejos),
    parishes: collection(parishes),
    neighborhoods: collection(neighborhoods),
  }
  const territoryLabels = collection(Object.values(territoryCollections).flatMap(({ features }) => features.map((feature) => ({
    type: 'Feature',
    id: feature.properties.id,
    properties: feature.properties,
    geometry: { type: 'Point', coordinates: feature.properties.center },
  }))))

  const files = {}
  for (const [name, value] of Object.entries(territoryCollections)) {
    files[name] = {
      ...(await writeJson(`territories/${name}.geojson`, value)),
      count: value.features.length,
    }
  }
  files.territoryLabels = {
    ...(await writeJson('territories/labels.geojson', territoryLabels)),
    count: territoryLabels.features.length,
  }
  files.physicalAsturias = {
    ...(await writeJson('physical/asturias.geojson', collection(physical))),
    count: physical.length,
  }
  files.physicalEurope = {
    ...(await writeJson('physical/europe.geojson', collection(physicalEurope))),
    count: physicalEurope.length,
  }

  const catalog = [countries, communities, provinces, comarcas, concejos, parishes, neighborhoods]
    .flat()
    .map(territoryCatalogEntry)
  const physicalCatalog = [...physicalEurope, ...physical].map(territoryCatalogEntry)
  files.catalog = { ...(await writeJson('catalog.json', { territories: catalog, physical: physicalCatalog })), count: catalog.length + physicalCatalog.length }

  const collectionMetadata = {
    countries: { sourceIds: ['natural-earth'], license: 'Public domain', bounds: boundsForFeatures(countries), minZoom: 0, maxZoom: 5.4 },
    communities: { sourceIds: ['ign-administrative-units'], license: 'CC BY 4.0', bounds: boundsForFeatures(communities), minZoom: 4.6, maxZoom: 7.2 },
    provinces: { sourceIds: ['ign-administrative-units'], license: 'CC BY 4.0', bounds: boundsForFeatures(provinces), minZoom: 6.4, maxZoom: 8.5 },
    comarcas: { sourceIds: ['sitpa-functional-regions'], license: 'CC BY 4.0', bounds: boundsForFeatures(comarcas), minZoom: 7.4, maxZoom: 9.2 },
    concejos: { sourceIds: ['sitpa-administrative-units'], license: 'CC BY 4.0', bounds: boundsForFeatures(concejos), minZoom: 8.5, maxZoom: 11.2 },
    parishes: { sourceIds: ['sadei-parishes'], license: 'CC BY 4.0', bounds: boundsForFeatures(parishes), minZoom: 10.5, maxZoom: 13.4 },
    neighborhoods: { sourceIds: ['sadei-neighborhoods'], license: '© SADEI; uso sujeto a su aviso legal', bounds: boundsForFeatures(neighborhoods), minZoom: 12.4, maxZoom: 24 },
    territoryLabels: { sourceIds: ['natural-earth', 'ign-administrative-units', 'sitpa-functional-regions', 'sitpa-administrative-units', 'sadei-parishes', 'sadei-neighborhoods'], license: 'Mixta; consultar fuentes', bounds: boundsForFeatures(territoryLabels.features), minZoom: 0, maxZoom: 24 },
    physicalAsturias: { sourceIds: ['sitpa-physical'], license: 'CC BY 4.0', bounds: boundsForFeatures(physical), minZoom: 7.5, maxZoom: 24 },
    physicalEurope: { sourceIds: ['natural-earth'], license: 'Public domain', bounds: boundsForFeatures(physicalEurope), minZoom: 2, maxZoom: 9 },
    catalog: { sourceIds: ['natural-earth', 'ign-administrative-units', 'sitpa-functional-regions', 'sitpa-administrative-units', 'sadei-parishes', 'sadei-neighborhoods', 'sitpa-physical'], license: 'Mixta; consultar fuentes', bounds: EUROPE_BOUNDS, minZoom: 0, maxZoom: 24 },
  }
  Object.entries(collectionMetadata).forEach(([name, metadata]) => Object.assign(files[name], metadata))

  const manifest = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    bounds: EUROPE_BOUNDS,
    defaultView: { center: [-5.86, 43.31], zoom: 8 },
    collections: files,
    sources: [
      { id: 'natural-earth', title: 'Natural Earth', url: 'https://www.naturalearthdata.com/', license: 'Public domain' },
      { id: 'ign-administrative-units', title: 'IGN — Unidades administrativas', url: 'https://api-features.ign.es/collections/administrativeunit', license: 'CC BY 4.0' },
      { id: 'sitpa-administrative-units', title: 'SITPA — Unidades administrativas', url: 'https://sig.asturias.es/servicios/rest/services/UnidadesAdministrativas/MapServer', license: 'CC BY 4.0' },
      { id: 'sadei-parishes', title: 'SADEI — Parroquias estadísticas', url: 'https://sig.asturias.es/servicios/rest/services/UnidadesAdministrativas/MapServer/3', license: 'CC BY 4.0' },
      { id: 'sadei-neighborhoods', title: 'SADEI — Barrios de las áreas urbanas', url: 'https://www.sadei.es/sadei/metodos-y-documentacion/mapas_125_1_ap.html', license: '© SADEI; uso sujeto a su aviso legal' },
      { id: 'sitpa-functional-regions', title: 'SITPA — Comarcas funcionales', url: 'https://sig.asturias.es/server/rest/services/VisorRPGUR/Visor_RPGUR/MapServer/55', license: 'CC BY 4.0' },
      { id: 'sitpa-physical', title: 'SITPA — Relieve, hidrografía y espacios protegidos', url: 'https://sig.asturias.es/servicios/rest/services', license: 'CC BY 4.0' },
    ],
  }
  await writeJson('manifest.json', manifest)
  process.stdout.write(`Atlas ${VERSION}: ${catalog.length} territorios y ${physicalCatalog.length} accidentes.\n`)
}

function titleCase(value) {
  return String(value || '')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s/-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))
}

function roundMetric(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : null
}

function physicalFeature(feature, kind, name, extras = {}, tolerance = 0, namespace = 'source') {
  const safeName = titleCase(name)
  const objectId = feature.properties.objectid || feature.properties.OBJECTID
  const fallbackId = createHash('sha1')
    .update(JSON.stringify([safeName, boundsForGeometry(feature.geometry)]))
    .digest('hex')
    .slice(0, 12)
  return decorate(feature, {
    id: `physical-as-${kind}-${namespace}-${objectId || fallbackId}`,
    slug: slugify(safeName),
    name: safeName,
    localName: safeName,
    aliases: [],
    kind,
    sourceId: 'sitpa-physical',
    territoryIds: ['es-as'],
    ...extras,
  }, tolerance)
}

function naturalPhysical(feature, kind, extras = {}) {
  const name = feature.properties.name_es || feature.properties.NAME_ES || feature.properties.name || feature.properties.NAME
  const id = feature.properties.ne_id || feature.properties.wikidataid || createHash('sha1')
    .update(JSON.stringify([name, boundsForGeometry(feature.geometry)]))
    .digest('hex')
    .slice(0, 12)
  return decorate(feature, {
    id: `physical-eu-${kind}-${id}`,
    slug: slugify(name),
    name,
    localName: feature.properties.name || name,
    aliases: [],
    kind,
    sourceId: 'natural-earth',
    territoryIds: [],
    ...extras,
  }, 0)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
