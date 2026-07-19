import type { BracketDistanceUnit, OrderSide } from './types'

export { BRACKET_TICK_PRESETS } from '../../../../constants/tradePanel'

export const fmtPrice = (p: number) =>
  p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const BRACKET_UNIT_SHORT: Record<BracketDistanceUnit, string> = {
  ticks: 't',
  points: 'pt',
  dollars: '$',
}

/** Dollar distances are per-contract risk; they need tickValue to map to price. */
function distanceToDelta(
  amount: number,
  unit: BracketDistanceUnit,
  tickSize: number,
  tickValue: number
): number {
  if (unit === 'ticks') return amount * tickSize
  if (unit === 'dollars') return tickValue > 0 ? (amount / tickValue) * tickSize : 0
  return amount
}

function deltaToDistance(
  delta: number,
  unit: BracketDistanceUnit,
  tickSize: number,
  tickValue: number
): number | null {
  if (tickSize <= 0) return null
  if (unit === 'ticks') return Math.max(1, Math.round(delta / tickSize))
  if (unit === 'dollars') {
    if (tickValue <= 0) return null
    return Math.round((delta / tickSize) * tickValue * 100) / 100
  }
  return Math.round(delta * 100) / 100
}

export function priceFromDistance(
  ref: number,
  amount: number,
  unit: BracketDistanceUnit,
  tickSize: number,
  kind: 'sl' | 'tp',
  side: OrderSide,
  tickValue: number = 0
): number {
  const delta = distanceToDelta(amount, unit, tickSize, tickValue)
  if (side === 'buy') return kind === 'sl' ? ref - delta : ref + delta
  return kind === 'sl' ? ref + delta : ref - delta
}

export function distanceFromPrice(
  ref: number,
  price: number,
  unit: BracketDistanceUnit,
  tickSize: number,
  kind: 'sl' | 'tp',
  side: OrderSide,
  tickValue: number = 0
): number | null {
  if (!Number.isFinite(ref) || !Number.isFinite(price) || tickSize <= 0) return null
  let diff: number
  if (side === 'buy') {
    diff = kind === 'sl' ? ref - price : price - ref
  } else {
    diff = kind === 'sl' ? price - ref : ref - price
  }
  if (diff <= 0) return null
  return deltaToDistance(diff, unit, tickSize, tickValue)
}

export function convertDistanceValue(
  value: string,
  from: BracketDistanceUnit,
  to: BracketDistanceUnit,
  tickSize: number,
  tickValue: number = 0
): string {
  const n = parseBracketDistanceInput(value, from)
  if (n == null || tickSize <= 0 || from === to) return value
  const delta = distanceToDelta(n, from, tickSize, tickValue)
  const converted = deltaToDistance(delta, to, tickSize, tickValue)
  if (converted == null) return value
  return converted % 1 === 0 ? String(converted) : converted.toFixed(2)
}

export function parseBracketPriceInput(value: string): number | null {
  const p = parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(p) && p > 0 ? p : null
}

export function parseBracketDistanceInput(value: string, unit: BracketDistanceUnit): number | null {
  const raw = value.replace(/,/g, '').replace(/\$/g, '').trim()
  if (!raw) return null
  const n = unit === 'ticks' ? parseInt(raw, 10) : parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** "10t = 2.5pt = $50/ct" equivalents string for a distance in a given unit. */
export function formatDistanceEquivalents(
  value: string,
  unit: BracketDistanceUnit,
  tickSize: number,
  tickValue: number
): string | null {
  const n = parseBracketDistanceInput(value, unit)
  if (n == null || tickSize <= 0) return null
  const delta = distanceToDelta(n, unit, tickSize, tickValue)
  if (delta <= 0) return null
  const fmt = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(2))
  const ticks = deltaToDistance(delta, 'ticks', tickSize, tickValue)
  const points = deltaToDistance(delta, 'points', tickSize, tickValue)
  const parts = [`${ticks}t`, `${fmt(points ?? 0)}pt`]
  const dollars = tickValue > 0 ? deltaToDistance(delta, 'dollars', tickSize, tickValue) : null
  if (dollars != null) parts.push(`$${fmt(dollars)}/ct`)
  return parts.join(' = ')
}

/** Total $ risk (or reward) for a bracket at `price` vs entry `ref`, for `qty` contracts. */
export function bracketDollarAmount(
  ref: number,
  price: number,
  qty: number,
  tickSize: number,
  tickValue: number
): number | null {
  if (
    !Number.isFinite(ref) ||
    !Number.isFinite(price) ||
    tickSize <= 0 ||
    tickValue <= 0 ||
    qty <= 0
  ) {
    return null
  }
  const perContract = deltaToDistance(Math.abs(ref - price), 'dollars', tickSize, tickValue)
  return perContract == null ? null : Math.round(perContract * qty * 100) / 100
}
