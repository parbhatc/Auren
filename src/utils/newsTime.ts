/**
 * Economic news event times are scraped in US Eastern time (the server pins the
 * ForexFactory scrape to America/New_York). These helpers convert an ET wall
 * time like "8:30am" on a given date to the viewer's timezone for display.
 */

const NEWS_SOURCE_TZ = 'America/New_York'

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - utcMs
}

/** Epoch ms for a wall-clock time in `timeZone` (two-pass for DST edges). */
function epochFromWallTime(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string
): number {
  const guess = Date.UTC(year, month - 1, day, hours, minutes)
  const utc = guess - tzOffsetMs(guess, timeZone)
  return guess - tzOffsetMs(utc, timeZone)
}

/**
 * Convert an ET news time string ("8:30am") on `dateStr` (YYYY-MM-DD) to the
 * viewer's `timeZone`. Non-clock labels ("All Day", "Tentative") and malformed
 * inputs are returned unchanged.
 */
export function formatNewsTime(dateStr: string | undefined, timeStr: string, timeZone: string): string {
  if (!timeStr || !dateStr) return timeStr
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr.split('-').map(Number) : null
  if (!m || !d) return timeStr

  let hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  const period = m[3]?.toLowerCase()
  if (period === 'pm' && hours !== 12) hours += 12
  if (period === 'am' && hours === 12) hours = 0

  try {
    const epoch = epochFromWallTime(d[0], d[1], d[2], hours, minutes, NEWS_SOURCE_TZ)
    return new Date(epoch).toLocaleTimeString('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return timeStr
  }
}
