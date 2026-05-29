/** e.g. CME:NQ */
export function formatChartSymbol(exchange: string, symbol: string): string {
  const raw = symbol.trim().toUpperCase()
  if (raw.includes(':')) return raw
  const ex = (exchange || 'CME').trim().toUpperCase()
  return `${ex}:${raw}`
}

export function parseChartSymbol(label: string): { exchange: string; symbol: string; chartSymbol: string } {
  const raw = label.trim().toUpperCase()
  if (raw.includes(':')) {
    const [exchange, symbol] = raw.split(':')
    const ex = (exchange || 'CME').toUpperCase()
    const sym = (symbol || 'MNQ').toUpperCase()
    return { exchange: ex, symbol: sym, chartSymbol: `${ex}:${sym}` }
  }
  return { exchange: 'CME', symbol: raw || 'MNQ', chartSymbol: `CME:${raw || 'MNQ'}` }
}

export type RithmicMdsQuotePayload = {
  symbol: string
  bid?: { price: number; size: number }
  ask?: { price: number; size: number }
  time: number
}

export type RithmicMdsUpdatePayload = {
  symbol: string
  price?: number
  size?: number
  volume?: number
  time: number
  /** Last trade aggressor: Buy = buyer lifted offer, Sell = seller hit bid */
  side?: 'Buy' | 'Sell'
  aggressor?: number | string
}

export type RithmicMdsLatestHighLowPayload = {
  symbol: string
  time: number
  high?: number
  low?: number
}

export type RithmicMdsLatestClosePayload = {
  symbol: string
  time: number
  close?: number
  close_date?: string
  settlement?: number
  settlement_date?: string
  price_type?: string
}
