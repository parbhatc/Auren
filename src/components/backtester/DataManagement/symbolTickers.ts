import type { SymbolData } from '../../../types/backtesterDataManagement'
import type { CsvDataSourcePreference } from './csvDataPrefs'

export type SymbolTickerSource = 'tradesea' | 'tradingview'

export function tickerConfigKey(source: SymbolTickerSource): 'tradesea' | 'tradingview' {
  return source
}

export function getSymbolTicker(
  symbolData: SymbolData | undefined,
  source: SymbolTickerSource
): string | undefined {
  const value = symbolData?.tickers?.[tickerConfigKey(source)]?.trim()
  return value || undefined
}

export function hasSymbolTicker(
  symbols: Record<string, SymbolData>,
  symbol: string,
  dataSource: CsvDataSourcePreference
): boolean {
  const source: SymbolTickerSource = dataSource === 'tradesea' ? 'tradesea' : 'tradingview'
  return Boolean(getSymbolTicker(symbols[symbol], source))
}
