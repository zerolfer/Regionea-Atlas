import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fetchJson, inEurope, naturalPhysical } from './sync-atlas-data.mjs'

const NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const OUTPUT = path.join(process.cwd(), 'public', 'data', 'atlas', 'physical', 'europe.geojson')

function inContext(feature) {
  // A dateline-crossing feature has a world-spanning bbox; that is not evidence
  // of intersection with Europe (e.g. the Gulf of Anadyr at ±180°).
  const coordinates = feature.geometry?.coordinates?.flat(Infinity) || []
  const longitudes = coordinates.filter((_, index) => index % 2 === 0)
  return longitudes.length > 0 && Math.max(...longitudes) - Math.min(...longitudes) < 180 && inEurope(feature)
}

function contextFeature(feature, kind, aliases) {
  const sourceId = feature.properties.ne_id || feature.properties.NE_ID || feature.properties.wikidataid || feature.properties.WIKIDATAID
  const result = naturalPhysical(feature, kind, {
    ...(sourceId ? { id: `physical-eu-${kind}-${sourceId}` } : {}),
    boundaryStatus: 'reference', aliases: aliases.filter(Boolean),
  })
  result.properties.name = result.properties.name.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es'))
  return result
}

export function buildPhysicalContext(marine, regions) {
  const coastal = marine.features.filter(inContext).filter(({ properties }) => ['bay', 'gulf'].includes(properties.featurecla)).map((feature) => {
    // Natural Earth calls Biscay a bay in English and a gulf in Spanish.
    // Preserve the source names and use the Spanish atlas terminology.
    const name = feature.properties.name_es || feature.properties.name || ''
    const kind = /^golfo\b/i.test(name) ? 'gulf' : feature.properties.featurecla
    return contextFeature(feature, kind, [feature.properties.name])
  })
  const deltas = regions.features.filter(inContext).filter(({ properties }) => properties.FEATURECLA === 'Delta').map((feature) => contextFeature(feature, 'delta', [feature.properties.NAME]))
  return [...new Map([...coastal, ...deltas].map((feature) => [feature.id, feature])).values()]
}

async function main() {
  const [snapshot, marine, regions] = await Promise.all([
    readFile(OUTPUT, 'utf8').then(JSON.parse),
    fetchJson(`${NATURAL_EARTH}/ne_10m_geography_marine_polys.geojson`),
    fetchJson(`${NATURAL_EARTH}/ne_10m_geography_regions_polys.geojson`),
  ])
  const generated = buildPhysicalContext(marine, regions)
  if (!generated.some(({ properties }) => properties.kind === 'gulf')) throw new Error('La fuente no contiene golfos europeos; se conserva el snapshot anterior')
  const existing = snapshot.features.filter(({ properties }) => !(properties.sourceId === 'natural-earth' && ['bay', 'gulf', 'delta'].includes(properties.kind)))
  snapshot.features = [...existing, ...generated]
  await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, 'utf8')
  console.log(`Contexto físico actualizado: ${generated.length} golfos, bahías y deltas de Natural Earth.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1 })
}
