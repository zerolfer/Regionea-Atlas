import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import AdmZip from 'adm-zip'
import { open } from 'shapefile'
import { simplifyGeometry } from './sync-atlas-data.mjs'
import { geometryBox, parseDeltaUnits, detailedDeltaGeometry, reprojectGeometry } from './lib/coastal-areas.mjs'

const ATLAS = path.join(process.cwd(), 'public', 'data', 'atlas')
const AREA_FILE = path.join(ATLAS, 'physical', 'coastal-areas.geojson')
const ICGC = 'https://geoserveis.icgc.cat/icgc_lifeebro/wms/service'
const SOURCES = [
  { id: 'icgc-life-ebro', title: 'ICGC — LIFE EBRO, ambientes sedimentarios modernos', url: 'https://www.icgc.cat/es/Geoinformacion-y-mapas/Servicios-en-linea-Geoservicios/WMS-Geoindex/WMS-Proyecto-Life-EBRO', license: 'CC BY 4.0' },
  { id: 'miteco-water-2027', title: '© Ministerio para la Transición Ecológica y el Reto Demográfico — Masas de agua PHC 2022–2027', url: 'https://www.miteco.gob.es/es/cartografia-y-sig/ide/descargas/agua/masas-de-agua-phc-2022-2027.html', license: 'CC BY 4.0' },
]

function areaFeature(id, name, kind, sourceId, geometry, extras = {}) {
  const cleaned = simplifyGeometry(geometry, 0.00003)
  const bbox = geometryBox(cleaned)
  return { type: 'Feature', id, geometry: cleaned, properties: {
    id, name, slug: name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    aliases: [], kind, sourceId, geometryRole: 'area', boundaryStatus: 'reference',
    bbox, center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], ...extras,
  } }
}

export async function importWaterAreas(buffer) {
  const zip = new AdmZip(buffer)
  const shp = zip.getEntries().find(({ entryName }) => entryName.endsWith('.shp'))
  if (!shp) throw new Error('No hay Shapefile en el ZIP hidrológico')
  const base = shp.entryName.slice(0, -4)
  const dbf = zip.getEntry(`${base}.dbf`), prj = zip.getEntry(`${base}.prj`), cpg = zip.getEntry(`${base}.cpg`)
  if (!dbf || !prj || !cpg) throw new Error('Faltan atributos, CRS o codificación en el ZIP hidrológico')
  const source = await open(shp.getData(), dbf.getData(), { encoding: cpg.getData().toString().trim() })
  const definition = prj.getData().toString()
  const result = [], seen = new Set()
  for (let record = await source.read(); !record.done; record = await source.read()) {
    const feature = record.value, p = feature.properties
    if (p.Categoria !== 'Transición' || !/^(ría|estuario|bahía)\b/iu.test(p.NombreMasa || '')) continue
    if (!p.CodMasa || seen.has(p.CodMasa) || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) throw new Error('Masa de transición inválida o duplicada')
    seen.add(p.CodMasa)
    if (p.versionId !== '2023-09-25') throw new Error('Ha cambiado la edición hidrológica: revise metadatos antes de publicar')
    result.push(areaFeature(`physical-es-water-${p.CodMasa}`, p.NombreMasa, /^bahía/iu.test(p.NombreMasa) ? 'bay' : 'estuary',
      'miteco-water-2027', reprojectGeometry(feature.geometry, definition), {
        aliases: [p.NombreInt].filter((name) => name && name !== 'NotApplicable'), referenceYear: 2023,
        geometryNote: 'Superficie de la masa de agua de transición del plan hidrológico 2022–2027. No delimita todo el paisaje de la ría ni sus terrenos ribereños.',
        sourceCode: p.CodMasa, sourceDate: p.versionId,
      }))
  }
  if (!result.length) throw new Error('No se encontraron rías o bahías con superficie verificable')
  return result
}

async function importEbro() {
  async function query(bbox, pixels = 1) {
    const url = new URL(ICGC)
    url.search = new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetFeatureInfo', VERSION: '1.1.1',
      LAYERS: 'delta_enviro', QUERY_LAYERS: 'delta_enviro', STYLES: '', SRS: 'EPSG:4326',
      BBOX: bbox.join(','), WIDTH: String(pixels), HEIGHT: String(pixels), X: String(Math.floor(pixels / 2)), Y: String(Math.floor(pixels / 2)),
      FORMAT: 'image/png', INFO_FORMAT: 'text/xml', FEATURE_COUNT: '1000' })
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`ICGC: ${response.status}`)
    return parseDeltaUnits(await response.text())
  }
  // Metre-scale queries return full GML units, not clipping to the query box.
  const geometry = await detailedDeltaGeometry(query)
  const box = geometryBox(geometry)
  if (box[0] < 0.47 || box[2] > 1.15 || box[1] < 40.49 || box[3] > 40.85) throw new Error('El delta se sale de la cobertura del servicio')
  return areaFeature('physical-es-delta-ebro', 'Delta del Ebro', 'delta', 'icgc-life-ebro', geometry, {
    aliases: ["Delta de l'Ebre", 'Delta del Ebre', 'Ebro Delta'],
    sourceDate: '2021-02', referenceYear: 2021,
    geometryNote: 'Área de referencia formada por las unidades de llanura deltaica y marismas del mapa de ambientes sedimentarios modernos del ICGC (QHpd y QHm). No es el límite del parque natural ni incluye los depósitos marinos sumergidos.',
  })
}

async function main() {
  const flag = process.argv.indexOf('--water-zip')
  const local = flag >= 0 ? process.argv[flag + 1] : 'data/physical-sources/masas-agua-supp2022-27.zip'
  if (!local) throw new Error('Falta el valor de --water-zip')
  const manifest = JSON.parse(await readFile(path.join(ATLAS, 'manifest.json'), 'utf8'))
  let waters
  try { waters = await importWaterAreas(await readFile(local)) } catch (error) {
    if (error.code !== 'ENOENT' || flag >= 0) throw error
    const previous = JSON.parse(await readFile(AREA_FILE, 'utf8'))
    waters = previous.features.filter(({ properties }) => properties.sourceId === 'miteco-water-2027')
    if (!waters.length) throw new Error('Descargue el ZIP oficial de MITECO y use --water-zip; no se publicarán superficies vacías')
    console.log('Se conserva la última importación hidrológica válida; la descarga de MITECO requiere verificación humana.')
  }
  const ebro = await importEbro()
  const features = [...waters, ebro]
  const body = `${JSON.stringify({ type: 'FeatureCollection', features })}\n`
  // Prepare and validate all inputs before touching the published snapshot.
  await writeFile(AREA_FILE, body)
  manifest.sources = [...manifest.sources.filter(({ id }) => !SOURCES.some((source) => source.id === id)), ...SOURCES]
  const boxes = features.map(({ properties }) => properties.bbox)
  manifest.collections.physicalCoastalAreas = {
    url: '/data/atlas/physical/coastal-areas.geojson', count: features.length,
    bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex'),
    sourceIds: SOURCES.map(({ id }) => id), license: 'CC BY 4.0', minZoom: 5, maxZoom: 24,
    bounds: [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))],
  }
  await writeFile(path.join(ATLAS, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
  console.log(`Superficies costeras: ${waters.length} masas de agua con nombre y el delta del Ebro.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1 })
}
