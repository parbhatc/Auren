import { ResolutionString } from '../../types/chart'

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

/** Minute / hour intraday (120 = 2 hours) */
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

/** TradingView `intraday_multipliers` (minutes; 120 = 2h) */
export const TRADESEA_INTRADAY_MULTIPLIERS = ['1', '2', '3', '5', '10', '15', '30', '60', '120']

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
