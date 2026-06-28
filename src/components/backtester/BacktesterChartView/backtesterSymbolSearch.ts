import { backtesterAPI } from '../../../api/backtester.api'
import type { TradeseaSearchSymbolResult } from '../../../services/tradesea/tradeseaSymbolInfo'

export async function searchBacktesterTradeSymbols(query: string): Promise<TradeseaSearchSymbolResult[]> {
  const resp = await backtesterAPI.searchSymbols(query)
  const symbols = resp.symbols ?? {}
  const q = query.trim().toUpperCase()

  return Object.keys(symbols)
    .filter((symbol) => !q || symbol.toUpperCase().includes(q))
    .map((symbol) => ({
      symbol,
      full_name: symbol,
      name: symbol,
      description: symbol,
      exchange: 'CME',
      type: 'futures',
      ticker: symbol,
      streamTicker: `CME:${symbol}`,
    }))
}

export function normalizeBacktesterSymbolRoot(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase()
  if (trimmed.includes(':')) {
    return trimmed.split(':').pop() ?? trimmed
  }
  return trimmed
}
