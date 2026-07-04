import { BacktestSession } from '../../types/backtester'
import { BacktesterChartClient } from './BacktesterChartClient'
import BacktesterTradeCache from './BacktesterTradeCache'
import { backtesterAPI } from '../../api/backtester.api'
import { BACKTESTER_CHART_SYMBOL_KEY } from '../constants'
import type { BacktesterChartDataFeed } from '../components/chart/BacktesterChartDataFeed'
import type { DomPositionContext } from '../../services/tradesea/tradeseaPnL'
import { calcTradeseaTickPnL } from '../../services/tradesea/tradeseaPnL'
import { tradeseaResolutionToSeconds } from '../../services/tradesea/tradeseaResolutions'
import type { ResolutionString } from '../../types/chart'

/**
 * Backtester Trade Handler
 * Handles backtester trading-related operations and logging
 */
export class BacktesterTradeHandler {

  private session: BacktestSession | null
  private client: BacktesterChartClient | null
  private datafeed: BacktesterChartDataFeed | null = null
  private widget: unknown = null
  private playbackInterval: NodeJS.Timeout | null = null
  private isPlaying: boolean = false
  private playbackSpeed: number = 1
  private playbackTimeframe: string = '5' // Playback timeframe (default: 5 minutes)
  private onReplayToggle?: (enabled: boolean) => void
  private onSessionUpdate?: (session: BacktestSession) => void
  private onStatsRefresh?: () => void
  private tradeCache: BacktesterTradeCache | null = null
  private replayPaneSyncRaf: number | null = null

  constructor(session: BacktestSession | null, client: BacktesterChartClient | null) {
    this.session = session
    this.client = client
  }

  /**
   * Set callback for replay toggle
   */
  setReplayToggleCallback(callback: (enabled: boolean) => void): void {
    this.onReplayToggle = callback
  }

  /**
   * Set callback for session update
   */
  setSessionUpdateCallback(callback: (session: BacktestSession) => void): void {
    this.onSessionUpdate = callback
  }

  /**
   * Set callback for stats refresh
   */
  setStatsRefreshCallback(callback: () => void): void {
    this.onStatsRefresh = callback
  }

  /**
   * Get the current session
   */
  getSession(): BacktestSession | null {
    return this.session
  }

  /**
   * Update the session
   */
  updateSession(session: BacktestSession | null): void {
    this.session = session
  }

  /**
   * Get the WebSocket client
   */
  getClient(): BacktesterChartClient | null {
    return this.client
  }

  /**
   * Chart datafeed used for marks, ticks, and replay bars.
   */
  setDatafeed(datafeed: BacktesterChartDataFeed | null): void {
    this.datafeed = datafeed
  }

  getDatafeed(): BacktesterChartDataFeed | null {
    return this.datafeed
  }

  private normalizeSymbol(symbol: string): string {
    const s = String(symbol || '').trim().toUpperCase()
    return s.includes(':') ? s.split(':')[1]! : s
  }

  resolveChartSymbol(override?: string): string {
    const explicit = String(override || '').trim()
    if (explicit) return explicit
    try {
      const w = this.widget as {
        getSymbol?: () => string
        chart?: () => { symbol?: () => string }
      } | null
      const fromWidget = w?.getSymbol?.() || w?.chart?.()?.symbol?.()
      if (fromWidget) return fromWidget
    } catch {
      // ignore
    }
    try {
      const chartComponent = this.client?.getChart()
      const chartWidget = chartComponent?.getChartWidget?.() ?? chartComponent
      const fromChart =
        chartWidget?.activeChart?.()?.symbol?.() ||
        chartWidget?.getSymbol?.() ||
        chartWidget?.chart?.()?.symbol?.()
      if (fromChart) return fromChart
    } catch {
      // ignore
    }
    return this.session?.symbol || ''
  }

  private resolveLastBar(symbol: string): { close: number; time?: number } | null {
    const datafeed = this.getDatafeed()
    if (!datafeed) return null
    const root = this.normalizeSymbol(symbol)
    return (
      datafeed.getLastBarForSymbol(symbol) ??
      datafeed.getLastBarForSymbol(root) ??
      datafeed.getLastBarForChart(this.tradeCache?.getChart()) ??
      null
    )
  }

  getMarkPrice(symbol: string): number | null {
    const bar = this.resolveLastBar(symbol)
    const close = bar?.close
    return close != null && Number.isFinite(close) ? close : null
  }

  getDomPositionFor(symbolKey: string): DomPositionContext | null {
    const cache = this.tradeCache
    if (!cache) return null
    const chartSymbol = this.resolveChartSymbol(symbolKey)
    const position = cache.getPosition(chartSymbol)
    const contracts = Number(position?.contracts)
    if (!position || !contracts) return null
    const datafeed = this.getDatafeed()
    const tickSize = datafeed?.getTickSize?.(chartSymbol) ?? datafeed?.getTickSize?.(this.normalizeSymbol(chartSymbol)) ?? 0.25
    const tickValue = datafeed?.getTickValue?.(chartSymbol) ?? datafeed?.getTickValue?.(this.normalizeSymbol(chartSymbol)) ?? tickSize * 2
    return {
      entry: position.entry as number,
      signedContracts: contracts,
      tickSize,
      tickValue,
    }
  }

  getPositionUplFor(symbolKey: string): number | null {
    const ctx = this.getDomPositionFor(symbolKey)
    if (!ctx) return null
    const mark = this.getMarkPrice(symbolKey)
    if (mark == null) return null
    return calcTradeseaTickPnL(ctx.entry, mark, ctx.signedContracts, ctx.tickSize, ctx.tickValue)
  }

  private resolveSessionStartDate(data: { startDate?: string; date?: string }): string | null {
    if (data.startDate && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
      return data.startDate
    }
    if (!data.date) return null
    const parsedDate = new Date(data.date)
    if (isNaN(parsedDate.getTime())) return null
    const year = parsedDate.getFullYear()
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
    const day = String(parsedDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private parseReplayResponseTime(time: string): number | null {
    const ms = Date.parse(String(time || ''))
    if (!Number.isFinite(ms)) return null
    return Math.floor(ms / 1000)
  }

  private getBwcWidget(): {
    getBars?: () => Array<{ time?: number }>
    getResolution?: () => string
    replay?: {
      getState?: () => { stepInterval?: string; autoSelectInterval?: boolean }
      setReplayPosition?: (pos: {
        selectedBarIndex: number
        currentBarIndex: number
        selectedBarTime: number
        currentBarTime: number
      }) => void
    }
  } | null {
    try {
      const chartComponent = this.client?.getChart() as {
        widgetRef?: unknown
        getChartWidget?: () => unknown
      } | null
      return (chartComponent?.widgetRef ?? chartComponent?.getChartWidget?.() ?? null) as {
        getBars?: () => Array<{ time?: number }>
        getResolution?: () => string
        replay?: {
          getState?: () => { stepInterval?: string; autoSelectInterval?: boolean }
          setReplayPosition?: (pos: {
            selectedBarIndex: number
            currentBarIndex: number
            selectedBarTime: number
            currentBarTime: number
          }) => void
        }
      } | null
    } catch {
      return null
    }
  }

  /** Mirrors BWC `replayBarsPerStep` — one chart bar per step when auto-select is on. */
  private replayBarsPerStep(
    stepIntervalId: string,
    chartResolutionId: string,
    autoSelectInterval: boolean,
  ): number {
    if (autoSelectInterval) return 1
    const id = String(stepIntervalId || '1').trim().toUpperCase()
    if (id === 'TICK') return 1
    const chartSec = Math.max(1, tradeseaResolutionToSeconds(chartResolutionId))
    const stepSec = id === '1S' ? 1 : Math.max(1, tradeseaResolutionToSeconds(stepIntervalId))
    return Math.max(1, Math.round(stepSec / chartSec))
  }

  private resolvePlaybackStep(chartResolution: string): {
    playbackTimeframe: string
    candlesToSkip: number
  } {
    const widget = this.getBwcWidget()
    const replayState = widget?.replay?.getState?.()

    if (replayState) {
      const autoSelect = Boolean(replayState.autoSelectInterval)
      const stepInterval = String(replayState.stepInterval ?? '1')
      return {
        playbackTimeframe: autoSelect ? chartResolution : stepInterval,
        candlesToSkip: this.replayBarsPerStep(stepInterval, chartResolution, autoSelect),
      }
    }

    const chartSec = Math.max(1, tradeseaResolutionToSeconds(chartResolution))
    const playbackSec = Math.max(1, tradeseaResolutionToSeconds(this.playbackTimeframe))
    return {
      playbackTimeframe: this.playbackTimeframe,
      candlesToSkip: Math.max(1, Math.round(playbackSec / chartSec)),
    }
  }

  private getReplayCursorSec(chartResolution: string): number | null {
    const resolution = chartResolution as ResolutionString
    return (
      this.datafeed?.getPlaybackAnchorSecForResolution?.(resolution) ??
      this.datafeed?.getPlaybackAnchorSecPublic?.() ??
      null
    )
  }

  /** Align server barCache.last with chart replay cursor (e.g. after 1m→30s TF switch). */
  syncServerReplayCursor(chartResolution?: string): void {
    if (!this.client?.isConnected()) return
    let resolution = chartResolution
    if (!resolution) {
      try {
        resolution = this.getBwcWidget()?.getResolution?.()
      } catch {
        resolution = undefined
      }
    }
    if (!resolution) return
    const cursorSec = this.getReplayCursorSec(resolution)
    if (cursorSec == null) return
    this.client.send({
      type: 'syncReplayCursor',
      cursorSec: Math.floor(cursorSec),
    })
  }

  private resolvePlaybackStepSec(): number {
    const stepInterval = this.resolvePlaybackStepResolution()
    const id = stepInterval.trim().toUpperCase()
    if (id === 'TICK') return 1
    if (id === '1S') return 1
    return Math.max(1, tradeseaResolutionToSeconds(stepInterval))
  }

  private resolvePlaybackStepResolution(): string {
    const widget = this.getBwcWidget()
    const replayState = widget?.replay?.getState?.()
    return String(replayState?.stepInterval ?? this.playbackTimeframe ?? '1')
  }

  private syncAllPanesReplayCursor(): void {
    const widget = this.getBwcWidget() as {
      syncHostReplayPanes?: () => void
    } | null
    widget?.syncHostReplayPanes?.()
  }

  /** Coalesce pane sync so multi-bar Next steps keep viewport tail stable. */
  private scheduleSyncAllPanesReplayCursor(): void {
    if (typeof requestAnimationFrame !== 'function') {
      this.syncAllPanesReplayCursor()
      return
    }
    if (this.replayPaneSyncRaf != null) {
      cancelAnimationFrame(this.replayPaneSyncRaf)
    }
    this.replayPaneSyncRaf = requestAnimationFrame(() => {
      this.replayPaneSyncRaf = null
      this.syncAllPanesReplayCursor()
    })
  }

  /** Keep BWC replay state aligned with the datafeed playback anchor (host-controlled replay). */
  syncReplayCursorFromBar(_anchorSec: number, _chartResolution?: string): void {
    this.scheduleSyncAllPanesReplayCursor()
  }

  private syncWidgetReplayCursor(anchorSec?: number, _chartResolution?: string): void {
    if (anchorSec != null && Number.isFinite(anchorSec)) {
      this.datafeed?.setPlaybackAnchorSec?.(Math.floor(anchorSec))
    }
    this.syncAllPanesReplayCursor()
  }

  private async reloadChartAfterSessionAnchor(opts?: {
    preserveViewport?: boolean
    playbackAnchorSec?: number
    clearPlaybackAnchor?: boolean
  }): Promise<void> {
    const chart = this.client?.getChart() as {
      reloadSessionDate?: (o?: {
        preserveViewport?: boolean
        playbackAnchorSec?: number
        clearPlaybackAnchor?: boolean
      }) => Promise<void>
      resetAllChartData?: () => Promise<void>
    } | null
    if (chart?.reloadSessionDate) {
      await chart.reloadSessionDate(opts)
      this.syncWidgetReplayCursor(opts?.playbackAnchorSec)
      return
    }
    this.datafeed?.resetSessionState?.()
    await chart?.resetAllChartData?.()
  }

  /**
   * Update the WebSocket client
   */
  updateClient(client: BacktesterChartClient | null): void {
    this.client = client

    // Set up callbacks when client is updated
    client?.setCallbacks({
      onReplayResponse: async (data: { type: string; time: string }) => {
        const anchorSec = this.parseReplayResponseTime(data.time)
        await this.reloadChartAfterSessionAnchor({
          preserveViewport: true,
          playbackAnchorSec: anchorSec ?? undefined,
          clearPlaybackAnchor: false,
        })
        console.log('[Backtester Trade Handler] Replayed to: ' + data.time)
      },
      onDateNavigationResponse: async (data: {
        type: string
        date: string
        startDate?: string
        success: boolean
        error?: string
      }) => {
        if (!data.success) {
          console.log('[Backtester Trade Handler] Date navigation failed: ', data)
          return
        }

        if (!this.session) return

        try {
          const newStartDate = this.resolveSessionStartDate(data)
          if (!newStartDate) {
            console.warn('[Backtester Trade Handler] Date navigation missing startDate')
            return
          }

          const updatedSession: BacktestSession = {
            ...this.session,
            startDate: newStartDate,
          }

          this.session = updatedSession
          this.client?.updateSession(updatedSession)
          this.onSessionUpdate?.(updatedSession)

          await this.reloadChartAfterSessionAnchor({
            preserveViewport: false,
            clearPlaybackAnchor: true,
          })

          await backtesterAPI.updateSession(updatedSession)
          this.onStatsRefresh?.()

          console.log('[Backtester Trade Handler] Date navigation: session anchored to', newStartDate)
        } catch (error) {
          console.error('[Backtester Trade Handler] Failed to apply date navigation:', error)
        }
      },
    })
  }

  /**
   * Get the trade cache instance
   */
  getTradeCache(): BacktesterTradeCache | null {
    return this.tradeCache
  }

  /**
   * Handle symbol change on chart — persist last viewed symbol for reopen; sessions remain multi-symbol.
   */
  handleSymbolChange(symbol: string): void {
    if (this.tradeCache) {
      this.tradeCache.onSymbolChange(symbol)
    }

    if (!this.session || this.session.symbol === symbol) {
      return
    }

    this.client?.send({
      type: 'symbol_change',
      symbol: symbol,
    })

    try {
      localStorage.setItem(BACKTESTER_CHART_SYMBOL_KEY, symbol)
    } catch {
      // ignore
    }

    const updatedSession: BacktestSession = { ...this.session, symbol }
    this.session = updatedSession
    this.onSessionUpdate?.(updatedSession)

    void backtesterAPI.updateSession(updatedSession).catch(() => {})

    try {
      ;(this as any).onUnrealizedPnLUpdate?.(0)
    } catch {
      // ignore
    }
  }


  onRealTimeBar(symbol: string, _resolution: string, bar: any): void {
    if(this.tradeCache){
      this.tradeCache.onRealTimeBar(symbol, bar)
    }
  }

  /**
   * Called when chart is ready
   */
  onReady(widget: any): void {
    this.widget = widget
    const tryAccessChart = () => {
      try {
        const chart = widget?.chart?.()
        if (chart) {
          this.tradeCache = new BacktesterTradeCache(this, widget)
          return
        }

        setTimeout(tryAccessChart, 100)
      } catch (error) {
        console.warn('[Backtester Trade Handler] Widget not ready, retrying...', error)
        setTimeout(tryAccessChart, 100)
      }
    }

    tryAccessChart()
  }

  /**
   * Log when a trading button is pressed
   */
  logButtonPress(buttonName: string, data?: { quantity?: number; symbol?: string }) {
    const chartSymbol = this.resolveChartSymbol(data?.symbol)
    if (!chartSymbol) {
      console.warn('[Backtester Trade Handler] No chart symbol for trade action')
      return
    }

    const lastBar = this.resolveLastBar(chartSymbol)
    if (!lastBar?.close) {
      console.warn('[Backtester Trade Handler] No last bar for trade action', { chartSymbol, buttonName })
      return
    }

    if (!this.tradeCache) {
      console.warn('[Backtester Trade Handler] Trade cache not ready')
      return
    }

    const mark = lastBar.close
    const position = this.tradeCache.getPosition(chartSymbol)

    switch (buttonName) {
      case 'Buy':
      case 'Sell': {
        const qty = Number(data?.quantity)
        if (!Number.isFinite(qty) || qty <= 0) return
        const signed = qty * (buttonName === 'Buy' ? 1 : -1)
        this.tradeCache.onOpenPosition(chartSymbol, mark, signed, null, null)
        break
      }
      case 'Reverse Position': {
        if (!position) return
        const contracts = position.contracts * -1
        this.tradeCache.onClosePosition(chartSymbol, Math.abs(position.contracts))
        this.tradeCache.onOpenPosition(chartSymbol, mark, contracts, null, null)
        break
      }
      case 'Close Position': {
        if (!position) return
        this.tradeCache.onClosePosition(chartSymbol, Math.abs(position.contracts))
        break
      }
      case 'Flatten All Position':
        this.tradeCache.onFlattenAllPosition()
        break
    }

    try {
      ;(this as { onPositionUpdate?: () => void }).onPositionUpdate?.()
      const upl = this.getPositionUplFor(chartSymbol)
      ;(this as { onUnrealizedPnLUpdate?: (pnl: number) => void }).onUnrealizedPnLUpdate?.(upl ?? 0)
    } catch {
      // ignore
    }
  }

  /**
   * Log when date navigation buttons are pressed
   */
  logDateNavigation(direction: 'previous' | 'next' | 'calendar', currentDate: string) {
    const logData: any = {
      direction: direction,
      currentDate: currentDate,
      sessionId: this.session?.id,
      sessionName: this.session?.name,
    }
    this.client?.send({
      type: 'date_navigation',
      direction: direction,
      currentDate: currentDate,
      sessionId: this.session?.id,
      sessionName: this.session?.name,
    })
    console.log(`[Backtester Trade Handler] Date navigation: ${direction}`, logData)
  }

  /**
   * Log when contract quantity changes
   */
  logQuantityChange(_oldValue: number, _newValue: number, _method: 'preset' | 'increment' | 'input' | 'decrement') {
    // Log data structure for future use
    // const logData = {
    //   oldValue,
    //   newValue,
    //   delta: method === 'increment' ? 1 : method === 'decrement' ? -1 : newValue - oldValue,
    //   method,
    //   sessionId: this.session?.id
    // }
  }

  /**
   * Log when playback control is used
   */
  logPlaybackAction(action: string, data?: any) {
    // Log data structure for future use
    // const logData = {
    //   action,
    //   sessionId: this.session?.id,
    //   ...data
    // }
    
    const chartComponent = this.client?.getChart()
    const chartWidget = chartComponent?.getChartWidget?.() ?? chartComponent
    switch (action) {
      case 'replay':
        if (data?.enabled && this.session?.startDate && this.session?.startTime) {
          const [year, month, day] = this.session.startDate.split('-').map(Number)
          const [hours, minutes] = this.session.startTime.split(':').map(Number)
          const replayDate = new Date(year, month - 1, day, hours, minutes, 0, 0)
          this.client?.send({
            type: 'replay',
            time: Math.floor(replayDate.getTime() / 1000),
          })
        }
        break
      // next_candle is handled by handleNextCandle() method
      case "next_candle":
        // Message already sent in handleNextCandle(), just log
        break
    }
  }

  /**
   * Handle play/pause toggle
   */
  handlePlayPause = (speed?: number): void => {
    if (speed !== undefined) {
      this.playbackSpeed = speed
    }
    
    const newIsPlaying = !this.isPlaying
    this.isPlaying = newIsPlaying
    
    this.logPlaybackAction(newIsPlaying ? 'play' : 'pause', {
      speed: this.playbackSpeed
    })
    
    if (newIsPlaying) {
      this.startPlayback()
    } else {
      this.stopPlayback()
    }
  }

  /**
   * Start playback at current speed
   */
  startPlayback = (): void => {
    // Clear any existing interval first
    this.stopPlayback()
    
    // Calculate interval: speed 1 = 1000ms, speed 2 = 500ms, speed 4 = 250ms, speed 8 = 125ms
    const intervalMs = 1000 / this.playbackSpeed
    
    this.playbackInterval = setInterval(() => {
      this.handleNextCandle()
    }, intervalMs) as any
  }

  /**
   * Stop playback
   */
  stopPlayback = (): void => {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval)
      this.playbackInterval = null
    }
  }

  /**
   * Handle speed change
   */
  handleSpeedChange = (speed: number): void => {
    const oldSpeed = this.playbackSpeed
    this.playbackSpeed = speed
    
    this.logPlaybackAction('speed_change', {
      oldSpeed,
      newSpeed: speed
    })
    
    // If playing, restart with new speed
    if (this.isPlaying) {
      this.stopPlayback()
      this.startPlayback()
    }
  }

  /**
   * Convert timeframe string to minutes
   */
  private timeframeToMinutes(timeframe: string): number {
    const clean = String(timeframe || '').trim().toUpperCase()
    if (!clean) return 1

    // Days
    if (clean.endsWith('D')) {
      const days = parseInt(clean.slice(0, -1), 10)
      return Number.isFinite(days) && days > 0 ? days * 1440 : 1
    }

    // Hours
    if (clean.endsWith('H')) {
      const hours = parseInt(clean.slice(0, -1), 10)
      return Number.isFinite(hours) && hours > 0 ? hours * 60 : 1
    }

    // Seconds (e.g. "30S" -> 0.5 minutes)
    if (clean.endsWith('S')) {
      const seconds = parseInt(clean.slice(0, -1), 10)
      return Number.isFinite(seconds) && seconds > 0 ? seconds / 60 : 1
    }

    // Minutes (default) - just the number
    const minutes = parseInt(clean, 10)
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 1
  }

  /**
   * Replay to a selected bar time (from BWC select-bar).
   */
  handleSelectBar = (payload: { time?: number; index?: number; bar?: { time?: number } }): void => {
    const rawTime = payload.time ?? payload.bar?.time
    if (rawTime == null || !Number.isFinite(Number(rawTime))) {
      console.warn('[BacktesterTradeHandler] selectBar missing bar time', payload)
      return
    }

    const unixSec = Number(rawTime) > 1e12 ? Math.floor(Number(rawTime) / 1000) : Math.floor(Number(rawTime))

    if (this.client?.isConnected()) {
      this.client.send({
        type: 'replay',
        time: unixSec,
      })
    }

    this.logPlaybackAction('select_bar', { time: unixSec, index: payload.index })
  }

  /**
   * Calculates how many candles to skip based on playback timeframe vs chart timeframe
   */
  handleNextCandle = (): void => {
    const stepResolution = this.resolvePlaybackStepResolution()
    const stepSec = this.resolvePlaybackStepSec()
    const current = this.datafeed?.getPlaybackAnchorSecPublic?.() ?? null

    if (current == null || !Number.isFinite(current)) {
      console.warn('[BacktesterTradeHandler] Replay cursor not set for nextCandle')
      return
    }

    const targetSec = current + stepSec
    this.datafeed?.setPlaybackAnchorSec?.(
      Math.floor(targetSec),
      stepResolution as ResolutionString,
    )

    // Trim pane bars to anchor before BWC overlay refresh (host-controlled replay).
    this.syncAllPanesReplayCursor()

    if (this.client && this.client.isConnected()) {
      this.client.send({
        type: 'nextCandle',
        stepSec,
        cursorSec: Math.floor(current),
        targetSec: Math.floor(targetSec),
        playbackTimeframe: stepResolution,
      })
    }

    queueMicrotask(() => this.scheduleSyncAllPanesReplayCursor())

    this.logPlaybackAction('next_candle', {
      stepResolution,
      stepSec,
      cursorSec: current,
      targetSec,
    })
  }

  /**
   * Set playback timeframe
   */
  setPlaybackTimeframe(timeframe: string): void {
    this.playbackTimeframe = timeframe
  }

  /**
   * Get playback timeframe
   */
  getPlaybackTimeframe(): string {
    return this.playbackTimeframe
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): { isPlaying: boolean; speed: number; timeframe: string } {
    return {
      isPlaying: this.isPlaying,
      speed: this.playbackSpeed,
      timeframe: this.playbackTimeframe
    }
  }

  /**
   * Cleanup - stop playback and clear interval
   */
  cleanup(): void {
    this.stopPlayback()
    this.isPlaying = false
  }
}

