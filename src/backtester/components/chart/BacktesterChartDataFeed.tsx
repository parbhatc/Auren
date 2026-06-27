import { IDatafeedChartApi, LibrarySymbolInfo, ResolutionString, SubscribeBarsCallback, Bar, Subscription } from '../../../types/chart'
import { backtesterAPI } from '../../../api/backtester.api'
import type { MarketBookUpdateKind, TradeseaMarketBook } from '../../../services/tradesea/tradeseaMarketBook'
import { BacktesterChartClient } from '../../services/BacktesterChartClient'

export class BacktesterChartDataFeed implements IDatafeedChartApi {
  private supportedResolutions: ResolutionString[]
  private symbolsCache: Record<string, { tickSize: number; tickValue: number }> | null = null
  private wsClient: BacktesterChartClient | null = null
  private subscriptions: Map<string, Subscription> = new Map()
  private chartSubscriptions: Map<string, string> = new Map()
  // Track last bar per symbol/resolution from getBars responses
  private lastBarsCache: Map<string, Bar> = new Map()
  private bookListeners = new Set<(streamId: string, kind: MarketBookUpdateKind) => void>()
  private tradeHandler: any = null // Reference to BacktesterTradeHandler

  constructor(wsClient?: BacktesterChartClient | null) {
    this.supportedResolutions = ['1', '2', '3', '5', '15', '30', '60', '240', '1D'] as ResolutionString[]
    this.wsClient = wsClient || null
  }

  /**
   * Set the trade handler reference
   */
  setTradeHandler(tradeHandler: any): void {
    this.tradeHandler = tradeHandler
  }

  /**
   * Get cache key for symbol/resolution combination
   */
  private getCacheKey(symbol: string, resolution: ResolutionString): string {
    return `${symbol}:${resolution}`
  }

  private normalizeSymbol(symbol: string): string {
    const s = String(symbol || '').trim().toUpperCase()
    return s.includes(':') ? s.split(':')[1]! : s
  }

  subscribeMarketBook(
    listener: (streamId: string, kind: MarketBookUpdateKind) => void,
  ): () => void {
    this.bookListeners.add(listener)
    queueMicrotask(() => this.replayMarketBookListeners(listener))
    return () => this.bookListeners.delete(listener)
  }

  private replayMarketBookListeners(
    listener: (streamId: string, kind: MarketBookUpdateKind) => void,
  ): void {
    const notified = new Set<string>()
    const emit = (symbol: string) => {
      const streamId = this.normalizeSymbol(symbol)
      if (!streamId || notified.has(streamId)) return
      if (!this.getLastBarForSymbol(streamId)?.close) return
      notified.add(streamId)
      try {
        listener(streamId, 'ltp')
      } catch {
        // ignore
      }
    }
    for (const key of this.lastBarsCache.keys()) {
      emit(key.split(':')[0] || '')
    }
    for (const sub of this.subscriptions.values()) {
      if (sub.symbol) emit(sub.symbol)
    }
  }

  private notifyMarketBook(symbol: string, kind: MarketBookUpdateKind = 'ltp'): void {
    const streamId = this.normalizeSymbol(symbol)
    for (const fn of this.bookListeners) {
      try {
        fn(streamId, kind)
      } catch {
        // ignore
      }
    }
  }

  getMarketBookForSymbol(symbol: string): TradeseaMarketBook | null {
    const root = this.normalizeSymbol(symbol)
    const bar = this.getLastBarForSymbol(root)
    if (!bar || bar.close == null || !Number.isFinite(bar.close)) return null

    const last = bar.close
    const tick = this.getTickSize(root)
    const bid = last - tick
    const ask = last + tick
    const vol = Number(bar.volume) || 0

    return {
      streamId: root,
      last,
      bestBid: bid,
      bestAsk: ask,
      bestBidSize: 1,
      bestAskSize: 1,
      bids: [{ price: bid, size: 1 }],
      asks: [{ price: ask, size: 1 }],
      volumeByPrice: new Map(vol > 0 ? [[last, vol]] : []),
      updatedAt: Date.now(),
    }
  }

  private pendingWsMessages: Array<Record<string, unknown>> = []

  setWebSocketClient(wsClient: BacktesterChartClient | null): void {
    this.wsClient = wsClient
    if (wsClient?.isConnected?.()) {
      this.flushPendingMessages()
    }
  }

  /** Send after WS is open and server session handshake completed. */
  private sendWhenReady(message: Record<string, unknown>): void {
    if (this.wsClient?.isConnected?.() && this.wsClient.isChartReady?.()) {
      this.wsClient.send(message)
      return
    }
    this.pendingWsMessages.push(message)
  }

  flushPendingMessages(): void {
    if (!this.wsClient?.isConnected?.() || !this.wsClient.isChartReady?.()) {
      return
    }
    const queue = this.pendingWsMessages.splice(0)
    for (const message of queue) {
      this.wsClient.send(message)
    }
  }

  onReady(callback: (configuration: any) => void): void {
    setTimeout(() => {
      callback({
        supported_resolutions: this.supportedResolutions,
        supports_group_request: false,
        supports_marks: false,
        supports_search: true,
        supports_time: true,
        supports_timescale_marks: false,
        supports_quotes: false,
      })
    }, 0)
  }

  async loadSymbols(): Promise<Record<string, { tickSize: number; tickValue: number }>> {
    if (this.symbolsCache) {
      return this.symbolsCache
    }

    try {
      const response = await backtesterAPI.searchSymbols()
      this.symbolsCache = response.symbols || {}
      return this.symbolsCache
    } catch (error) {
      console.error('[BacktesterChartDataFeed] Failed to load symbols:', error)
      this.symbolsCache = {}
      return this.symbolsCache
    }
  }

  searchSymbols(userInput: string, _exchange: string, _symbolType: string, onResultReadyCallback: (symbols: LibrarySymbolInfo[]) => void): void {
    this.loadSymbols().then((symbols) => {
      const allSymbols = Object.keys(symbols).map(s => ({
        symbol: s,
        full_name: s,
        description: s,
        exchange: 'CME',
        type: 'futures'
      }))

      const results = !userInput || userInput.trim() === ''
        ? allSymbols
        : allSymbols.filter(s => s.symbol.includes(userInput.toUpperCase()))

      setTimeout(() => onResultReadyCallback(results as any), 0)
    })
  }

  resolveSymbol(symbolName: string, onSymbolResolvedCallback: (symbolInfo: LibrarySymbolInfo) => void, onResolveErrorCallback: (reason: string) => void): void {
    console.log('Resolving symbol:', symbolName)
    symbolName = symbolName.toUpperCase()
    
    this.loadSymbols().then((symbols) => {
      const info = symbols[symbolName]
      
      if (!info) {
        setTimeout(() => onResolveErrorCallback('Symbol not found'), 0)
        return
      }
      
      const symbolInfo: LibrarySymbolInfo = {
        name: symbolName,
        ticker: symbolName,
        description: symbolName,
        type: 'futures',
        session: '1700-1600',
        subsession_id: 'extended',
        subsessions: [
          {
            id: 'extended',
            description: 'Extended Trading Hours',
            session: '1700-1600',
            'session-display': '1700-1600'
          },
          {
            id: 'regular',
            description: 'Regular Trading Hours',
            session: '0830-1515',
            'session-display': '1700-1600'
          }
        ],
        timezone: 'America/Chicago',
        exchange: 'CME',
        listed_exchange: 'CME',
        minmov: (info.tickSize || 1) * 100,
        pricescale: 100,
        has_intraday: true,
        supported_resolutions: this.supportedResolutions,
        volume_precision: 2,
        data_status: 'streaming'
      }
      
      setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0)
    })
  }

  private pendingGetBarsRequests: Map<string, { 
    symbol: string
    resolution: ResolutionString
    onHistoryCallback: (bars: any[], meta: { noData: boolean }) => void
    onErrorCallback: (reason: string) => void 
  }> = new Map()

  getBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, periodParams: any, onHistoryCallback: (bars: any[], meta: { noData: boolean }) => void, onErrorCallback: (reason: string) => void): void {
    if (!this.wsClient) {
      onErrorCallback('WebSocket client not available')
      return
    }

    // Reset indicators when first data request (new symbol/timeframe)
    if (periodParams.firstDataRequest) {
      const indicatorManager = (window as any).indicatorManager
      if (indicatorManager && typeof indicatorManager.reset === 'function') {
        indicatorManager.reset()
      }
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    if (!symbolInfo.name) {
      onErrorCallback('Symbol name is required')
      return
    }
    
    this.pendingGetBarsRequests.set(requestId, {
      symbol: symbolInfo.name,
      resolution: resolution,
      onHistoryCallback,
      onErrorCallback
    })

    this.sendWhenReady({
      type: 'getBars',
      symbol: symbolInfo.name,
      resolution: resolution,
      from: periodParams.from,
      to: periodParams.to,
      countBack: periodParams.countBack,
      firstDataRequest: periodParams.firstDataRequest,
      requestId: requestId
    })

    setTimeout(() => {
      if (this.pendingGetBarsRequests.has(requestId)) {
        this.pendingGetBarsRequests.delete(requestId)
        onErrorCallback('Request timeout')
      }
    }, 30000)
  }

  handleGetBarsResponse(response: { requestId: string; bars?: any[]; noData?: boolean; error?: string }): void {
    const request = this.pendingGetBarsRequests.get(response.requestId)
    if (!request) {
      console.error(`[BacktesterChartDataFeed] No request found for requestId: ${response.requestId}`)
      return
    }

    this.pendingGetBarsRequests.delete(response.requestId)

    if (response.error) {
      request.onErrorCallback(response.error)
      return
    }

    if (response.noData || !response.bars || response.bars.length === 0) {
      request.onHistoryCallback([], {noData: true})
      return
    }

    // Store the last bar from getBars response for this symbol/resolution
    // This will be used when subscribeBars is called
    if (response.bars.length > 0) {
      const lastBar = response.bars[response.bars.length - 1]
      const cacheKey = this.getCacheKey(request.symbol, request.resolution)
      
      // Check if cache already exists - only update if new bar is more recent
      const cachedLastBar = this.lastBarsCache.get(cacheKey)
      if (!cachedLastBar || lastBar.time >= cachedLastBar.time) {
        this.lastBarsCache.set(cacheKey, lastBar)
        this.notifyMarketBook(request.symbol, 'ltp')
      }
    }

    request.onHistoryCallback(response.bars, {noData: false})
  }

  subscribeBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, _onRealtimeCallback: SubscribeBarsCallback, subscriberUID: string, _onResetCacheNeededCallback?: () => void): void {
    // Check if we have a last bar from getBars for this symbol/resolution
    let symbol = symbolInfo.name || ''
    const cacheKey = this.getCacheKey(symbol, resolution)
    const cachedLastBar = this.lastBarsCache.get(cacheKey) || null

    this.subscriptions.set(subscriberUID, {
      symbol: symbol,
      resolution: resolution,
      onRealtimeCallback: _onRealtimeCallback,
      lastBar: cachedLastBar
    })
    this.chartSubscriptions.set(this.getCacheKey(symbol, resolution), subscriberUID)
    if (cachedLastBar) {
      this.notifyMarketBook(symbol, 'ltp')
    }
    if (this.wsClient) {
      this.sendWhenReady({
        type: 'subscribeBars',
        symbol: symbolInfo.name,
        resolution: resolution,
        subscriberUID: subscriberUID,
      })
    }
  }

  unsubscribeBars(subscriberUID: string): void {
    let info = this.subscriptions.get(subscriberUID)
    if(info){
      this.chartSubscriptions.delete(this.getCacheKey(info.symbol, info.resolution))
    }
    this.subscriptions.delete(subscriberUID)
    if (this.wsClient) {
      this.wsClient.send({
        type: 'unsubscribeBars',
        subscriberUID: subscriberUID,
      })
    }
  }

  /**
   * Handle realtime bar updates from WebSocket
   * Called when the server sends a realtimeBar message
   */
  handleRealtimeBar(data: { subscriberUID: string; candle: Bar }): void {
    const subscription = this.subscriptions.get(data.subscriberUID)
    if (!subscription) {
      console.warn(`[BacktesterChartDataFeed] No subscription found for subscriberUID: ${data.subscriberUID}`)
      return
    }

    // Update last bar
    subscription.lastBar = data.candle
    this.notifyMarketBook(subscription.symbol, 'ltp')

    // Call the realtime callback
    if (subscription.onRealtimeCallback) {
      subscription.onRealtimeCallback(data.candle)
    }

    // Call onRealTimeBar on trade cache after realtime data is pushed
    if (this.tradeHandler) {
      this.tradeHandler.onRealTimeBar(subscription.symbol, subscription.resolution, data.candle)
    }
  }

  getServerTime(callback: (time: number) => void): void {
    backtesterAPI.getServerTime()
      .then((response) => {
        callback(response.timestamp)
      })
      .catch((error) => {
        console.error('[BacktesterChartDataFeed] Failed to get server time:', error)
        callback(Date.now())
      })
  }

  getLastBarForChart(chart: any): Bar | null {
    let cacheKey = this.getCacheKey(chart.symbol(), chart.resolution())
    let uuid = this.chartSubscriptions.get(cacheKey)

    if(uuid){
      let subscription = this.subscriptions.get(uuid)
      if(subscription){
        return subscription.lastBar
      }
    }

    return this.lastBarsCache.get(cacheKey) || null
  }

  getLastBarForSymbol(symbol: string): Bar | null {
    for(let [, value] of this.subscriptions.entries()){
      if(value.symbol === symbol && value.lastBar !== null && value.lastBar !== undefined){
        return value.lastBar
      }
    }
    for(let [key, value] of this.lastBarsCache.entries()){
      if(key.includes(symbol)){
        return value
      }
    }
    return null
  }

  getTickSize(symbol: string): number {
    const symbolInfo = this.symbolsCache?.[symbol] || null
    return symbolInfo?.tickSize || 1
  }

  getTickValue(symbol: string): number {
    const symbolInfo = this.symbolsCache?.[symbol] || null
    return symbolInfo?.tickValue || 1
  }
}

