import {
  IDatafeedChartApi,
  LibrarySymbolInfo,
  ResolutionString,
  SubscribeBarsCallback,
  Bar,
} from '../../types/chart'
import { getApiBaseUrl, getAuthHeaders } from '../../api/api'
import { TradeseaMdsClient } from './TradeseaMdsClient'
import type { TradeseaTradeHandler } from './TradeseaTradeHandler'
import { debugTradeseaUpl } from './tradeseaDebug'
import { debugPracticeChartSymbol } from './practiceChartSymbolDebug'
import { saveLoadedCandlesChunk } from '../debug/candleDebugCapture'
import { candleDebug } from './candleDebug'
import { tradeseaDollarsPerPoint, tradeseaDollarsPerTick } from './tradeseaPnL'
import {
  tradeseaInstrumentsAllSymbolsUrl,
  tradeseaInstrumentsSearchUrl,
} from './tradeseaEndpoints'
import { normalizeTradeseaStreamInstrument, normalizeTradeseaTradeInstrument } from './tradeseaInstrument'
import {
  TRADESEA_INTRADAY_MULTIPLIERS,
  TRADESEA_SECONDS_MULTIPLIERS,
  TRADESEA_SUPPORTED_RESOLUTIONS,
  tradeseaResolutionToSeconds,
} from './tradeseaResolutions'
import {
  TradeseaInstrumentRow,
  buildInstrumentIndex,
  findInstrument,
  resolveProductSymbol as resolveProductSymbolFromCatalog,
  instrumentToLibrarySymbolInfo,
  instrumentToSearchSymbolResult,
  librarySymbolDisplayName,
  librarySymbolStreamTicker,
  parseTradeseaJsonArray,
  searchRowToSearchSymbolResult,
  udfSymbolToLibrarySymbolInfo,
  TradeseaSearchSymbolResult,
} from './tradeseaSymbolInfo'
import { TradeseaMarketBookStore, type TradeseaMarketBook } from './tradeseaMarketBook'
import { isSymbolMarketOpen } from '../../utils/marketSession'
import { isBwcChartPanning, whenBwcPanEnds } from '../../utils/bwcPan'

export type { TradeseaMarketBook } from './tradeseaMarketBook'

const HISTORY_CACHE_TTL_MS = 90_000
const HISTORY_MAX_RETRIES = 4
const HISTORY_RETRY_BASE_MS = 1_200
const HISTORY_REQUEST_TIMEOUT_MS = 15_000
/** Wait for MDS resubscribeAll before verifying book subs. */
const MDS_OPEN_BOOK_VERIFY_MS = 450

type UdfHistoryResponse = {
  s?: string
  t?: number[]
  o?: number[]
  h?: number[]
  l?: number[]
  c?: number[]
  v?: number[]
  errmsg?: string
  message?: string
}

type TvQuote = {
  s: 'ok'
  n: string
  v: { bid: number; ask: number; lp?: number }
}

type QuoteSubscription = {
  streamId: string
  symbolKey: string
  callback: (quotes: TvQuote[]) => void
}

export class TradeseaDatafeed implements IDatafeedChartApi {
  private mds: TradeseaMdsClient
  private accountId: string
  private userId: string
  private connectionGroupId: string
  private delayed: boolean
  private keyToSubs = new Map<string, Map<string, SubscribeBarsCallback>>()
  private subIdByKey = new Map<string, number>()
  private lastBarTimeByKey = new Map<string, number>()
  private lastBarByKey = new Map<string, Bar>()
  private offCandles: (() => void) | null = null
  private tradeHandler: TradeseaTradeHandler | import('../practice/PracticeTradeHandler').PracticeTradeHandler | null = null
  private resKeyToChartSymbol = new Map<string, string>()
  private instrumentIndex = new Map<string, TradeseaInstrumentRow>()
  private symbolsLoadPromise: Promise<void> | null = null
  private readonly marketBook = new TradeseaMarketBookStore()
  private marketBookWired = false
  private offMarketBook: Array<() => void> = []
  private bookSubIdsByStream = new Map<string, number[]>()
  private historyFetchChain: Promise<unknown> = Promise.resolve()
  private historyInflight = new Map<string, Promise<UdfHistoryResponse>>()
  private historyCache = new Map<string, { expires: number; data: UdfHistoryResponse }>()
  private chartResetCallback: (() => void) | null = null
  private chartSymbolChangeRequest: ((symbol: string) => void) | null = null
  private quoteSubs = new Map<string, QuoteSubscription>()
  private quoteBookListenerInstalled = false
  private lastDispatchedQuote = new Map<string, { bid: number; ask: number }>()
  private mdsOpenTimer: ReturnType<typeof setTimeout> | null = null
  private tradeBarRaf: number | null = null
  private pendingTradeBar: { symbol: string; resolution: string; bar: Bar } | null = null

  constructor(options: {
    mds: TradeseaMdsClient
    accountId: string
    userId: string
    connectionGroupId: string
    delayed?: boolean
  }) {
    this.mds = options.mds
    this.accountId = options.accountId
    this.userId = options.userId
    this.connectionGroupId = options.connectionGroupId
    this.delayed = Boolean(options.delayed)
    this.ensureMarketBookWired()
    this.offMarketBook.push(
      this.mds.on('open', () => {
        this.onMdsOpen()
      })
    )
    this.offMarketBook.push(
      this.mds.on('connection', (state) => {
        if (state === 'connecting') candleDebug.mdsConnecting()
      })
    )
  }

  private logSymbol(
    event: string,
    detail: Record<string, unknown>,
    options?: { force?: boolean; throttleKey?: string }
  ): void {
    debugPracticeChartSymbol(`TradeseaDatafeed.${event}`, detail, options)
  }

  private ensureMarketBookWired(): void {
    if (this.marketBookWired) return
    this.marketBookWired = true

    this.offMarketBook.push(
      this.mds.on('ltp', (msg) => {
        const id = this.bookStreamId(String(msg.id || ''))
        if (!id || msg.p == null) return
        const price = Number(msg.p)
        this.marketBook.applyLtp(id, price)
        this.dispatchLtpToCandleSubscribers(id, price, Number(msg.t))
      }),
      this.mds.on('bestBidAsk', (msg) => {
        const id = this.bookStreamId(String(msg.id || ''))
        if (!id) return
        this.marketBook.applyBestBidAsk(id, {
          bp: msg.bp,
          ap: msg.ap,
          bs: msg.bs,
          as: msg.as,
        })
      }),
      this.mds.on('quotes', (msg) => {
        const id = this.bookStreamId(String(msg.id || ''))
        if (!id) return
        this.marketBook.applyQuotes(id, {
          p: msg.p,
          bp: msg.bp,
          ap: msg.ap,
          bs: msg.bs,
          as: msg.as,
        })
      }),
      this.mds.on('depth', (msg) => {
        const id = this.bookStreamId(String(msg.id || ''))
        if (!id) return
        this.marketBook.applyDepth(id, { a: msg.a, b: msg.b, u: msg.u })
      }),
      this.mds.on('ttv', (msg) => {
        const id = this.bookStreamId(String(msg.id || ''))
        if (!id) return
        this.marketBook.applyVolumeAtPrice(id, { v: msg.v, u: msg.u })
      })
    )
  }

  getMarketBookForChart(chartSymbol: string): TradeseaMarketBook | null {
    const streamId = this.streamSymbol(chartSymbol)
    return this.marketBook.get(streamId)
  }

  getMarketBookForStream(streamId: string): TradeseaMarketBook | null {
    return this.marketBook.get(streamId)
  }

  /** TradingView / BetterweightChartPro quote API — bid/ask lines on chart. */
  get supportsQuotes(): boolean {
    return true
  }

  private installQuoteBookListener(): void {
    if (this.quoteBookListenerInstalled) return
    this.quoteBookListenerInstalled = true
    this.offMarketBook.push(
      this.marketBook.subscribe((streamId, kind) => {
        if (kind === 'bbo' || kind === 'ltp') {
          this.dispatchQuotesForStream(streamId)
        }
      })
    )
  }

  private buildTvQuote(streamId: string, symbolKey: string): TvQuote | null {
    const book = this.marketBook.get(streamId)
    if (!book) return null
    const bid = book.bestBid
    const ask = book.bestAsk
    if (bid == null || ask == null || !Number.isFinite(bid) || !Number.isFinite(ask)) {
      return null
    }
    const lp = book.last
    return {
      s: 'ok',
      n: symbolKey,
      v: {
        bid,
        ask,
        ...(lp != null && Number.isFinite(lp) ? { lp } : {}),
      },
    }
  }

  private dispatchQuotesForStream(streamId: string): void {
    for (const sub of this.quoteSubs.values()) {
      if (sub.streamId !== streamId) continue
      const quote = this.buildTvQuote(streamId, sub.symbolKey)
      if (!quote) continue
      const prev = this.lastDispatchedQuote.get(streamId)
      if (prev && prev.bid === quote.v.bid && prev.ask === quote.v.ask) continue
      this.lastDispatchedQuote.set(streamId, { bid: quote.v.bid, ask: quote.v.ask })
      try {
        sub.callback([quote])
      } catch {
        /* ignore */
      }
    }
  }

  private quoteKeysForSymbolInfo(info: LibrarySymbolInfo): {
    chartSymbol: string
    streamId: string
    symbolKey: string
  } | null {
    const chartSymbol = librarySymbolDisplayName(info).trim()
    const streamId = this.streamSymbol(librarySymbolStreamTicker(info))
    if (!streamId) return null
    return {
      chartSymbol: chartSymbol || streamId,
      streamId,
      symbolKey: chartSymbol || streamId,
    }
  }

  getQuotes(
    symbolInfos: LibrarySymbolInfo | LibrarySymbolInfo[]
  ): Promise<TvQuote[]> {
    const list = Array.isArray(symbolInfos) ? symbolInfos : [symbolInfos]
    const out: TvQuote[] = []
    for (const info of list) {
      const keys = this.quoteKeysForSymbolInfo(info)
      if (!keys) continue
      this.ensureMarketBookSubscription(keys.chartSymbol)
      const quote = this.buildTvQuote(keys.streamId, keys.symbolKey)
      if (quote) out.push(quote)
    }
    return Promise.resolve(out)
  }

  subscribeQuotes(
    symbolInfos: LibrarySymbolInfo | LibrarySymbolInfo[],
    onQuotes: (quotes: TvQuote[]) => void,
    listenerGuid: string
  ): void {
    const list = Array.isArray(symbolInfos) ? symbolInfos : [symbolInfos]
    const info = list[0]
    if (!info) return

    const keys = this.quoteKeysForSymbolInfo(info)
    if (!keys) return

    this.installQuoteBookListener()
    this.ensureMarketBookSubscription(keys.chartSymbol)

    candleDebug.quotesSubscribe(keys.chartSymbol, listenerGuid)

    this.quoteSubs.set(listenerGuid, {
      streamId: keys.streamId,
      symbolKey: keys.symbolKey,
      callback: onQuotes,
    })

    const snap = this.buildTvQuote(keys.streamId, keys.symbolKey)
    if (snap) {
      try {
        onQuotes([snap])
      } catch {
        /* ignore */
      }
    }
  }

  unsubscribeQuotes(listenerGuid: string): void {
    if (this.quoteSubs.has(listenerGuid)) {
      candleDebug.quotesUnsubscribe(listenerGuid)
    }
    this.quoteSubs.delete(listenerGuid)
  }

  subscribeMarketBook(
    listener: (streamId: string, kind: import('./tradeseaMarketBook').MarketBookUpdateKind) => void
  ): () => void {
    return this.marketBook.subscribe(listener)
  }

  /** MDS opened — refresh bootstrap metadata and verify book subs. */
  private onMdsOpen(): void {
    const streamTickers = new Set<string>()
    let candleResolution = '1'
    for (const [key] of this.subIdByKey.entries()) {
      const sep = key.indexOf('__')
      if (sep <= 0) continue
      const streamSym = key.slice(0, sep)
      const res = key.slice(sep + 2)
      if (streamSym) streamTickers.add(streamSym)
      if (res) candleResolution = res
    }
    if (streamTickers.size) {
      this.mds.setBootstrap(
        { symbols: [...streamTickers], resolution: candleResolution },
        { apply: false }
      )
    }

    candleDebug.mdsOpen([...streamTickers], candleResolution)

    const chartSymbols = [...this.resKeyToChartSymbol.values()]
      .map((s) => String(s || '').trim())
      .filter(Boolean)

    if (this.mdsOpenTimer) clearTimeout(this.mdsOpenTimer)
    this.mdsOpenTimer = setTimeout(() => {
      this.mdsOpenTimer = null
      for (const label of chartSymbols) {
        const streamId = this.streamSymbol(label)
        if (streamId && this.mds.hasBookSubscriptionsFor(streamId)) {
          this.bookSubIdsByStream.set(streamId, [])
          continue
        }
        this.ensureMarketBookSubscription(label)
      }
    }, MDS_OPEN_BOOK_VERIFY_MS)
  }

  refreshMdsSubscriptions(): void {
    this.onMdsOpen()
  }

  /** Ensure the official MDS chart/book streams for one stream ticker. */
  ensureMarketBookSubscription(chartSymbol: string): void {
    const streamId = this.streamSymbol(chartSymbol)
    if (!streamId) return

    const tracked = this.bookSubIdsByStream.get(streamId)
    if (tracked && tracked.length > 0) {
      candleDebug.bookSubscribeSkip(chartSymbol, 'dedicated')
      this.logSymbol(
        'ensureMarketBookSubscription:skip',
        { chartSymbol, streamId, reason: 'dedicated' },
        { throttleKey: `book-skip:${streamId}` }
      )
      return
    }
    if (this.mds.hasBookSubscriptionsFor(streamId)) {
      this.bookSubIdsByStream.set(streamId, [])
      candleDebug.bookSubscribeSkip(chartSymbol, 'active')
      this.logSymbol(
        'ensureMarketBookSubscription:skip',
        { chartSymbol, streamId, reason: 'active' },
        { throttleKey: `book-active:${streamId}` }
      )
      return
    }

    if (tracked) {
      this.bookSubIdsByStream.delete(streamId)
    }
    this.logSymbol('ensureMarketBookSubscription', { chartSymbol, streamId }, { force: true })
    const bookEntries: Array<{ kind: string; subId: number }> = []
    const ltpId = this.mds.subscribeLtp([streamId])
    bookEntries.push({ kind: 'ltp', subId: ltpId })
    const bbaId = this.mds.subscribeBestBidAsk([streamId])
    bookEntries.push({ kind: 'bba', subId: bbaId })
    const quotesId = this.mds.subscribeQuotes([streamId])
    bookEntries.push({ kind: 'quotes', subId: quotesId })
    const ttvId = this.mds.subscribeTtv([streamId])
    bookEntries.push({ kind: 'ttv', subId: ttvId })
    const marketModeId = this.mds.subscribeMarketMode([streamId])
    bookEntries.push({ kind: 'market-mode', subId: marketModeId })
    const subs = [ltpId, bbaId, quotesId, ttvId, marketModeId]
    if (this.mds.isMarketDepthEntitled()) {
      const depthId = this.mds.subscribeDepth([streamId])
      if (depthId >= 0) {
        subs.push(depthId)
        bookEntries.push({ kind: 'dom', subId: depthId })
      }
    }
    candleDebug.bookSubscribe(chartSymbol, bookEntries)
    this.bookSubIdsByStream.set(streamId, subs)
  }

  /** Release a trade-panel-only book once no chart pane uses its stream. */
  releaseMarketBookSubscription(chartSymbol: string): void {
    const streamId = this.streamSymbol(chartSymbol)
    if (!streamId) return
    const streamStillUsed = [...this.subIdByKey.keys()].some(
      (activeKey) => this.parseResKey(activeKey)?.streamId === streamId
    )
    if (streamStillUsed) return

    const bookSubIds = this.bookSubIdsByStream.get(streamId)
    if (bookSubIds?.length) {
      for (const bookSubId of bookSubIds) this.mds.unsubscribe(bookSubId)
    }
    this.bookSubIdsByStream.delete(streamId)
  }

  isDelayedMarketData(): boolean {
    return this.delayed
  }

  setTradeHandler(handler: TradeseaTradeHandler | import('../practice/PracticeTradeHandler').PracticeTradeHandler | null): void {
    this.tradeHandler = handler
    debugTradeseaUpl('datafeed:tradeHandler', {
      force: true,
      tradeHandlerSet: Boolean(handler),
    })
  }

  clearHistoryCache(): void {
    this.historyCache.clear()
  }

  /** Drop candle WS subs + listener maps before BWC remount (e.g. MDS reconnect). */
  teardownCandleStreams(): void {
    if (this.tradeBarRaf != null) {
      cancelAnimationFrame(this.tradeBarRaf)
      this.tradeBarRaf = null
      this.pendingTradeBar = null
    }
    for (const subId of this.subIdByKey.values()) {
      this.mds.unsubscribe(subId)
    }
    this.subIdByKey.clear()
    this.keyToSubs.clear()
    this.lastBarTimeByKey.clear()
    this.lastBarByKey.clear()
    this.resKeyToChartSymbol.clear()
    if (this.offCandles) {
      this.offCandles()
      this.offCandles = null
    }
  }

  /** @deprecated Prefer MDS open listener in AurenChart; kept for callers that set it explicitly. */
  setChartResetCallback(callback: (() => void) | null): void {
    this.chartResetCallback = callback
  }

  setChartSymbolChangeRequest(callback: ((symbol: string) => void) | null): void {
    this.chartSymbolChangeRequest = callback
  }

  requestChartSymbolChange(chartSymbol: string): void {
    this.chartSymbolChangeRequest?.(chartSymbol)
  }

  private parseResKey(resKey: string): { streamId: string; resolution: string } | null {
    const sep = resKey.indexOf('__')
    if (sep <= 0) return null
    const streamId = resKey.slice(0, sep)
    const resolution = resKey.slice(sep + 2)
    if (!streamId || !resolution) return null
    return { streamId, resolution }
  }

  private barPeriodMs(resolution: string): number {
    return tradeseaResolutionToSeconds(resolution) * 1000
  }

  private udfRowsToBars(data: UdfHistoryResponse, resolution: string): Bar[] {
    if (data.s === 'no_data' || !data.t?.length || data.s !== 'ok') return []
    const bars: Bar[] = []
    for (let i = 0; i < data.t.length; i++) {
      const vol = data.v?.[i] ?? 0
      bars.push(
        this.normalizeLiveBar(
          {
            time: data.t[i],
            open: data.o![i],
            high: data.h![i],
            low: data.l![i],
            close: data.c![i],
            volume: vol,
            tickVolume: vol,
          },
          resolution
        )
      )
    }
    return bars
  }

  private dispatchBarToSubscribers(
    resKey: string,
    resolution: string,
    streamId: string,
    bar: Bar,
    options?: { force?: boolean }
  ): void {
    const subs = this.keyToSubs.get(resKey)
    if (!subs?.size) return

    const barTime = this.alignBarTimeMs(bar.time, resolution)
    const normalizedBar: Bar = { ...bar, time: barTime }
    const last = this.lastBarTimeByKey.get(resKey) ?? 0
    const alignedLast = last > 0 ? this.alignBarTimeMs(last, resolution) : 0

    const chartSymbolForBar =
      this.resKeyToChartSymbol.get(resKey) ?? streamId

    if (!options?.force && alignedLast > 0 && barTime < alignedLast) {
      candleDebug.skipOlder({
        chartSymbol: chartSymbolForBar,
        resolution,
        barTimeMs: barTime,
        lastTimeMs: alignedLast,
      })
      return
    }

    const nextLast = Math.max(alignedLast, barTime)
    this.lastBarTimeByKey.set(resKey, nextLast)
    this.lastBarByKey.set(resKey, normalizedBar)

    this.lastBarByKey.set(this.keyFor(chartSymbolForBar, resolution), normalizedBar)

    if (alignedLast === 0 || barTime > alignedLast) {
      candleDebug.newBar({
        chartSymbol: chartSymbolForBar,
        resolution,
        barTimeMs: barTime,
        close: normalizedBar.close,
        prevTimeMs: alignedLast > 0 ? alignedLast : undefined,
      })
    } else {
      candleDebug.forming({
        resKey,
        chartSymbol: chartSymbolForBar,
        resolution,
        barTimeMs: barTime,
        close: normalizedBar.close,
      })
    }

    subs.forEach((cb) => {
      try {
        cb(normalizedBar)
      } catch {
        /* ignore */
      }
    })

    const bookId = this.bookStreamId(streamId)
    if (bookId && Number.isFinite(normalizedBar.close)) {
      this.marketBook.applyLtp(bookId, normalizedBar.close)
    }
    this.scheduleTradeHandlerBar(chartSymbolForBar, resolution, normalizedBar)
  }

  /**
   * Resolve exact and product-equivalent subscriptions. Some MDS venues emit a
   * canonical id that differs from the UDF/search ticker (notably metals).
   */
  private candleSubscriptionKeys(streamId: string): Array<{
    key: string
    resolution: string
  }> {
    const incomingProduct = resolveProductSymbolFromCatalog(streamId, this.instrumentIndex)
    const matches: Array<{ key: string; resolution: string }> = []
    for (const key of this.keyToSubs.keys()) {
      const sep = key.lastIndexOf('__')
      if (sep <= 0) continue
      const subscribedStream = key.slice(0, sep)
      const resolution = key.slice(sep + 2)
      if (subscribedStream === streamId) {
        matches.push({ key, resolution })
        continue
      }
      const subscribedProduct = resolveProductSymbolFromCatalog(
        subscribedStream,
        this.instrumentIndex
      )
      if (
        incomingProduct &&
        subscribedProduct &&
        incomingProduct === subscribedProduct
      ) {
        matches.push({ key, resolution })
      }
    }
    return matches
  }

  /**
   * Keep the forming candle moving from last-trade ticks when an instrument's
   * dedicated candle stream is sparse or absent. Native candle frames still
   * replace this fallback with authoritative OHLCV whenever they arrive.
   */
  private dispatchLtpToCandleSubscribers(
    streamId: string,
    price: number,
    time: number
  ): void {
    if (!Number.isFinite(price)) return
    for (const { key, resolution } of this.candleSubscriptionKeys(streamId)) {
      if (String(resolution).toUpperCase().endsWith('T')) continue
      const barTime = this.alignBarTimeMs(
        Number.isFinite(time) && time > 0 ? time : Date.now(),
        resolution
      )
      const previous = this.lastBarByKey.get(key)
      const sameBar =
        previous != null &&
        this.alignBarTimeMs(previous.time, resolution) === barTime
      const bar: Bar = sameBar
        ? {
            ...previous,
            time: barTime,
            high: Math.max(Number(previous.high ?? price), price),
            low: Math.min(Number(previous.low ?? price), price),
            close: price,
          }
        : {
            time: barTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
            tickVolume: 0,
          }
      this.dispatchBarToSubscribers(key, resolution, streamId, bar)
    }
  }

  /** Run trade overlay after BWC paints (coalesced to one rAF per frame). */
  private scheduleTradeHandlerBar(symbol: string, resolution: string, bar: Bar): void {
    if (!this.tradeHandler) return
    this.pendingTradeBar = { symbol, resolution, bar }
    if (isBwcChartPanning()) {
      whenBwcPanEnds(() => {
        const pending = this.pendingTradeBar
        if (!pending || !this.tradeHandler) return
        this.pendingTradeBar = null
        this.tradeHandler.onRealTimeBar(pending.symbol, pending.resolution, pending.bar)
      })
      return
    }
    if (this.tradeBarRaf != null) return
    this.tradeBarRaf = requestAnimationFrame(() => {
      this.tradeBarRaf = null
      const pending = this.pendingTradeBar
      this.pendingTradeBar = null
      if (!pending || !this.tradeHandler) return
      if (isBwcChartPanning()) {
        this.pendingTradeBar = pending
        this.scheduleTradeHandlerBar(pending.symbol, pending.resolution, pending.bar)
        return
      }
      this.tradeHandler.onRealTimeBar(pending.symbol, pending.resolution, pending.bar)
    })
  }

  private normalizeBarTimeMs(time: number): number {
    if (!Number.isFinite(time) || time <= 0) return Date.now()
    return time < 1e12 ? time * 1000 : time
  }

  /** Snap bar open time to resolution boundary (ms) so history + MDS ticks match. */
  private alignBarTimeMs(time: number, resolution: string): number {
    const periodSec = Math.max(1, tradeseaResolutionToSeconds(resolution))
    const ms = this.normalizeBarTimeMs(time)
    const sec = Math.floor(ms / 1000)
    return Math.floor(sec / periodSec) * periodSec * 1000
  }

  private alignBarTimeSec(timeSec: number, resolution: string): number {
    const barSec = Math.max(1, tradeseaResolutionToSeconds(resolution))
    const sec = Math.floor(timeSec)
    return Math.floor(sec / barSec) * barSec
  }

  private buildHistoryParams(
    symbol: string,
    resolution: string,
    fromSec: number,
    toSec: number,
    countback: number
  ): URLSearchParams {
    const params = new URLSearchParams()
    params.set('connection-user-id', this.userId)
    params.set('connection-group-id', this.connectionGroupId)
    params.set('symbol', symbol)
    params.set('resolution', resolution)
    params.set('from', String(Math.floor(fromSec)))
    params.set('to', String(Math.floor(toSec)))
    params.set('countback', String(countback))
    params.set('currencyCode', 'USD')
    return params
  }

  private normalizeLiveBar(bar: Bar, resolution: string): Bar {
    return { ...bar, time: this.alignBarTimeMs(bar.time, resolution) }
  }

  private rememberLastBar(symbolInfo: LibrarySymbolInfo, resolution: string, bar: Bar): void {
    const res = String(resolution)
    const stream = this.streamSymbol(librarySymbolStreamTicker(symbolInfo))
    const chartName = librarySymbolDisplayName(symbolInfo)
    const keys = new Set<string>([
      this.keyFor(stream, res),
      this.keyFor(chartName, res),
      this.keyFor(this.streamSymbol(chartName), res),
    ])
    for (const key of keys) {
      if (!key) continue
      const aligned = this.alignBarTimeMs(bar.time, res)
      const alignedBar = { ...bar, time: aligned }
      this.lastBarByKey.set(key, alignedBar)
      this.lastBarTimeByKey.set(key, aligned)
    }
  }

  getLastBarForChart(chart: { symbol?: () => string; resolution?: () => string }): Bar | null {
    if (!chart?.symbol || !chart?.resolution) return null
    const symbol = chart.symbol()
    const resolution = String(chart.resolution())
    const candidates = [
      this.keyFor(this.streamSymbol(symbol), resolution),
      this.keyFor(symbol, resolution),
    ]
    for (const key of candidates) {
      const bar = this.lastBarByKey.get(key)
      if (bar) return bar
    }
    return null
  }

  getSymbolInfo(symbol: string): LibrarySymbolInfo | undefined {
    const row = findInstrument(this.instrumentIndex, symbol)
    return row ? instrumentToLibrarySymbolInfo(row, this.delayed) : undefined
  }

  isMarketOpenForChart(chartSymbol: string, now?: Date): boolean {
    const info = this.getSymbolInfo(chartSymbol)
    return isSymbolMarketOpen(info, now)
  }

  /** NQ / MNQ / GC — not CME_MINI:NQ or CME-Delayed:MNQ. */
  resolveProductSymbol(chartSymbol: string): string {
    const product = resolveProductSymbolFromCatalog(chartSymbol, this.instrumentIndex)
    this.logSymbol(
      'resolveProductSymbol',
      { chartSymbol, product },
      { throttleKey: `product:${chartSymbol}:${product}` }
    )
    return product
  }

  getTickSize(symbol: string): number {
    const row = findInstrument(this.instrumentIndex, symbol)
    return row?.minTick ?? row?.pipSize ?? 0.25
  }

  /** $ per 1.0 index point (Tradesea catalog `pipValue`, e.g. MNQ = 2). */
  getDollarsPerPoint(symbol: string): number {
    const row = findInstrument(this.instrumentIndex, symbol)
    return tradeseaDollarsPerPoint(row?.pipValue ?? 2)
  }

  /** $ per minimum tick — use with getTickSize in tick-based P&L helpers. */
  getTickValue(symbol: string): number {
    const tickSize = this.getTickSize(symbol)
    return tradeseaDollarsPerTick(tickSize, this.getDollarsPerPoint(symbol))
  }

  private proxyUdfUrl(subPath: string, query: URLSearchParams): string {
    const base = getApiBaseUrl().replace(/\/$/, '')
    query.set('accountId', this.accountId)
    return `${base}/tradesea/proxy/udf/${subPath}?${query.toString()}`
  }

  private async fetchJson<T>(url: string, auth = true): Promise<T> {
    const res = await fetch(url, {
      headers: {
        ...(auth ? getAuthHeaders() : {}),
        Accept: 'application/json',
      },
    })
    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      const snippet = text.trim().slice(0, 120)
      throw new Error(
        res.ok
          ? `Invalid JSON from Tradesea proxy`
          : `Request failed (${res.status})${snippet ? `: ${snippet}` : ''}`
      )
    }
    if (!res.ok) {
      const err = data as { message?: string; error?: string }
      throw new Error(err?.message || err?.error || `Request failed (${res.status})`)
    }
    return data as T
  }

  private historyCacheKey(params: URLSearchParams): string {
    const resolution = params.get('resolution') || '1'
    const barSec = Math.max(1, tradeseaResolutionToSeconds(resolution))
    const from = Number(params.get('from'))
    const to = Number(params.get('to'))
    const alignedFrom = Number.isFinite(from) ? Math.floor(from / barSec) * barSec : from
    const alignedTo = Number.isFinite(to) ? Math.ceil(to / barSec) * barSec : to
    return [
      params.get('symbol'),
      resolution,
      alignedFrom,
      alignedTo,
      params.get('countback'),
    ].join('|')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private historyRetryDelayMs(res: Response, attempt: number): number {
    const retryAfter = res.headers.get('retry-after')
    if (retryAfter) {
      const seconds = Number(retryAfter)
      if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
    }
    return HISTORY_RETRY_BASE_MS * 2 ** attempt
  }

  /** Serialize UDF history calls — TradingView + studies can trigger many parallel getBars. */
  private enqueueHistoryFetch<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.historyFetchChain.then(fn, fn)
    this.historyFetchChain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async fetchHistoryUdf(
    params: URLSearchParams,
    options?: { skipCache?: boolean }
  ): Promise<UdfHistoryResponse> {
    const cacheKey = this.historyCacheKey(params)
    const now = Date.now()
    if (!options?.skipCache) {
      const cached = this.historyCache.get(cacheKey)
      if (cached && cached.expires > now) {
        const sym = params.get('symbol') || ''
        const res = params.get('resolution') || '1'
        candleDebug.cacheHit(sym, res)
        return cached.data
      }
    }

    const inflight = this.historyInflight.get(cacheKey)
    if (inflight) return inflight

    const promise = this.enqueueHistoryFetch(() => this.fetchHistoryUdfOnce(params, cacheKey))
    this.historyInflight.set(cacheKey, promise)
    try {
      return await promise
    } finally {
      this.historyInflight.delete(cacheKey)
    }
  }

  private async fetchHistoryUdfOnce(
    params: URLSearchParams,
    cacheKey: string,
    attempt = 0
  ): Promise<UdfHistoryResponse> {
    const stale = this.historyCache.get(cacheKey)?.data
    const url = this.proxyUdfUrl('history', new URLSearchParams(params))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HISTORY_REQUEST_TIMEOUT_MS)
    let res: Response
    let text: string
    try {
      res = await fetch(url, {
        headers: {
          ...getAuthHeaders(),
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
      text = await res.text()
    } catch (err) {
      if (stale) return stale
      if (controller.signal.aborted) {
        throw new Error(
          `History request timed out after ${Math.round(HISTORY_REQUEST_TIMEOUT_MS / 1000)} seconds`
        )
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
    let data: UdfHistoryResponse | null = null
    try {
      data = text ? (JSON.parse(text) as UdfHistoryResponse) : null
    } catch {
      if (res.status === 429 && attempt < HISTORY_MAX_RETRIES) {
        await this.sleep(this.historyRetryDelayMs(res, attempt))
        return this.fetchHistoryUdfOnce(params, cacheKey, attempt + 1)
      }
      const snippet = text.trim().slice(0, 120)
      throw new Error(
        res.ok
          ? 'Invalid JSON from Tradesea history'
          : `History request failed (${res.status})${snippet ? `: ${snippet}` : ''}`
      )
    }

    if (res.status === 429) {
      if (attempt < HISTORY_MAX_RETRIES) {
        await this.sleep(this.historyRetryDelayMs(res, attempt))
        return this.fetchHistoryUdfOnce(params, cacheKey, attempt + 1)
      }
      if (stale) return stale
      throw new Error('History rate limited (429). Please wait a moment and refresh.')
    }

    if (!res.ok) {
      throw new Error(
        data?.message || data?.errmsg || `History request failed (${res.status})`
      )
    }

    const out = data ?? { s: 'no_data' }
    this.historyCache.set(cacheKey, {
      data: out,
      expires: Date.now() + HISTORY_CACHE_TTL_MS,
    })
    return out
  }

  whenSymbolsReady(): Promise<void> {
    return this.ensureSymbolsLoaded()
  }

  private ensureSymbolsLoaded(): Promise<void> {
    if (this.symbolsLoadPromise) return this.symbolsLoadPromise

    const url = tradeseaInstrumentsAllSymbolsUrl(this.accountId)
    this.symbolsLoadPromise = this.fetchJson<unknown>(url, true)
      .then((data) => {
        const rows = parseTradeseaJsonArray<TradeseaInstrumentRow>(data)
        this.instrumentIndex = buildInstrumentIndex(rows)
      })
      .catch((err) => {
        console.error('[TradeseaDatafeed] Failed to load instruments:', err)
        this.instrumentIndex = new Map()
      })

    return this.symbolsLoadPromise
  }

  private instrumentsSearch(query: string): Promise<TradeseaInstrumentRow[]> {
    const q = query.trim() || 'NQ'
    if (!this.delayed) {
      return this.udfInstrumentSearch(q)
    }
    const url = tradeseaInstrumentsSearchUrl(this.accountId, q)
    return this.fetchJson<unknown>(url, true).then((data) =>
      parseTradeseaJsonArray<TradeseaInstrumentRow>(data)
    )
  }

  /** Prod UDF symbol search — same API as app.tradesea.ai (prod-market-data.tradesea.ai/v1/search). */
  private udfInstrumentSearch(query: string): Promise<TradeseaInstrumentRow[]> {
    const params = new URLSearchParams()
    params.set('query', query)
    return this.fetchJson<unknown>(this.proxyUdfUrl('search', params), true).then((data) =>
      parseTradeseaJsonArray<TradeseaInstrumentRow>(data)
    )
  }

  private resolveUdfSymbol(ticker: string): Promise<LibrarySymbolInfo | null> {
    const streamTicker = this.streamSymbol(ticker)
    const params = new URLSearchParams()
    params.set('connection-user-id', this.userId)
    params.set('connection-group-id', this.connectionGroupId)
    params.set('symbol', streamTicker)
    params.set('currencyCode', 'USD')

    return this.fetchJson<Record<string, unknown>>(this.proxyUdfUrl('symbols', params), true)
      .then((data) => {
        if (!data || typeof data !== 'object') return null
        const row = data as Record<string, unknown>
        if (row.s === 'error') return null
        return udfSymbolToLibrarySymbolInfo(row, this.delayed)
      })
      .catch(() => null)
  }

  resolveStreamInstrument(symbol: string): string {
    return this.streamSymbol(symbol)
  }

  /** MDS `id` is already a stream ticker (e.g. CME:NQ); avoid re-mapping wire ids. */
  private bookStreamId(msgId: string): string {
    const id = String(msgId || '').trim()
    if (!id) return id
    if (id.includes(':')) return id
    return this.streamSymbol(id)
  }

  private streamSymbol(symbol: string): string {
    const trimmed = symbol.trim()
    if (!trimmed) return trimmed

    const fromCatalog = findInstrument(this.instrumentIndex, trimmed)
    const out = fromCatalog?.ticker
      ? normalizeTradeseaStreamInstrument(fromCatalog.ticker, this.delayed)
      : normalizeTradeseaStreamInstrument(trimmed, this.delayed)

    if (out !== trimmed) {
      this.logSymbol(
        'streamSymbol',
        {
          in: trimmed,
          out,
          catalogTicker: fromCatalog?.ticker ?? null,
          delayed: this.delayed,
        },
        { throttleKey: `stream:${trimmed}->${out}` }
      )
    }

    return out
  }

  private keyFor(symbol: string, resolution: string): string {
    return `${symbol}__${resolution}`
  }

  onReady(callback: (configuration: unknown) => void): void {
    void this.ensureSymbolsLoaded()
    setTimeout(() => {
      callback({
        supported_resolutions: TRADESEA_SUPPORTED_RESOLUTIONS,
        supports_search: true,
        supports_quotes: true,
      })
    }, 0)
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (symbols: TradeseaSearchSymbolResult[]) => void
  ): void {
    const q = userInput.trim()

    void this.ensureSymbolsLoaded()
      .then(() => this.instrumentsSearch(q || 'NQ'))
      .then((rows) => rows.map((row) => instrumentToSearchSymbolResult(row, this.delayed)))
      .then(onResult)
      .catch((err) => {
        console.error('[TradeseaDatafeed] searchSymbols failed:', err)
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

    this.logSymbol('resolveSymbol:start', { symbolName: name }, { force: true })

    void this.ensureSymbolsLoaded()
      .then(async () => {
        const instrument = findInstrument(this.instrumentIndex, name)
        const ticker = this.streamSymbol(instrument?.ticker || name)

        const udfInfo = await this.resolveUdfSymbol(ticker)
        if (udfInfo) {
          this.logSymbol(
            'resolveSymbol:udf',
            {
              symbolName: name,
              streamTicker: ticker,
              resolvedName: udfInfo.name,
              resolvedTicker: udfInfo.ticker,
            },
            { force: true }
          )
          onResolve(udfInfo)
          return
        }

        if (instrument) {
          const info = instrumentToLibrarySymbolInfo(instrument, this.delayed)
          this.logSymbol(
            'resolveSymbol:catalog',
            {
              symbolName: name,
              streamTicker: ticker,
              resolvedName: info.name,
              resolvedTicker: info.ticker,
            },
            { force: true }
          )
          onResolve(info)
          return
        }

        const query = name.includes(':') ? name.split(':').pop()! : name
        const rows = await this.instrumentsSearch(query)
        const exact =
          rows.find(
            (r) =>
              r.ticker === name ||
              r.ticker?.toUpperCase() === name.toUpperCase() ||
              r.symbol?.toUpperCase() === name.toUpperCase()
          ) || rows[0]

        if (!exact) {
          throw new Error('Symbol not found')
        }

        const udfFromSearch = await this.resolveUdfSymbol(this.streamSymbol(exact.ticker || exact.symbol || name))
        if (udfFromSearch) {
          this.logSymbol(
            'resolveSymbol:searchUdf',
            {
              symbolName: name,
              resolvedName: udfFromSearch.name,
              resolvedTicker: udfFromSearch.ticker,
            },
            { force: true }
          )
          onResolve(udfFromSearch)
          return
        }

        const info = instrumentToLibrarySymbolInfo(exact, this.delayed)
        this.logSymbol(
          'resolveSymbol:searchCatalog',
          {
            symbolName: name,
            resolvedName: info.name,
            resolvedTicker: info.ticker,
          },
          { force: true }
        )
        onResolve(info)
      })
      .catch((err) => {
        this.logSymbol('resolveSymbol:error', { symbolName: name, error: String(err) }, { force: true })
        console.error('[TradeseaDatafeed] resolveSymbol failed:', err)
        onError(String(err?.message || err))
      })
  }

  getBars(
    symbolInfo: LibrarySymbolInfo | null | undefined,
    resolution: ResolutionString,
    periodParams: { from: number; to: number; firstDataRequest?: boolean; countBack?: number },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (reason: string) => void
  ): void {
    if (!symbolInfo) {
      onResult([], { noData: true })
      return
    }
    const chartSymbol = librarySymbolDisplayName(symbolInfo)
    const symbol = this.streamSymbol(librarySymbolStreamTicker(symbolInfo))
    if (periodParams.firstDataRequest) {
      this.logSymbol(
        'getBars',
        {
          chartSymbol,
          streamSymbol: symbol,
          resolution: String(resolution),
          firstDataRequest: true,
        },
        { force: true }
      )
    }
    const barSec = tradeseaResolutionToSeconds(String(resolution))
    const from = this.alignBarTimeSec(Math.floor(periodParams.from), String(resolution))
    const to = this.alignBarTimeSec(Math.floor(periodParams.to), String(resolution)) + barSec
    const estimatedBars = Math.ceil((to - from) / barSec) + 2
    const countback = Math.min(
      5000,
      periodParams.countBack != null
        ? Math.max(1, periodParams.countBack)
        : Math.max(301, estimatedBars)
    )

    const params = this.buildHistoryParams(symbol, String(resolution), from, to, countback)

    this.fetchHistoryUdf(params)
      .then((data) => {
        if (data.s === 'no_data' || !data.t?.length) {
          candleDebug.history({
            chartSymbol,
            resolution: String(resolution),
            bars: 0,
            noData: true,
            firstLoad: Boolean(periodParams.firstDataRequest),
          })
          onResult([], { noData: true })
          return
        }
        if (data.s !== 'ok') {
          throw new Error(data.errmsg || data.message || `History status: ${data.s}`)
        }
        const bars = this.udfRowsToBars(data, String(resolution))
        candleDebug.history({
          chartSymbol,
          resolution: String(resolution),
          bars: bars.length,
          firstTimeMs: bars[0]?.time,
          lastTimeMs: bars[bars.length - 1]?.time,
          firstLoad: Boolean(periodParams.firstDataRequest),
        })
        if (bars.length > 0) {
          this.rememberLastBar(symbolInfo, String(resolution), bars[bars.length - 1])
        }
        if (periodParams.firstDataRequest) {
          void saveLoadedCandlesChunk({
            symbol: chartSymbol,
            resolution: String(resolution),
            from,
            to,
            udf: {
              s: data.s,
              t: data.t,
              o: data.o,
              h: data.h,
              l: data.l,
              c: data.c,
              v: data.v,
            },
            note: 'firstDataRequest',
          })
        }
        onResult(bars, { noData: false })
      })
      .catch((err) => {
        console.warn('[TradeseaDatafeed] getBars failed:', err)
        onError(String(err?.message || err))
      })
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string
  ): void {
    const chartSymbol = librarySymbolDisplayName(symbolInfo)
    const symbol = this.streamSymbol(librarySymbolStreamTicker(symbolInfo))
    const key = this.keyFor(symbol, String(resolution))

    if (!this.keyToSubs.has(key)) {
      this.keyToSubs.set(key, new Map())
    }
    this.keyToSubs.get(key)!.set(listenerGuid, onTick)

    this.resKeyToChartSymbol.set(key, chartSymbol)

    const isNewStream = !this.subIdByKey.has(key)
    this.logSymbol(
      'subscribeBars',
      {
        chartSymbol,
        streamSymbol: symbol,
        resolution: String(resolution),
        listenerGuid,
        key,
        isNewStream,
        activeKeys: [...this.subIdByKey.keys()],
      },
      { force: true }
    )

    const mdsState = this.mds.getConnectionState()
    const subId = isNewStream
      ? (() => {
          this.ensureMarketBookSubscription(chartSymbol)
          const id = this.mds.subscribeCandles([symbol], [String(resolution)])
          this.subIdByKey.set(key, id)
          return id
        })()
      : this.subIdByKey.get(key) ?? -1

    candleDebug.subscribe(chartSymbol, String(resolution), subId, {
      listenerGuid,
      mdsState,
    })

    if (isNewStream && mdsState === 'connected') {
      candleDebug.mdsOpen([symbol], String(resolution))
    }

    if (isNewStream) {
      if (!this.offCandles) {
        this.offCandles = this.mds.on('candles', (msg) => {
          const streamId = String(msg.id || '')
          const res = String(msg.r || '')
          const vol = msg.v != null ? Number(msg.v) : 0
          const bar = this.normalizeLiveBar(
            {
              time: Number(msg.t),
              open: Number(msg.o),
              high: Number(msg.h),
              low: Number(msg.l),
              close: Number(msg.c),
              volume: vol,
              tickVolume: vol,
            },
            res
          )
          const routes = this.candleSubscriptionKeys(streamId).filter(
            ({ resolution }) => resolution === res
          )
          for (const { key } of routes) {
            this.dispatchBarToSubscribers(key, res, streamId, bar)
          }
        })
      }
    }
  }

  unsubscribeBars(listenerGuid: string): void {
    for (const [key, subs] of this.keyToSubs.entries()) {
      if (!subs.has(listenerGuid)) continue
      subs.delete(listenerGuid)
      if (subs.size === 0) {
        const chartSymbol = this.resKeyToChartSymbol.get(key)
        this.keyToSubs.delete(key)
        this.lastBarTimeByKey.delete(key)
        const subId = this.subIdByKey.get(key)
        if (subId != null) {
          this.mds.unsubscribe(subId)
          this.subIdByKey.delete(key)
        }
        const streamId = this.parseResKey(key)?.streamId
        const streamStillUsed =
          streamId != null &&
          [...this.subIdByKey.keys()].some(
            (activeKey) => this.parseResKey(activeKey)?.streamId === streamId
          )
        if (streamId && !streamStillUsed) {
          const bookSubIds = this.bookSubIdsByStream.get(streamId)
          if (bookSubIds?.length) {
            for (const bookSubId of bookSubIds) this.mds.unsubscribe(bookSubId)
          }
          this.bookSubIdsByStream.delete(streamId)
        }
        this.logSymbol(
          'unsubscribeBars:lastListener',
          { listenerGuid, key, chartSymbol, streamKey: key.split('__')[0] },
          { force: true }
        )
        if (chartSymbol) this.resKeyToChartSymbol.delete(key)
      }
    }
  }
}
