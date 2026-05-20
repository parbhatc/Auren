import { toTradeseaDelayedTicker, toTradeseaProdTicker } from './tradeseaStreamSymbol'

/**
 * Canonical instrument ticker for trades REST (executions, orders).
 * Stream symbols are case-sensitive: `CME-Delayed:MNQ` works, `CME-DELAYED:MNQ` returns empty.
 */
export function normalizeTradeseaTradeInstrument(symbol: string): string {
  const trimmed = String(symbol || '').trim()
  if (!trimmed) return trimmed

  if (!trimmed.includes(':')) {
    return toTradeseaDelayedTicker(trimmed)
  }

  const colon = trimmed.indexOf(':')
  const venuePart = trimmed.slice(0, colon)
  const symbolPart = trimmed.slice(colon + 1).trim()
  const match = venuePart.match(/^([A-Za-z]+)-([Dd][Ee][Ll][Aa][Yy][Ee][Dd])$/)

  if (match) {
    const root = match[1].toUpperCase()
    return `${root}-Delayed:${symbolPart.toUpperCase()}`
  }

  return trimmed
}

/** MDS/UDF stream symbol — production uses live tickers (CME:MNQ), sandbox uses CME-Delayed:MNQ. */
export function normalizeTradeseaStreamInstrument(symbol: string, delayed = true): string {
  const trimmed = String(symbol || '').trim()
  if (!trimmed) return delayed ? 'CME-Delayed:NQ' : 'CME:NQ'

  if (trimmed.includes(':')) {
    if (delayed) return toTradeseaDelayedTicker(trimmed)
    const delayedMatch = trimmed.match(/^([A-Za-z]+)-Delayed:(.+)$/i)
    if (delayedMatch) {
      return `${delayedMatch[1].toUpperCase()}:${delayedMatch[2].trim().toUpperCase()}`
    }
    return toTradeseaProdTicker(trimmed)
  }

  return delayed ? toTradeseaDelayedTicker(trimmed) : toTradeseaProdTicker(trimmed)
}
