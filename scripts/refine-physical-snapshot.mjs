import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { beachDisplayName } from './sync-physical-coast.mjs'
import { geometryRole, matchingCoastalArea } from './lib/coastal-areas.mjs'
import { physicalLabelCollection as labelCollection } from './lib/physical-labels.mjs'
import { promoteSnapshotFiles } from './lib/snapshot-publication.mjs'

const ROOT = process.cwd()
const ATLAS = path.join(ROOT, 'public', 'data', 'atlas')
const publicationFiles = []

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalize(value) {
  return cleanName(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
}

function bounds(features) {
  const boxes = features.map((feature) => feature.properties.bbox).filter(Boolean)
  return [
    Math.min(...boxes.map((box) => box[0])), Math.min(...boxes.map((box) => box[1])),
    Math.max(...boxes.map((box) => box[2])), Math.max(...boxes.map((box) => box[3])),
  ]
}

async function read(relativePath) {
  return JSON.parse(await readFile(path.join(ATLAS, relativePath), 'utf8'))
}

async function write(relativePath, value) {
  const body = `${JSON.stringify(value)}\n`
  const target = path.join(ATLAS, relativePath), temporary = `${target}.refine-${process.pid}.tmp`
  await writeFile(temporary, body, 'utf8')
  publicationFiles.push({ target, temporary })
  return { bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') }
}

const [asturias, europe, coastalAreas, catalog, manifest] = await Promise.all([
  read('physical/asturias.geojson'), read('physical/europe.geojson'), read('physical/coastal-areas.geojson'), read('catalog.json'), read('manifest.json'),
])

asturias.features.forEach((feature) => {
  feature.properties.name = cleanName(feature.properties.name)
  feature.properties.localName = cleanName(feature.properties.localName || feature.properties.name)
  if (feature.properties.kind === 'beach') {
    feature.properties.name = beachDisplayName(feature.properties.localName)
    feature.properties.slug = normalize(feature.properties.name).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    feature.properties.aliases = [...new Set([...(feature.properties.aliases || []), feature.properties.localName])].filter((name) => name !== feature.properties.name)
  }
})

const protectedSites = new Map(asturias.features.filter(f => f.id.startsWith('physical-as-protected-site-')).map(f => [f.id, f]))
for (const feature of [...asturias.features, ...europe.features, ...coastalAreas.features]) {
  feature.properties.geometryRole = ['peak', 'range'].includes(feature.properties.kind) && feature.geometry.type === 'Point' ? 'label' : geometryRole(feature)
  const area = matchingCoastalArea(feature, coastalAreas.features)
  if (area) {
    feature.properties.geometryId = area.id
    feature.properties.kind = area.properties.kind
    area.properties.aliases = [...new Set([...area.properties.aliases, feature.properties.name,
      feature.properties.localName, ...(feature.properties.aliases || [])])].filter((name) => name && name !== area.properties.name)
  }
  else if (!protectedSites.has(feature.properties.geometryId)) delete feature.properties.geometryId
}
const asturiasLabels = labelCollection(asturias.features, (feature) => feature.properties.kind !== 'river' && !feature.properties.geometryId)
const europeLabels = labelCollection(europe.features, (feature) => feature.properties.kind !== 'river')
const coastalLabels = labelCollection(coastalAreas.features, () => true)
const areasById = new Map([...coastalAreas.features, ...protectedSites.values()].map((feature) => [feature.id, feature]))
catalog.physical = [...europe.features, ...asturias.features, ...coastalAreas.features].map((feature) => {
  const area = areasById.get(feature.properties.geometryId)
  if (!area) return { ...feature.properties }
  // Keep every published gazetteer ID usable in shared URLs, while directing
  // selection/camera to the canonical named water surface. No duplicate search results.
  return { ...area.properties, id: feature.id, slug: feature.properties.slug, name: feature.properties.name,
    localName: feature.properties.localName, aliases: feature.properties.aliases, legacyIds: feature.properties.legacyIds, memberIds: undefined, geometryId: area.id }
})

const asturiasFile = await write('physical/asturias.geojson', asturias)
const europeFile = await write('physical/europe.geojson', europe)
const coastalFile = await write('physical/coastal-areas.geojson', coastalAreas)
const coastalLabelsFile = await write('physical/labels-coastal-areas.geojson', coastalLabels)
const asturiasLabelsFile = await write('physical/labels-asturias.geojson', asturiasLabels)
const europeLabelsFile = await write('physical/labels-europe.geojson', europeLabels)
const catalogFile = await write('catalog.json', catalog)

Object.assign(manifest.collections.physicalAsturias, asturiasFile, { count: asturias.features.length, bounds: bounds(asturias.features) })
Object.assign(manifest.collections.physicalEurope, europeFile, { count: europe.features.length, bounds: bounds(europe.features) })
Object.assign(manifest.collections.physicalCoastalAreas, coastalFile)
Object.assign(manifest.collections.catalog, catalogFile, { count: catalog.territories.length + catalog.physical.length })
manifest.collections.catalog.sourceIds = [...new Set(catalog.physical.map(({ sourceId }) => sourceId).concat(manifest.collections.catalog.sourceIds))]
manifest.collections.physicalAsturiasLabels = {
  url: '/data/atlas/physical/labels-asturias.geojson', ...asturiasLabelsFile, count: asturiasLabels.features.length,
  sourceIds: ['sitpa-physical'], license: 'CC BY 4.0', bounds: bounds(asturiasLabels.features), minZoom: 7.5, maxZoom: 24,
}
manifest.collections.physicalEuropeLabels = {
  url: '/data/atlas/physical/labels-europe.geojson', ...europeLabelsFile, count: europeLabels.features.length,
  sourceIds: ['natural-earth'], license: 'Public domain', bounds: bounds(europeLabels.features), minZoom: 2, maxZoom: 24,
}
manifest.collections.physicalCoastalAreasLabels = {
  url: '/data/atlas/physical/labels-coastal-areas.geojson', ...coastalLabelsFile, count: coastalLabels.features.length,
  sourceIds: manifest.collections.physicalCoastalAreas.sourceIds, license: 'CC BY 4.0', bounds: bounds(coastalLabels.features), minZoom: 5, maxZoom: 24,
}
manifest.version = new Date().toISOString().slice(0, 10)
manifest.generatedAt = new Date().toISOString()
await write('manifest.json', manifest)
await promoteSnapshotFiles(publicationFiles)

process.stdout.write(`Atlas físico refinado: ${asturias.features.length} accidentes y ${asturiasLabels.features.length + europeLabels.features.length} etiquetas únicas.\n`)
