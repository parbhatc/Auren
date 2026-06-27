/** Default chart symbol when opening a replay session */
export const DEFAULT_BACKTESTER_SYMBOL = 'NQ'

export const BACKTESTER_CHART_SYMBOL_KEY = 'backtester-chart-symbol'

export function resolveSessionDisplaySymbol(sessionSymbol?: string): string {
  if (sessionSymbol && sessionSymbol !== 'MULTI') {
    return sessionSymbol
  }
  try {
    const saved = localStorage.getItem(BACKTESTER_CHART_SYMBOL_KEY)
    if (saved) return saved
  } catch {
    // ignore
  }
  return DEFAULT_BACKTESTER_SYMBOL
}

export function getInitialChartSymbol(sessionSymbol?: string): string {
  if (sessionSymbol && sessionSymbol !== 'MULTI') {
    return sessionSymbol
  }
  return DEFAULT_BACKTESTER_SYMBOL
}
