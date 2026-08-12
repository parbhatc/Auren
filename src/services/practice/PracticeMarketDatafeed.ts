import api, { getAuthToken, getWebSocketUrl } from '../../api/api'
import type {
  Bar,
  IDatafeedChartApi,
  LibrarySymbolInfo,
  ResolutionString,
  SubscribeBarsCallback,
} from '../../types/chart'
import type { MdsConnectionState } from '../tradesea/TradeseaMdsClient'
import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'
import {
  resolvePracticeInstrumentTicks,
  snapPracticePriceToTick,
} from './practiceInstrumentTicks'

const RESOLUTIONS = ['30S', '1', '3', '5', '15', '30', '45', '60', '120', '180', '240', '1D', '1W', '1M']
const OVERRIDES = new Set([
  'onReady',
  'searchSymbols',
  'resolveSymbol',
  'getBars',
  'subscribeBars',
  'unsubscribeBars',
  'ensureMarketBookSubscription',
  'releaseMarketBookSubscription',
  'getLastBarForChart',
  'clearHistoryCache',
  'teardownCandleStreams',
  'dispose',
  'getConnectionState',
  'getTickSize',
  'getTickValue',
  'getDollarsPerPoint',
  'resolveProductSymbol',
  'isAutoReconnectEnabled',
  'setAutoReconnectEnabled',
  'reconnect',
  'on',
  '__practiceMarketDatafeed',
])

type SearchResult = {
  symbol: string
  ticker: string
  name: string
  full_name: string
  description: string
  exchange: string
  type: string
  currency_code?: string
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: number
}

type WireSubscribers = Map<string, SubscribeBarsCallback>

type ProviderConfig = {
  streamPath: string
  searchPath: string
}

type StatusEvent = 'connection' | 'open' | 'close' | 'autoReconnect' | 'connectionsLimitBlocked'
type StatusListener = (...args: any[]) => void

function apiRequestPath(path: string): string {
  return path.startsWith('/api/') ? path.slice('/api'.length) : path
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
}

function normalizeSearchResult(item: Record<string, unknown>): SearchResult {
  const contracts = Array.isArray(item.contracts) ? item.contracts as Array<Record<string, unknown>> : []
  const continuous = item.type === 'futures'
    ? contracts.find((contract) => Array.isArray(contract.typespecs) && contract.typespecs.includes('continuous'))
    : undefined
  const symbol = cleanText(item.symbol).toUpperCase()
  const streamSymbol = cleanText(continuous?.symbol || item.symbol).toUpperCase()
  const prefix = cleanText(continuous?.prefix || item.source_id || item.exchange)
  const ticker = prefix ? `${prefix}:${streamSymbol}` : streamSymbol
  return {
    symbol,
    ticker,
    name: ticker,
    full_name: ticker,
    description: cleanText(item.description) || ticker,
    exchange: cleanText(item.exchange),
    type: cleanText(item.type),
    currency_code: cleanText(item.currency_code),
  }
}

class PracticeMarketDatafeed implements IDatafeedChartApi {
  readonly __practiceMarketDatafeed = true
  private ws: WebSocket | null = null
  private connectPromise: Promise<void> | null = null
  private sequence = 0
  private pending = new Map<string, PendingRequest>()
  private symbolInfo = new Map<string, LibrarySymbolInfo>()
  private wireSubscribers = new Map<string, WireSubscribers>()
  private wireByListener = new Map<string, string>()
  private bookSubscriptions = new Map<string, string>()
  private latestBySymbol = new Map<string, Bar>()
  private providerConfigPromise: Promise<ProviderConfig> | null = null
  private connectionState: MdsConnectionState = 'disconnected'
  private autoReconnect = true
  private reconnectTimer: number | null = null
  private statusListeners = new Map<StatusEvent, Set<StatusListener>>()

  constructor(private readonly fallback: Record<string, unknown>) {}

  resolveProductSymbol(chartSymbol: string): string {
    return chartSymbolToProductRoot(chartSymbol)
  }

  getTickSize(symbol: string): number {
    return resolvePracticeInstrumentTicks(symbol).tickSize
  }

  getTickValue(symbol: string): number {
    return resolvePracticeInstrumentTicks(symbol).tickValue
  }

  getDollarsPerPoint(symbol: string): number {
    const { tickSize, tickValue } = resolvePracticeInstrumentTicks(symbol)
    return tickSize > 0 ? tickValue / tickSize : tickValue
  }

  getConnectionState(): MdsConnectionState {
    return this.connectionState
  }

  isAutoReconnectEnabled(): boolean {
    return this.autoReconnect
  }

  setAutoReconnectEnabled(enabled: boolean): void {
    this.autoReconnect = enabled
    this.emitStatus('autoReconnect', enabled)
    if (!enabled && this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  reconnect(): void {
    void this.reconnectAndRestoreSubscriptions()
  }

  on(event: 'connection', handler: (state: MdsConnectionState) => void): () => void
  on(event: 'open', handler: () => void): () => void
  on(event: 'close', handler: () => void): () => void
  on(event: 'autoReconnect', handler: (enabled: boolean) => void): () => void
  on(event: 'connectionsLimitBlocked', handler: () => void): () => void
  on(event: StatusEvent, handler: StatusListener): () => void {
    let listeners = this.statusListeners.get(event)
    if (!listeners) {
      listeners = new Set()
      this.statusListeners.set(event, listeners)
    }
    listeners.add(handler)
    return () => listeners?.delete(handler)
  }

  onReady(callback: (configuration: unknown) => void): void {
    queueMicrotask(() => callback({
      supported_resolutions: RESOLUTIONS,
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
      supports_quotes: true,
    }))
  }

  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: (symbols: unknown[]) => void): void {
    const query = String(userInput || '').trim()
    if (!query) {
      onResult([])
      return
    }
    void this.getProviderConfig().then(({ searchPath }) => api.get(apiRequestPath(searchPath), {
      params: {
        text: query,
        ...(exchange ? { exchange } : {}),
        ...(symbolType ? { search_type: symbolType } : {}),
      },
    })).then((response) => {
      const payload = response.data?.data
      const rows = Array.isArray(payload) ? payload : payload?.symbols || []
      const results = rows.slice(0, 50).map((row: Record<string, unknown>) => normalizeSearchResult(row))
      for (const result of results) this.cacheSearchResult(result)
      onResult(results)
    }).catch(() => onResult([]))
  }

  resolveSymbol(symbolName: string, onResolve: (info: LibrarySymbolInfo) => void, onError: (reason: string) => void): void {
    const key = String(symbolName || '').trim().toUpperCase()
    const cached = this.symbolInfo.get(key)
    if (cached) {
      queueMicrotask(() => onResolve(cached))
      return
    }
    this.searchSymbols(key.split(':').pop() || key, '', '', (rows) => {
      const results = rows as SearchResult[]
      const exact = results.find((row) => row.ticker === key)
        || results.find((row) => row.symbol === key)
        || results[0]
      if (!exact) {
        onError(`Unable to resolve symbol: ${symbolName}`)
        return
      }
      onResolve(this.cacheSearchResult(exact))
    })
  }

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: { from: number; to: number; firstDataRequest?: boolean; countBack?: number },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (reason: string) => void,
  ): void {
    const symbol = String(symbolInfo.ticker || symbolInfo.name).toUpperCase()
    void this.request('history', {
      symbol,
      resolution: String(resolution).toUpperCase(),
      bars: Math.min(5000, Math.max(1, periodParams.countBack || 500)),
      ...(periodParams.to == null ? {} : { to: periodParams.to }),
    }).then((data) => {
      const history = data as { bars?: Bar[]; historyExhausted?: boolean }
      const bars = (history.bars || []).map((bar) => this.normalizeBar(symbol, bar))
      if (bars.length) this.rememberLatest(symbol, bars[bars.length - 1])
      onResult(bars, { noData: bars.length === 0 && Boolean(history.historyExhausted) })
    }).catch((error) => onError(error instanceof Error ? error.message : String(error)))
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
  ): void {
    const symbol = String(symbolInfo.ticker || symbolInfo.name).toUpperCase()
    const normalizedResolution = String(resolution).toUpperCase()
    const subscriptionId = `${symbol}#${normalizedResolution}`
    this.unsubscribeBars(listenerGuid)
    let subscribers = this.wireSubscribers.get(subscriptionId)
    const first = !subscribers
    if (!subscribers) {
      subscribers = new Map()
      this.wireSubscribers.set(subscriptionId, subscribers)
    }
    subscribers.set(listenerGuid, onTick)
    this.wireByListener.set(listenerGuid, subscriptionId)
    if (first) {
      void this.request('subscribe', { subscriptionId, symbol, resolution: normalizedResolution })
        .catch((error) => console.warn('[Practice market data] subscribe failed:', error))
    }
  }

  unsubscribeBars(listenerGuid: string): void {
    const subscriptionId = this.wireByListener.get(listenerGuid)
    if (!subscriptionId) return
    this.wireByListener.delete(listenerGuid)
    const subscribers = this.wireSubscribers.get(subscriptionId)
    subscribers?.delete(listenerGuid)
    if (subscribers?.size) return
    this.wireSubscribers.delete(subscriptionId)
    void this.request('unsubscribe', { subscriptionId }).catch(() => undefined)
  }

  ensureMarketBookSubscription(chartSymbol: string): void {
    const label = String(chartSymbol || '').trim().toUpperCase()
    if (!label || this.bookSubscriptions.has(label)) return
    // Reserve the label immediately so repeated React effects do not create
    // duplicate upstream quote sessions while symbol search is in flight.
    this.bookSubscriptions.set(label, '')
    void this.resolveProviderTicker(label).then((symbol) => {
      if (!this.bookSubscriptions.has(label)) return
      const subscriptionId = `${symbol}#QUOTE`
      this.bookSubscriptions.set(label, subscriptionId)
      return this.request('quote_subscribe', { subscriptionId, symbol })
    }).catch((error) => {
      this.bookSubscriptions.delete(label)
      console.warn('[Practice market data] quote subscription failed:', error)
    })
  }

  releaseMarketBookSubscription(chartSymbol: string): void {
    const label = String(chartSymbol || '').trim().toUpperCase()
    const subscriptionId = this.bookSubscriptions.get(label)
    if (subscriptionId == null) return
    this.bookSubscriptions.delete(label)
    if (subscriptionId) void this.request('unsubscribe', { subscriptionId }).catch(() => undefined)
  }

  getLastBarForChart(chart: { symbol?: () => string; resolution?: () => string }): Bar | null {
    const raw = String(chart?.symbol?.() || '').toUpperCase()
    const info = this.symbolInfo.get(raw)
    const ticker = String(info?.ticker || raw).toUpperCase()
    return this.latestBySymbol.get(ticker) || this.latestBySymbol.get(raw) || null
  }

  clearHistoryCache(): void {}

  teardownCandleStreams(): void {
    for (const subscriptionId of this.wireSubscribers.keys()) {
      void this.request('unsubscribe', { subscriptionId }).catch(() => undefined)
    }
    this.wireSubscribers.clear()
    this.wireByListener.clear()
    for (const subscriptionId of this.bookSubscriptions.values()) {
      if (subscriptionId) void this.request('unsubscribe', { subscriptionId }).catch(() => undefined)
    }
    this.bookSubscriptions.clear()
  }

  dispose(): void {
    this.teardownCandleStreams()
    this.ws?.close(1000, 'practice datafeed disposed')
    this.ws = null
    this.connectPromise = null
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.setConnectionState('disconnected')
    this.statusListeners.clear()
    const dispose = this.fallback.dispose
    if (typeof dispose === 'function') dispose.call(this.fallback)
  }

  private cacheSearchResult(result: SearchResult): LibrarySymbolInfo {
    const tick = this.getTickSize(result.ticker || result.symbol)
    const pricescale = Math.min(1e8, Math.max(1, Math.round(1 / tick)))
    const info: LibrarySymbolInfo = {
      name: result.ticker,
      ticker: result.ticker,
      symbol: result.symbol,
      description: result.description,
      exchange: result.exchange,
      listed_exchange: result.exchange,
      type: result.type,
      currency_code: result.currency_code || 'USD',
      timezone: 'America/New_York',
      session: result.type === 'futures' ? '1700-1600' : '0930-1600',
      minmov: 1,
      pricescale,
      has_intraday: true,
      has_seconds: true,
      supported_resolutions: RESOLUTIONS,
      data_status: 'realtime',
    }
    this.symbolInfo.set(result.ticker.toUpperCase(), info)
    if (!this.symbolInfo.has(result.symbol.toUpperCase())) this.symbolInfo.set(result.symbol.toUpperCase(), info)
    return info
  }

  private normalizeBar(symbol: string, bar: Bar): Bar {
    return {
      ...bar,
      open: snapPracticePriceToTick(symbol, bar.open),
      high: snapPracticePriceToTick(symbol, bar.high),
      low: snapPracticePriceToTick(symbol, bar.low),
      close: snapPracticePriceToTick(symbol, bar.close),
    }
  }

  private rememberLatest(symbol: string, bar: Bar): void {
    this.latestBySymbol.set(symbol.toUpperCase(), bar)
    const root = symbol.split(':').pop()
    if (root) this.latestBySymbol.set(root.toUpperCase(), bar)
    const applyExternalMarketBar = this.fallback.applyExternalMarketBar
    if (typeof applyExternalMarketBar === 'function') {
      const labels = new Set([symbol, chartSymbolToProductRoot(symbol)].filter(Boolean))
      for (const label of labels) applyExternalMarketBar.call(this.fallback, label, bar)
    }
  }

  private resolveProviderTicker(chartSymbol: string): Promise<string> {
    const root = chartSymbolToProductRoot(chartSymbol)
    const cached = this.symbolInfo.get(root)
    if (cached?.ticker) return Promise.resolve(String(cached.ticker).toUpperCase())
    return new Promise((resolve, reject) => {
      this.searchSymbols(root, '', '', (rows) => {
        const results = rows as SearchResult[]
        const exact = results.find((row) => row.symbol === root) || results[0]
        if (!exact?.ticker) {
          reject(new Error(`Unable to resolve market-book symbol: ${chartSymbol}`))
          return
        }
        resolve(exact.ticker.toUpperCase())
      })
    })
  }

  private connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()
    if (this.connectPromise) return this.connectPromise
    this.setConnectionState('connecting')
    this.connectPromise = new Promise<void>((resolve, reject) => {
      void this.getProviderConfig().then(({ streamPath }) => {
        const token = getAuthToken()
        const url = new URL(getWebSocketUrl(streamPath))
        if (token) url.searchParams.set('token', token)
        const ws = new WebSocket(url.toString())
        this.ws = ws
        const timeout = window.setTimeout(() => {
          this.setConnectionState('disconnected')
          reject(new Error('Practice market-data connection timed out'))
        }, 15_000)
        ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>
        if (message.type === 'connected') {
          window.clearTimeout(timeout)
          this.setConnectionState('connected')
          resolve()
          return
        }
        if (message.type === 'bar' || message.type === 'update') {
          const subscriptionId = String(message.subscriptionId || '')
          const symbol = String(message.symbol || subscriptionId.split('#')[0])
          const bar = this.normalizeBar(symbol, message.bar as Bar)
          this.rememberLatest(symbol, bar)
          for (const callback of this.wireSubscribers.get(subscriptionId)?.values() || []) callback(bar)
          return
        }
        if (message.type === 'quote') {
          const symbol = String(message.symbol || '')
          const rawQuote = message.quote as Record<string, number | null>
          const quote = {
            ...rawQuote,
            last: rawQuote.last == null ? null : snapPracticePriceToTick(symbol, rawQuote.last),
            bid: rawQuote.bid == null ? null : snapPracticePriceToTick(symbol, rawQuote.bid),
            ask: rawQuote.ask == null ? null : snapPracticePriceToTick(symbol, rawQuote.ask),
          }
          const applyExternalMarketQuote = this.fallback.applyExternalMarketQuote
          if (typeof applyExternalMarketQuote === 'function') {
            const labels = new Set([symbol, chartSymbolToProductRoot(symbol)].filter(Boolean))
            for (const label of labels) applyExternalMarketQuote.call(this.fallback, label, quote)
          }
          return
        }
        const id = String(message.id || '')
        const pending = this.pending.get(id)
        if (!pending) return
        window.clearTimeout(pending.timer)
        this.pending.delete(id)
        if (message.type === 'error') {
          const payload = message.error as { message?: string } | undefined
          pending.reject(new Error(payload?.message || 'Practice market-data request failed'))
        } else {
          pending.resolve(message.data)
        }
        }
        ws.onerror = () => {
          this.setConnectionState('disconnected')
          reject(new Error('Unable to connect to practice market data'))
        }
        ws.onclose = () => {
          window.clearTimeout(timeout)
          if (this.ws !== ws) return
          this.ws = null
          this.connectPromise = null
          this.rejectPending(new Error('Practice market data disconnected'))
          this.setConnectionState('disconnected')
          this.scheduleReconnect()
        }
      }).catch((error) => {
        this.setConnectionState('disconnected')
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    }).finally(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) this.connectPromise = null
    })
    return this.connectPromise
  }

  private setConnectionState(state: MdsConnectionState): void {
    if (state === this.connectionState) return
    this.connectionState = state
    this.emitStatus('connection', state)
    if (state === 'connected') this.emitStatus('open')
    if (state === 'disconnected') this.emitStatus('close')
  }

  private emitStatus(event: StatusEvent, ...args: unknown[]): void {
    for (const listener of this.statusListeners.get(event) || []) listener(...args)
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      window.clearTimeout(request.timer)
      request.reject(error)
    }
    this.pending.clear()
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.wireSubscribers.size === 0 || this.reconnectTimer !== null) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.reconnectAndRestoreSubscriptions()
    }, 1_000)
  }

  private async reconnectAndRestoreSubscriptions(): Promise<void> {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const previous = this.ws
    if (previous) {
      previous.onclose = null
      previous.onerror = null
      previous.close(1000, 'market data reconnect requested')
    }
    this.ws = null
    this.connectPromise = null
    this.rejectPending(new Error('Practice market data reconnecting'))
    this.setConnectionState('disconnected')
    try {
      await this.connect()
      await Promise.all([...this.wireSubscribers.keys()].map((subscriptionId) => {
        const separator = subscriptionId.lastIndexOf('#')
        const symbol = subscriptionId.slice(0, separator)
        const resolution = subscriptionId.slice(separator + 1)
        return this.request('subscribe', { subscriptionId, symbol, resolution })
      }))
      await Promise.all([...this.bookSubscriptions.entries()].map(async ([label]) => {
        const symbol = await this.resolveProviderTicker(label)
        const subscriptionId = `${symbol}#QUOTE`
        this.bookSubscriptions.set(label, subscriptionId)
        await this.request('quote_subscribe', { subscriptionId, symbol })
      }))
    } catch (error) {
      console.warn('[Practice market data] reconnect failed:', error)
      this.scheduleReconnect()
    }
  }

  private getProviderConfig(): Promise<ProviderConfig> {
    if (this.providerConfigPromise) return this.providerConfigPromise
    this.providerConfigPromise = api.get('/practice/market-data/config').then((response) => {
      const streamPath = String(response.data?.data?.streamPath || '')
      const searchPath = String(response.data?.data?.searchPath || '')
      if (!streamPath.startsWith('/')) throw new Error('Practice market-data gateway is not configured')
      if (!searchPath.startsWith('/')) throw new Error('Practice market-data search is not configured')
      return { streamPath, searchPath }
    }).catch((error) => {
      this.providerConfigPromise = null
      throw error
    })
    return this.providerConfigPromise
  }

  private async request(type: string, payload: Record<string, unknown>): Promise<unknown> {
    await this.connect()
    const id = String(++this.sequence)
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${type} request timed out`))
      }, 30_000)
      this.pending.set(id, { resolve, reject, timer })
      this.ws!.send(JSON.stringify({ id, type, ...payload }))
    })
  }
}

export function createPracticeMarketDatafeed<T extends Record<string, unknown>>(fallback: T): T {
  if (fallback.__practiceMarketDatafeed) return fallback
  const practiceMarketData = new PracticeMarketDatafeed(fallback)
  return new Proxy(fallback, {
    get(target, property, receiver) {
      if (OVERRIDES.has(String(property))) {
        const value = Reflect.get(practiceMarketData, property, practiceMarketData)
        return typeof value === 'function' ? value.bind(practiceMarketData) : value
      }
      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export { normalizeSearchResult }
