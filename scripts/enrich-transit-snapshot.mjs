import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertRouteClassification, classifyRoute, transitClassificationManifest } from './lib/transit-classification.mjs'

const ROOT = process.cwd()
const TRANSIT = path.join(ROOT, 'public', 'data', 'atlas', 'transit')
const INITIAL_COVERAGE = { id: 'es-as', bounds: [-7.25, 42.9, -4.45, 43.75], contextBounds: [-7.5, 42.72, -4.2, 43.93] }
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
    delete feature.properties.scope
    if (feature.properties.entityType === 'route') {
      try {
        assertRouteClassification(feature.properties)
      } catch {
        Object.assign(feature.properties, classifyRoute(feature.geometry.coordinates, {
          stopCount: feature.properties.routeStopCount || 0,
          basis: 'published-geometry',
        }))
      }
    }
  })
  await writeFile(file, `${JSON.stringify(collection)}\n`, 'utf8')
  return collection.features.length
}

const [routes, stops] = await Promise.all([enrich('routes.geojson'), enrich('stops.geojson')])
const manifestFile = path.join(TRANSIT, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
manifest.routes = routes
manifest.stops = stops
manifest.coverage ||= INITIAL_COVERAGE
manifest.classification = transitClassificationManifest()
await writeFile(manifestFile, `${JSON.stringify(manifest)}\n`, 'utf8')
process.stdout.write(`Snapshot enriquecido: ${routes} líneas y ${stops} paradas.\n`)
