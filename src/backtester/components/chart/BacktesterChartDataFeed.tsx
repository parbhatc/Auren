import { IDatafeedChartApi, LibrarySymbolInfo, ResolutionString, SubscribeBarsCallback, Bar, Subscription } from '../../../types/chart'
import { backtesterAPI } from '../../../api/backtester.api'
import type { MarketBookUpdateKind, TradeseaMarketBook } from '../../../services/tradesea/tradeseaMarketBook'
import { tradeseaResolutionToSeconds } from '../../../services/tradesea/tradeseaResolutions'
import type { BacktestSession } from '../../../types/backtester'
import { BacktesterChartClient } from '../../services/BacktesterChartClient'

export class BacktesterChartDataFeed implements IDatafeedChartApi {
  private readonly baseResolutions: ResolutionString[] = ['1', '2', '3', '5', '15', '30', '60', '240', '1D']
  private supportedResolutions: ResolutionString[]
  private symbolResolutions: Map<string, ResolutionString[]> = new Map()
  private symbolsCache: Record<string, { tickSize: number; tickValue: number; supportedChartResolutions?: string[] }> | null = null
  private resolvedSymbolCache: Map<string, LibrarySymbolInfo> = new Map()
  private wsClient: BacktesterChartClient | null = null
  private subscriptions: Map<string, Subscription> = new Map()
  private chartSubscriptions: Map<string, string> = new Map()
  // Track last bar per symbol/resolution from getBars responses
  private lastBarsCache: Map<string, Bar> = new Map()
  /** Sub-minute bars seen during replay — used to patch forming HTF candles. */
  private replayLtfBars: Map<string, Bar[]> = new Map()
  /** Latest replay cursor (advances on next candle); falls back to session start. */
  private playbackAnchorSec: number | null = null
  /** Resolution that last advanced `playbackAnchorSec` (usually 1m). */
  private playbackAnchorResolution: ResolutionString = '1'
  private bookListeners = new Set<(streamId: string, kind: MarketBookUpdateKind) => void>()
  private tradeHandler: any = null // Reference to BacktesterTradeHandler

  constructor(wsClient?: BacktesterChartClient | null) {
    this.supportedResolutions = [...this.baseResolutions]
    this.wsClient = wsClient || null
  }

  /**
   * Set the trade handler reference
   */
  setTradeHandler(tradeHandler: any): void {
    this.tradeHandler = tradeHandler
    this.seedSessionPlaybackAnchor()
  }

  /** Session startTime is the replay cursor until Next / bar picker advances it. */
  private seedSessionPlaybackAnchor(): void {
    if (this.playbackAnchorSec != null) return
    const sessionAnchor = this.getSessionAnchorSec()
    if (sessionAnchor == null) return
    this.playbackAnchorSec = sessionAnchor
    this.playbackAnchorResolution = '1'
  }

  /**
   * Get cache key for symbol/resolution combination
   */
  private getCacheKey(symbol: string, resolution: ResolutionString): string {
    const sym = String(symbol || '').trim().toUpperCase()
    const res = String(resolution || '').trim().toUpperCase()
    return `${sym}:${res}`
  }

  private getActiveSession(): BacktestSession | null {
    return this.wsClient?.getSession() ?? this.tradeHandler?.getSession?.() ?? null
  }

  /** Session replay anchor as Unix seconds (startDate + startTime, local). */
  private getSessionAnchorSec(): number | null {
    const session = this.getActiveSession()
    if (!session?.startDate || !session?.startTime) return null
    const [year, month, day] = session.startDate.split('-').map(Number)
    const [hours, minutes] = session.startTime.split(':').map(Number)
    if (![year, month, day, hours, minutes].every((n) => Number.isFinite(n))) return null
    return Math.floor(new Date(year, month - 1, day, hours, minutes, 0, 0).getTime() / 1000)
  }

  private notePlaybackBar(timeSec: number, resolution: ResolutionString, advanceAnchor = true): void {
    if (!advanceAnchor) return
    if (!Number.isFinite(timeSec)) return
    const t = Math.floor(timeSec)
    const barSec = Math.max(1, tradeseaResolutionToSeconds(String(resolution)))
    const anchorResSec = Math.max(
      1,
      tradeseaResolutionToSeconds(String(this.playbackAnchorResolution ?? '1')),
    )
    // ponytail: HTF bucket opens (9:15) must not replace LTF replay cursor (9:29)
    if (this.playbackAnchorSec != null && barSec > anchorResSec) return
    if (this.playbackAnchorSec == null || t > this.playbackAnchorSec) {
      this.playbackAnchorSec = t
      if (barSec <= anchorResSec) {
        this.playbackAnchorResolution = resolution
      }
    }
  }

  /** Current replay position, not just session startTime. */
  private getPlaybackAnchorSec(): number | null {
    if (this.playbackAnchorSec != null) return this.playbackAnchorSec

    let latest: number | null = null
    for (const bar of this.lastBarsCache.values()) {
      if (bar?.time == null) continue
      const t = this.normalizeBarTime(bar.time)
      if (latest == null || t > latest) latest = t
    }
    for (const sub of this.subscriptions.values()) {
      if (sub.lastBar?.time == null) continue
      const t = this.normalizeBarTime(sub.lastBar.time)
      if (latest == null || t > latest) latest = t
    }
    if (latest != null) return latest

    return this.getSessionAnchorSec()
  }

  /** Match server BarAggregator bucket alignment (local session timezone). */
  private alignTimeToResolutionSec(timeSec: number, resolution: ResolutionString): number {
    const r = String(resolution).trim().toUpperCase()
    const secMatch = r.match(/^(\d+)S$/)
    if (secMatch) {
      const barSec = Math.max(1, parseInt(secMatch[1], 10))
      return Math.floor(timeSec / barSec) * barSec
    }

    const d = new Date(timeSec * 1000)

    if (r === 'D' || r === '1D') {
      d.setHours(0, 0, 0, 0)
      return Math.floor(d.getTime() / 1000)
    }

    const mins = parseInt(r, 10)
    if (Number.isFinite(mins) && mins > 0) {
      const alignedMinutes = Math.floor(d.getMinutes() / mins) * mins
      d.setMinutes(alignedMinutes, 0, 0)
      return Math.floor(d.getTime() / 1000)
    }

    const barSec = Math.max(1, tradeseaResolutionToSeconds(r))
    return Math.floor(timeSec / barSec) * barSec
  }

  /**
   * When replay advanced on HTF (e.g. 1m @ 9:02), map to the last LTF bar in that period
   * (e.g. 30s @ 9:02:30) so OHLC matches the HTF close.
   */
  private capPlaybackAnchorForTargetResolution(
    anchorSec: number,
    targetResolution: ResolutionString,
  ): number {
    const sourceRes = this.playbackAnchorResolution ?? '1'
    const sourceSec = tradeseaResolutionToSeconds(String(sourceRes))
    const targetSec = tradeseaResolutionToSeconds(String(targetResolution))

    if (!Number.isFinite(sourceSec) || !Number.isFinite(targetSec) || targetSec >= sourceSec) {
      return this.alignTimeToResolutionSec(anchorSec, targetResolution)
    }

    const htfOpen = this.alignTimeToResolutionSec(anchorSec, sourceRes)
    const lastLtOpen = htfOpen + sourceSec - targetSec
    return this.alignTimeToResolutionSec(lastLtOpen, targetResolution)
  }

  /** Last bar open time allowed on chart (filters future HTF buckets). */
  private replayLastBarOpenSec(anchorSec: number, resolution: ResolutionString): number {
    const effective = this.capPlaybackAnchorForTargetResolution(anchorSec, resolution)
    return this.alignTimeToResolutionSec(effective, resolution)
  }

  /**
   * History API `to` bound — must reach the raw replay cursor so server aggregation
   * includes the full partial HTF bucket (e.g. 9:15–9:29:30 on 15m).
   */
  private replayHistoryToSec(anchorSec: number): number {
    return anchorSec
  }

  /** Cap history window to replay anchor — BWC host-controlled replay uses Date.now() otherwise. */
  private clampPeriodToSessionAnchor(
    periodParams: { from?: number; to?: number; countBack?: number; firstDataRequest?: boolean },
    resolution: ResolutionString,
  ) {
    const anchorSec = this.getPlaybackAnchorSec()
    if (anchorSec == null) return periodParams

    const barSec = Math.max(1, tradeseaResolutionToSeconds(String(resolution)))
    const historyTo = this.replayHistoryToSec(anchorSec)
    const lastBarOpen = this.replayLastBarOpenSec(anchorSec, resolution)
    const count = Math.max(1, Number(periodParams.countBack) || 1)
    let from = periodParams.from
    let to = periodParams.to

    if (to == null || !Number.isFinite(Number(to)) || Number(to) > historyTo) {
      to = historyTo
      if (periodParams.firstDataRequest) {
        from = Math.min(lastBarOpen, historyTo) - (count - 1) * barSec
      }
    }
    if (from != null && Number.isFinite(Number(from)) && Number(from) > Number(to)) {
      from = Number(to) - (count - 1) * barSec
    }

    this.logReplayClamp('clamp', {
      resolution,
      anchorSec,
      historyTo,
      lastBarOpen,
      from,
      to,
      countBack: count,
    })

    return { ...periodParams, from, to, countBack: count }
  }

  private logReplayClamp(label: string, payload: Record<string, unknown>): void {
    if (typeof window === 'undefined' || !(window as { __BWC_REPLAY_DEBUG__?: boolean }).__BWC_REPLAY_DEBUG__) {
      return
    }
    console.info(`[BWC:replay:data] ${label}`, payload)
  }

  private filterBarsToSessionAnchor(bars: Bar[], resolution: ResolutionString): Bar[] {
    const anchorSec = this.getPlaybackAnchorSec()
    if (anchorSec == null) return bars
    const lastBarOpen = this.replayLastBarOpenSec(anchorSec, resolution)
    const filtered = bars.filter((bar) => bar.time <= lastBarOpen)
    if (filtered.length !== bars.length) {
      this.logReplayClamp('filterBars', {
        resolution,
        anchorSec,
        lastBarOpen,
        before: bars.length,
        after: filtered.length,
        lastBar: bars.length ? bars[bars.length - 1]?.time : undefined,
      })
    }
    return filtered
  }

  private isSubMinuteResolution(resolution: ResolutionString): boolean {
    return String(resolution).trim().toUpperCase().endsWith('S')
  }

  /**
   * Pick the finest cached replay LTF series for patching a forming HTF candle.
   * Falls back from playback resolution to any finer cached resolution (e.g. 30S when chart is 15m).
   */
  private resolveReplayLtfKey(
    symbol: string,
    sourceRes: ResolutionString,
    sourceSec: number,
    targetSec: number,
  ): string | null {
    if (Number.isFinite(sourceSec) && Number.isFinite(targetSec) && sourceSec < targetSec) {
      return this.getCacheKey(symbol, sourceRes)
    }

    let bestKey: string | null = null
    let bestSec = Infinity
    const sym = String(symbol || '').trim().toUpperCase()
    const prefix = `${sym}:`

    for (const key of this.replayLtfBars.keys()) {
      if (!key.startsWith(prefix)) continue
      const res = key.slice(prefix.length) as ResolutionString
      const sec = tradeseaResolutionToSeconds(String(res))
      if (!Number.isFinite(sec) || sec >= targetSec || sec >= bestSec) continue
      const bars = this.replayLtfBars.get(key)
      if (!bars?.length) continue
      bestSec = sec
      bestKey = key
    }

    if (bestKey) return bestKey
    if (Number.isFinite(sourceSec) && sourceSec < targetSec) {
      return this.getCacheKey(symbol, sourceRes)
    }
    return null
  }

  private mergeReplayLtfBars(cacheKey: string, bars: Bar[]): void {
    if (!bars.length) return
    const byTime = new Map<number, Bar>()
    for (const bar of this.replayLtfBars.get(cacheKey) ?? []) {
      byTime.set(bar.time, bar)
    }
    for (const bar of bars) {
      byTime.set(bar.time, bar)
    }
    const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time)
    this.replayLtfBars.set(cacheKey, merged.slice(-5000))
  }

  private aggregateLtfIntoHtfBar(ltBars: Bar[], htfOpen: number, toUtc: number): Bar | null {
    const sub = ltBars.filter((b) => b.time >= htfOpen && b.time <= toUtc)
    if (!sub.length) return null

    let high = -Infinity
    let low = Infinity
    let volume = 0
    for (const b of sub) {
      high = Math.max(high, b.high)
      low = Math.min(low, b.low)
      volume += b.volume ?? 0
    }

    return {
      time: htfOpen,
      open: sub[0]!.open,
      high,
      low,
      close: sub[sub.length - 1]!.close,
      volume,
    }
  }

  private patchFormingHtfBars(bars: Bar[], symbol: string, htfResolution: ResolutionString): Bar[] {
    if (!bars.length) return bars

    const anchorSec = this.getPlaybackAnchorSec()
    if (anchorSec == null) return bars

    const sourceRes = this.playbackAnchorResolution ?? '1'
    const sourceSec = tradeseaResolutionToSeconds(String(sourceRes))
    const targetSec = tradeseaResolutionToSeconds(String(htfResolution))

    const htfOpen = this.alignTimeToResolutionSec(anchorSec, htfResolution)
    if (anchorSec >= htfOpen + targetSec) return bars

    const ltfKey = this.resolveReplayLtfKey(symbol, sourceRes, sourceSec, targetSec)
    const ltBars = ltfKey ? this.replayLtfBars.get(ltfKey) ?? [] : []
    if (!ltBars.length) return bars

    const agg = this.aggregateLtfIntoHtfBar(ltBars, htfOpen, anchorSec)
    if (!agg) return bars

    const idx = bars.findIndex((b) => b.time === htfOpen)
    if (idx === -1) return bars

    const patched = bars.slice()
    patched[idx] = { ...patched[idx]!, ...agg, time: htfOpen }
    return patched
  }

  /**
   * Block switching to sub-minute TF when CSV has no bar at the mapped replay cursor
   * (e.g. 1m @ 9:10 → 30s needs data through 9:10:30).
   */
  async validateResolutionAtCursor(
    symbol: string,
    targetResolution: ResolutionString,
  ): Promise<{ ok: boolean; message?: string }> {
    const sym = String(symbol || '').trim().toUpperCase()
    if (!sym) return { ok: false, message: 'Symbol not available' }

    await this.loadSymbols()
    const supported =
      this.symbolResolutions.get(sym) ??
      (this.symbolsCache?.[sym] as { supportedChartResolutions?: string[] } | undefined)
        ?.supportedChartResolutions ??
      this.supportedResolutions

    const target = String(targetResolution).trim().toUpperCase() as ResolutionString
    if (!supported.map((r) => String(r).toUpperCase()).includes(target)) {
      return {
        ok: false,
        message: `${target} data is not available for ${sym}`,
      }
    }

    if (!this.isSubMinuteResolution(target)) {
      return { ok: true }
    }

    const anchorSec = this.getPlaybackAnchorSec()
    if (anchorSec == null) return { ok: true }

    const probeTime = this.capPlaybackAnchorForTargetResolution(anchorSec, target)
    const barSec = Math.max(1, tradeseaResolutionToSeconds(target))

    const ltfKey = this.getCacheKey(sym, target)
    const cachedLtf = this.replayLtfBars.get(ltfKey) ?? []
    if (cachedLtf.some((b) => b.time === probeTime)) {
      return { ok: true }
    }
    const cachedLast = cachedLtf.length > 0 ? cachedLtf[cachedLtf.length - 1] : undefined
    if (cachedLast && cachedLast.time >= probeTime) {
      return { ok: true }
    }

    try {
      const response = await backtesterAPI.getHistory({
        symbol: sym,
        resolution: target,
        from: Math.max(0, probeTime - barSec * 2),
        to: probeTime,
        countBack: 5,
      })

      if (response.noData || !response.bars?.length) {
        const when = new Date(probeTime * 1000).toLocaleString()
        return {
          ok: false,
          message: `No ${target} data at ${when} for this replay session`,
        }
      }

      const bars = this.sanitizeBars((response.bars ?? []) as Bar[])
      if (bars.some((b) => b.time === probeTime)) {
        return { ok: true }
      }

      const last = bars.length > 0 ? bars[bars.length - 1] : undefined
      if (last && last.time <= probeTime && probeTime < last.time + barSec) {
        return { ok: true }
      }

      if (last && last.time >= probeTime) {
        return { ok: true }
      }

      const when = new Date(probeTime * 1000).toLocaleString()
      return {
        ok: false,
        message: `No ${target} data at ${when} for this replay session`,
      }
    } catch {
      return { ok: false, message: `Could not verify ${target} data for ${sym}` }
    }
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

  /** BWC/LWC expect Unix seconds; server CSV bars use milliseconds. */
  private normalizeBarTime(time: number): number {
    if (!Number.isFinite(Number(time))) return Math.floor(Date.now() / 1000)
    const n = Number(time)
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
  }

  /** Drop invalid OHLC, coerce numbers, dedupe by time (keep last). */
  private sanitizeBars(bars: Bar[]): Bar[] {
    const byTime = new Map<number, Bar>()
    for (const raw of bars) {
      const open = Number(raw.open)
      const high = Number(raw.high)
      const low = Number(raw.low)
      const close = Number(raw.close)
      if (![open, high, low, close].every((v) => Number.isFinite(v))) continue
      const time = this.normalizeBarTime(Number(raw.time))
      const volumeRaw = raw.volume != null ? Number(raw.volume) : 0
      byTime.set(time, {
        time,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volumeRaw) ? volumeRaw : 0,
      })
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
  }

  private normalizeBar(bar: Bar): Bar | null {
    const open = Number(bar.open)
    const high = Number(bar.high)
    const low = Number(bar.low)
    const close = Number(bar.close)
    if (![open, high, low, close].every((v) => Number.isFinite(v))) return null
    const volumeRaw = bar.volume != null ? Number(bar.volume) : 0
    return {
      time: this.normalizeBarTime(bar.time),
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volumeRaw) ? volumeRaw : 0,
    }
  }

  setWebSocketClient(wsClient: BacktesterChartClient | null): void {
    this.wsClient = wsClient
    if (wsClient?.isConnected?.() && wsClient.isChartReady?.()) {
      this.flushPendingMessages()
    }
  }

  /** Clear cached bars and pending getBars state after reconnect or session change. */
  resetSessionState(opts?: { clearPlaybackAnchor?: boolean }): void {
    for (const [, controller] of this.pendingGetBarsAbort) {
      controller.abort()
    }
    this.pendingGetBarsAbort.clear()
    for (const [, request] of this.pendingGetBarsRequests) {
      request.onErrorCallback('Session reset')
    }
    this.pendingGetBarsRequests.clear()
    this.pendingWsMessages = []
    this.lastBarsCache.clear()
    this.replayLtfBars.clear()
    if (opts?.clearPlaybackAnchor !== false) {
      this.playbackAnchorSec = null
      this.playbackAnchorResolution = '1'
      this.seedSessionPlaybackAnchor()
    }
  }

  /** Host replay cursor (unix seconds) — survives session cache clears during bar replay. */
  setPlaybackAnchorSec(sec: number | null, resolution: ResolutionString = '1'): void {
    if (sec == null || !Number.isFinite(Number(sec))) {
      this.playbackAnchorSec = null
      return
    }
    this.playbackAnchorSec = Math.floor(Number(sec))
    const nextSec = tradeseaResolutionToSeconds(String(resolution))
    const curSec = tradeseaResolutionToSeconds(String(this.playbackAnchorResolution ?? '1'))
    if (!Number.isFinite(nextSec) || !Number.isFinite(curSec) || nextSec <= curSec) {
      this.playbackAnchorResolution = resolution
    }
  }

  getPlaybackAnchorSecPublic(): number | null {
    return this.getPlaybackAnchorSec()
  }

  getPlaybackAnchorSecForResolution(resolution: ResolutionString): number | null {
    const anchorSec = this.getPlaybackAnchorSec()
    if (anchorSec == null) return null
    return this.capPlaybackAnchorForTargetResolution(anchorSec, resolution)
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

  private resolutionsForSymbol(symbol: string): ResolutionString[] {
    return this.symbolResolutions.get(symbol.toUpperCase()) ?? this.baseResolutions
  }

  private refreshSupportedResolutionUnion(): void {
    const union = new Set<ResolutionString>(this.baseResolutions)
    for (const list of this.symbolResolutions.values()) {
      for (const r of list) union.add(r)
    }
    this.supportedResolutions = Array.from(union)
  }

  async loadSymbols(): Promise<Record<string, { tickSize: number; tickValue: number }>> {
    if (this.symbolsCache) {
      return this.symbolsCache
    }

    try {
      const response = await backtesterAPI.getSymbolData()
      const symbols = response.symbols || {}
      this.symbolsCache = symbols
      this.symbolResolutions.clear()
      this.resolvedSymbolCache.clear()
      for (const [sym, info] of Object.entries(symbols)) {
        const list = (info as { supportedChartResolutions?: string[] }).supportedChartResolutions
        if (list?.length) {
          this.symbolResolutions.set(sym.toUpperCase(), list as ResolutionString[])
        }
      }
      this.refreshSupportedResolutionUnion()
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
    symbolName = symbolName.toUpperCase()

    const cached = this.resolvedSymbolCache.get(symbolName)
    if (cached) {
      setTimeout(() => onSymbolResolvedCallback(cached), 0)
      return
    }

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
        supported_resolutions: this.resolutionsForSymbol(symbolName),
        has_seconds: this.resolutionsForSymbol(symbolName).some((r) => String(r).toUpperCase().endsWith('S')),
        seconds_multipliers: this.resolutionsForSymbol(symbolName)
          .filter((r) => String(r).toUpperCase().endsWith('S'))
          .map((r) => String(r).toUpperCase().replace(/S$/, '')),
        volume_precision: 2,
        data_status: 'streaming'
      }

      this.resolvedSymbolCache.set(symbolName, symbolInfo)
      setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0)
    })
  }

  private pendingGetBarsRequests: Map<string, { 
    symbol: string
    resolution: ResolutionString
    onHistoryCallback: (bars: any[], meta: { noData: boolean }) => void
    onErrorCallback: (reason: string) => void 
  }> = new Map()

  private pendingGetBarsAbort: Map<string, AbortController> = new Map()

  getBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, periodParams: any, onHistoryCallback: (bars: any[], meta: { noData: boolean }) => void, onErrorCallback: (reason: string) => void): void {
    if (!this.wsClient) {
      onErrorCallback('WebSocket client not available')
      return
    }

    this.seedSessionPlaybackAnchor()

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

    const clamped = this.clampPeriodToSessionAnchor(periodParams, resolution)

    void this.fetchBarsHttp({
      requestId,
      symbol: symbolInfo.name,
      resolution,
      from: clamped.from,
      to: clamped.to,
      countBack: clamped.countBack,
      firstDataRequest: clamped.firstDataRequest,
    })

    window.setTimeout(() => {
      if (this.pendingGetBarsRequests.has(requestId)) {
        this.pendingGetBarsRequests.delete(requestId)
        this.pendingGetBarsAbort.get(requestId)?.abort()
        this.pendingGetBarsAbort.delete(requestId)
        onErrorCallback('Request timeout')
      }
    }, 30000)
  }

  private async fetchBarsHttp(params: {
    requestId: string
    symbol: string
    resolution: ResolutionString
    from?: number
    to?: number
    countBack?: number
    firstDataRequest?: boolean
  }): Promise<void> {
    const pending = this.pendingGetBarsRequests.get(params.requestId)
    if (!pending) return

    const controller = new AbortController()
    this.pendingGetBarsAbort.set(params.requestId, controller)

    try {
      const response = await backtesterAPI.getHistory(
        {
          symbol: params.symbol,
          resolution: params.resolution,
          from: params.from,
          to: params.to,
          countBack: params.countBack,
          firstDataRequest: params.firstDataRequest,
          requestId: params.requestId,
        },
        { signal: controller.signal },
      )

      if (!this.pendingGetBarsRequests.has(params.requestId)) return

      this.handleGetBarsResponse({
        requestId: params.requestId,
        bars: response.bars,
        noData: response.noData,
        meta: response.meta,
        error: response.success === false ? response.message : undefined,
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const stillPending = this.pendingGetBarsRequests.get(params.requestId)
      if (!stillPending) return
      this.pendingGetBarsRequests.delete(params.requestId)
      this.pendingGetBarsAbort.delete(params.requestId)
      const message = error instanceof Error ? error.message : 'getBars failed'
      stillPending.onErrorCallback(message)
    } finally {
      this.pendingGetBarsAbort.delete(params.requestId)
    }
  }

  handleGetBarsResponse(response: { requestId: string; bars?: any[]; noData?: boolean; error?: string; meta?: { noData?: boolean } }): void {
    const request = this.pendingGetBarsRequests.get(response.requestId)
    if (!request) {
      console.error(`[BacktesterChartDataFeed] No request found for requestId: ${response.requestId}`)
      return
    }

    this.pendingGetBarsRequests.delete(response.requestId)
    this.pendingGetBarsAbort.delete(response.requestId)

    if (response.error) {
      request.onErrorCallback(response.error)
      return
    }

    if (response.noData || !response.bars || response.bars.length === 0) {
      request.onHistoryCallback([], {noData: true})
      return
    }

    const bars = this.patchFormingHtfBars(
      this.filterBarsToSessionAnchor(
        this.sanitizeBars(response.bars as Bar[]),
        request.resolution,
      ),
      request.symbol,
      request.resolution,
    )
    if (!bars.length) {
      request.onHistoryCallback([], { noData: true })
      return
    }

    // Store the last bar from getBars response for this symbol/resolution
    // This will be used when subscribeBars is called
    if (bars.length > 0) {
      const lastBar = bars[bars.length - 1]
      const cacheKey = this.getCacheKey(request.symbol, request.resolution)

      const resSec = tradeseaResolutionToSeconds(String(request.resolution))
      if (
        this.isSubMinuteResolution(request.resolution) ||
        (Number.isFinite(resSec) && resSec <= tradeseaResolutionToSeconds('60'))
      ) {
        this.mergeReplayLtfBars(cacheKey, bars)
      }
      
      // Check if cache already exists - only update if new bar is more recent
      const cachedLastBar = this.lastBarsCache.get(cacheKey)
      if (!cachedLastBar || lastBar.time >= cachedLastBar.time) {
        this.lastBarsCache.set(cacheKey, lastBar)
        this.notePlaybackBar(lastBar.time, request.resolution)
        this.notifyMarketBook(request.symbol, 'ltp')
      }
    }

    const noData = Boolean(response.noData || response.meta?.noData)
    request.onHistoryCallback(bars, { noData })
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

    const candle = this.normalizeBar(data.candle)
    if (!candle) return

    this.notePlaybackBar(candle.time, subscription.resolution, false)

    const cacheKey = this.getCacheKey(subscription.symbol, subscription.resolution)
    if (this.isSubMinuteResolution(subscription.resolution)) {
      this.mergeReplayLtfBars(cacheKey, [candle])
    }
    const cachedLastBar = this.lastBarsCache.get(cacheKey)
    if (!cachedLastBar || candle.time >= cachedLastBar.time) {
      this.lastBarsCache.set(cacheKey, candle)
    }

    // Update last bar
    subscription.lastBar = candle
    this.notifyMarketBook(subscription.symbol, 'ltp')

    // Call the realtime callback
    if (subscription.onRealtimeCallback) {
      subscription.onRealtimeCallback(candle)
    }

    if (this.tradeHandler) {
      this.tradeHandler.syncReplayCursorFromBar?.(candle.time, subscription.resolution)
      this.tradeHandler.onRealTimeBar(subscription.symbol, subscription.resolution, candle)
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

