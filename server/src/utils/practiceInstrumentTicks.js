import { isMicroPracticeSymbol } from './practiceRules.js'

/** Common CME futures tick specs for practice P&L on the server. */
const MINI_TICKS = {
  NQ: { tickSize: 0.25, tickValue: 5 },
  ES: { tickSize: 0.25, tickValue: 12.5 },
  YM: { tickSize: 1, tickValue: 5 },
  RTY: { tickSize: 0.1, tickValue: 5 },
  GC: { tickSize: 0.1, tickValue: 10 },
  CL: { tickSize: 0.01, tickValue: 10 },
  NG: { tickSize: 0.001, tickValue: 10 },
}

const MICRO_TICKS = {
  MNQ: { tickSize: 0.25, tickValue: 0.5 },
  MES: { tickSize: 0.25, tickValue: 1.25 },
  MYM: { tickSize: 1, tickValue: 0.5 },
  M2K: { tickSize: 0.1, tickValue: 0.5 },
  MGC: { tickSize: 0.1, tickValue: 1 },
  MCL: { tickSize: 0.01, tickValue: 1 },
}

export function resolvePracticeInstrumentTicks(symbol) {
  const s = String(symbol || '')
    .toUpperCase()
    .replace(/^[A-Z]+:/, '')
    .replace(/[0-9!]+$/g, '')
    .trim()

  const table = isMicroPracticeSymbol(s) ? MICRO_TICKS : MINI_TICKS
  const spec = table[s]
  if (spec) return spec

  const tickSize = 0.25
  return { tickSize, tickValue: isMicroPracticeSymbol(s) ? tickSize * 2 : tickSize * 20 }
}

export function snapPracticePriceToTick(symbol, value) {
  const price = Number(value)
  if (!Number.isFinite(price)) return price
  const { tickSize } = resolvePracticeInstrumentTicks(symbol)
  if (!Number.isFinite(tickSize) || tickSize <= 0) return price
  const decimals = Math.max(0, (String(tickSize).split('.')[1] || '').length)
  return Number((Math.round(price / tickSize) * tickSize).toFixed(decimals))
}

export function calcPracticePnL(entry, exit, contracts, symbol) {
  const { tickSize, tickValue } = resolvePracticeInstrumentTicks(symbol)
  if (!tickSize) return 0
  const normalizedEntry = snapPracticePriceToTick(symbol, entry)
  const normalizedExit = snapPracticePriceToTick(symbol, exit)
  const pnl = ((normalizedExit - normalizedEntry) / tickSize) * tickValue * contracts
  return Number.isFinite(pnl) ? pnl : 0
}
