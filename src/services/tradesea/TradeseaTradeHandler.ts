import { aurenToast } from '../../utils/aurenToast'
import { tradeseaAPI } from '../../api/tradesea.api'
import { TradeseaPropFirm } from '../propfirms/TradeseaPropFirm'
import {
  formatTradeseaExecutionTooltip,
  parseTradeseaExecutions,
  toChartExecutionTimeSeconds,
} from './tradeseaExecutions'
import {
  calcTradeseaTickPnL,
  calcAccountUnrealizedPl,
  signedContractsFromPosition,
} from './tradeseaPnL'
import { findPositionsForInstrument, instrumentsMatch } from './tradeseaPositions'
import { TradeseaDatafeed, type TradeseaMarketBook } from './TradeseaDatafeed'
import { TradeseaTradeCache } from './TradeseaTradeCache'
import { normalizeTradeseaTradeInstrument } from './tradeseaInstrument'
import { debugTradeseaUpl } from './tradeseaDebug'
import { toTradeseaDelayedTicker } from './tradeseaStreamSymbol'
import { isMarketClosedApiError, MARKET_CLOSED_MESSAGE } from '../../utils/marketSession'

export class TradeseaTradeHandler {
  private widget: any = null
  private executionLines: Array<{ remove?: () => void }> = []
  private executionsPaintGeneration = 0
  tradeCache: TradeseaTradeCache | null = null
  private streamSyncTimer: ReturnType<typeof setTimeout> | null = null
  /** Fired when candle-driven UP&L changes (account bar). */
  onUnrealizedPnLUpdate?: (upl: number) => void

  constructor(readonly propFirm: TradeseaPropFirm) {}

  onReady(widget: any, chartDatafeed?: TradeseaDatafeed | null): void {
    this.widget = widget
    this.tradeCache = new TradeseaTradeCache(this, widget)
    this.attachToDatafeed(chartDatafeed)
    if (this.propFirm.positions.some((p) => Math.abs(p.qty ?? 0) > 0)) {
      this.scheduleStreamSync()
    } else {
      void this.syncFromStream()
    }
    void this.refreshExecutionsForChart()
  }

  /** Bind candle → UP&L on the datafeed the chart actually uses. */
  attachToDatafeed(chartDatafeed?: TradeseaDatafeed | null): void {
    const df =
      chartDatafeed ??
      this.propFirm.chartServices?.datafeed ??
      null
    df?.setTradeHandler(this)
    debugTradeseaUpl('handler:attach', {
      force: true,
      tradeHandlerSet: Boolean(df),
      sameAsPropFirm: df === this.propFirm.chartServices?.datafeed,
    })
  }

  onRealTimeBar(symbol: string, _resolution: string, bar: { close?: number }): void {
    if (!this.tradeCache || !bar) return
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
        if (instrumentsMatch(instrument, activeInstrument)) return markPrice
        return null
      },
      (instrument) => ({
        tickSize:
          datafeed?.getTickSize?.(activeSymbol) ??
          datafeed?.getTickSize?.(instrument) ??
          tickSize,
        tickValue:
          datafeed?.getTickValue?.(activeSymbol) ??
          datafeed?.getTickValue?.(instrument) ??
          tickValue,
      }),
      { chartMark: markPrice, chartInstrument: activeInstrument }
    )

    let total = streamTotal
    let counted = streamCounted

    if (!counted) {
      const cacheSnap = this.tradeCache?.getChartPositionSnapshot()
      if (cacheSnap && cacheSnap.entry != null && cacheSnap.contracts) {
        total = calcTradeseaTickPnL(
          cacheSnap.entry,
          markPrice,
          cacheSnap.contracts,
          tickSize,
          tickValue
        )
        counted = true
      }
    }

    if (!counted) {
      const matches = findPositionsForInstrument(this.propFirm.positions, activeInstrument)
      const sources = matches.length
        ? matches
        : this.propFirm.positions.filter((p) => Math.abs(p.qty ?? 0) > 0)

      for (const pos of sources) {
        const entry = pos.avgPrice
        if (entry == null) continue
        const contracts = signedContractsFromPosition(pos)
        if (!contracts) continue
        total += calcTradeseaTickPnL(entry, markPrice, contracts, tickSize, tickValue)
        counted = true
      }
    }

    if (!counted) {
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

    debugTradeseaUpl('calc', {
      markPrice,
      chartSymbol: activeSymbol,
      chartInstrument: activeInstrument,
      streamCounted,
      streamTotal,
      counted,
      total,
      positionsCount: this.propFirm.positions.length,
      tickSize,
      tickValue,
    })

    this.propFirm.setUnrealizedPl(total, { fromStream: false })
    this.onUnrealizedPnLUpdate?.(total)
    this.propFirm.notifyAccountInfoChanged?.()
  }

  /** Called when the chart cache has no open positions left. */
  onAllPositionsClosed(): void {
    this.propFirm.setUnrealizedPl(0, { fromStream: false })
    this.onUnrealizedPnLUpdate?.(0)
    this.propFirm.notifyAccountInfoChanged?.()
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

  /** Apply WS positions + bracket orders to chart lines (retries until chart/bars exist). */
  scheduleStreamSync(): void {
    if (this.streamSyncTimer) {
      clearTimeout(this.streamSyncTimer)
      this.streamSyncTimer = null
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
    if (!this.tradeCache || !this.widget?.chart) return

    const run = () => {
      try {
        const chartSymbol = String(this.widget.chart().symbol() || this.propFirm.chartSymbol)
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
    if (!this.tradeCache || !this.widget?.chart) return
    try {
      const chartSymbol = String(this.widget.chart().symbol() || this.propFirm.chartSymbol)
      this.tradeCache.syncPositionForChartSymbol(chartSymbol)
    } catch {
      /* chart not ready */
    }
  }

  refreshUnrealizedFromLastBar(): void {
    try {
      const chart = this.widget?.chart?.()
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

  getActiveMarketBook(chartSymbol?: string): TradeseaMarketBook | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    if (!datafeed?.getMarketBookForChart) return null
    return datafeed.getMarketBookForChart(this.getChartSymbol(chartSymbol))
  }

  getActiveMarkPrice(chartSymbol?: string): number | null {
    const book = this.getActiveMarketBook(chartSymbol)
    if (book?.last != null) return book.last
    try {
      const chart = this.widget?.chart?.()
      const datafeed = this.propFirm.chartServices?.datafeed
      const lastBar = chart && datafeed?.getLastBarForChart?.(chart)
      if (lastBar?.close != null) return lastBar.close
    } catch {
      /* chart not ready */
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
    setTimeout(() => {
      void this.refreshExecutionsForChart(chartSymbol)
    }, 800)
  }

  /** Filled trades for chart arrows (api-trades-r-delprod …/executions). */
  async refreshExecutionsForChart(symbol?: string): Promise<void> {
    const accountId = this.propFirm.selectedAccountId
    if (!accountId || !this.widget?.chart) return

    const datafeed = this.propFirm.chartServices?.datafeed
    if (datafeed?.whenSymbolsReady) {
      await datafeed.whenSymbolsReady()
    }

    const instrument = this.resolveInstrument(this.getChartSymbol(symbol))

    try {
      const res = await tradeseaAPI.getExecutions(accountId, instrument, 100)
      if (!res.success || res.s !== 'ok') return

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

  async logButtonPress(buttonName: string, data?: { quantity?: number; symbol?: string }): Promise<void> {
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
          })

          if (result.success && result.s === 'ok') {
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
