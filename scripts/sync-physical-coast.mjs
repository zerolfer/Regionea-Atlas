import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fetchJson } from './sync-atlas-data.mjs'

const ROOT = process.cwd()
const ASTURIAS_PATH = path.join(ROOT, 'public', 'data', 'atlas', 'physical', 'asturias.geojson')

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
  url.searchParams.set('resultRecordCount', '1000')
  url.searchParams.set('orderByFields', 'objectid')
  url.searchParams.set('f', 'geojson')
  return url
}

async function fetchCollection(url) {
  const features = []
  const ids = new Set()
  let more = true
  while (more) {
    url.searchParams.set('resultOffset', String(features.length))
    const collection = await fetchJson(url)
    if (!Array.isArray(collection.features)) throw new Error(`Respuesta GeoJSON inválida de ${url}`)
    for (const feature of collection.features) {
      const id = feature.properties.objectid ?? feature.properties.OBJECTID
      if (id == null || ids.has(id)) throw new Error(`Paginación costera inválida de ${url}`)
      ids.add(id)
      features.push(feature)
    }
    more = collection.exceededTransferLimit === true || collection.features.length === 1000
    if (more && !collection.features.length) throw new Error(`Paginación costera vacía de ${url}`)
  }
  return { type: 'FeatureCollection', features }
}

export function coastalKind(feature) {
  const name = normalize(feature.properties.text)
  if (!name || name.length < 3 || /\b(de|del|la|el|los|las)$/.test(name)) return null
  const words = name.split(/\s+/)
  if (words.length > 2 && words.filter((word) => word.length === 1).length / words.length > 0.4) return null
  if (/^(ensenada|bahia|golfo|cabo|punta|ria|isla|islote)$/.test(name)) return null
  const layer = String(feature.properties.layer || '')
  if (layer === '050404') return 'estuary'
  if (layer === '050408') return 'island'
  if (/\bgolfo\b/.test(name)) return 'gulf'
  if (/\b(cabo|punta)\b/.test(name)) return 'cape'
  if (/\b(isla|islote|isleo)\b/.test(name)) return 'island'
  if (/\b(bahia|ensenada)\b/.test(name)) return 'bay'
  return 'coast'
}

export function beachDisplayName(name) {
  let original = String(name || '').replace(/\s+/g, ' ').trim()
  if (!original) return ''
  if (/^playa(s)?\b/i.test(original)) return original
  if (/^del\s+/i.test(original)) return `Playa del ${original.replace(/^del\s+/i, '')}`
  original = original.replace(/^de\s+/i, '')
  const article = original.match(/^(El|La|Los|Las)\s+(.+)$/i)
  if (article) return `Playa ${article[1].toLowerCase() === 'el' ? 'del' : `de ${article[1].toLowerCase()}`} ${article[2]}`
  return `Playa de ${original}`
}

function decoratePoint(feature, kind, name, namespace, previousIds) {
  if (!kind) return null
  const original = titleCase(name)
  const safeName = kind === 'beach' ? beachDisplayName(original) : original
  const coordinates = feature.geometry?.coordinates
  if (!safeName || feature.geometry?.type !== 'Point' || !Array.isArray(coordinates)) return null
  const objectId = feature.properties.objectid ?? feature.properties.OBJECTID
  if (objectId == null) throw new Error(`Accidente costero sin ID: ${safeName}`)
  const id = previousIds.get(`${namespace}-${objectId}`) || `physical-as-${kind}-${namespace}-${objectId}`
  const center = [Number(coordinates[0].toFixed(5)), Number(coordinates[1].toFixed(5))]
  return {
    type: 'Feature', id,
    properties: {
      id, slug: slugify(safeName), name: safeName, localName: original, aliases: safeName === original ? [] : [original], kind,
      sourceId: 'sitpa-physical', territoryIds: ['es-as'], bbox: [...center, ...center], center,
    },
    geometry: { type: 'Point', coordinates: center },
  }
}

async function main() {
  const [asturias, names, beaches] = await Promise.all([
    JSON.parse(await readFile(ASTURIAS_PATH, 'utf8')),
    fetchCollection(endpoint('NombresGeograficos', 3, "layer IN ('050404','050408','050412')")),
    fetchCollection(endpoint('Visor/Turismo', 2)),
  ])
  if (!names.features.length || !beaches.features.length) throw new Error('Fuente costera vacía; se conserva el snapshot anterior')

  // Public IDs are opaque: correcting a kind must not invalidate shared URLs.
  const previousIds = new Map(asturias.features.flatMap(({ properties }) => {
    const key = properties.id?.match(/(names-hydro-coast|tourism-beach)-(.+)$/)?.[0]
    return key ? [[key, properties.id]] : []
  }))

  const generated = [
    ...names.features.map((feature) => decoratePoint(feature, coastalKind(feature), feature.properties.text, 'names-hydro-coast', previousIds)),
    ...beaches.features.map((feature) => decoratePoint(feature, 'beach', feature.properties.nombre, 'tourism-beach', previousIds)),
  ].filter(Boolean)

  const existing = asturias.features.filter((feature) => {
    const id = String(feature.properties?.id || '')
    return !(id.includes('-names-hydro-coast-') || id.includes('-tourism-beach-'))
  })

  const unique = new Map([...existing, ...generated].map((feature) => [feature.properties.id, feature]))
  asturias.features = [...unique.values()]
  await writeFile(ASTURIAS_PATH, `${JSON.stringify(asturias)}\n`, 'utf8')
  process.stdout.write(`Costa física actualizada: ${generated.length} accidentes oficiales.\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1 })
}
