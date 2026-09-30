import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { assertRouteClassification, TRANSIT_CLASSIFICATION_VERSION } from './lib/transit-classification.mjs'

const root = process.cwd()
const atlasDir = path.join(root, 'public', 'data', 'atlas')

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(atlasDir, relativePath), 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function inspectCoordinates(value, context) {
  if (!Array.isArray(value)) throw new Error(`${context}: coordenadas no válidas`)
  if (value.length >= 2 && typeof value[0] === 'number') {
    assert(Number.isFinite(value[0]) && Number.isFinite(value[1]), `${context}: coordenada no finita`)
    assert(value[0] >= -180 && value[0] <= 180, `${context}: longitud fuera de WGS84`)
    assert(value[1] >= -90 && value[1] <= 90, `${context}: latitud fuera de WGS84`)
    return
  }
  value.forEach((part) => inspectCoordinates(part, context))
}

function validateFeature(feature, ids, sourceIds, collection) {
  const context = `${collection}/${feature?.properties?.id || 'sin-id'}`
  assert(feature?.type === 'Feature', `${context}: no es Feature`)
  assert(feature.geometry?.type && feature.geometry?.coordinates, `${context}: geometría vacía`)
  assert(feature.id === feature.properties?.id, `${context}: feature.id no coincide`)
  assert(!ids.has(feature.id), `${context}: ID duplicado`)
  ids.add(feature.id)
  assert(sourceIds.has(feature.properties.sourceId), `${context}: fuente desconocida`)
  assert(Array.isArray(feature.properties.bbox) && feature.properties.bbox.length === 4, `${context}: bbox no válida`)
  inspectCoordinates(feature.geometry.coordinates, context)
}

const manifest = await json('manifest.json')
const catalog = await json('catalog.json')
assert(manifest.version && !Number.isNaN(Date.parse(manifest.generatedAt)), 'Manifiesto sin versión o fecha válida')
assert(Array.isArray(manifest.sources) && manifest.sources.length > 0, 'Manifiesto sin fuentes')

const sourceIds = new Set()
for (const source of manifest.sources) {
  assert(source.id && source.title && source.url && source.license, 'Fuente incompleta en el manifiesto')
  assert(!sourceIds.has(source.id), `Fuente duplicada: ${source.id}`)
  sourceIds.add(source.id)
}

const ids = new Set()
const territorialCollections = new Set(['countries', 'communities', 'provinces', 'comarcas', 'concejos', 'parishes', 'neighborhoods'])
for (const [name, collection] of Object.entries(manifest.collections)) {
  assert(Array.isArray(collection.sourceIds) && collection.sourceIds.length > 0, `${name}: faltan fuentes`)
  collection.sourceIds.forEach((sourceId) => assert(sourceIds.has(sourceId), `${name}: fuente desconocida (${sourceId})`))
  assert(collection.license, `${name}: falta licencia`)
  assert(Array.isArray(collection.bounds) && collection.bounds.length === 4 && collection.bounds.every(Number.isFinite), `${name}: límites geográficos no válidos`)
  assert(Number.isFinite(collection.minZoom) && Number.isFinite(collection.maxZoom) && collection.minZoom <= collection.maxZoom, `${name}: rango de zoom no válido`)
  const relativePath = collection.url.replace('/data/atlas/', '')
  const filePath = path.join(atlasDir, relativePath)
  const buffer = await readFile(filePath)
  const fileStat = await stat(filePath)
  const checksum = createHash('sha256').update(buffer).digest('hex')
  assert(fileStat.size === collection.bytes, `${name}: tamaño distinto del manifiesto`)
  assert(checksum === collection.sha256, `${name}: checksum distinto del manifiesto`)
  if (relativePath.endsWith('.geojson')) {
    const geojson = JSON.parse(buffer.toString('utf8'))
    assert(geojson.type === 'FeatureCollection', `${name}: no es FeatureCollection`)
    assert(geojson.features.length === collection.count, `${name}: recuento incorrecto`)
    const collectionIds = name === 'territoryLabels' || name.endsWith('Labels') ? new Set() : ids
    geojson.features.forEach((feature) => validateFeature(feature, collectionIds, sourceIds, name))
    if (name.startsWith('physical') && !name.endsWith('Labels')) {
      for (const feature of geojson.features) {
        const p = feature.properties, polygon = ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)
        assert(['area', 'line', 'point', 'label'].includes(p.geometryRole), `${p.id}: falta papel geométrico`)
        assert(p.geometryRole !== 'area' || polygon, `${p.id}: una superficie no puede ser un punto`)
        if (['bay', 'gulf', 'delta', 'estuary'].includes(p.kind) && feature.geometry.type === 'Point') {
          assert(p.geometryRole === 'label', `${p.id}: un topónimo costero no delimita una superficie`)
        }
        if (polygon) {
          const rings = feature.geometry.coordinates.flat(feature.geometry.type === 'MultiPolygon' ? 1 : 0)
          for (const ring of rings) assert(ring.length >= 4 && ring[0].join() === ring.at(-1).join(), `${p.id}: anillo abierto o degenerado`)
        }
      }
    }
  }
}

const catalogEntities = [...catalog.territories, ...catalog.physical]
const catalogIds = new Set(catalogEntities.map(({ id }) => id))
assert(catalogIds.size === catalogEntities.length, 'El catálogo contiene IDs duplicados')
assert(catalog.territories.filter(({ kind }) => kind === 'functional-region').length === 8, 'Deben existir 8 comarcas')
assert(catalog.territories.filter(({ kind }) => kind === 'municipality').length === 78, 'Deben existir 78 concejos')
assert(catalog.territories.filter(({ kind }) => kind === 'parish').length === 857, 'Deben existir 857 parroquias')
assert(
  catalog.territories.every(({ name }) => !/no adscrito a entidad colectiva/i.test(String(name || '').normalize('NFD').replace(/\p{M}/gu, ''))),
  'Quedan restos del nomenclátor que no son parroquias',
)
assert(catalog.territories.filter(({ kind }) => kind === 'neighborhood').length === 91, 'Deben existir 91 barrios de las áreas urbanas')

for (const entity of catalog.territories) {
  if (entity.parentId) assert(catalogIds.has(entity.parentId), `${entity.id}: parentId roto (${entity.parentId})`)
  assert(entity.areaKm2 > 0, `${entity.id}: superficie ausente o no válida`)
  assert(['official', 'statistical', 'municipal', 'reference'].includes(entity.boundaryStatus), `${entity.id}: estado del límite no válido`)
  if (entity.kind === 'parish') assert(entity.boundaryStatus === 'statistical', `${entity.id}: parroquia no estadística`)
  if (entity.kind === 'neighborhood') {
    assert(entity.boundaryStatus === 'statistical', `${entity.id}: barrio sin naturaleza estadística`)
    assert(['es-as-concejo-33004', 'es-as-concejo-33024', 'es-as-concejo-33031', 'es-as-concejo-33037', 'es-as-concejo-33044'].includes(entity.parentId), `${entity.id}: barrio fuera de Avilés, Gijón, Langreo, Mieres u Oviedo`)
  }
}

for (const name of territorialCollections) assert(manifest.collections[name], `Falta colección territorial ${name}`)

const physicalKinds = new Set(['peak', 'range', 'river', 'lake', 'reservoir', 'valley', 'coast', 'cape', 'bay', 'gulf', 'delta', 'estuary', 'cliff', 'beach', 'island', 'protected-area'])
for (const entity of catalog.physical) {
  if (entity.sourceDate) {
    assert(/^\d{4}-\d{2}(-\d{2})?$/.test(entity.sourceDate) && !Number.isNaN(Date.parse(entity.sourceDate))
      && new Date(entity.sourceDate).toISOString().startsWith(entity.sourceDate), `${entity.id}: fecha de fuente inválida`)
  }
  if (['miteco-water-2027', 'icgc-life-ebro'].includes(entity.sourceId)) {
    assert(entity.geometryRole === 'area' && entity.boundaryStatus === 'reference' && entity.sourceDate
      && entity.geometryNote?.trim(), `${entity.id}: superficie costera sin fecha o alcance documentado`)
  }
  if (entity.geometryId) {
    const area = catalog.physical.find(({ id }) => id === entity.geometryId)
    assert(area?.geometryRole === 'area' && !area.geometryId, `${entity.id}: referencia a superficie rota o encadenada`)
  }
  assert(physicalKinds.has(entity.kind), `${entity.id}: tipo físico desconocido`)
  // SITPA publishes unnamed water bodies too. Keep their verified geometries;
  // do not fabricate a placename just to satisfy the catalogue.
  assert(typeof entity.name === 'string' && (entity.name.trim() || entity.kind === 'lake'), `${entity.id}: topónimo físico vacío`)
  assert(ids.has(entity.id), `${entity.id}: accidente sin geometría`)
  if (entity.kind === 'beach') assert(/^playa(s)?\b/i.test(entity.name), `${entity.id}: playa sin prefijo identificativo`)
}
assert(manifest.collections.physicalCoastalAreas && manifest.collections.physicalCoastalAreasLabels, 'Faltan superficies costeras o sus etiquetas')
assert(catalog.physical.some(({ id, kind, geometryRole }) => id === 'physical-es-delta-ebro' && kind === 'delta' && geometryRole === 'area'), 'Falta la superficie del delta del Ebro')
for (const name of ['physicalAsturiasLabels', 'physicalEuropeLabels']) {
  const collection = manifest.collections[name]
  if (!collection) continue
  const labels = await json(collection.url.replace('/data/atlas/', ''))
  assert(labels.features.every(({ properties }) => properties.kind !== 'river'), `${name}: río etiquetado en el centro de una caja en lugar de sobre su recorrido`)
}

const transitManifest = await json('transit/manifest.json')
const transitRoutes = await json('transit/routes.geojson')
const transitStops = await json('transit/stops.geojson')
assert(transitManifest.classification?.version === TRANSIT_CLASSIFICATION_VERSION, 'Transporte: versión de clasificación ausente o incompatible')
assert(transitManifest.classification?.method === 'geometry-scale', 'Transporte: método de clasificación no válido')
assert(typeof transitManifest.coverage?.id === 'string' && transitManifest.coverage.id, 'Transporte: cobertura sin identificador')
assert(Array.isArray(transitManifest.coverage?.bounds) && transitManifest.coverage.bounds.length === 4 && transitManifest.coverage.bounds.every(Number.isFinite), 'Transporte: límites de cobertura no válidos')
assert(Array.isArray(transitManifest.coverage?.contextBounds) && transitManifest.coverage.contextBounds.length === 4 && transitManifest.coverage.contextBounds.every(Number.isFinite), 'Transporte: límites contextuales no válidos')
assert(transitRoutes.type === 'FeatureCollection' && transitRoutes.features.length === transitManifest.routes, 'Transporte: recuento de rutas incorrecto')
assert(transitStops.type === 'FeatureCollection' && transitStops.features.length === transitManifest.stops, 'Transporte: recuento de paradas incorrecto')
const transitIds = new Set()
for (const feature of [...transitRoutes.features, ...transitStops.features]) {
  const properties = feature?.properties || {}
  const context = `transporte/${properties.id || 'sin-id'}`
  assert(feature.type === 'Feature' && feature.geometry?.coordinates, `${context}: geometría ausente`)
  assert(typeof properties.id === 'string' && properties.id.includes(':'), `${context}: ID sin espacio de nombres`)
  const identity = `${properties.entityType}:${properties.id}`
  assert(!transitIds.has(identity), `${context}: ID duplicado dentro del tipo ${properties.entityType}`)
  transitIds.add(identity)
  assert(properties.provider && properties.name, `${context}: proveedor o nombre ausente`)
  assert(['bus', 'rail', 'ferry', 'air'].includes(properties.transportMode), `${context}: medio no válido`)
  assert(!('scope' in properties), `${context}: conserva el campo obsoleto scope`)
  inspectCoordinates(feature.geometry.coordinates, context)
  if (properties.entityType === 'route') assertRouteClassification(properties, context)
  else assert(properties.entityType === 'stop', `${context}: tipo de entidad no válido`)
}
console.log(`Atlas válido: ${catalog.territories.length} territorios, ${catalog.physical.length} accidentes, ${ids.size} geometrías.`)
