import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const ASTURIAS_PATH = path.join(ROOT, 'public', 'data', 'atlas', 'physical', 'asturias.geojson')
const COASTAL_KINDS = new Set(['cape', 'bay', 'gulf', 'estuary', 'beach', 'island'])

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim()
}

function titleCase(value) {
  return String(value || '').trim().toLocaleLowerCase('es').replace(/(^|[\s/(-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))
}

function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function endpoint(service, layer, where = '1=1') {
  const url = new URL(`https://sig.asturias.es/servicios/rest/services/${service}/MapServer/${layer}/query`)
  url.searchParams.set('where', where)
  url.searchParams.set('outFields', '*')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultRecordCount', '2000')
  url.searchParams.set('f', 'geojson')
  return url
}

async function fetchCollection(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Regionea-Atlas data pipeline' } })
  if (!response.ok) throw new Error(`${response.status} al descargar ${url}`)
  const collection = await response.json()
  if (!Array.isArray(collection.features)) throw new Error(`Respuesta GeoJSON inválida de ${url}`)
  return collection
}

function coastalKind(feature) {
  const layer = String(feature.properties.layer || '')
  if (layer === '050404') return 'estuary'
  if (layer === '050408') return 'island'
  const name = normalize(feature.properties.text)
  if (name.includes('golfo')) return 'gulf'
  if (/\b(cabo|punta)\b/.test(name)) return 'cape'
  return 'bay'
}

function decoratePoint(feature, kind, name, namespace) {
  const safeName = titleCase(name)
  const coordinates = feature.geometry?.coordinates
  if (!safeName || feature.geometry?.type !== 'Point' || !Array.isArray(coordinates)) return null
  const objectId = feature.properties.objectid || feature.properties.OBJECTID
  const id = `physical-as-${kind}-${namespace}-${objectId}`
  const center = [Number(coordinates[0].toFixed(5)), Number(coordinates[1].toFixed(5))]
  return {
    type: 'Feature', id,
    properties: {
      id, slug: slugify(safeName), name: safeName, localName: safeName, aliases: [], kind,
      sourceId: 'sitpa-physical', territoryIds: ['es-as'], bbox: [...center, ...center], center,
    },
    geometry: { type: 'Point', coordinates: center },
  }
}

const [asturias, names, beaches] = await Promise.all([
  JSON.parse(await readFile(ASTURIAS_PATH, 'utf8')),
  fetchCollection(endpoint('NombresGeograficos', 3, "layer IN ('050404','050408','050412')")),
  fetchCollection(endpoint('Visor/Turismo', 2)),
])

const generated = [
  ...names.features.map((feature) => decoratePoint(feature, coastalKind(feature), feature.properties.text, 'names-hydro-coast')),
  ...beaches.features.map((feature) => decoratePoint(feature, 'beach', feature.properties.nombre, 'tourism-beach')),
].filter(Boolean)

const existing = asturias.features.filter((feature) => {
  const id = String(feature.properties?.id || '')
  return !(COASTAL_KINDS.has(feature.properties?.kind) && (id.includes('-names-hydro-coast-') || id.includes('-tourism-beach-')))
})

const unique = new Map([...existing, ...generated].map((feature) => [feature.properties.id, feature]))
asturias.features = [...unique.values()]
await writeFile(ASTURIAS_PATH, `${JSON.stringify(asturias)}\n`, 'utf8')
process.stdout.write(`Costa física actualizada: ${generated.length} accidentes oficiales.\n`)
