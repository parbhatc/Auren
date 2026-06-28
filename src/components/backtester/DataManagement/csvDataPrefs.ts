export const CSV_DATA_SOURCE_KEY = 'backtester.dataManagement.csvSource'
export const CSV_DATA_TV_TOKEN_KEY = 'backtester.dataManagement.tradingviewToken'

export type CsvDataSourcePreference = 'tradesea' | 'tradingview'

export function loadCsvDataSource(): CsvDataSourcePreference {
  const value = localStorage.getItem(CSV_DATA_SOURCE_KEY)
  return value === 'tradingview' ? 'tradingview' : 'tradesea'
}

export function saveCsvDataSource(source: CsvDataSourcePreference): void {
  localStorage.setItem(CSV_DATA_SOURCE_KEY, source)
}

export function loadCsvDataTradingViewToken(): string {
  return localStorage.getItem(CSV_DATA_TV_TOKEN_KEY) || ''
}

export function saveCsvDataTradingViewToken(token: string): void {
  const trimmed = token.trim()
  if (trimmed) {
    localStorage.setItem(CSV_DATA_TV_TOKEN_KEY, trimmed)
  } else {
    localStorage.removeItem(CSV_DATA_TV_TOKEN_KEY)
  }
}

export function wsSourceFromCsvDataSource(source: CsvDataSourcePreference): CsvDataWsSource {
  return source
}

export type CsvDataWsSource = 'tradesea' | 'tradingview'

/** Backtester data WS still uses legacy `topstep` for Tradesea CSV downloads. */
export function toServerWsSource(source: CsvDataWsSource): 'topstep' | 'tradingview' {
  return source === 'tradesea' ? 'topstep' : 'tradingview'
}

export function fromServerWsSource(source: string): CsvDataWsSource {
  return source === 'topstep' ? 'tradesea' : 'tradingview'
}

export function resolveDataManagementTab(
  param: string | null
): 'symbol-info' | 'csv-data' {
  return param === 'csv' ? 'csv-data' : 'symbol-info'
}
