import type { ResolutionString } from '../../types/chart'

/** Tick charts (Tradesea prop firm only) */
export const TRADESEA_TICK_RESOLUTIONS = [
  '100T',
  '500T',
  '1000T',
  '2000T',
  '5000T',
] as const satisfies readonly ResolutionString[]

/** Second charts */
export const TRADESEA_SECOND_RESOLUTIONS = [
  '1S',
  '5S',
  '10S',
  '15S',
  '30S',
  '45S',
] as const satisfies readonly ResolutionString[]

/** Minute / hour intraday (120 = 2 hours, 180 = 3 hours, 240 = 4 hours) */
export const TRADESEA_INTRADAY_RESOLUTIONS = [
  '1',
  '2',
  '3',
  '5',
  '10',
  '15',
  '30',
  '60',
  '120',
  '180',
  '240',
] as const satisfies readonly ResolutionString[]

export const TRADESEA_DAILY_WEEKLY_MONTHLY = ['1D', '1W', '1M'] as const satisfies readonly ResolutionString[]

export const TRADESEA_SUPPORTED_RESOLUTIONS: ResolutionString[] = [
  ...TRADESEA_TICK_RESOLUTIONS,
  ...TRADESEA_SECOND_RESOLUTIONS,
  ...TRADESEA_INTRADAY_RESOLUTIONS,
  ...TRADESEA_DAILY_WEEKLY_MONTHLY,
]

/** TradingView `seconds_multipliers` (unit S, multiplier from suffix) */
export const TRADESEA_SECONDS_MULTIPLIERS = ['1', '5', '10', '15', '30', '45']

/** TradingView `intraday_multipliers` (minutes; 120 = 2h, 180 = 3h, 240 = 4h) */
export const TRADESEA_INTRADAY_MULTIPLIERS = ['1', '2', '3', '5', '10', '15', '30', '60', '120', '180', '240']

const CME_SESSION_ANCHOR_SEC = 18 * 60 * 60
const ET_OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const etOffsetCache = new Map<number, number>()

function etOffsetSeconds(timeSec: number): number {
  const cacheKey = Math.floor(timeSec / 3600)
  const cached = etOffsetCache.get(cacheKey)
  if (cached !== undefined) return cached
  if (etOffsetCache.size > 10_000) etOffsetCache.clear()

  const parts = Object.fromEntries(
    ET_OFFSET_FORMATTER.formatToParts(new Date(timeSec * 1000))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )
  const localAsUtc = Math.floor(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ) / 1000)
  const offset = localAsUtc - timeSec
  etOffsetCache.set(cacheKey, offset)
  return offset
}

/**
 * BetterweightChartPro uses TradingView's short aliases (D/W/M) when it calls
 * the datafeed, while Tradesea's UDF and MDS endpoints require explicit
 * multipliers for calendar resolutions.
 */
export function tradeseaWireResolution(resolution: string): string {
  const r = String(resolution).trim().toUpperCase()
  if (r === 'D') return '1D'
  if (r === 'W') return '1W'
  if (r === 'M') return '1M'
  return r
}

export function tradeseaResolutionToSeconds(resolution: string): number {
  const r = tradeseaWireResolution(resolution)

  if (r.endsWith('T')) {
    return 1
  }

  if (r.endsWith('S')) {
    const sec = parseInt(r.replace(/S$/, ''), 10)
    return Number.isFinite(sec) && sec > 0 ? sec : 1
  }

  if (r === 'D' || r === '1D') return 86400
  if (r === 'W' || r === '1W') return 604800
  if (r === 'M' || r === '1M') return 2592000

  const mins = parseInt(r, 10)
  return Number.isFinite(mins) && mins > 0 ? mins * 60 : 60
}

/**
 * Align intraday candles to the CME Globex session open at 18:00 New York.
 * This produces TradingView-style grids such as 18:00/20:00/22:00 for 2h,
 * 18:00/21:00/00:00 for 3h, and 18:00/22:00/02:00 for 4h.
 */
export function alignTradeseaBarTimeSec(timeSec: number, resolution: string): number {
  const time = Math.floor(Number(timeSec))
  const normalizedResolution = tradeseaWireResolution(resolution)
  const barSec = Math.max(1, tradeseaResolutionToSeconds(normalizedResolution))
  if (!Number.isFinite(time)) return time

  // Tick/second and calendar resolutions retain their existing epoch grid.
  if (!/^\d+$/.test(normalizedResolution) || barSec >= 86400) {
    return Math.floor(time / barSec) * barSec
  }

  const offset = etOffsetSeconds(time)
  const localTime = time + offset
  const bucketLocal =
    Math.floor((localTime - CME_SESSION_ANCHOR_SEC) / barSec) * barSec
    + CME_SESSION_ANCHOR_SEC
  let bucketUtc = bucketLocal - offset

  // The bucket can cross a DST boundary; resolve against the offset at the
  // resulting open rather than retaining the offset from the incoming tick.
  const bucketOffset = etOffsetSeconds(bucketUtc)
  if (bucketOffset !== offset) bucketUtc = bucketLocal - bucketOffset
  return bucketUtc
}
