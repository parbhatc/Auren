/**
 * Rithmic chart datafeed: history via REST + optional live bars via /rithmic-mds-ws.
 */
import {
  IDatafeedChartApi,
  LibrarySymbolInfo,
  ResolutionString,
  SubscribeBarsCallback,
  Bar,
} from '../../types/chart'
import { rithmicAPI, type RithmicSymbolRow } from '../../api/rithmic.api'
import { resolutionToSeconds, SUPPORTED_RESOLUTIONS } from './rithmicResolutions'
import { RithmicMdsClient } from './RithmicMdsClient'
import { parseChartSymbol } from './rithmicMdsFormat'
import type { RithmicSearchSymbolResult } from './rithmicSymbolInfo'
import {
  buildRithmicSymbolIndex,
  findRithmicSymbolRow,
  rithmicRowToLibrarySymbolInfo,
  rithmicRowToSearchSymbolResult,
  rithmicTickSize,
  rithmicTickValue,
  searchRithmicSymbolRows,
} from './rithmicSymbolInfo'
import type { RithmicMdsUpdatePayload } from './rithmicMdsFormat'
import {
  logRithmicBar,
  logRithmicCandlePatch,
  logRithmicHistory,
  logRithmicLatestClose,
  logRithmicLatestHighLow,
  logRithmicQuote,
  logRithmicTrade,
} from './rithmicChartDebug'

const RESOLUTIONS = SUPPORTED_RESOLUTIONS

type RithmicMarketBook = {
  bid: number | null
  ask: number | null
  bidSize: number | null
  askSize: number | null
  last: number | null
  sessionHigh: number | null
  sessionLow: number | null
  sessionClose: number | null
  settlement: number | null
}

function parseSymbol(name: string): { symbol: string; exchange: string; chartSymbol: string } {
  const raw = name.trim()
  if (raw.includes(':')) {
    const [exchange, symbol] = raw.split(':')
    const ex = (exchange || 'CME').toUpperCase()
    const sym = (symbol || 'MNQ').toUpperCase()
    return { exchange: ex, symbol: sym, chartSymbol: `${ex}:${sym}` }
  }
  const sym = raw.toUpperCase() || 'MNQ'
  return { symbol: sym, exchange: 'CME', chartSymbol: `CME:${sym}` }
}

export class RithmicHistoryDatafeed implements IDatafeedChartApi {
  private symbolsPromise: Promise<RithmicSymbolRow[]> | null = null
  private symbolIndex: Map<string, RithmicSymbolRow> | null = null
  private keyToSubs = new Map<string, Map<string, SubscribeBarsCallback>>()
  private resKeyToChartSymbol = new Map<string, string>()
  private activeSubKey: string | null = null
  private offBar: (() => void) | null = null
  private offQuote: (() => void) | null = null
  private offUpdate: (() => void) | null = null
  private offLatestHighLow: (() => void) | null = null
  private offLatestClose: (() => void) | null = null
  private marketBook: RithmicMarketBook | null = null
  private marketBookListeners = new Set<() => void>()
  private lastBarTimeByKey = new Map<string, number>()
  private lastBarByKey = new Map<string, Bar>()
  /** Latest session high/low/close from MDS (may arrive before subscribeBars). */
  private sessionBySymbol = new Map<
    string,
    { high: number | null; low: number | null; close: number | null }
  >()

  constructor(private readonly mds: RithmicMdsClient | null = null) {
    void this.ensureSymbolIndex()
    if (this.mds) this.ensureMdsListeners()
  }

  private lookupRow(symbol: string): RithmicSymbolRow | null {
    if (!this.symbolIndex) return null
    return findRithmicSymbolRow(this.symbolIndex, symbol)
  }

  private ensureSymbolsLoaded(): Promise<RithmicSymbolRow[]> {
    if (!this.symbolsPromise) {
      this.symbolsPromise = rithmicAPI.getSymbols().catch((err) => {
        this.symbolsPromise = null
        throw err
      })
    }
    return this.symbolsPromise
  }

  private async ensureSymbolIndex(): Promise<Map<string, RithmicSymbolRow>> {
    if (this.symbolIndex) return this.symbolIndex
    const rows = await this.ensureSymbolsLoaded()
    this.symbolIndex = buildRithmicSymbolIndex(rows)
    return this.symbolIndex
  }

  setTradeHandler(_handler: unknown): void {}
  setChartResetCallback(_cb: (() => void) | null): void {}
  refreshMdsSubscriptions(): void {
    if (!this.mds || !this.activeSubKey) return
    const chartSymbol = this.activeSubKey.split('__')[0]
    const resolution = this.activeSubKey.split('__')[1]
    if (!chartSymbol || !resolution) return
    this.mds.subscribe(chartSymbol, resolution)
  }

  private keyFor(chartSymbol: string, resolution: string): string {
    return `${chartSymbol}__${resolution}`
  }

  private normalizeBarTimeMs(time: number): number {
    if (!Number.isFinite(time) || time <= 0) return Date.now()
    return time < 1e12 ? time * 1000 : time
  }

  private barPeriodMs(resolution: string): number {
    return resolutionToSeconds(resolution) * 1000
  }

  private barOpenTimeMs(tradeTimeMs: number, periodMs: number): number {
    return Math.floor(tradeTimeMs / periodMs) * periodMs
  }

  private rememberSession(
    chartSymbol: string,
    patch: { high?: number | null; low?: number | null; close?: number | null },
  ): void {
    const prev = this.sessionBySymbol.get(chartSymbol) ?? {
      high: null,
      low: null,
      close: null,
    }
    this.sessionBySymbol.set(chartSymbol, {
      high: patch.high !== undefined ? patch.high : prev.high,
      low: patch.low !== undefined ? patch.low : prev.low,
      close: patch.close !== undefined ? patch.close : prev.close,
    })
  }

  /** Widen forming-bar OHLC with cached session high/low (does not override close from trades). */
  private applySessionRangeToBar(chartSymbol: string, bar: Bar): Bar {
    const s = this.sessionBySymbol.get(chartSymbol)
    if (!s) return bar
    let { high, low } = bar
    if (s.high != null && Number.isFinite(s.high)) high = Math.max(high, s.high)
    if (s.low != null && Number.isFinite(s.low)) low = Math.min(low, s.low)
    return high === bar.high && low === bar.low ? bar : { ...bar, high, low }
  }

  private logBarPatch(chartSymbol: string, bar: Bar, from: string): void {
    logRithmicCandlePatch(chartSymbol, {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      from,
    })
  }

  private dispatchLiveBar(key: string, bar: Bar, resolution: string): void {
    const subs = this.keyToSubs.get(key)
    if (!subs?.size) return

    const periodMs = this.barPeriodMs(resolution)
    const last = this.lastBarTimeByKey.get(key) ?? 0
    if (last > 0 && bar.time < last && last - bar.time > periodMs * 2) return

    this.lastBarTimeByKey.set(key, Math.max(last, bar.time))
    this.lastBarByKey.set(key, bar)

    subs.forEach((cb) => {
      try {
        cb(bar)
      } catch {
        /* ignore */
      }
    })
  }

  private applyTradeUpdate(chartSymbol: string, update: RithmicMdsUpdatePayload): void {
    const price = Number(update.price)
    if (!Number.isFinite(price)) return

    const tradeTimeMs = this.normalizeBarTimeMs(Number(update.time))
    const size = Number(update.size ?? 0)

    for (const [key, subs] of this.keyToSubs.entries()) {
      if (!subs.size) continue
      if (!key.startsWith(`${chartSymbol}__`)) continue

      const resolution = key.split('__')[1] || '1'
      const periodMs = this.barPeriodMs(resolution)
      const bucketMs = this.barOpenTimeMs(tradeTimeMs, periodMs)
      const prev = this.lastBarByKey.get(key)

      let bar: Bar
      if (!prev || bucketMs > prev.time) {
        const open = prev && bucketMs > prev.time ? prev.close : price
        bar = {
          time: bucketMs,
          open,
          high: price,
          low: price,
          close: price,
          volume: size > 0 ? size : 0,
          tickVolume: size > 0 ? size : 0,
        }
      } else if (bucketMs < prev.time) {
        if (prev.time - bucketMs > periodMs * 2) continue
        continue
      } else {
        const volAdd = size > 0 ? size : 0
        bar = {
          time: prev.time,
          open: prev.open,
          high: Math.max(prev.high, price),
          low: Math.min(prev.low, price),
          close: price,
          volume: (prev.volume ?? 0) + volAdd,
          tickVolume: (prev.tickVolume ?? 0) + volAdd,
        }
      }

      bar = this.applySessionRangeToBar(chartSymbol, bar)
      this.logBarPatch(chartSymbol, bar, 'update')
      this.dispatchLiveBar(key, bar, resolution)
    }
  }

  /** Apply cached session high/low/close to the current-period forming bar. */
  private patchFormingBarFromSession(
    chartSymbol: string,
    patch: { high?: number; low?: number; close?: number },
    source: 'latest_high_low' | 'latest_close' | 'session_cache',
  ): void {
    const hasHigh = patch.high != null && Number.isFinite(patch.high)
    const hasLow = patch.low != null && Number.isFinite(patch.low)
    const hasClose = patch.close != null && Number.isFinite(patch.close)
    if (!hasHigh && !hasLow && !hasClose) return

    this.rememberSession(chartSymbol, {
      high: hasHigh ? patch.high! : undefined,
      low: hasLow ? patch.low! : undefined,
      close: hasClose ? patch.close! : undefined,
    })

    for (const [key, subs] of this.keyToSubs.entries()) {
      if (!subs.size) continue
      if (!key.startsWith(`${chartSymbol}__`)) continue

      const resolution = key.split('__')[1] || '1'
      const periodMs = this.barPeriodMs(resolution)
      const bucketMs = this.barOpenTimeMs(Date.now(), periodMs)
      const prev = this.lastBarByKey.get(key)

      const refPrice = hasClose
        ? patch.close!
        : hasHigh && hasLow
          ? (patch.high! + patch.low!) / 2
          : patch.high ?? patch.low ?? prev?.close

      if (refPrice == null || !Number.isFinite(refPrice)) continue

      let bar: Bar
      if (!prev || bucketMs > prev.time) {
        const open = prev?.close ?? refPrice
        bar = {
          time: bucketMs,
          open,
          high: hasHigh ? patch.high! : Math.max(open, refPrice),
          low: hasLow ? patch.low! : Math.min(open, refPrice),
          close: hasClose ? patch.close! : open,
          volume: 0,
          tickVolume: 0,
        }
      } else if (bucketMs < prev.time) {
        continue
      } else {
        bar = {
          time: prev.time,
          open: prev.open,
          high: hasHigh ? patch.high! : prev.high,
          low: hasLow ? patch.low! : prev.low,
          close: hasClose ? patch.close! : prev.close,
          volume: prev.volume ?? 0,
          tickVolume: prev.tickVolume ?? 0,
        }
      }

      bar = this.applySessionRangeToBar(chartSymbol, bar)
      this.logBarPatch(chartSymbol, bar, source)
      this.dispatchLiveBar(key, bar, resolution)
    }
  }

  private flushSessionToFormingBars(chartSymbol: string): void {
    const s = this.sessionBySymbol.get(chartSymbol)
    if (!s) return
    this.patchFormingBarFromSession(
      chartSymbol,
      {
        high: s.high ?? undefined,
        low: s.low ?? undefined,
        close: s.close ?? undefined,
      },
      'session_cache',
    )
  }

  getLastBarForChart(chart: { symbol?: () => string; resolution?: () => string }): Bar | null {
    if (!chart?.symbol || !chart?.resolution) return null
    const { chartSymbol } = parseSymbol(chart.symbol())
    const resolution = String(chart.resolution())
    return this.lastBarByKey.get(this.keyFor(chartSymbol, resolution)) ?? null
  }

  private notifyMarketBook(): void {
    this.marketBookListeners.forEach((fn) => {
      try {
        fn()
      } catch {
        /* ignore */
      }
    })
  }

  private mergeMarketBook(patch: Partial<RithmicMarketBook>): void {
    const prev = this.marketBook
    this.marketBook = {
      bid: patch.bid !== undefined ? patch.bid : (prev?.bid ?? null),
      ask: patch.ask !== undefined ? patch.ask : (prev?.ask ?? null),
      bidSize: patch.bidSize !== undefined ? patch.bidSize : (prev?.bidSize ?? null),
      askSize: patch.askSize !== undefined ? patch.askSize : (prev?.askSize ?? null),
      last: patch.last !== undefined ? patch.last : (prev?.last ?? null),
      sessionHigh: patch.sessionHigh !== undefined ? patch.sessionHigh : (prev?.sessionHigh ?? null),
      sessionLow: patch.sessionLow !== undefined ? patch.sessionLow : (prev?.sessionLow ?? null),
      sessionClose: patch.sessionClose !== undefined ? patch.sessionClose : (prev?.sessionClose ?? null),
      settlement: patch.settlement !== undefined ? patch.settlement : (prev?.settlement ?? null),
    }
    this.notifyMarketBook()
  }

  private ensureMdsListeners(): void {
    if (!this.mds || this.offBar) return
    this.offBar = this.mds.on('bar', (msg) => {
      const key = this.keyFor(msg.symbol, msg.resolution)
      const subs = this.keyToSubs.get(key)
      if (!subs?.size) return
      const vol = Number(msg.v ?? 0)
      let bar: Bar = {
        time: this.normalizeBarTimeMs(Number(msg.time)),
        open: Number(msg.o),
        high: Number(msg.h),
        low: Number(msg.l),
        close: Number(msg.c),
        volume: vol,
        tickVolume: vol,
      }
      bar = this.applySessionRangeToBar(msg.symbol, bar)
      logRithmicBar(msg.symbol, {
        time: bar.time,
        close: bar.close,
        volume: vol,
        resolution: msg.resolution,
      })
      this.dispatchLiveBar(key, bar, msg.resolution)
    })
    this.offQuote = this.mds.on('quote', (quote) => {
      logRithmicQuote(quote.symbol, {
        bid: quote.bid?.price,
        ask: quote.ask?.price,
        bidSize: quote.bid?.size,
        askSize: quote.ask?.size,
      })
      this.mergeMarketBook({
        bid: quote.bid?.price ?? null,
        ask: quote.ask?.price ?? null,
        bidSize: quote.bid?.size ?? null,
        askSize: quote.ask?.size ?? null,
      })
    })
    this.offLatestHighLow = this.mds.on('latest_high_low', (row) => {
      if (row.high == null && row.low == null) return
      logRithmicLatestHighLow(row.symbol, { high: row.high, low: row.low })
      this.mergeMarketBook({
        sessionHigh: row.high ?? this.marketBook?.sessionHigh ?? null,
        sessionLow: row.low ?? this.marketBook?.sessionLow ?? null,
      })
      this.patchFormingBarFromSession(
        row.symbol,
        { high: row.high, low: row.low },
        'latest_high_low',
      )
    })
    this.offLatestClose = this.mds.on('latest_close', (row) => {
      const close =
        row.close != null && Number.isFinite(row.close)
          ? row.close
          : row.settlement != null && Number.isFinite(row.settlement)
            ? row.settlement
            : undefined
      logRithmicLatestClose(row.symbol, {
        close: row.close,
        settlement: row.settlement,
        price_type: row.price_type,
        close_date: row.close_date,
        settlement_date: row.settlement_date,
      })
      this.mergeMarketBook({
        sessionClose: close ?? this.marketBook?.sessionClose ?? null,
        settlement: row.settlement ?? this.marketBook?.settlement ?? null,
      })
      if (close != null) {
        this.patchFormingBarFromSession(row.symbol, { close }, 'latest_close')
      }
    })
    this.offUpdate = this.mds.on('update', (update) => {
      if (update.price == null) return
      logRithmicTrade(update.symbol, {
        price: update.price,
        size: update.size,
        side: update.side,
      })
      this.mergeMarketBook({ last: Number(update.price) })
      this.applyTradeUpdate(update.symbol, update)
    })
  }

  ensureMarketBookSubscription(chartLabel: string): void {
    if (!this.mds) return
    this.ensureMdsListeners()
    const { chartSymbol } = parseSymbol(chartLabel)
    const resolution = this.activeSubKey?.split('__')[1] || '1'
    this.mds.subscribe(chartSymbol, resolution)
  }

  subscribeMarketBook(listener: () => void): () => void {
    this.marketBookListeners.add(listener)
    return () => this.marketBookListeners.delete(listener)
  }

  getMarketBookForChart(_chartSymbol: string): RithmicMarketBook | null {
    return this.marketBook
  }

  isDelayedMarketData(): boolean {
    return false
  }

  resolveStreamInstrument(chartLabel: string): string {
    return parseSymbol(chartLabel).chartSymbol
  }

  getTickSize(symbol: string): number {
    return rithmicTickSize(this.lookupRow(symbol)) ?? 0.25
  }

  getTickValue(symbol: string): number {
    return rithmicTickValue(this.lookupRow(symbol)) ?? 0.5
  }

  onReady(callback: (config: object) => void): void {
    void this.ensureSymbolsLoaded().finally(() => {
      callback({
        supported_resolutions: RESOLUTIONS,
        supports_search: true,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_group_request: false,
      })
    })
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    _symbolType: string,
    onResult: (symbols: RithmicSearchSymbolResult[]) => void
  ): void {
    const q = userInput.trim()

    void this.ensureSymbolsLoaded()
      .then((rows) =>
        searchRithmicSymbolRows(rows, {
          query: q || undefined,
          exchange: exchange || undefined,
          limit: q ? 30 : 200,
        })
      )
      .then((rows) => rows.map((row) => rithmicRowToSearchSymbolResult(row)))
      .then(onResult)
      .catch((err) => {
        console.error('[RithmicHistoryDatafeed] searchSymbols failed:', err)
        onResult([])
      })
  }

  resolveSymbol(
    symbolName: string,
    onResolve: (info: LibrarySymbolInfo) => void,
    onError: (reason: string) => void
  ): void {
    const name = symbolName.trim()
    if (!name) {
      setTimeout(() => onError('Invalid symbol'), 0)
      return
    }

    void this.ensureSymbolIndex()
      .then((index) => {
        const row = findRithmicSymbolRow(index, name)
        if (row) {
          onResolve(rithmicRowToLibrarySymbolInfo(row))
          return
        }

        const query = name.includes(':') ? name.split(':').pop()! : name
        return this.ensureSymbolsLoaded().then((rows) => {
          const matches = searchRithmicSymbolRows(rows, { query, limit: 5 })
          const exact =
            matches.find(
              (r) =>
                r.ticker?.toUpperCase() === name.toUpperCase() ||
                r.symbol?.toUpperCase() === name.toUpperCase()
            ) ?? matches[0]

          if (!exact) {
            throw new Error('Symbol not found')
          }
          onResolve(rithmicRowToLibrarySymbolInfo(exact))
        })
      })
      .catch((err) => onError(String(err?.message || err)))
  }

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: { from: number; to: number; firstDataRequest?: boolean; countBack?: number },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (reason: string) => void
  ): void {
    const { symbol, exchange, chartSymbol } = parseSymbol(
      String(symbolInfo.name || symbolInfo.ticker || 'CME:MNQ')
    )
    const resKey = this.keyFor(chartSymbol, String(resolution))
    const from = Math.floor(periodParams.from)
    const to = Math.floor(periodParams.to)
    const barSec = resolutionToSeconds(String(resolution))
    const estimatedBars = Math.ceil((to - from) / barSec) + 2
    const countback = Math.min(
      5000,
      periodParams.countBack != null
        ? Math.max(1, periodParams.countBack)
        : Math.max(301, estimatedBars)
    )

    void rithmicAPI
      .getHistory({ symbol, exchange, resolution, from, to, countback })
      .then((data) => {
        if (data.s === 'no_data' || !data.t?.length) {
          onResult([], { noData: true })
          return
        }
        if (data.s !== 'ok') {
          throw new Error(data.message || `History status: ${data.s}`)
        }
        const bars: Bar[] = []
        for (let i = 0; i < data.t.length; i++) {
          const vol = data.v?.[i] ?? 0
          bars.push({
            time: this.normalizeBarTimeMs(data.t[i]!),
            open: data.o![i],
            high: data.h![i],
            low: data.l![i],
            close: data.c![i],
            volume: vol,
            tickVolume: vol,
          })
        }
        if (bars.length) {
          const last = bars[bars.length - 1]!
          this.lastBarByKey.set(resKey, last)
          this.lastBarTimeByKey.set(resKey, last.time)
        }
        logRithmicHistory(chartSymbol, bars, {
          from,
          to,
          resolution: String(resolution),
        })
        onResult(bars, { noData: false })
      })
      .catch((err) => onError(String(err?.message || err)))
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string
  ): void {
    const tvLabel = String(symbolInfo.name || symbolInfo.ticker || symbolInfo.symbol || '')
    const { chartSymbol } = parseSymbol(
      String(symbolInfo.ticker || symbolInfo.name || symbolInfo.symbol || 'CME:MNQ')
    )
    const key = this.keyFor(chartSymbol, String(resolution))

    if (!this.keyToSubs.has(key)) {
      this.keyToSubs.set(key, new Map())
    }
    this.keyToSubs.get(key)!.set(listenerGuid, onTick)
    this.resKeyToChartSymbol.set(key, tvLabel)

    if (!this.mds) return

    this.ensureMdsListeners()
    const isNewStream = this.activeSubKey !== key
    if (isNewStream) {
      this.activeSubKey = key
      this.mds.subscribe(chartSymbol, String(resolution))
    }
    this.flushSessionToFormingBars(chartSymbol)
  }

  unsubscribeBars(listenerGuid: string): void {
    for (const [key, subs] of this.keyToSubs.entries()) {
      if (!subs.has(listenerGuid)) continue
      subs.delete(listenerGuid)
      if (subs.size === 0) {
        this.keyToSubs.delete(key)
        this.lastBarTimeByKey.delete(key)
        this.lastBarByKey.delete(key)
        this.resKeyToChartSymbol.delete(key)
        if (this.activeSubKey === key) {
          this.activeSubKey = null
          this.mds?.unsubscribe()
        }
      }
    }
  }
}

export type RithmicPreviewChartServices = {
  accountId: string
  mds: RithmicMdsClient
  datafeed: RithmicHistoryDatafeed
  streamConfig: { delayed: false }
}

export function prepareRithmicPreviewChartServices(
  accountId: string,
  options?: {
    mds?: RithmicMdsClient
    bootstrapSymbol?: string
    bootstrapResolution?: string
  }
): RithmicPreviewChartServices {
  const mds = options?.mds ?? new RithmicMdsClient()
  const datafeed = new RithmicHistoryDatafeed(mds)

  const bootstrapSymbol = String(options?.bootstrapSymbol || 'MNQ').trim()
  const { chartSymbol } = parseSymbol(
    bootstrapSymbol.includes(':') ? bootstrapSymbol : `CME:${bootstrapSymbol}`
  )
  const resolution = String(options?.bootstrapResolution || '1')

  mds.connect(accountId, { chartSymbol, resolution })

  return {
    accountId,
    mds,
    datafeed,
    streamConfig: { delayed: false },
  }
}

export function teardownRithmicPreviewChartServices(services: RithmicPreviewChartServices | null): void {
  if (!services) return
  services.datafeed.setChartResetCallback(null)
  services.mds.disconnect()
}
