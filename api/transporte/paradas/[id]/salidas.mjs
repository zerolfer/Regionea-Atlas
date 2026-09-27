import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getRenfeRealtime } from '../../../_lib/renfe-realtime.mjs'
import { nextScheduledDepartures } from '../../../_lib/gtfs-schedule.mjs'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  const id = String(request.query?.id || '')
  if (!id) return response.status(400).json({ error: 'Falta el identificador de parada' })
  try {
    const filename = `${encodeURIComponent(id).replaceAll('%', '_')}.json`
    const file = path.join(process.cwd(), 'public', 'data', 'atlas', 'transit', 'departures', filename)
    const data = JSON.parse(await readFile(file, 'utf8'))
    const provider = id.split(':', 1)[0]
    let providerSchedule = null
    try {
      const scheduleFile = path.join(process.cwd(), 'public', 'data', 'atlas', 'transit', 'schedule.json')
      const schedule = JSON.parse(await readFile(scheduleFile, 'utf8'))
      providerSchedule = schedule.providers?.[provider] || null
    } catch {
      // Los snapshots de demostración anteriores no tienen calendario expandido.
    }
    const staticDepartures = data.departures || []
    const scheduled = providerSchedule ? nextScheduledDepartures(staticDepartures, providerSchedule) : staticDepartures
    const realtime = id.startsWith('renfe:') ? await getRenfeRealtime() : null
    const updates = realtime?.tripUpdates
      ?.flatMap((trip) => trip.stops.map((stop) => ({ ...stop, tripId: trip.tripId, routeId: trip.routeId })))
      .filter((stop) => stop.stopId === id) || []
    const departures = scheduled.map((departure) => {
      const update = updates.find((item) => !departure.tripId || item.tripId === departure.tripId)
      return {
        ...departure,
        freshness: update ? realtime.status : providerSchedule?.status || departure.freshness || 'scheduled',
        delaySeconds: update?.departureDelay ?? update?.arrivalDelay ?? null,
      }
    })
    return response.status(200).json({
      stopId: id,
      updatedAt: realtime?.updatedAt || new Date().toISOString(),
      status: realtime?.status === 'live' || realtime?.status === 'stale' ? realtime.status : providerSchedule?.status || 'scheduled',
      departures,
    })
  } catch (error) {
    return response.status(503).json({ stopId: id, departures: [], error: error.message })
  }
}
