import AdmZip from 'adm-zip'
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { feedFreshness, parseGtfsTime } from '../api/_lib/gtfs-schedule.mjs'
import { classifyRoute, transitClassificationManifest } from './lib/transit-classification.mjs'

const DEFAULT_COVERAGE = { id: 'es-as', bounds: [-7.25, 42.9, -4.45, 43.75], contextBounds: [-7.5, 42.72, -4.2, 43.93] }
const OUTPUT = path.join(process.cwd(), 'public', 'data', 'atlas', 'transit')
const PROVIDER_COLORS = { cta: '#327d70', alsa: '#386a9c', renfe: '#8b2f45' }

function parseArgs() {
  const args = process.argv.slice(2)
  const feeds = []
  const coverage = structuredClone(DEFAULT_COVERAGE)
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--feed' && args[index + 1]) feeds.push(args[++index])
    else if (args[index] === '--coverage-id' && args[index + 1]) coverage.id = args[++index]
    else if (args[index] === '--coverage-bounds' && args[index + 1]) coverage.bounds = parseBounds(args[++index], '--coverage-bounds')
    else if (args[index] === '--context-bounds' && args[index + 1]) coverage.contextBounds = parseBounds(args[++index], '--context-bounds')
  }
  if (!feeds.length) throw new Error('Uso: npm run data:import-gtfs -- --feed proveedor=ruta.zip [--coverage-id id --coverage-bounds oeste,sur,este,norte --context-bounds oeste,sur,este,norte]')
  return { coverage, feeds: feeds.map((feed) => {
    const separator = feed.indexOf('=')
    if (separator < 1) throw new Error(`Feed no válido: ${feed}`)
    return { provider: feed.slice(0, separator).toLowerCase(), file: feed.slice(separator + 1) }
  }) }
}

function parseBounds(value, flag) {
  const bounds = String(value).split(',').map(Number)
  if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) {
    throw new Error(`${flag} debe tener el formato oeste,sur,este,norte`)
  }
  return bounds
}

function parseCsv(text) {
  const rows = []
  forEachCsvRow(text, (row) => rows.push(row))
  return rows
}

function forEachCsvRow(text, visitor) {
  let headers = null
  let row = []
  let field = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '')
  const emitRow = () => {
    row.push(field)
    field = ''
    if (row.some((value) => value !== '')) {
      if (!headers) headers = row.map((header) => header.trim())
      else visitor(Object.fromEntries(headers.map((header, column) => [header, (row[column] ?? '').trim()])))
    }
    row = []
  }
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      emitRow()
    } else field += char
  }
  if (field || row.length) emitRow()
}

function findEntry(zip, name) {
  return zip.getEntries().find((candidate) => candidate.entryName.toLowerCase().endsWith(`/${name}`) || candidate.entryName.toLowerCase() === name)
}

function readTableText(zip, name, required = true) {
  const entry = findEntry(zip, name)
  if (!entry) {
    if (required) throw new Error(`Falta ${name} en el GTFS`)
    return ''
  }
  return entry.getData().toString('utf8')
}

function readTable(zip, name, required = true) {
  const text = readTableText(zip, name, required)
  return text ? parseCsv(text) : []
}

function stopInCoverage(stop, bounds) {
  const longitude = Number(stop.stop_lon)
  const latitude = Number(stop.stop_lat)
  return longitude >= bounds[0] && longitude <= bounds[2] && latitude >= bounds[1] && latitude <= bounds[3]
}

function positionInBounds([longitude, latitude], bounds) {
  return longitude >= bounds[0] && longitude <= bounds[2]
    && latitude >= bounds[1] && latitude <= bounds[3]
}

function routeColor(route, provider) {
  const color = String(route.route_color || '').replace('#', '')
  return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : PROVIDER_COLORS[provider] || '#326b89'
}

function transportMode(route, provider) {
  const routeType = Number(route.route_type)
  if (routeType === 4 || (routeType >= 1000 && routeType < 1100)) return 'ferry'
  if (routeType >= 1100 && routeType < 1200) return 'air'
  if ([0, 1, 2, 5, 6, 7, 11, 12].includes(routeType) || provider === 'renfe') return 'rail'
  return 'bus'
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function squareSegmentDistance(point, start, end) {
  let x = start[0]
  let y = start[1]
  let dx = end[0] - x
  let dy = end[1] - y
  if (dx || dy) {
    const position = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)
    if (position > 1) { x = end[0]; y = end[1] }
    else if (position > 0) { x += dx * position; y += dy * position }
  }
  dx = point[0] - x
  dy = point[1] - y
  return dx * dx + dy * dy
}

function simplifyLine(points, tolerance = 0.00008) {
  const coordinates = points.filter((point, index) => index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1])
  if (coordinates.length <= 2) return coordinates
  const markers = new Uint8Array(coordinates.length)
  const stack = [0, coordinates.length - 1]
  const squareTolerance = tolerance * tolerance
  markers[0] = markers[coordinates.length - 1] = 1
  while (stack.length) {
    const last = stack.pop()
    const first = stack.pop()
    let maximum = 0
    let selected = 0
    for (let index = first + 1; index < last; index += 1) {
      const distance = squareSegmentDistance(coordinates[index], coordinates[first], coordinates[last])
      if (distance > maximum) { maximum = distance; selected = index }
    }
    if (maximum > squareTolerance) {
      markers[selected] = 1
      stack.push(first, selected, selected, last)
    }
  }
  return coordinates.filter((_, index) => markers[index])
}

function buildSchedule(calendarRows, exceptionRows, feedInfo, relevantServiceIds) {
  const calendars = Object.fromEntries(calendarRows
    .filter((row) => relevantServiceIds.has(row.service_id))
    .map((row) => [row.service_id, {
      startDate: row.start_date,
      endDate: row.end_date,
      weekdays: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => [day, row[day] === '1'])),
    }]))
  const exceptions = {}
  exceptionRows.filter((row) => relevantServiceIds.has(row.service_id)).forEach((row) => {
    const entry = exceptions[row.date] || { added: [], removed: [] }
    const target = row.exception_type === '1' ? entry.added : entry.removed
    if (!target.includes(row.service_id)) target.push(row.service_id)
    exceptions[row.date] = entry
  })
  const allDates = [
    ...Object.values(calendars).flatMap(({ startDate, endDate }) => [startDate, endDate]),
    ...Object.keys(exceptions),
  ].filter(Boolean).sort()
  const declared = feedInfo[0] || {}
  const feedStartDate = declared.feed_start_date || allDates[0] || null
  const feedEndDate = declared.feed_end_date || allDates.at(-1) || null
  return {
    status: feedFreshness(feedEndDate),
    feedStartDate,
    feedEndDate,
    calendars,
    exceptions,
  }
}

function normalizeFeed({ provider, file }, coverage) {
  const zip = new AdmZip(file)
  const routes = readTable(zip, 'routes.txt')
  const stops = readTable(zip, 'stops.txt')
  const trips = readTable(zip, 'trips.txt')
  const feedInfo = readTable(zip, 'feed_info.txt', false)
  const stopTimesText = readTableText(zip, 'stop_times.txt')
  const coverageStops = new Set(stops.filter((stop) => stopInCoverage(stop, coverage.bounds)).map((stop) => stop.stop_id))
  const relevantTrips = new Set()
  forEachCsvRow(stopTimesText, (time) => {
    if (coverageStops.has(time.stop_id)) relevantTrips.add(time.trip_id)
  })
  const relevantTripRows = trips.filter((trip) => relevantTrips.has(trip.trip_id))
  const tripById = new Map(relevantTripRows.map((trip) => [trip.trip_id, trip]))
  const relevantRoutes = new Set(relevantTripRows.map((trip) => trip.route_id))
  const relevantServiceIds = new Set(relevantTripRows.map((trip) => trip.service_id))
  const calendarRows = readTable(zip, 'calendar.txt', false).filter((row) => relevantServiceIds.has(row.service_id))
  const exceptionRows = []
  const exceptionsText = readTableText(zip, 'calendar_dates.txt', false)
  if (exceptionsText) forEachCsvRow(exceptionsText, (row) => {
    if (relevantServiceIds.has(row.service_id)) exceptionRows.push(row)
  })
  const schedule = buildSchedule(calendarRows, exceptionRows, feedInfo, relevantServiceIds)
  const relevantShapes = new Set(relevantTripRows.map((trip) => trip.shape_id).filter(Boolean))
  const routeById = new Map(routes.filter((route) => relevantRoutes.has(route.route_id)).map((route) => [route.route_id, route]))
  const stopById = new Map(stops.map((stop) => [stop.stop_id, stop]))
  const shapePoints = new Map()
  const shapesText = readTableText(zip, 'shapes.txt', false)
  if (shapesText) forEachCsvRow(shapesText, (point) => {
    if (!relevantShapes.has(point.shape_id)) return
    const list = shapePoints.get(point.shape_id) || []
    list.push(point)
    shapePoints.set(point.shape_id, list)
  })
  const stopFeatures = stops.filter((stop) => coverageStops.has(stop.stop_id)).map((stop) => ({
    type: 'Feature',
    properties: {
      id: `${provider}:${stop.stop_id}`, entityType: 'stop', provider: provider.toUpperCase(), freshness: schedule.status,
      name: cleanText(stop.stop_name) || stop.stop_id, color: PROVIDER_COLORS[provider] || '#326b89',
      transportMode: provider === 'renfe' ? 'rail' : 'bus',
    },
    geometry: { type: 'Point', coordinates: [Number(stop.stop_lon), Number(stop.stop_lat)] },
  }))
  const departures = {}
  const departureKeys = new Map()
  const tripStopPoints = new Map()
  const routeStopIds = new Map()
  forEachCsvRow(stopTimesText, (time) => {
    if (!relevantTrips.has(time.trip_id)) return
    const trip = tripById.get(time.trip_id)
    const stop = stopById.get(time.stop_id)
    if (trip?.route_id) {
      const stopIds = routeStopIds.get(trip.route_id) || new Set()
      stopIds.add(time.stop_id)
      routeStopIds.set(trip.route_id, stopIds)
    }
    if (stop) {
      const coordinates = [Number(stop.stop_lon), Number(stop.stop_lat)]
      if (coordinates.every(Number.isFinite)) {
        const points = tripStopPoints.get(time.trip_id) || []
        points.push({ sequence: Number(time.stop_sequence), coordinates })
        tripStopPoints.set(time.trip_id, points)
      }
    }
    if (!coverageStops.has(time.stop_id)) return
    const route = routeById.get(trip?.route_id) || {}
    const id = `${provider}:${time.stop_id}`
    const list = departures[id] || []
    const departureKey = `${time.trip_id}:${time.stop_sequence}:${time.departure_time || time.arrival_time}`
    const keys = departureKeys.get(id) || new Set()
    if (!keys.has(departureKey)) list.push({
      route: cleanText(route.route_short_name) || trip?.route_id || '', destination: cleanText(trip?.trip_headsign) || cleanText(route.route_long_name),
      scheduledTime: time.departure_time || time.arrival_time, freshness: 'scheduled', serviceId: trip?.service_id,
      scheduledSeconds: parseGtfsTime(time.departure_time || time.arrival_time), tripId: time.trip_id,
      stopSequence: Number(time.stop_sequence) || null,
    })
    keys.add(departureKey)
    departureKeys.set(id, keys)
    departures[id] = list
  })
  Object.values(departures).forEach((items) => {
    items.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
  })
  const routeFeatures = []
  const tripsByRoute = new Map()
  relevantTripRows.forEach((trip) => {
    const routeTrips = tripsByRoute.get(trip.route_id) || []
    routeTrips.push(trip)
    tripsByRoute.set(trip.route_id, routeTrips)
  })
  tripsByRoute.forEach((routeTrips, routeId) => {
    const trip = routeTrips[0]
    const route = routeById.get(trip.route_id) || {}
    const variants = []
    const seenVariants = new Set()
    routeTrips.forEach((candidate) => {
      const variantId = candidate.shape_id || `stops:${candidate.trip_id}`
      if (seenVariants.has(variantId)) return
      seenVariants.add(variantId)
      const points = (shapePoints.get(candidate.shape_id) || []).sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
      const shapeCoordinates = points.map((point) => [Number(point.shape_pt_lon), Number(point.shape_pt_lat)]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
      const fallbackCoordinates = (tripStopPoints.get(candidate.trip_id) || []).sort((a, b) => a.sequence - b.sequence).map((point) => point.coordinates)
      const coordinates = shapeCoordinates.length >= 2 ? shapeCoordinates : fallbackCoordinates
      if (coordinates.length >= 2) variants.push(coordinates)
    })
    if (!variants.length) return
    const representative = variants.reduce((longest, coordinates) => coordinates.length > longest.length ? coordinates : longest, variants[0])
    const contextualCoordinates = provider === 'alsa' ? representative.filter((position) => positionInBounds(position, coverage.contextBounds)) : representative
    const coordinates = simplifyLine(contextualCoordinates)
    if (coordinates.length < 2) return
    const classification = classifyRoute(variants, { stopCount: routeStopIds.get(routeId)?.size || 0 })
    routeFeatures.push({
      type: 'Feature',
      properties: {
        id: `${provider}:${routeId}`, entityType: 'route', provider: provider.toUpperCase(), freshness: schedule.status,
        name: cleanText(route.route_long_name) || cleanText(route.route_short_name) || cleanText(trip.trip_headsign) || routeId,
        shortName: cleanText(route.route_short_name), color: routeColor(route, provider),
        routeType: Number(route.route_type), transportMode: transportMode(route, provider), ...classification,
      },
      geometry: { type: 'LineString', coordinates },
    })
  })
  return { provider, routeFeatures, stopFeatures, departures, schedule }
}

async function writeAtomic(name, value) {
  const target = path.join(OUTPUT, name)
  await mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.next`
  await writeFile(temporary, `${JSON.stringify(value)}\n`, 'utf8')
  await rename(temporary, target)
}

function departureFilename(id) {
  return `${encodeURIComponent(id).replaceAll('%', '_')}.json`
}

async function writeDepartures(departures) {
  const entries = Object.entries(departures)
  for (let index = 0; index < entries.length; index += 100) {
    await Promise.all(entries.slice(index, index + 100).map(([stopId, items]) => (
      writeAtomic(`departures/${departureFilename(stopId)}`, { stopId, departures: items })
    )))
  }
  await unlink(path.join(OUTPUT, 'departures.json')).catch((error) => {
    if (error.code !== 'ENOENT') throw error
  })
}

async function main() {
  const { feeds, coverage } = parseArgs()
  const normalized = feeds.map((feed) => normalizeFeed(feed, coverage))
  const routes = normalized.flatMap((feed) => feed.routeFeatures)
  const stops = normalized.flatMap((feed) => feed.stopFeatures)
  const departures = Object.assign({}, ...normalized.map((feed) => feed.departures))
  const providers = Object.fromEntries(normalized.map((feed) => [feed.provider, feed.schedule]))
  const status = Object.values(providers).some((feed) => feed.status === 'stale') ? 'stale' : 'scheduled'
  await writeAtomic('routes.geojson', { type: 'FeatureCollection', features: routes })
  await writeAtomic('stops.geojson', { type: 'FeatureCollection', features: stops })
  await writeAtomic('vehicles.geojson', { type: 'FeatureCollection', features: [] })
  await writeDepartures(departures)
  await writeAtomic('schedule.json', { generatedAt: new Date().toISOString(), providers })
  await writeAtomic('manifest.json', { generatedAt: new Date().toISOString(), status, routes: routes.length, stops: stops.length, departureStops: Object.keys(departures).length, coverage, classification: transitClassificationManifest(), providers: Object.fromEntries(Object.entries(providers).map(([id, feed]) => [id, { status: feed.status, feedStartDate: feed.feedStartDate, feedEndDate: feed.feedEndDate }])) })
  process.stdout.write(`GTFS importado: ${routes.length} líneas y ${stops.length} paradas para ${coverage.id}.\n`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
