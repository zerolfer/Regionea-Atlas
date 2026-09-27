const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function parseGtfsTime(value) {
  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(String(value || '').trim())
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

export function shiftGtfsDate(value, days) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
}

export function zonedNowParts(now = new Date(), timeZone = 'Europe/Madrid') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]))
  return {
    date: `${parts.year}${parts.month}${parts.day}`,
    seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  }
}

export function feedFreshness(feedEndDate, now = new Date(), timeZone = 'Europe/Madrid') {
  return feedEndDate && feedEndDate < zonedNowParts(now, timeZone).date ? 'stale' : 'scheduled'
}

export function isServiceActive(providerSchedule, serviceId, date) {
  const exceptions = providerSchedule?.exceptions?.[date]
  if (exceptions?.removed?.includes(serviceId)) return false
  if (exceptions?.added?.includes(serviceId)) return true
  const calendar = providerSchedule?.calendars?.[serviceId]
  if (!calendar || date < calendar.startDate || date > calendar.endDate) return false
  if (!shiftGtfsDate(date, 0)) return false
  const utcDate = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8))))
  return Boolean(calendar.weekdays?.[WEEKDAYS[utcDate.getUTCDay()]])
}

function displayTime(seconds) {
  const normalized = ((seconds % 86400) + 86400) % 86400
  return `${String(Math.floor(normalized / 3600)).padStart(2, '0')}:${String(Math.floor((normalized % 3600) / 60)).padStart(2, '0')}`
}

export function nextScheduledDepartures(items, providerSchedule, options = {}) {
  const { now = new Date(), timeZone = 'Europe/Madrid', limit = 12, horizonSeconds = 30 * 3600 } = options
  const current = zonedNowParts(now, timeZone)
  const results = []
  const seen = new Set()
  for (let dayOffset = -2; dayOffset <= 2; dayOffset += 1) {
    const serviceDate = shiftGtfsDate(current.date, dayOffset)
    for (const item of items || []) {
      const scheduledSeconds = item.scheduledSeconds ?? parseGtfsTime(item.scheduledTime)
      if (scheduledSeconds == null || !isServiceActive(providerSchedule, item.serviceId, serviceDate)) continue
      const relativeSeconds = dayOffset * 86400 + scheduledSeconds
      if (relativeSeconds < current.seconds || relativeSeconds > current.seconds + horizonSeconds) continue
      const key = `${item.tripId || ''}:${item.stopSequence || ''}:${serviceDate}:${scheduledSeconds}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ ...item, serviceDate, scheduledTime: displayTime(relativeSeconds), relativeSeconds })
    }
  }
  return results
    .sort((left, right) => left.relativeSeconds - right.relativeSeconds)
    .slice(0, limit)
    .map(({ relativeSeconds: _relativeSeconds, ...item }) => item)
}
