import { ResolutionString } from '../../types/chart'

/** TradingView second charts (suffix S) — Rithmic SECOND_BAR */
export const SECOND_RESOLUTIONS = [
  '1S',
  '5S',
  '10S',
  '15S',
  '30S',
  '45S',
] as ResolutionString[]

/** TradingView `seconds_multipliers` (unit S, multiplier from suffix) */
export const SECONDS_MULTIPLIERS = ['1', '5', '10', '15', '30', '45']

/** Minute / hour intraday (120 = 2 hours) */
export const INTRADAY_MULTIPLIERS = ['1', '2', '3', '5', '10', '15', '30', '60', '120']

export const DAILY_WEEKLY = ['1D', '1W'] as ResolutionString[]

export const SUPPORTED_RESOLUTIONS = [
  ...SECOND_RESOLUTIONS,
  ...INTRADAY_MULTIPLIERS.map((m) => m as ResolutionString),
  ...DAILY_WEEKLY,
] as ResolutionString[]

export function resolutionToSeconds(resolution: string): number {
  const r = String(resolution).trim().toUpperCase()

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

function pricescaleFromRow(row: { minTick?: number; pipSize?: number; precision?: number }): {
  minmov: number
  pricescale: number
} {
  const precision = Number.isFinite(row.precision) ? Number(row.precision) : 2
  const minTick = row.minTick ?? row.pipSize ?? Math.pow(10, -precision)
  const pricescale = Math.pow(10, precision)
  const minmov = Math.max(1, Math.round(minTick * pricescale))
  return { minmov, pricescale }
}

export { pricescaleFromRow }
