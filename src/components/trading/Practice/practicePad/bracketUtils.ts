import type { BracketDistanceUnit, OrderSide } from './types'

export const BRACKET_TICK_PRESETS = [10, 25, 50, 100] as const

export const fmtPrice = (p: number) =>
  p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function distanceToDelta(amount: number, unit: BracketDistanceUnit, tickSize: number): number {
  return unit === 'ticks' ? amount * tickSize : amount
}

export function priceFromDistance(
  ref: number,
  amount: number,
  unit: BracketDistanceUnit,
  tickSize: number,
  kind: 'sl' | 'tp',
  side: OrderSide
): number {
  const delta = distanceToDelta(amount, unit, tickSize)
  if (side === 'buy') return kind === 'sl' ? ref - delta : ref + delta
  return kind === 'sl' ? ref + delta : ref - delta
}

export function distanceFromPrice(
  ref: number,
  price: number,
  unit: BracketDistanceUnit,
  tickSize: number,
  kind: 'sl' | 'tp',
  side: OrderSide
): number | null {
  if (!Number.isFinite(ref) || !Number.isFinite(price) || tickSize <= 0) return null
  let diff: number
  if (side === 'buy') {
    diff = kind === 'sl' ? ref - price : price - ref
  } else {
    diff = kind === 'sl' ? price - ref : ref - price
  }
  if (diff <= 0) return null
  if (unit === 'points') {
    return Math.round(diff * 100) / 100
  }
  return Math.max(1, Math.round(diff / tickSize))
}

export function convertDistanceValue(
  value: string,
  from: BracketDistanceUnit,
  to: BracketDistanceUnit,
  tickSize: number
): string {
  const n = parseBracketDistanceInput(value, from)
  if (n == null || tickSize <= 0 || from === to) return value
  if (from === 'ticks' && to === 'points') {
    const points = n * tickSize
    return points % 1 === 0 ? String(points) : points.toFixed(2)
  }
  return String(Math.max(1, Math.round(n / tickSize)))
}

export function parseBracketPriceInput(value: string): number | null {
  const p = parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(p) && p > 0 ? p : null
}

export function parseBracketDistanceInput(value: string, unit: BracketDistanceUnit): number | null {
  const raw = value.replace(/,/g, '').trim()
  if (!raw) return null
  const n = unit === 'ticks' ? parseInt(raw, 10) : parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
