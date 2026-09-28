import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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
console.log(`Atlas válido: ${catalog.territories.length} territorios, ${catalog.physical.length} accidentes, ${ids.size} geometrías.`)
