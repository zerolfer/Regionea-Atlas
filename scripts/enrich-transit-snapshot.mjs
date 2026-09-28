import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const TRANSIT = path.join(ROOT, 'public', 'data', 'atlas', 'transit')
const ASTURIAS_BOUNDS = [-7.25, 42.9, -4.45, 43.75]

function positions(value, result = []) {
  if (typeof value?.[0] === 'number') result.push(value)
  else if (Array.isArray(value)) value.forEach((child) => positions(child, result))
  return result
}

function geometryBounds(geometry) {
  const points = positions(geometry?.coordinates)
  if (!points.length) return null
  const longitudes = points.map(([longitude]) => longitude)
  const latitudes = points.map(([, latitude]) => latitude)
  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)]
}

function scope(geometry) {
  const bounds = geometryBounds(geometry)
  if (!bounds) return 'regional'
  if (bounds[0] < ASTURIAS_BOUNDS[0] || bounds[2] > ASTURIAS_BOUNDS[2] || bounds[1] < ASTURIAS_BOUNDS[1] || bounds[3] > ASTURIAS_BOUNDS[3]) return 'external'
  const middleLatitude = (bounds[1] + bounds[3]) / 2
  const widthKm = (bounds[2] - bounds[0]) * 111 * Math.cos(middleLatitude * Math.PI / 180)
  const heightKm = (bounds[3] - bounds[1]) * 111
  return Math.hypot(widthKm, heightKm) <= 24 ? 'local' : 'regional'
}

function mode(properties) {
  if (properties.transportMode) return properties.transportMode
  const routeType = Number(properties.routeType)
  if (routeType === 4 || (routeType >= 1000 && routeType < 1100)) return 'ferry'
  if (routeType >= 1100 && routeType < 1200) return 'air'
  if ([0, 1, 2, 5, 6, 7, 11, 12].includes(routeType) || String(properties.provider).toUpperCase() === 'RENFE') return 'rail'
  return 'bus'
}

async function enrich(name) {
  const file = path.join(TRANSIT, name)
  const collection = JSON.parse(await readFile(file, 'utf8'))
  collection.features.forEach((feature) => {
    feature.properties.transportMode = mode(feature.properties)
    feature.properties.scope = feature.properties.entityType === 'route' ? scope(feature.geometry) : 'local'
  })
  await writeFile(file, `${JSON.stringify(collection)}\n`, 'utf8')
  return collection.features.length
}

const [routes, stops] = await Promise.all([enrich('routes.geojson'), enrich('stops.geojson')])
process.stdout.write(`Snapshot enriquecido: ${routes} líneas y ${stops} paradas.\n`)
