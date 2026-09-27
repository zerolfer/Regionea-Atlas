import { describe, expect, it } from 'vitest'
import { mergeNormalizedFeeds, normalizeFeed } from './renfe-realtime.mjs'

describe('normalización GTFS-Realtime de Renfe', () => {
  it('normaliza vehículos, retrasos y avisos con IDs de proveedor', () => {
    const data = normalizeFeed({
      entity: [
        {
          id: 'vehicle-1',
          vehicle: { trip: { tripId: 'trip-1', routeId: 'C1' }, position: { latitude: 43.4, longitude: -5.8, bearing: 0 }, timestamp: 123 },
        },
        {
          id: 'update-1',
          tripUpdate: { trip: { tripId: 'trip-1', routeId: 'C1' }, stopTimeUpdate: [{ stopId: 'stop-1', departure: { delay: 180 } }] },
        },
        {
          id: 'alert-1',
          alert: { headerText: { translation: [{ text: 'Incidencia' }] }, descriptionText: { translation: [{ text: 'Demora' }] } },
        },
      ],
    }, new Date('2026-09-27T12:00:00.000Z'))

    expect(data.status).toBe('live')
    expect(data.vehicles[0]).toMatchObject({ id: 'renfe:vehicle-1', routeId: 'renfe:C1', bearing: 0 })
    expect(data.tripUpdates[0].stops[0]).toMatchObject({ stopId: 'renfe:stop-1', departureDelay: 180 })
    expect(data.alerts[0]).toMatchObject({ id: 'renfe:alert-1', header: 'Incidencia' })
    expect(data.updatedAt).toBe('2026-09-27T12:00:00.000Z')
  })

  it('combina los tres canales sin duplicar entidades', () => {
    const now = new Date('2026-09-27T12:00:00.000Z')
    const first = normalizeFeed({ entity: [{ id: 'same', alert: { headerText: { translation: [{ text: 'Aviso' }] } } }] }, now)
    const second = normalizeFeed({ entity: [{ id: 'same', alert: { headerText: { translation: [{ text: 'Aviso actualizado' }] } } }] }, now)
    const merged = mergeNormalizedFeeds([first, second], now)

    expect(merged.alerts).toHaveLength(1)
    expect(merged.alerts[0].header).toBe('Aviso actualizado')
    expect(merged.status).toBe('live')
  })
})
