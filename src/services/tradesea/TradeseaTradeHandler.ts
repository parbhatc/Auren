import { aurenToast } from '../../utils/aurenToast'
import { tradeseaAPI } from '../../api/tradesea.api'
import { getAuthToken } from '../../api/api'
import { TradeseaPropFirm } from '../../propfirms/tradesea'
import {
  formatTradeseaExecutionTooltip,
  parseTradeseaExecutions,
  toChartExecutionTimeSeconds,
} from './tradeseaExecutions'
import {
  calcAccountUnrealizedPl,
} from './tradeseaPnL'
import { isBwcChartPanning } from '../../utils/bwcPan'
import { TradeseaDatafeed, type TradeseaMarketBook } from './TradeseaDatafeed'
import type { PracticeChartDatafeed, PracticeMarketBook } from '../practice/practiceDatafeed'
import { TradeseaTradeCache } from './TradeseaTradeCache'
import { normalizeTradeseaTradeInstrument } from './tradeseaInstrument'
import { debugTradeseaUpl } from './tradeseaDebug'
import { toTradeseaDelayedTicker } from './tradeseaStreamSymbol'
import { isMarketClosedApiError, MARKET_CLOSED_MESSAGE } from '../../utils/marketSession'
import { findPositionsForInstrument, instrumentsMatch, parseTradeseaPosition } from './tradeseaPositions'
import { createBwcAutoRiskPreview } from '../../chart/bwcAutoRiskPreview'
import { getBwcActiveResolution, pickBwcChartPriceOnce } from '../../chart/bwcPanePricePicker'
import type { ChartPricePickContext } from '../../types/tradePanel'
import {
  summarizePracticePositionFamily,
  type PracticePositionFamilySummary,
} from '../practice/practiceContractFamily'

export class TradeseaTradeHandler {
  private widget: any = null
  private executionLines: Array<{ remove?: () => void }> = []
  private executionsPaintGeneration = 0
  tradeCache: TradeseaTradeCache | null = null
  private streamSyncTimer: ReturnType<typeof setTimeout> | null = null
  private marketBookUnsub: (() => void) | null = null
  private cancelChartPricePick: (() => void) | null = null
  private attachedDatafeed: TradeseaDatafeed | null = null
  private cacheSessionKey: string | null = null
  private executionRefreshTimer: ReturnType<typeof setTimeout> | null = null
  /** Fired when candle-driven UP&L changes (account bar). */
  onUnrealizedPnLUpdate?: (upl: number) => void

  constructor(readonly propFirm: TradeseaPropFirm) {}

  private sessionKey(): string {
    return JSON.stringify([getAuthToken(), this.propFirm.token, this.propFirm.selectedAccountId])
  }

  onReady(widget: any, chartDatafeed?: TradeseaDatafeed | null): void {
    const sessionKey = this.sessionKey()
    if (this.cacheSessionKey !== sessionKey) this.disposeSession()
    else if (this.widget && this.widget !== widget) this.detachChart(this.widget)
    this.widget = widget
    if (this.tradeCache) this.tradeCache.attachChartView(widget)
    else this.tradeCache = new TradeseaTradeCache(this, widget)
    this.cacheSessionKey = sessionKey
    this.attachToDatafeed(chartDatafeed)
    if (this.propFirm.positions.some((p) => Math.abs(p.qty ?? 0) > 0)) {
      this.scheduleStreamSync()
    } else {
      void this.syncFromStream()
    }
    void this.refreshExecutionsForChart()
  }

  /** Detach just the view; keep account marks and browser stop state warm. */
  detachChart(widget: unknown): void {
    if (this.widget !== widget) return
    if (this.streamSyncTimer) clearTimeout(this.streamSyncTimer)
    this.streamSyncTimer = null
    if (this.executionRefreshTimer) clearTimeout(this.executionRefreshTimer)
    this.executionRefreshTimer = null
    this.cancelChartPricePick?.()
    this.cancelChartPricePick = null
    this.executionsPaintGeneration += 1
    this.clearExecutionShapes()
    this.tradeCache?.detachChartView()
    this.widget = null
  }

  /** End account/auth ownership before another feed can publish new ticks. */
  disposeSession(): void {
    if (this.widget) this.detachChart(this.widget)
    if (this.streamSyncTimer) clearTimeout(this.streamSyncTimer)
    this.streamSyncTimer = null
    if (this.executionRefreshTimer) clearTimeout(this.executionRefreshTimer)
    this.executionRefreshTimer = null
    this.executionsPaintGeneration += 1
    this.marketBookUnsub?.()
    this.marketBookUnsub = null
    this.attachedDatafeed?.setTradeHandler(null)
    this.attachedDatafeed = null
    this.tradeCache?.detachChartView()
    this.tradeCache = null
    this.cacheSessionKey = null
  }

  /** Bind candle → UP&L on the datafeed the chart actually uses. */
  attachToDatafeed(chartDatafeed?: TradeseaDatafeed | null): void {
    const df =
      chartDatafeed ??
      this.propFirm.chartServices?.datafeed ??
      null
    this.marketBookUnsub?.()
    this.marketBookUnsub = null
    this.attachedDatafeed = df
    df?.setTradeHandler(this)
    if (df?.subscribeMarketBook) {
      this.marketBookUnsub = df.subscribeMarketBook((streamId, kind) => {
        if (this.cacheSessionKey !== this.sessionKey()) return
        if (kind !== 'ltp' && kind !== 'bbo') return
        const book = df.getMarketBookForStream(streamId)
        const mark =
          book?.last ??
          (book?.bestBid != null && book?.bestAsk != null
            ? (book.bestBid + book.bestAsk) / 2
            : book?.bestBid ?? book?.bestAsk)
        if (mark != null && Number.isFinite(mark)) {
          this.tradeCache?.onMarketPrice(streamId, mark, Date.now())
          this.updateUnrealizedFromMark(mark, streamId)
        }
      })
    }
    debugTradeseaUpl('handler:attach', {
      force: true,
      tradeHandlerSet: Boolean(df),
      sameAsPropFirm: df === this.propFirm.chartServices?.datafeed,
    })
  }

  onRealTimeBar(symbol: string, _resolution: string, bar: { close?: number }): void {
    if (this.cacheSessionKey !== this.sessionKey()) return
    if (!this.tradeCache || !bar) return
    if (isBwcChartPanning()) return
    this.tradeCache.onRealTimeBar(symbol, bar)
    if (bar.close != null) {
      debugTradeseaUpl('bar', { chartSymbol: symbol, markPrice: bar.close })
      this.updateUnrealizedFromMark(bar.close, symbol)
    }
  }

  /** Recalculate account UP&L from open positions + latest candle close. */
  updateUnrealizedFromMark(markPrice: number, chartSymbol?: string): void {
    if (!Number.isFinite(markPrice)) return

    const datafeed = this.propFirm.chartServices?.datafeed
    const activeSymbol = chartSymbol || this.getChartSymbol()
    const activeInstrument = this.resolveInstrument(activeSymbol)
    const tickSize = datafeed?.getTickSize?.(activeSymbol) ?? 0.25
    const tickValue = datafeed?.getTickValue?.(activeSymbol) ?? 0.5

    const { total: streamTotal, counted: streamCounted } = calcAccountUnrealizedPl(
      this.propFirm.positions,
      (instrument) => {
        const book = datafeed?.getMarketBookForChart?.(instrument)
        const instrumentMark =
          book?.last ??
          (book?.bestBid != null && book?.bestAsk != null
            ? (book.bestBid + book.bestAsk) / 2
            : book?.bestBid ?? book?.bestAsk)
        if (instrumentMark != null && Number.isFinite(instrumentMark)) {
          return instrumentMark
        }
        if (instrumentsMatch(instrument, activeInstrument)) return markPrice
        return null
      },
      (instrument) => ({
        tickSize:
          datafeed?.getTickSize?.(instrument) ??
          (instrumentsMatch(instrument, activeInstrument)
            ? datafeed?.getTickSize?.(activeSymbol)
            : undefined) ??
          tickSize,
        tickValue:
          datafeed?.getTickValue?.(instrument) ??
          (instrumentsMatch(instrument, activeInstrument)
            ? datafeed?.getTickValue?.(activeSymbol)
            : undefined) ??
          tickValue,
      }),
      { chartMark: markPrice, chartInstrument: activeInstrument }
    )

    if (!streamCounted) {
      debugTradeseaUpl('calc:none', {
        force: true,
        markPrice,
        chartSymbol: activeSymbol,
        chartInstrument: activeInstrument,
        positionsCount: this.propFirm.positions.length,
        positions: this.propFirm.positions,
        streamCounted,
        streamTotal,
        cacheSnapshot: this.tradeCache?.getChartPositionSnapshot() ?? null,
        tradeHandlerSet: true,
        tickSize,
        tickValue,
      })
      return
    }

    const total = streamTotal
    debugTradeseaUpl('calc', {
      markPrice,
      chartSymbol: activeSymbol,
      chartInstrument: activeInstrument,
      streamCounted,
      streamTotal,
      counted: streamCounted,
      total,
      positionsCount: this.propFirm.positions.length,
      tickSize,
      tickValue,
    })

    const totalRounded = Math.round(total * 100) / 100
    const prevUpl = this.propFirm.upl
    this.propFirm.setUnrealizedPl(totalRounded, { fromStream: false })
    if (prevUpl !== this.propFirm.upl) {
      this.onUnrealizedPnLUpdate?.(totalRounded)
    }
  }

  /** Called when the chart cache has no open positions left. */
  onAllPositionsClosed(): void {
    const prevUpl = this.propFirm.upl
    this.propFirm.setUnrealizedPl(0, { fromStream: false })
    if (prevUpl !== this.propFirm.upl) {
      this.onUnrealizedPnLUpdate?.(0)
    }
  }

  handleSymbolChange(symbol: string): void {
    if (!this.tradeCache) return
    this.tradeCache.onSymbolChange(symbol)
    void this.syncFromStream()
    void this.refreshExecutionsForChart(symbol)
  }

  resolveInstrumentPublic(chartSymbol: string): string {
    return this.resolveInstrument(chartSymbol)
  }

  getActiveChartResolution(): string {
    return getBwcActiveResolution(this.widget)
  }

  pickChartPriceOnce(onPrice: (price: number, context: ChartPricePickContext) => boolean | void): (() => void) | null {
    this.cancelChartPricePick?.()
    const cancel = pickBwcChartPriceOnce(
      this.widget,
      (rawPrice, context) => {
        const symbol = context.symbol || this.getChartSymbol()
        const tickSize = this.propFirm.chartServices?.datafeed?.getTickSize?.(symbol) ?? 0.25
        const price = tickSize > 0 ? Math.round(rawPrice / tickSize) * tickSize : rawPrice
        return Number(price.toFixed(8))
      },
      (price, context) => {
        const accepted = onPrice(price, context)
        if (accepted !== false && this.cancelChartPricePick === cancel) this.cancelChartPricePick = null
        return accepted
      }
    )
    this.cancelChartPricePick = cancel
    return cancel
  }

  showAutoPositionPreview(options: {
    side: 'buy' | 'sell'
    entry: number
    stopLoss: number
    tickSize: number
    appearanceAt: (price: number, context: ChartPricePickContext) => { label: string; quantityLabel: string }
    tickSizeAt?: (context: ChartPricePickContext) => number
  }): (() => void) | null {
    if (this.tradeCache?.getChartPositionSnapshot()) return null
    return createBwcAutoRiskPreview(this.widget, {
      stopLoss: options.stopLoss,
      tickSize: options.tickSize,
      appearanceAt: options.appearanceAt,
      tickSizeAt: options.tickSizeAt,
    })
  }

  /** Apply WS positions + bracket orders to chart lines (retries until chart/bars exist). */
  scheduleStreamSync(): void {
    if (this.streamSyncTimer) {
      clearTimeout(this.streamSyncTimer)
      this.streamSyncTimer = null
    }
    if (!this.widget) {
      this.syncFromStream()
      return
    }

    const delays = [0, 1000]
    let step = 0

    const tick = () => {
      this.syncFromStream()
      step += 1
      if (step < delays.length) {
        this.streamSyncTimer = setTimeout(tick, delays[step])
      }
    }

    tick()
  }

  syncFromStream(): void {
    if (!this.tradeCache || this.cacheSessionKey !== this.sessionKey()) return
    const widget = this.widget
    const cache = this.tradeCache
    const chart = widget?.chart?.() ?? cache.getChart()
    if (!chart) return
    const sessionKey = this.cacheSessionKey

    const run = () => {
      if (this.widget !== widget || this.tradeCache !== cache || this.sessionKey() !== sessionKey) return
      try {
        const chartSymbol = String(chart.symbol() || this.propFirm.chartSymbol)
        this.tradeCache?.syncAllOpenPositions(chartSymbol)
        this.refreshUnrealizedFromLastBar()
      } catch {
        /* chart not ready */
      }
    }

    const datafeed = this.propFirm.chartServices?.datafeed
    if (datafeed?.whenSymbolsReady) {
      void datafeed.whenSymbolsReady().then(run)
    } else {
      run()
    }
  }

  /** Bracket-only refresh when `orderUpdates` moves SL/TP (position size unchanged). */
  syncBracketsFromOrders(): void {
    if (!this.tradeCache || this.cacheSessionKey !== this.sessionKey()) return
    try {
      const chart = this.widget?.chart?.() ?? this.tradeCache.getChart()
      if (!chart) return
      const chartSymbol = String(chart.symbol() || this.propFirm.chartSymbol)
      this.tradeCache.syncPositionForChartSymbol(chartSymbol)
    } catch {
      /* chart not ready */
    }
  }

  refreshUnrealizedFromLastBar(): void {
    try {
      const chart = this.widget?.chart?.() ?? this.tradeCache?.getChart()
      const datafeed = this.propFirm.chartServices?.datafeed
      const lastBar = chart && datafeed?.getLastBarForChart?.(chart)
      const chartSymbol = chart ? String(chart.symbol?.() || '') : undefined
      if (lastBar?.close != null) {
        debugTradeseaUpl('refreshLastBar', {
          force: true,
          chartSymbol,
          markPrice: lastBar.close,
        })
        this.updateUnrealizedFromMark(lastBar.close, chartSymbol || undefined)
      } else {
        debugTradeseaUpl('refreshLastBar:missing', {
          force: true,
          chartSymbol,
          hasChart: Boolean(chart),
          hasDatafeed: Boolean(datafeed),
        })
      }
    } catch (err) {
      debugTradeseaUpl('refreshLastBar:error', {
        force: true,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  getTradeCache(): TradeseaTradeCache | null {
    return this.tradeCache
  }

  getActiveMarketBook(chartSymbol?: string): PracticeMarketBook | null {
    const datafeed = this.propFirm.chartServices?.datafeed as PracticeChartDatafeed | undefined
    if (!datafeed?.getMarketBookForChart) return null
    return datafeed.getMarketBookForChart(this.getChartSymbol(chartSymbol))
  }

  getActiveMarkPrice(chartSymbol?: string): number | null {
    const requestedSymbol = this.getChartSymbol(chartSymbol)
    const book = this.getActiveMarketBook(requestedSymbol)
    if (book?.last != null) return book.last

    const widgetSymbol = this.getChartSymbol()
    const requestedIsChart =
      instrumentsMatch(
        this.resolveInstrument(requestedSymbol),
        this.resolveInstrument(widgetSymbol)
      )
    if (requestedIsChart) {
      try {
        const chart = this.widget?.chart?.()
        const datafeed = this.propFirm.chartServices?.datafeed
        const lastBar = chart && datafeed?.getLastBarForChart?.(chart)
        if (lastBar?.close != null) return lastBar.close
      } catch {
        /* chart not ready */
      }
    }
    if (book?.bestBid != null && book?.bestAsk != null) {
      return (book.bestBid + book.bestAsk) / 2
    }
    return book?.bestBid ?? book?.bestAsk ?? null
  }

  private getChartSymbol(symbol?: string): string {
    let chartSymbol = symbol?.trim()
    if (!chartSymbol && this.widget?.chart) {
      try {
        chartSymbol = String(this.widget.chart().symbol() || '').trim()
      } catch {
        chartSymbol = ''
      }
    }
    return chartSymbol || this.propFirm.chartSymbol || 'NQ'
  }

  private getMarketClosedMessage(chartSymbol: string): string | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    if (!datafeed?.isMarketOpenForChart) return null
    return datafeed.isMarketOpenForChart(chartSymbol) ? null : MARKET_CLOSED_MESSAGE
  }

  private formatOrderError(message: string): string {
    return isMarketClosedApiError(message) ? MARKET_CLOSED_MESSAGE : message
  }

  private resolveInstrument(chartSymbol: string): string {
    const datafeed = this.propFirm.chartServices?.datafeed
    if (datafeed) {
      return normalizeTradeseaTradeInstrument(datafeed.resolveStreamInstrument(chartSymbol.trim()))
    }
    return normalizeTradeseaTradeInstrument(toTradeseaDelayedTicker(chartSymbol))
  }

  private scheduleRefresh(chartSymbol: string): void {
    if (this.executionRefreshTimer) clearTimeout(this.executionRefreshTimer)
    this.executionRefreshTimer = setTimeout(() => {
      this.executionRefreshTimer = null
      void this.refreshExecutionsForChart(chartSymbol)
    }, 800)
  }

  /** Filled trades for chart arrows (api-trades-r-delprod …/executions). */
  async refreshExecutionsForChart(symbol?: string): Promise<void> {
    const accountId = this.propFirm.selectedAccountId
    if (!accountId || !this.widget?.chart) return
    const widget = this.widget
    const sessionKey = this.cacheSessionKey

    const datafeed = this.propFirm.chartServices?.datafeed
    if (datafeed?.whenSymbolsReady) {
      await datafeed.whenSymbolsReady()
    }
    if (this.widget !== widget || this.sessionKey() !== sessionKey) return

    const instrument = this.resolveInstrument(this.getChartSymbol(symbol))

    try {
      const res = await tradeseaAPI.getExecutions(accountId, instrument, 100)
      if (!res.success || res.s !== 'ok') return
      if (this.widget !== widget || this.sessionKey() !== sessionKey) return

      const executions = parseTradeseaExecutions(res)
      this.propFirm.executions = executions
      this.paintExecutionsOnChart(executions)
    } catch (err) {
      console.warn('[TradeseaTradeHandler] getExecutions failed:', err)
    }
  }

  private clearExecutionShapes(): void {
    for (const line of this.executionLines) {
      try {
        line?.remove?.()
      } catch {
        /* ignore */
      }
    }
    this.executionLines = []
  }

  private async paintExecutionsOnChart(
    executions: ReturnType<typeof parseTradeseaExecutions>
  ): Promise<void> {
    const chart = this.widget?.chart?.()
    if (!chart || typeof chart.createExecutionShape !== 'function') return

    const generation = ++this.executionsPaintGeneration
    this.clearExecutionShapes()

    const seen = new Set<string>()
    const sorted = [...executions].sort((a, b) => a.time - b.time)

    for (const ex of sorted) {
      if (generation !== this.executionsPaintGeneration) return
      const dedupeKey = ex.id || `${ex.time}-${ex.price}-${ex.side}-${ex.qty}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      try {
        const direction = String(ex.side).toLowerCase() === 'sell' ? 'sell' : 'buy'
        const tooltip = formatTradeseaExecutionTooltip(ex)
        const time = toChartExecutionTimeSeconds(ex.time)
        const line = await chart.createExecutionShape()
        if (generation !== this.executionsPaintGeneration) {
          line?.remove?.()
          return
        }

        if (!line || typeof line.setTime !== 'function') continue

        line.setDirection(direction).setTime(time).setPrice(ex.price)

        if (typeof line.setText === 'function') line.setText('')
        if (typeof line.setTooltip === 'function') line.setTooltip(tooltip)

        const arrowColor = direction === 'buy' ? '#22c55e' : '#ef4444'
        if (typeof line.setArrowColor === 'function') line.setArrowColor(arrowColor)
        if (typeof line.setTextColor === 'function') line.setTextColor('rgba(0,0,0,0)')
        if (typeof line.setArrowHeight === 'function') line.setArrowHeight(10)
        if (typeof line.setArrowSpacing === 'function') line.setArrowSpacing(2)

        this.executionLines.push(line)
      } catch (err) {
        console.warn('[TradeseaTradeHandler] execution shape failed:', err)
      }
    }
  }

  private findPositionForChart(instrument: string) {
    const matches = findPositionsForInstrument(this.propFirm.positions, instrument)
    if (!matches.length) return null
    return matches[0]
  }

  getPositionFamilySummaryFor(symbolKey: string): PracticePositionFamilySummary | null {
    const positions = this.propFirm.positions.flatMap((row) => {
      const position = parseTradeseaPosition(row)
      const quantity = Number(position?.qty)
      if (!position?.instrument || !Number.isFinite(quantity) || quantity <= 0) return []
      const contracts = String(position.side || '').toLowerCase() === 'sell' ? -quantity : quantity
      return [{
        symbol: position.instrument,
        closeSymbol: position.instrument,
        contracts,
      }]
    })
    return summarizePracticePositionFamily(symbolKey, positions)
  }

  async logButtonPress(buttonName: string, data?: {
    quantity?: number
    symbol?: string
    stopLoss?: number | null
    takeProfit?: number | null
    stopLossMode?: 'hard' | 'soft'
    softStopTrigger?: 'bar_close'
    softStopResolution?: string
  }): Promise<void> {
    const accountId = this.propFirm.selectedAccountId
    if (!accountId) {
      aurenToast.error('Select a Tradesea account first')
      return
    }

    const chartSymbol = this.getChartSymbol(data?.symbol)
    const closedMsg = this.getMarketClosedMessage(chartSymbol)
    if (closedMsg) {
      aurenToast.error(closedMsg)
      return
    }

    const instrument = this.resolveInstrument(chartSymbol)

    switch (buttonName) {
      case 'Buy':
      case 'Sell': {
        const qty = Number(data?.quantity)
        if (!Number.isFinite(qty) || qty <= 0) {
          aurenToast.error('Enter a valid quantity')
          return
        }
        const side = buttonName === 'Buy' ? 'buy' : 'sell'
        try {
          const result = await tradeseaAPI.placeOrder({
            accountId,
            instrument,
            qty,
            side,
            type: 'market',
            durationType: 'day',
            stopLoss:
              data?.stopLossMode === 'soft' ? undefined : data?.stopLoss ?? undefined,
            takeProfit: data?.takeProfit ?? undefined,
          })

          if (result.success && result.s === 'ok') {
            if (data?.stopLossMode === 'soft' && data.stopLoss != null) {
              await this.tradeCache?.armSoftStop(
                chartSymbol,
                data.stopLoss,
                data.softStopResolution || this.getActiveChartResolution()
              )
            }
            aurenToast.success(`${buttonName} order placed (${qty} @ ${instrument})`)
            this.scheduleRefresh(chartSymbol)
          } else {
            aurenToast.error(
              this.formatOrderError(result.error || result.errmsg || `Failed to place ${side} order`)
            )
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : `Failed to place ${side} order`
          console.error('[TradeseaTradeHandler] placeOrder failed:', err)
          aurenToast.error(this.formatOrderError(msg))
        }
        break
      }

      case 'Close Position': {
        const qty = Number(data?.quantity)
        const position = this.findPositionForChart(instrument)
        if (!position) {
          aurenToast.error(`No open position for ${instrument}`)
          return
        }

        const posQty = Math.abs(position.qty ?? 0)
        const amount =
          Number.isFinite(qty) && qty > 0 && posQty > 0 && qty < posQty ? qty : undefined

        try {
          const result = await tradeseaAPI.closePosition({
            accountId,
            positionId: position.id,
            amount,
          })
          if (result.success && result.s === 'ok') {
            this.tradeCache?.clearSoftStop(chartSymbol)
            aurenToast.success(amount ? `Closed ${amount} contract(s)` : 'Position closed')
            this.scheduleRefresh(chartSymbol)
          } else {
            aurenToast.error(result.error || result.errmsg || 'Failed to close position')
          }
        } catch (err: unknown) {
          aurenToast.error(err instanceof Error ? err.message : 'Failed to close position')
        }
        break
      }

      case 'Reverse Position': {
        const position = this.findPositionForChart(instrument)
        if (!position) {
          aurenToast.error(`No open position for ${instrument}`)
          return
        }
        try {
          const result = await tradeseaAPI.reversePosition({
            accountId,
            positionId: position.id,
          })
          if (result.success && result.s === 'ok') {
            this.tradeCache?.clearSoftStop(chartSymbol)
            aurenToast.success('Position reversed')
            this.scheduleRefresh(chartSymbol)
          } else {
            aurenToast.error(result.error || result.errmsg || 'Failed to reverse position')
          }
        } catch (err: unknown) {
          aurenToast.error(err instanceof Error ? err.message : 'Failed to reverse position')
        }
        break
      }

      case 'Flatten All Position': {
        try {
          const result = await tradeseaAPI.flattenAll(accountId)
          if (result.success && result.s === 'ok') {
            this.tradeCache?.clearAllSoftStops()
            aurenToast.success('Flattened all positions')
            this.scheduleRefresh(chartSymbol)
          } else {
            aurenToast.error(result.error || result.errmsg || 'Failed to flatten')
          }
        } catch (err: unknown) {
          aurenToast.error(err instanceof Error ? err.message : 'Failed to flatten')
        }
        break
      }

      default:
        console.log('[TradeseaTradeHandler]', buttonName, data)
    }
  }

  async cancelAllWorkingOrders(): Promise<void> {
    const accountId = this.propFirm.selectedAccountId
    if (!accountId) {
      aurenToast.error('Select a Tradesea account first')
      return
    }
    try {
      const result = await tradeseaAPI.cancelAllOrders(accountId)
      if (result.success && result.s === 'ok') {
        aurenToast.success('Cancelled all working orders')
      } else {
        aurenToast.error(result.error || result.errmsg || 'Failed to cancel orders')
      }
    } catch (err: unknown) {
      aurenToast.error(err instanceof Error ? err.message : 'Failed to cancel orders')
    }
  }
}
