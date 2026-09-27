import GtfsRealtimeBindings from 'gtfs-realtime-bindings'

let lastGood = null
let cachedResult = null
let lastFetch = 0
const CACHE_MS = 15_000
const DEFAULT_ENDPOINTS = {
  alerts: 'https://gtfsrt.renfe.com/alerts.pb',
  tripUpdates: 'https://gtfsrt.renfe.com/trip_updates.pb',
  vehiclePositions: 'https://gtfsrt.renfe.com/vehicle_positions.pb',
}

function asNumber(value) {
  if (typeof value === 'number') return value
  if (value && typeof value.toNumber === 'function') return value.toNumber()
  return Number(value || 0)
}

export function normalizeFeed(feed, now = new Date()) {
  const vehicles = []
  const alerts = []
  const tripUpdates = []
  for (const entity of feed.entity || []) {
    if (entity.vehicle?.position) {
      vehicles.push({
        id: `renfe:${entity.id}`, tripId: entity.vehicle.trip?.tripId || null,
        routeId: entity.vehicle.trip?.routeId ? `renfe:${entity.vehicle.trip.routeId}` : null,
        latitude: entity.vehicle.position.latitude, longitude: entity.vehicle.position.longitude,
        bearing: entity.vehicle.position.bearing ?? null, timestamp: asNumber(entity.vehicle.timestamp) || null,
      })
    }
    if (entity.tripUpdate) {
      tripUpdates.push({
        id: `renfe:${entity.id}`, tripId: entity.tripUpdate.trip?.tripId || null,
        routeId: entity.tripUpdate.trip?.routeId ? `renfe:${entity.tripUpdate.trip.routeId}` : null,
        timestamp: asNumber(entity.tripUpdate.timestamp) || null,
        stops: (entity.tripUpdate.stopTimeUpdate || []).map((stop) => ({
          stopId: stop.stopId ? `renfe:${stop.stopId}` : null,
          stopSequence: stop.stopSequence ?? null,
          arrivalDelay: stop.arrival?.delay ?? null,
          departureDelay: stop.departure?.delay ?? null,
        })),
      })
    }
    if (entity.alert) {
      alerts.push({
        id: `renfe:${entity.id}`,
        header: entity.alert.headerText?.translation?.[0]?.text || 'Aviso de servicio',
        description: entity.alert.descriptionText?.translation?.[0]?.text || '',
      })
    }
  }
  return { status: 'live', updatedAt: now.toISOString(), vehicles, alerts, tripUpdates }
}

export function mergeNormalizedFeeds(feeds, now = new Date(), status = 'live') {
  const byId = (items) => [...new Map(items.map((item) => [item.id, item])).values()]
  return {
    status,
    updatedAt: now.toISOString(),
    vehicles: byId(feeds.flatMap((feed) => feed.vehicles)),
    alerts: byId(feeds.flatMap((feed) => feed.alerts)),
    tripUpdates: byId(feeds.flatMap((feed) => feed.tripUpdates)),
  }
}

function endpointUrls() {
  if (process.env.RENFE_GTFS_RT_URL) return [process.env.RENFE_GTFS_RT_URL]
  return [
    process.env.RENFE_GTFS_RT_ALERTS_URL || DEFAULT_ENDPOINTS.alerts,
    process.env.RENFE_GTFS_RT_TRIP_UPDATES_URL || DEFAULT_ENDPOINTS.tripUpdates,
    process.env.RENFE_GTFS_RT_VEHICLE_POSITIONS_URL || DEFAULT_ENDPOINTS.vehiclePositions,
  ]
}

async function fetchFeed(url) {
  const upstream = await fetch(url, {
    headers: process.env.RENFE_GTFS_RT_TOKEN ? { Authorization: `Bearer ${process.env.RENFE_GTFS_RT_TOKEN}` } : {},
    signal: AbortSignal.timeout(8_000),
  })
  if (!upstream.ok) throw new Error(`Renfe respondió ${upstream.status}`)
  const buffer = new Uint8Array(await upstream.arrayBuffer())
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer)
}

export async function getRenfeRealtime() {
  if (cachedResult && Date.now() - lastFetch < CACHE_MS) return cachedResult
  const now = new Date()
  const results = await Promise.allSettled(endpointUrls().map(fetchFeed))
  const feeds = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => normalizeFeed(result.value, now))
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Error de conexión')
  lastFetch = Date.now()

  if (errors.length) {
    const reason = `Tiempo real parcial: ${errors.join('; ')}`
    cachedResult = lastGood
      ? { ...lastGood, status: 'stale', reason }
      : feeds.length
        ? { ...mergeNormalizedFeeds(feeds, now, 'stale'), reason }
        : { status: 'unavailable', updatedAt: null, vehicles: [], alerts: [], tripUpdates: [], reason }
    return cachedResult
  }

  lastGood = mergeNormalizedFeeds(feeds, now)
  cachedResult = lastGood
  return cachedResult
}
