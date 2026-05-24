import type { PineJSContext, PineJS } from '../types'

export type Bar = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export type FvgFillMode = 'touch' | 'full'

/** Read OHLCV from the PineJS runtime for the current bar. */
export function readBar(context: PineJSContext, PineJS: PineJS): Bar {
  return {
    time: PineJS.Std.time(context),
    open: PineJS.Std.open(context),
    high: PineJS.Std.high(context),
    low: PineJS.Std.low(context),
    close: PineJS.Std.close(context),
  }
}

export function timeToSeconds(timeMs: number): number {
  return timeMs / 1000
}

/** Convert bar count to seconds for a chart resolution string (e.g. "5", "1D"). */
export function barsToSeconds(bars: number, resolution: string | null | undefined): number {
  if (!resolution || bars <= 0) return 0
  const res = String(resolution).trim()
  const n = parseInt(res, 10) || 1

  let secondsPerBar: number
  if (res.includes('D')) secondsPerBar = n * 86400
  else if (res.includes('W')) secondsPerBar = n * 604800
  else if (res.includes('M')) secondsPerBar = n * 2592000
  else secondsPerBar = n * 60

  return secondsPerBar * bars
}

export function hasInputChange(
  changes: Record<string, { old?: unknown; new?: unknown }> | null,
  ...ids: string[]
): boolean {
  if (!changes) return false
  return ids.some((id) => id in changes)
}

export function normalizeFillMode(value: unknown): FvgFillMode {
  const raw = String(value ?? '').toLowerCase()
  return raw.includes('full') ? 'full' : 'touch'
}

export function isFvgZoneFilled(
  type: 'bullish' | 'bearish',
  top: number,
  bottom: number,
  high: number,
  low: number,
  mode: FvgFillMode
): boolean {
  if (type === 'bullish') {
    return mode === 'full' ? low <= bottom : low <= top
  }
  return mode === 'full' ? high >= top : high >= bottom
}

export function rgbaToOpaque(color: string, opacity = 1): string {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
  if (!match) return color
  const [, r, g, b] = match
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
