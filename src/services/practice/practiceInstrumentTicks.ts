import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'

export type PracticeInstrumentTicks = {
  tickSize: number
  tickValue: number
}

const PRACTICE_INSTRUMENT_TICKS: Record<string, PracticeInstrumentTicks> = {
  NQ: { tickSize: 0.25, tickValue: 5 },
  MNQ: { tickSize: 0.25, tickValue: 0.5 },
  ES: { tickSize: 0.25, tickValue: 12.5 },
  MES: { tickSize: 0.25, tickValue: 1.25 },
  YM: { tickSize: 1, tickValue: 5 },
  MYM: { tickSize: 1, tickValue: 0.5 },
  RTY: { tickSize: 0.1, tickValue: 5 },
  M2K: { tickSize: 0.1, tickValue: 0.5 },
  GC: { tickSize: 0.1, tickValue: 10 },
  MGC: { tickSize: 0.1, tickValue: 1 },
  CL: { tickSize: 0.01, tickValue: 10 },
  MCL: { tickSize: 0.01, tickValue: 1 },
  NG: { tickSize: 0.001, tickValue: 10 },
}

export function resolvePracticeInstrumentTicks(symbol: string): PracticeInstrumentTicks {
  const product = chartSymbolToProductRoot(symbol).toUpperCase()
  const known = PRACTICE_INSTRUMENT_TICKS[product]
  if (known) return known

  const tickSize = 0.25
  const isMicro = /^M[A-Z]{2,}/.test(product)
  return { tickSize, tickValue: isMicro ? tickSize * 2 : tickSize * 20 }
}

export function snapPracticePriceToTick(symbol: string, value: number): number {
  const price = Number(value)
  if (!Number.isFinite(price)) return price
  const { tickSize } = resolvePracticeInstrumentTicks(symbol)
  if (!Number.isFinite(tickSize) || tickSize <= 0) return price
  const decimals = Math.max(0, (String(tickSize).split('.')[1] || '').length)
  return Number((Math.round(price / tickSize) * tickSize).toFixed(decimals))
}
