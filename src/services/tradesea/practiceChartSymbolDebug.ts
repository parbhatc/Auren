/**
 * Practice chart symbol / load_last_chart tracing (chart + TradeseaDatafeed).
 * Enable: practiceChartSymbolDebug(true) or localStorage practice_chart_symbol_debug=1
 *
 * Datafeed events: TradeseaDatafeed.resolveSymbol*, subscribeBars, unsubscribeBars,
 * getBars (firstDataRequest), streamSymbol, ensureMarketBookSubscription, resolveProductSymbol
 */

const STORAGE_KEY = 'practice_chart_symbol_debug'

export type PracticeChartSymbolDebugEntry = {
  t: number
  source: string
  detail?: Record<string, unknown>
}

const MAX_LOG = 80
const log: PracticeChartSymbolDebugEntry[] = []

export function isPracticeChartSymbolDebug(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

export function setPracticeChartSymbolDebug(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  console.info(
    `[Practice chart symbol] debug ${enabled ? 'ON' : 'OFF'} — localStorage.${STORAGE_KEY}=${enabled ? '1' : '0'}`
  )
}

export function getPracticeChartSymbolDebugLog(): PracticeChartSymbolDebugEntry[] {
  return [...log]
}

export function clearPracticeChartSymbolDebugLog(): void {
  log.length = 0
}

/** Throttle identical source+symbol spam (ms). */
const throttleAt = new Map<string, number>()
const THROTTLE_MS = 400

export function debugPracticeChartSymbol(
  source: string,
  detail: Record<string, unknown> = {},
  options?: { force?: boolean; throttleKey?: string }
): void {
  if (!isPracticeChartSymbolDebug()) return

  const key = options?.throttleKey ?? `${source}:${String(detail.chartSym ?? detail.root ?? detail.symbolProp ?? '')}`
  const now = Date.now()
  if (!options?.force) {
    const last = throttleAt.get(key) ?? 0
    if (now - last < THROTTLE_MS) return
  }
  throttleAt.set(key, now)

  const entry: PracticeChartSymbolDebugEntry = { t: now, source, detail }
  log.push(entry)
  if (log.length > MAX_LOG) log.shift()

  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      __practiceChartSymbolDebugLog?: PracticeChartSymbolDebugEntry[]
    }
    w.__practiceChartSymbolDebugLog = getPracticeChartSymbolDebugLog()
  }

  console.log(`[Practice chart symbol] ${source}`, detail)
}

export function installPracticeChartSymbolDebugConsoleApi(): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as {
    practiceChartSymbolDebug?: (on?: boolean) => boolean
    practiceChartSymbolDebugLog?: () => PracticeChartSymbolDebugEntry[]
    practiceChartSymbolDebugClear?: () => void
  }
  w.practiceChartSymbolDebug = (on = true) => {
    setPracticeChartSymbolDebug(on)
    return isPracticeChartSymbolDebug()
  }
  w.practiceChartSymbolDebugLog = () => getPracticeChartSymbolDebugLog()
  w.practiceChartSymbolDebugClear = () => {
    clearPracticeChartSymbolDebugLog()
    console.info('[Practice chart symbol] log cleared')
  }
  if (isPracticeChartSymbolDebug()) {
    console.info(
      '[Practice chart symbol] debug ON. Commands: practiceChartSymbolDebug(false), practiceChartSymbolDebugLog(), practiceChartSymbolDebugClear()'
    )
  }
}

installPracticeChartSymbolDebugConsoleApi()
