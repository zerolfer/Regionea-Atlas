import { createHash } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildRiverFeatures, fetchJson, fetchRiverCollection } from './sync-atlas-data.mjs'

const ATLAS = path.join(process.cwd(), 'public', 'data', 'atlas')
const read = async file => JSON.parse(await readFile(path.join(ATLAS, file), 'utf8'))

export function replaceRiverSnapshot(asturias, catalog, rivers) {
  const incomingIds = new Set(rivers.map(f => f.id))
  const previousRiverIds = new Set(asturias.features.filter(f => f.properties.kind === 'river').map(f => f.id))
  const references = new Map(asturias.features.filter(f => incomingIds.has(f.id) && f.properties.geometryId).map(f => [f.id, f.properties]))
  const aliases = new Map(catalog.physical.filter(f => incomingIds.has(f.id) && f.geometryId).map(f => [f.id, f]))
  asturias.features = [
    ...asturias.features.filter(f => !previousRiverIds.has(f.id) && !incomingIds.has(f.id)),
    ...rivers.map(f => {
      const previous = references.get(f.id)
      return previous ? { ...f, properties: { ...f.properties, kind: previous.kind, geometryId: previous.geometryId } } : f
    }),
  ]
  catalog.physical = [
    ...catalog.physical.filter(f => !previousRiverIds.has(f.id) && !incomingIds.has(f.id)),
    ...rivers.map(f => aliases.get(f.id) || f.properties),
  ]
}

async function main() {
  // Fetch and validate the entire inventory first. A failed source cannot erase
  // or partially replace the last valid local collection.
  const raw = await fetchRiverCollection(fetchJson)
  const rivers = buildRiverFeatures(raw.features)
  if (rivers.length !== raw.coverage.featureCount || new Set(rivers.map(f => f.id)).size !== rivers.length) throw new Error('Cobertura fluvial incompleta')
  const [asturias, catalog, manifest] = await Promise.all([read('physical/asturias.geojson'), read('catalog.json'), read('manifest.json')])
  replaceRiverSnapshot(asturias, catalog, rivers)
  const boxes = asturias.features.map(f => f.properties.bbox)
  const bounds = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
  const candidates = [['physical/asturias.geojson', asturias], ['catalog.json', catalog]]
  const serialized = candidates.map(([file, value]) => {
    const body = `${JSON.stringify(value)}\n`
    const metadata = { bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') }
    Object.assign(manifest.collections[file === 'catalog.json' ? 'catalog' : 'physicalAsturias'], metadata,
      file === 'catalog.json' ? { count: catalog.territories.length + catalog.physical.length } : { count: asturias.features.length, bounds, riverCoverage: raw.coverage })
    return [file, body]
  })
  manifest.version = new Date().toISOString().slice(0, 10)
  manifest.generatedAt = new Date().toISOString()
  serialized.push(['manifest.json', `${JSON.stringify(manifest)}\n`])
  // Preserve recoverable originals for local publication failures. Manifest is
  // promoted last; these fixed snapshot URLs are not a remote atomic store.
  const originals = await Promise.all(serialized.map(async ([file]) => [file, await readFile(path.join(ATLAS, file))]))
  const suffix = `.rivers-${process.pid}.tmp`
  await Promise.all(serialized.map(([file, body]) => writeFile(path.join(ATLAS, file + suffix), body)))
  try {
    for (const [file] of serialized) await rename(path.join(ATLAS, file + suffix), path.join(ATLAS, file))
  } catch (error) {
    await Promise.all(originals.map(([file, body]) => writeFile(path.join(ATLAS, file), body)))
    throw error
  }
  console.log(`Red fluvial: ${rivers.length} tramos oficiales; ${rivers.filter(f => !f.properties.name).length} sin topónimo. Inventario comprobado antes de publicar.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
