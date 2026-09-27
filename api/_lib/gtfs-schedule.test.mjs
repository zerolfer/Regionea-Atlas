import { describe, expect, it } from 'vitest'
import { feedFreshness, isServiceActive, nextScheduledDepartures, parseGtfsTime, shiftGtfsDate } from './gtfs-schedule.mjs'

const dailySchedule = {
  status: 'scheduled',
  calendars: {
    daily: {
      startDate: '20260901',
      endDate: '20261031',
      weekdays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true },
    },
  },
  exceptions: {},
}

describe('GTFS schedule helpers', () => {
  it('accepts trips crossing midnight', () => {
    expect(parseGtfsTime('25:12:30')).toBe(90750)
    const result = nextScheduledDepartures([
      { tripId: 'night', stopSequence: 1, serviceId: 'daily', scheduledTime: '25:12:30', scheduledSeconds: 90750 },
    ], dailySchedule, { now: new Date('2026-09-27T23:50:00Z'), timeZone: 'UTC' })
    expect(result[0]).toMatchObject({ tripId: 'night', serviceDate: '20260927', scheduledTime: '01:12' })
  })

  it('deduplicates equivalent departures and applies exceptions', () => {
    const schedule = structuredClone(dailySchedule)
    schedule.exceptions['20260928'] = { added: [], removed: ['daily'] }
    const duplicate = { tripId: 'a', stopSequence: 2, serviceId: 'daily', scheduledTime: '10:00:00', scheduledSeconds: 36000 }
    const result = nextScheduledDepartures([duplicate, duplicate], schedule, { now: new Date('2026-09-27T09:00:00Z'), timeZone: 'UTC' })
    expect(result).toHaveLength(1)
    expect(isServiceActive(schedule, 'daily', '20260928')).toBe(false)
  })

  it('shifts service dates without locale-dependent parsing', () => {
    expect(shiftGtfsDate('20261231', 1)).toBe('20270101')
    expect(parseGtfsTime('10:77:00')).toBeNull()
  })

  it('marks an expired static feed as stale', () => {
    expect(feedFreshness('20260926', new Date('2026-09-27T12:00:00Z'), 'UTC')).toBe('stale')
    expect(feedFreshness('20260927', new Date('2026-09-27T12:00:00Z'), 'UTC')).toBe('scheduled')
  })
})
