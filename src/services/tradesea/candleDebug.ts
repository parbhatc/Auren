/**

 * Tradesea candle / history tracing.

 * Enable: candleDebug() or localStorage tradeseaCandleDebug = '1' | 'verbose'

 */



const STORAGE_KEY = 'tradeseaCandleDebug'

const FORMING_THROTTLE_MS = 5_000

const MAX_LOG = 100

const LOG_PREFIX = '[candles]'



export type CandleDebugEntry = {

  t: number

  line: string

  detail?: Record<string, unknown>

}



const log: CandleDebugEntry[] = []

const formingLastAt = new Map<string, number>()

const bookSubscribeLogged = new Set<string>()

const bookSkipLogged = new Set<string>()



export type CandleDebugMode = 'off' | 'normal' | 'verbose'



export function getCandleDebugMode(): CandleDebugMode {

  try {

    const v = localStorage.getItem(STORAGE_KEY)

    if (v === 'verbose') return 'verbose'

    if (v === '1') return 'normal'

    return 'off'

  } catch {

    return 'off'

  }

}



export function isCandleDebugOn(): boolean {

  return getCandleDebugMode() !== 'off'

}



export function isCandleDebugVerbose(): boolean {

  return getCandleDebugMode() === 'verbose'

}



export function setCandleDebug(mode: boolean | 'verbose'): void {

  try {

    if (mode === 'verbose') {

      localStorage.setItem(STORAGE_KEY, 'verbose')

    } else if (mode) {

      localStorage.setItem(STORAGE_KEY, '1')

    } else {

      localStorage.removeItem(STORAGE_KEY)

    }

  } catch {

    /* ignore */

  }

  const label =

    mode === 'verbose' ? 'verbose' : mode ? 'on' : 'off'

  console.log(

    `${LOG_PREFIX} debug ${label} — localStorage.${STORAGE_KEY}=${mode === 'verbose' ? "'verbose'" : mode ? "'1'" : '(removed)'}`

  )

}



export function getCandleDebugLog(): CandleDebugEntry[] {

  return [...log]

}



export function clearCandleDebugLog(): void {

  log.length = 0

  formingLastAt.clear()

  bookSubscribeLogged.clear()

  bookSkipLogged.clear()

}



function emit(line: string, detail?: Record<string, unknown>): void {

  const entry: CandleDebugEntry = { t: Date.now(), line, detail }

  log.push(entry)

  if (log.length > MAX_LOG) log.shift()

  if (typeof window !== 'undefined') {

    const w = window as Window & { __candleDebugLog?: CandleDebugEntry[] }

    w.__candleDebugLog = getCandleDebugLog()

  }

  console.log(`${LOG_PREFIX} ${line}`)

}



function emitBwc(line: string, detail?: Record<string, unknown>): void {

  if (!isCandleDebugOn()) return

  emit(`bwc · ${line}`, detail)

}



/** CME-Delayed:MNQ → MNQ */

export function candleDebugShortSymbol(label: string): string {

  const s = String(label || '').trim()

  const colon = s.lastIndexOf(':')

  return colon >= 0 ? s.slice(colon + 1) : s

}



export function candleDebugFmtTime(timeMs: number): string {

  if (!Number.isFinite(timeMs)) return '?'

  const ms = timeMs < 1e12 ? timeMs * 1000 : timeMs

  return new Date(ms).toLocaleTimeString(undefined, {

    hour: 'numeric',

    minute: '2-digit',

    second: '2-digit',

    hour12: true,

  })

}



/** BWC-style date + 12-hour time (e.g. 6/24/2026 3:21:00 PM). */

export function candleDebugFmtDateTime12(timeSecOrMs: number): string {

  if (!Number.isFinite(timeSecOrMs)) return '?'

  const ms = timeSecOrMs < 1e12 ? timeSecOrMs * 1000 : timeSecOrMs

  const d = new Date(ms)

  const date = d.toLocaleDateString(undefined, {

    month: 'numeric',

    day: 'numeric',

    year: 'numeric',

  })

  const time = d.toLocaleTimeString(undefined, {

    hour: 'numeric',

    minute: '2-digit',

    second: '2-digit',

    hour12: true,

  })

  return `${date} ${time}`

}



function bwcBarRange(firstSec?: number, lastSec?: number): string {

  if (firstSec == null || lastSec == null) return ''

  return `${candleDebugFmtDateTime12(firstSec)} → ${candleDebugFmtDateTime12(lastSec)}`

}



function symRes(chartSymbol: string, resolution: string): string {

  return `${candleDebugShortSymbol(chartSymbol)}/${resolution}m`

}



export const candleDebug = {

  history(options: {

    chartSymbol: string

    resolution: string

    bars: number

    firstTimeMs?: number

    lastTimeMs?: number

    noData?: boolean

    firstLoad?: boolean

  }): void {

    if (!isCandleDebugVerbose()) return

    const tag = symRes(options.chartSymbol, options.resolution)

    if (options.noData || options.bars === 0) {

      emit(`udf ${tag} · no data${options.firstLoad ? ' (first load)' : ''}`)

      return

    }

    const range =

      options.firstTimeMs != null && options.lastTimeMs != null

        ? `${candleDebugFmtTime(options.firstTimeMs)}→${candleDebugFmtTime(options.lastTimeMs)}`

        : ''

    emit(

      `udf ${tag} · ${options.bars} bars ${range}${options.firstLoad ? ' · first load' : ''}`

    )

  },



  cacheHit(chartSymbol: string, resolution: string): void {

    if (!isCandleDebugVerbose()) return

    emit(`history ${symRes(chartSymbol, resolution)} · cache hit`)

  },



  subscribe(

    chartSymbol: string,

    resolution: string,

    subId: number,

    opts?: { listenerGuid?: string; mdsState?: string }

  ): void {

    if (!isCandleDebugOn()) return

    const tag = symRes(chartSymbol, resolution)

    const mds = opts?.mdsState ? ` · mds ${opts.mdsState}` : ''

    const listener = opts?.listenerGuid ? ` · ${opts.listenerGuid}` : ''

    emit(`subscribe ${tag} · sub #${subId}${mds}${listener}`)

  },



  mdsConnecting(): void {

    if (!isCandleDebugOn()) return

    emit('MDS connecting')

  },



  mdsOpen(streams: string[], resolution: string): void {

    if (!isCandleDebugOn()) return

    if (!streams.length) {

      emit('MDS open · no chart candle subs yet')

      return

    }

    const names = streams.map(candleDebugShortSymbol).join(', ')

    emit(`MDS open · ${names} @ ${resolution}m`)

  },



  chartReload(): void {

    if (!isCandleDebugOn()) return

    emit('chart reload · MDS reconnect')

  },



  chartReloadDone(): void {

    if (!isCandleDebugOn()) return

    emit('chart reload · done')

  },



  newBar(options: {

    chartSymbol: string

    resolution: string

    barTimeMs: number

    close: number

    prevTimeMs?: number

  }): void {

    if (!isCandleDebugOn()) return

    const tag = symRes(options.chartSymbol, options.resolution)

    const prev =

      options.prevTimeMs != null && options.prevTimeMs > 0

        ? ` ← ${candleDebugFmtTime(options.prevTimeMs)}`

        : ''

    emit(

      `live ${tag} · NEW ${candleDebugFmtTime(options.barTimeMs)} @ ${options.close}${prev}`

    )

  },



  forming(options: {

    resKey: string

    chartSymbol: string

    resolution: string

    barTimeMs: number

    close: number

  }): void {

    if (!isCandleDebugOn()) return

    if (isCandleDebugVerbose()) {

      emit(

        `live ${symRes(options.chartSymbol, options.resolution)} · ${candleDebugFmtTime(options.barTimeMs)} @ ${options.close}`

      )

      return

    }

    const now = Date.now()

    const last = formingLastAt.get(options.resKey) ?? 0

    if (now - last < FORMING_THROTTLE_MS) return

    formingLastAt.set(options.resKey, now)

    emit(

      `live ${symRes(options.chartSymbol, options.resolution)} · ~${candleDebugFmtTime(options.barTimeMs)} @ ${options.close}`

    )

  },



  skipOlder(options: {

    chartSymbol: string

    resolution: string

    barTimeMs: number

    lastTimeMs: number

  }): void {

    if (!isCandleDebugOn()) return

    emit(

      `skip ${symRes(options.chartSymbol, options.resolution)} · ${candleDebugFmtTime(options.barTimeMs)} < ${candleDebugFmtTime(options.lastTimeMs)}`

    )

  },



  bwcGetBarsRequest(options: {

    chartSymbol: string

    resolution: string

    bars: number

    fromSec: number

    toSec: number

  }): void {

    const tag = symRes(options.chartSymbol, options.resolution)

    emitBwc(

      `getBars request ${tag} · ${options.bars} bars ${bwcBarRange(options.fromSec, options.toSec)}`

    )

  },



  bwcGetBarsResult(options: {

    chartSymbol: string

    resolution: string

    bars: number

    firstTimeSec?: number

    lastTimeSec?: number

    noData?: boolean

  }): void {

    const tag = symRes(options.chartSymbol, options.resolution)

    if (options.noData || options.bars === 0) {

      emitBwc(`getBars results ${tag} · 0 bars`)

      return

    }

    emitBwc(

      `getBars results ${tag} · ${options.bars} bars ${bwcBarRange(options.firstTimeSec, options.lastTimeSec)}`

    )

  },



  bwcSubscribeBars(options: {

    chartSymbol: string

    resolution: string

    listenerGuid: string

  }): void {

    const tag = symRes(options.chartSymbol, options.resolution)

    emitBwc(`subscribeBars ${tag} · ${options.listenerGuid}`)

  },



  bwcSubscribeQuotes(options: { chartSymbol: string; listenerGuid: string }): void {

    const sym = candleDebugShortSymbol(options.chartSymbol)

    emitBwc(`subscribeQuotes ${sym} · ${options.listenerGuid}`)

  },



  chartReady(chartSymbol: string, resolution: string): void {

    if (!isCandleDebugOn()) return

    emit(`chart ready · ${symRes(chartSymbol, resolution)}`)

  },



  bookSubscribe(

    chartSymbol: string,

    entries: Array<{ kind: string; subId: number }>

  ): void {

    if (!isCandleDebugOn()) return

    const sym = candleDebugShortSymbol(chartSymbol)

    if (!isCandleDebugVerbose() && bookSubscribeLogged.has(sym)) return

    bookSubscribeLogged.add(sym)

    const parts = entries

      .filter((e) => e.subId >= 0)

      .map((e) => `${e.kind} #${e.subId}`)

      .join(' · ')

    if (!parts) return

    emit(`book subscribe ${sym} · ${parts}`)

  },



  bookSubscribeSkip(chartSymbol: string, reason: string): void {

    if (!isCandleDebugOn()) return

    const sym = candleDebugShortSymbol(chartSymbol)

    const key = `${sym}:${reason}`

    if (bookSkipLogged.has(key)) return

    bookSkipLogged.add(key)

    emit(`book subscribe ${sym} · skip (${reason})`)

  },



  quotesSubscribe(chartSymbol: string, listenerGuid: string): void {

    if (!isCandleDebugOn()) return

    emit(`quotes subscribe ${candleDebugShortSymbol(chartSymbol)} · ${listenerGuid}`)

  },



  quotesUnsubscribe(listenerGuid: string): void {

    if (!isCandleDebugOn()) return

    emit(`quotes unsubscribe · ${listenerGuid}`)

  },



  tradePadChartPick(symbol: string): void {

    if (!isCandleDebugOn()) return

    emit(`trade pad · chart pick ${candleDebugShortSymbol(symbol)}`)

  },

}



export function installCandleDebugConsoleApi(): void {

  if (typeof window === 'undefined') return

  const w = window as Window & {

    candleDebug?: (mode?: boolean | 'verbose') => CandleDebugMode

    candleDebugLog?: () => CandleDebugEntry[]

    candleDebugClear?: () => void

  }

  w.candleDebug = (mode = true) => {

    if (mode === undefined) return getCandleDebugMode()

    setCandleDebug(mode)

    return getCandleDebugMode()

  }

  w.candleDebugLog = () => {

    const entries = getCandleDebugLog()

    console.table(entries.map((e) => ({ time: new Date(e.t).toLocaleTimeString(), event: e.line })))

    return entries

  }

  w.candleDebugClear = () => {

    clearCandleDebugLog()

    console.log(`${LOG_PREFIX} log cleared`)

  }

  if (isCandleDebugOn()) {

    console.log(

      `${LOG_PREFIX} debug ON. Commands: candleDebug(false), candleDebug("verbose"), candleDebugLog(), candleDebugClear()`

    )

  }

}



installCandleDebugConsoleApi()


