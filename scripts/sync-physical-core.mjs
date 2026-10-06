import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchPhysicalCore, PHYSICAL_CORE_SOURCES } from './sync-atlas-data.mjs'
import { promoteSnapshotFiles } from './lib/snapshot-publication.mjs'

const ATLAS = path.join(process.cwd(), 'public', 'data', 'atlas')

async function main() {
  // Complete and validate every source before replacing any local snapshot.
  const core = await fetchPhysicalCore()
  if (!core.features.length) throw new Error('Fuentes físicas vacías; se conserva el snapshot anterior')
  const names = ['physical/asturias.geojson', 'catalog.json', 'manifest.json']
  const originals = await Promise.all(names.map(file => readFile(path.join(ATLAS, file))))
  const [asturias, catalog, manifest] = originals.map(body => JSON.parse(body.toString()))
  const prefixes = PHYSICAL_CORE_SOURCES.map(d => `physical-as-${d.kind}-${d.namespace}-`)
  const belongsToCore = id => id.startsWith('physical-as-protected-site-') || prefixes.some(prefix => id.startsWith(prefix))
  asturias.features = [...asturias.features.filter(f => !belongsToCore(f.id)), ...core.features]
  catalog.physical = [...catalog.physical.filter(f => !belongsToCore(f.id)), ...core.features.map(f => f.properties)]
  manifest.collections.physicalAsturias.sourceCoverage = { ...manifest.collections.physicalAsturias.sourceCoverage, ...core.coverage }
  const boxes = asturias.features.map(f => f.properties.bbox)
  manifest.collections.physicalAsturias.bounds = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
  const bodies = [asturias, catalog].map((value, index) => {
    const body = `${JSON.stringify(value)}\n`
    const metadata = manifest.collections[index === 0 ? 'physicalAsturias' : 'catalog']
    Object.assign(metadata, { count: index === 0 ? asturias.features.length : catalog.territories.length + catalog.physical.length,
      bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') })
    return body
  })
  manifest.generatedAt = new Date().toISOString()
  manifest.version = manifest.generatedAt.slice(0, 10)
  bodies.push(`${JSON.stringify(manifest)}\n`)
  const suffix = `.core-${process.pid}.tmp`
  await Promise.all(names.map((file, index) => writeFile(path.join(ATLAS, file + suffix), bodies[index])))
  await promoteSnapshotFiles(names.map(file => ({ target: path.join(ATLAS, file), temporary: path.join(ATLAS, file + suffix) })))
  for (const [namespace, coverage] of Object.entries(core.coverage)) console.log(`${namespace}: ${coverage.featureCount} registros, inventario completo comprobado.`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
