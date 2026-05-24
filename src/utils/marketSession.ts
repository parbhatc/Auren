import type { LibrarySymbolInfo } from '../types/chart'

/** Toast / guard message when futures session is closed. */
export const MARKET_CLOSED_MESSAGE = 'Market closed'

const TV_WEEKDAY: Record<string, number> = {
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
}

type ZonedClock = { tvDay: number; minutes: number }

function getZonedClock(date: Date, timeZone: string): ZonedClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  let weekday = 'Mon'
  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value
    if (part.type === 'hour') hour = Number(part.value)
    if (part.type === 'minute') minute = Number(part.value)
  }

  return {
    tvDay: TV_WEEKDAY[weekday] ?? 2,
    minutes: hour * 60 + minute,
  }
}

function parseHm(value: string): number | null {
  const raw = value.trim()
  if (raw.length !== 4) return null
  const hour = Number(raw.slice(0, 2))
  const minute = Number(raw.slice(2, 4))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function isMinutesInRange(minutes: number, start: number, end: number): boolean {
  if (start === end) return false
  if (start < end) return minutes >= start && minutes < end
  return minutes >= start || minutes < end
}

/** CME Globex equity-index schedule with daily 16:00–17:00 CT halt and weekend close. */
export function isCmeGlobexEquityIndexOpen(now: Date, timeZone: string): boolean {
  const { tvDay, minutes } = getZonedClock(now, timeZone)
  const open = 17 * 60
  const close = 16 * 60

  if (tvDay === 7) return false
  if (tvDay === 1) return minutes >= open
  if (tvDay === 6) return minutes < close
  if (minutes >= close && minutes < open) return false
  return true
}

function isTradingViewSessionOpen(session: string, now: Date, timeZone: string): boolean {
  const trimmed = session.trim()
  if (!trimmed || trimmed === '24x7') return true

  const { tvDay, minutes } = getZonedClock(now, timeZone)
  const segments = trimmed.split(',').map((s) => s.trim()).filter(Boolean)

  for (const segment of segments) {
    const colon = segment.indexOf(':')
    const daysPart = colon >= 0 ? segment.slice(colon + 1) : ''
    const rangePart = colon >= 0 ? segment.slice(0, colon) : segment

    if (daysPart && !daysPart.includes(String(tvDay))) continue

    const dash = rangePart.indexOf('-')
    if (dash <= 0) continue
    const start = parseHm(rangePart.slice(0, dash))
    const end = parseHm(rangePart.slice(dash + 1))
    if (start == null || end == null) continue
    if (isMinutesInRange(minutes, start, end)) return true
  }

  return false
}

function isCmeFuturesSymbol(info: LibrarySymbolInfo): boolean {
  const type = String(info.type || '').toLowerCase()
  if (type !== 'futures' && type !== 'future') return false
  const exchange = String(info.listed_exchange || info.exchange || '').toUpperCase()
  return /CME|CBOT|NYMEX|COMEX|GLOBEX/.test(exchange)
}

export function resolveSymbolSession(info: LibrarySymbolInfo): { session: string; timezone: string } {
  const timezone = String(info.timezone || 'America/Chicago')
  const session = String(info.session || '24x7').trim()

  if (session === '24x7' && isCmeFuturesSymbol(info)) {
    return { session: 'cme_globex', timezone }
  }

  return { session, timezone }
}

export function isSymbolMarketOpen(
  info: LibrarySymbolInfo | null | undefined,
  now: Date = new Date()
): boolean {
  if (!info) return true

  const { session, timezone } = resolveSymbolSession(info)
  if (session === '24x7') return true
  if (session === 'cme_globex') return isCmeGlobexEquityIndexOpen(now, timezone)
  return isTradingViewSessionOpen(session, now, timezone)
}

export function isMarketClosedApiError(message: string): boolean {
  const m = message.trim().toLowerCase()
  if (!m) return false
  return (
    m.includes('market closed') ||
    m.includes('market is closed') ||
    m.includes('outside trading hours') ||
    m.includes('outside market hours') ||
    m.includes('session is closed') ||
    m.includes('not tradable')
  )
}
