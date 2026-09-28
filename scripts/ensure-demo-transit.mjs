import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { classifyRoute, transitClassificationManifest } from './lib/transit-classification.mjs'

const output = path.join(process.cwd(), 'public', 'data', 'atlas', 'transit')
const INITIAL_COVERAGE = { id: 'es-as', bounds: [-7.25, 42.9, -4.45, 43.75], contextBounds: [-7.5, 42.72, -4.2, 43.93] }

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

async function write(name, value) {
  await mkdir(path.dirname(path.join(output, name)), { recursive: true })
  await writeFile(path.join(output, name), `${JSON.stringify(value)}\n`, 'utf8')
}

function departureFilename(id) {
  return `${encodeURIComponent(id).replaceAll('%', '_')}.json`
}

async function main() {
  await mkdir(output, { recursive: true })
  if (await exists(path.join(output, 'routes.geojson'))) {
    process.stdout.write('Transporte: se conserva el snapshot existente.\n')
    return
  }
  const routes = [
    ['renfe:c1-demo', 'C1 Gijón–Oviedo', 'Renfe', '#8b2f45', [[-5.6764, 43.5364], [-5.695, 43.49], [-5.79, 43.44], [-5.854, 43.366]]],
    ['renfe:c2-demo', 'C2 Oviedo–Mieres', 'Renfe', '#9f6a24', [[-5.854, 43.366], [-5.82, 43.32], [-5.778, 43.251]]],
    ['cta:centro-demo', 'Eje central CTA', 'CTA', '#327d70', [[-5.6764, 43.5364], [-5.75, 43.47], [-5.854, 43.366]]],
    ['alsa:a8-demo', 'Gijón–Avilés–Aeropuerto', 'ALSA', '#386a9c', [[-5.6764, 43.5364], [-5.79, 43.55], [-5.9222, 43.555], [-6.0346, 43.5636]]],
  ].map(([id, name, provider, color, coordinates]) => ({
    type: 'Feature', properties: { id, entityType: 'route', name, provider, freshness: 'demo', color, transportMode: provider === 'Renfe' ? 'rail' : 'bus', ...classifyRoute(coordinates, { basis: 'published-geometry' }) },
    geometry: { type: 'LineString', coordinates },
  }))
  const stops = [
    ['renfe:gijon-demo', 'Gijón / Xixón', 'Renfe', '#8b2f45', [-5.6764, 43.5364]],
    ['renfe:oviedo-demo', 'Oviedo / Uviéu', 'Renfe', '#8b2f45', [-5.854, 43.366]],
    ['renfe:mieres-demo', 'Mieres del Camín', 'Renfe', '#9f6a24', [-5.778, 43.251]],
    ['alsa:aviles-demo', 'Avilés', 'ALSA', '#386a9c', [-5.9222, 43.555]],
    ['alsa:aeropuerto-demo', 'Aeropuerto de Asturias', 'ALSA', '#386a9c', [-6.0346, 43.5636]],
  ].map(([id, name, provider, color, coordinates]) => ({
    type: 'Feature', properties: { id, entityType: 'stop', name, provider, freshness: 'demo', color, transportMode: provider === 'Renfe' ? 'rail' : 'bus' },
    geometry: { type: 'Point', coordinates },
  }))
  const departures = {
    'renfe:gijon-demo': [{ route: 'C1', destination: 'Oviedo / Uviéu', scheduledTime: '10:12', freshness: 'demo' }],
    'renfe:oviedo-demo': [{ route: 'C1', destination: 'Gijón / Xixón', scheduledTime: '10:08', freshness: 'demo' }],
    'renfe:mieres-demo': [{ route: 'C2', destination: 'Oviedo / Uviéu', scheduledTime: '10:18', freshness: 'demo' }],
    'alsa:aviles-demo': [{ route: 'ALSA', destination: 'Aeropuerto de Asturias', scheduledTime: '10:35', freshness: 'demo' }],
    'alsa:aeropuerto-demo': [{ route: 'ALSA', destination: 'Gijón / Xixón', scheduledTime: '11:00', freshness: 'demo' }],
  }
  await Promise.all([
    write('routes.geojson', { type: 'FeatureCollection', features: routes }),
    write('stops.geojson', { type: 'FeatureCollection', features: stops }),
    write('vehicles.geojson', { type: 'FeatureCollection', features: [] }),
    ...Object.entries(departures).map(([stopId, items]) => write(`departures/${departureFilename(stopId)}`, { stopId, departures: items })),
    write('manifest.json', { generatedAt: new Date().toISOString(), status: 'demo', routes: routes.length, stops: stops.length, coverage: INITIAL_COVERAGE, classification: transitClassificationManifest(), providers: { cta: { status: 'demo' }, alsa: { status: 'demo' }, renfe: { status: 'demo' } } }),
  ])
  process.stdout.write('Transporte: snapshot de demostración creado.\n')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
