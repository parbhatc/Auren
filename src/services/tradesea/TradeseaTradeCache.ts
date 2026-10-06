import { aurenToast } from '../../utils/aurenToast'
import ChartTradeCache from '../../components/common/ChartTradeCache'
import { tradeseaAPI } from '../../api/tradesea.api'
import { bracketOrdersForPosition } from './tradeseaBracketOrders'
import { findPositionsForInstrument, parseTradeseaPosition } from './tradeseaPositions'
import { TradeseaTradeHandler } from './TradeseaTradeHandler'
import { debugTradeseaSl } from './tradeseaDebug'

let lastSyncPositionSlKey = ''
let lastAppliedSlVisualKey = ''
let lastAppliedTpVisualKey = ''

const BRACKET_PENDING_MS = 5000

type TradeseaCachedPosition = {
  symbol: string
  entry: number
  stopLoss: number | null
  takeProfit: number | null
  contracts: number
  stopLossOrderId?: number | string | null
  takeProfitOrderId?: number | string | null
  positionId?: string | null
  bracketPendingUntil?: number
  stopLossMode?: 'hard' | 'soft'
  softStopTrigger?: 'bar_close'
  line?: unknown
  [key: string]: unknown
}

export class TradeseaTradeCache extends ChartTradeCache {
  private stopLossCancelInFlight = false
  private softStops = new Map<string, { price: number; createdAt: number }>()
  private softStopMinuteMarks = new Map<string, { minute: number; close: number; time: number }>()
  private softStopCloseInFlight = new Set<string>()

  constructor(handler: TradeseaTradeHandler, widget: any) {
    super(handler, widget.chart())
    this.create_stop_loss_and_take_profit_lines = true
  }

  private get propFirm() {
    return this.handler.propFirm
  }

  getDatafeed(): any {
    return this.propFirm.chartServices?.datafeed ?? null
  }

  onRealTimeBar(symbol: string, bar: { close?: number }): void {
    super.onRealTimeBar(symbol, bar)
  }

  /** Register a browser-only stop. Nothing is sent to Tradesea as a stop order. */
  async armSoftStop(symbol: string, price: number): Promise<void> {
    const instrument = this.handler.resolveInstrumentPublic(symbol)
    if (!instrument || !Number.isFinite(price)) return
    const existing = this.getPosition(symbol) as TradeseaCachedPosition | undefined
    const existingHardStopOrderId = existing?.stopLossOrderId
    const accountId = this.propFirm.selectedAccountId
    if (existingHardStopOrderId && accountId) {
      try {
        const result = await tradeseaAPI.cancelOrder({
          accountId,
          orderId: String(existingHardStopOrderId),
        })
        if (!result.success || result.s !== 'ok') {
          aurenToast.error(result.error || result.errmsg || 'Could not replace the hard stop')
          return
        }
      } catch (err) {
        aurenToast.error(err instanceof Error ? err.message : 'Could not replace the hard stop')
        return
      }
    }

    this.softStops.set(instrument, { price, createdAt: Date.now() })
    if (!existing?.contracts) return
    existing.stopLoss = price
    existing.stopLossMode = 'soft'
    existing.softStopTrigger = 'bar_close'
    existing.stopLossOrderId = null
    this.ensurePositionLines(symbol, existing.entry, existing.contracts, price, existing.takeProfit)
  }

  clearSoftStop(symbol: string): void {
    const instrument = this.handler.resolveInstrumentPublic(symbol)
    this.softStops.delete(instrument)
    this.softStopMinuteMarks.delete(instrument)
  }

  clearAllSoftStops(): void {
    this.softStops.clear()
    this.softStopMinuteMarks.clear()
    this.softStopCloseInFlight.clear()
  }

  /** Build a one-minute close from the live mark stream and evaluate soft stops. */
  onMarketPrice(symbol: string, price: number, time = Date.now()): void {
    if (!Number.isFinite(price)) return
    const instrument = this.handler.resolveInstrumentPublic(symbol)
    if (!instrument) return
    const minute = Math.floor(time / 60_000)
    const previous = this.softStopMinuteMarks.get(instrument)
    this.softStopMinuteMarks.set(instrument, { minute, close: price, time })
    if (!previous || previous.minute >= minute) return
    void this.evaluateSoftStopClose(instrument, previous.close, previous.time)
  }

  private async evaluateSoftStopClose(instrument: string, close: number, time: number): Promise<void> {
    const configured = this.softStops.get(instrument)
    if (!configured) return
    const entry = [...this.cache.entries()].find(([key, position]) =>
      Boolean(position?.contracts) && this.handler.resolveInstrumentPublic(key) === instrument
    )
    const position = entry?.[1] as TradeseaCachedPosition | undefined
    if (!position?.contracts || position.stopLossMode !== 'soft') return
    const stop = Number(position.stopLoss ?? configured.price)
    const triggered = position.contracts > 0 ? close <= stop : close >= stop
    const positionId = String(position.positionId || '')
    if (!triggered || !positionId || this.softStopCloseInFlight.has(positionId)) return

    this.softStopCloseInFlight.add(positionId)
    aurenToast.warning('Soft stop triggered', `1-minute close ${close} crossed ${stop}. Closing the full position.`)
    try {
      await this.handleClosePosition(position, close, time, 'onCancel')
    } finally {
      this.softStopCloseInFlight.delete(positionId)
    }
  }

  onOpenPosition(
    symbol: string,
    price: number,
    contracts: number,
    stopLoss: number | null = null,
    takeProfit: number | null = null,
    entryTime: number | null = null,
    id: number | null = null,
    stopLossOrderId: number | string | null = null,
    takeProfitOrderId: number | string | null = null
  ) {
    const cacheKey = this.activeChartSymbol() || symbol
    const datafeed = this.getDatafeed()
    const lastBar = datafeed?.getLastBarForChart?.(this.chart)
    const mark = lastBar?.close ?? price

    if (!lastBar && mark != null) {
      const line = this.createLines(cacheKey, price, mark, contracts, stopLoss, takeProfit)
      const data = this.setData(
        cacheKey,
        price,
        stopLoss,
        takeProfit,
        contracts,
        entryTime ?? Math.floor(Date.now() / 1000),
        line,
        id,
        stopLossOrderId,
        takeProfitOrderId
      )
      this.handleOpenPosition(data)
      return data
    }

    return super.onOpenPosition(
      cacheKey,
      price,
      contracts,
      stopLoss,
      takeProfit,
      entryTime,
      id,
      stopLossOrderId,
      takeProfitOrderId
    )
  }

  updateStopLoss(symbol: string, price: number | null, context?: string): void {
    const position = this.cache.get(symbol)
    if (context === 'onCancel' && price == null && position) {
      if (position.stopLoss == null && !position.stopLossOrderId) {
        debugTradeseaSl('chart:updateStopLoss:skip-duplicate-cancel', { cacheKey: symbol })
        this.forceRemoveBracketLine(symbol, 'stop_loss')
        return
      }
    }
    debugTradeseaSl('chart:updateStopLoss', {
      cacheKey: symbol,
      price,
      context,
      oldPrice: position?.stopLoss ?? null,
      positionId: position?.positionId ?? null,
      stopLossOrderId: position?.stopLossOrderId ?? null,
      entry: position?.entry,
      contracts: position?.contracts,
    })
    super.updateStopLoss(symbol, price, context)
  }

  async handleUpdateStopLoss(
    price: number | null,
    oldPrice: number | null,
    position: Record<string, unknown>,
    context?: string
  ): Promise<void> {
    const cached = position as TradeseaCachedPosition
    if (cached.stopLossMode === 'soft') {
      const instrument = this.handler.resolveInstrumentPublic(String(position.symbol || this.activeChartSymbol()))
      if (context === 'onCancel' || price == null) {
        this.softStops.delete(instrument)
        cached.stopLoss = null
        cached.stopLossMode = 'hard'
        this.forceRemoveBracketLine(String(position.symbol || this.activeChartSymbol()), 'stop_loss')
        aurenToast.success('Soft stop removed')
        return
      }
      this.softStops.set(instrument, { price, createdAt: Date.now() })
      cached.stopLoss = price
      cached.stopLossOrderId = null
      aurenToast.success(`Soft stop moved to ${price}`)
      return
    }
    if (context === 'sync') {
      debugTradeseaSl('handler:skip-sync', {
        price,
        oldPrice,
        context,
        positionId: position.positionId ?? null,
        note: 'WS/chart sync only — no API',
      })
      return
    }

    const accountId = this.propFirm.selectedAccountId
    const positionId = String(position.positionId || '')
    debugTradeseaSl('handler:start', {
      price,
      oldPrice,
      context,
      accountId,
      positionId: positionId || null,
      stopLossOrderId: position.stopLossOrderId ?? null,
      cacheKey: position.symbol ?? null,
    })

    if (!accountId || !positionId) {
      debugTradeseaSl('handler:abort-missing-ids', {
        accountId,
        positionId: positionId || null,
        note: 'Need selectedAccountId and position.positionId from WS',
      })
      return
    }

    if (context === 'onCancel' || price == null) {
      const cacheKey = String(position.symbol || this.activeChartSymbol())
      const clearLocalStopLoss = () => {
        position.stopLossOrderId = null
        position.stopLoss = null
        delete (position as TradeseaCachedPosition).bracketPendingUntil
        this.forceRemoveBracketLine(cacheKey, 'stop_loss')
        this.ensurePositionLines(
          cacheKey,
          Number(position.entry),
          Number(position.contracts),
          null,
          (position.takeProfit as number | null) ?? null
        )
      }

      const orderId = position.stopLossOrderId
      if (!orderId) {
        debugTradeseaSl('handler:cancel-local-only', {
          positionId,
          note: 'No stopLossOrderId — removing chart line only (already cancelled on server?)',
        })
        clearLocalStopLoss()
        return
      }

      if (this.stopLossCancelInFlight) {
        debugTradeseaSl('handler:cancel-skipped-in-flight', { orderId: String(orderId) })
        clearLocalStopLoss()
        return
      }

      this.stopLossCancelInFlight = true
      debugTradeseaSl('api:cancel-start', { accountId, orderId: String(orderId) })
      try {
        const res = await tradeseaAPI.cancelOrder({
          accountId,
          orderId: String(orderId),
        })
        debugTradeseaSl('api:cancel-response', {
          success: res.success,
          s: res.s,
          error: res.error,
          apiResponse: res,
        })
        if (res.success && res.s === 'ok') {
          aurenToast.success('Stop loss removed')
          clearLocalStopLoss()
          setTimeout(() => this.handler.syncBracketsFromOrders(), 400)
        } else {
          aurenToast.error(res.error || res.errmsg || 'Failed to cancel stop loss')
        }
      } catch (err) {
        debugTradeseaSl('api:cancel-error', {
          message: err instanceof Error ? err.message : String(err),
        })
        aurenToast.error(err instanceof Error ? err.message : 'Failed to cancel stop loss')
      } finally {
        this.stopLossCancelInFlight = false
      }
      return
    }

    debugTradeseaSl('api:modify-start', { accountId, positionId, stopLoss: price })
    try {
      const res = await tradeseaAPI.modifyPosition({
        accountId,
        positionId,
        stopLoss: price,
      })
      debugTradeseaSl('api:modify-response', {
        success: res.success,
        s: res.s,
        error: res.error,
        requestId: res.requestId,
        apiResponse: res,
      })
      if (res.success && res.s === 'ok') {
        position.stopLoss = price
        const cached = position as TradeseaCachedPosition
        cached.bracketPendingUntil = Date.now() + BRACKET_PENDING_MS
        aurenToast.success(`Stop loss updated to ${price}`)
        const cacheKey = String(position.symbol || this.activeChartSymbol())
        this.ensurePositionLines(
          cacheKey,
          Number(position.entry),
          Number(position.contracts),
          price,
          (position.takeProfit as number | null) ?? null
        )
        debugTradeseaSl('handler:modify-ok-optimistic-line', { price, cacheKey })
        setTimeout(() => this.handler.syncBracketsFromOrders(), 600)
      } else {
        aurenToast.error(res.error || res.errmsg || 'Failed to update stop loss')
      }
    } catch (err) {
      debugTradeseaSl('api:modify-error', {
        message: err instanceof Error ? err.message : String(err),
      })
      aurenToast.error(err instanceof Error ? err.message : 'Failed to update stop loss')
    }
  }

  async handleUpdateTakeProfit(
    price: number | null,
    _oldPrice: number | null,
    position: Record<string, unknown>,
    context?: string
  ): Promise<void> {
    if (context === 'sync') return

    const accountId = this.propFirm.selectedAccountId
    const positionId = String(position.positionId || '')
    if (!accountId || !positionId) return

    if (context === 'onCancel' || price == null) {
      const orderId = position.takeProfitOrderId
      if (!orderId) return
      try {
        const res = await tradeseaAPI.cancelOrder({
          accountId,
          orderId: String(orderId),
        })
        if (res.success && res.s === 'ok') {
          aurenToast.success('Take profit removed')
          position.takeProfitOrderId = null
          position.takeProfit = null
        } else {
          aurenToast.error(res.error || res.errmsg || 'Failed to cancel take profit')
        }
      } catch (err) {
        aurenToast.error(err instanceof Error ? err.message : 'Failed to cancel take profit')
      }
      return
    }

    try {
      const res = await tradeseaAPI.modifyPosition({
        accountId,
        positionId,
        takeProfit: price,
      })
      if (res.success && res.s === 'ok') {
        position.takeProfit = price
        const cached = position as TradeseaCachedPosition
        cached.bracketPendingUntil = Date.now() + BRACKET_PENDING_MS
        aurenToast.success(`Take profit updated to ${price}`)
        const cacheKey = String(position.symbol || this.activeChartSymbol())
        this.ensurePositionLines(
          cacheKey,
          Number(position.entry),
          Number(position.contracts),
          (position.stopLoss as number | null) ?? null,
          price
        )
        setTimeout(() => this.handler.syncBracketsFromOrders(), 600)
      } else {
        aurenToast.error(res.error || res.errmsg || 'Failed to update take profit')
      }
    } catch (err) {
      aurenToast.error(err instanceof Error ? err.message : 'Failed to update take profit')
    }
  }

  private activeChartSymbol(): string {
    try {
      return String(this.chart?.symbol?.() || '').trim()
    } catch {
      return ''
    }
  }

  /** Entry + size from chart cache when WS positions are missing or incomplete. */
  getChartPositionSnapshot(): { entry: number; contracts: number } | null {
    const resolved = this.getPositionForActiveChart()
    const position = resolved?.position ?? this.getPosition(this.activeChartSymbol())
    if (!position?.contracts || position.entry == null) return null
    return { entry: Number(position.entry), contracts: Number(position.contracts) }
  }

  /** Sync active chart position from unified WS snapshot (all positions live in propFirm.positions). */
  syncAllOpenPositions(chartSymbol: string): void {
    this.syncPositionForChartSymbol(chartSymbol)
  }

  /** Sync chart position lines from unified WS positions + bracket orders. */
  syncPositionForChartSymbol(
    chartSymbol?: string,
    knownPosition?: ReturnType<typeof parseTradeseaPosition>
  ): void {
    const cacheKey = chartSymbol?.trim() || this.activeChartSymbol()
    if (!this.chart || !cacheKey) return

    const instrument = this.handler.resolveInstrumentPublic(cacheKey)
    const openPositions = knownPosition
      ? [knownPosition]
      : findPositionsForInstrument(this.propFirm.positions, instrument)
    const pos = openPositions[0]
    if (!pos?.id || !pos.qty) {
      const cached = this.getPosition(cacheKey)
      if (cached?.contracts) {
        this.cache.delete(cacheKey)
        cached.line?.removeAll?.()
      }
      return
    }

    const side = String(pos.side || '').toLowerCase()
    const qty = Math.abs(pos.qty ?? 0)
    const contracts =
      side === 'sell' || side === 'short' ? -qty : qty
    const entry = pos.avgPrice ?? 0
    const brackets = bracketOrdersForPosition(this.propFirm.orders, pos.id)
    const existing = this.getPosition(cacheKey) as TradeseaCachedPosition | undefined

    const softStop = this.softStops.get(instrument)
    const { stopLoss: brokerStopLoss, takeProfit, stopLossOrderId: brokerStopLossOrderId, takeProfitOrderId } =
      this.resolveBracketPrices(existing, brackets)
    const stopLoss = softStop?.price ?? brokerStopLoss
    const stopLossOrderId = softStop ? null : brokerStopLossOrderId

    const syncKey = `${cacheKey}|${pos.id}|${stopLoss}|${takeProfit}|${entry}|${contracts}`
    if (syncKey !== lastSyncPositionSlKey) {
      lastSyncPositionSlKey = syncKey
      debugTradeseaSl('sync:position', {
        cacheKey,
        positionId: pos.id,
        entry,
        contracts,
        stopLoss,
        takeProfit,
        bracketStop: brackets.stopLoss
          ? {
              id: brackets.stopLoss.id,
              status: brackets.stopLoss.status,
              stopPrice: brackets.stopLoss.stopPrice,
            }
          : null,
        ordersForParent: this.propFirm.orders.filter(
          (o) => o.parentId === pos.id && o.parentType === 'position'
        ).length,
      })
    }

    if (existing) {
      existing.positionId = pos.id
      existing.stopLossOrderId = stopLossOrderId
      existing.takeProfitOrderId = takeProfitOrderId
      existing.entry = entry
      existing.contracts = contracts
      existing.stopLoss = stopLoss
      existing.stopLossMode = softStop ? 'soft' : 'hard'
      existing.softStopTrigger = softStop ? 'bar_close' : undefined
      existing.takeProfit = takeProfit

      this.ensurePositionLines(cacheKey, entry, contracts, stopLoss, takeProfit)
      return
    }

    this.onOpenPosition(
      cacheKey,
      entry,
      contracts,
      stopLoss,
      takeProfit,
      Math.floor(Date.now() / 1000),
      null,
      brackets.stopLoss?.id ?? null,
      brackets.takeProfit?.id ?? null
    )
    const created = this.getPosition(cacheKey)
    if (created) {
      created.positionId = pos.id
      created.stopLossMode = softStop ? 'soft' : 'hard'
      created.softStopTrigger = softStop ? 'bar_close' : undefined
    }
    this.ensurePositionLines(cacheKey, entry, contracts, stopLoss, takeProfit)
  }

  /** Create or refresh position / SL / TP lines when history bars are available. */
  private ensurePositionLines(
    cacheKey: string,
    entry: number,
    contracts: number,
    stopLoss: number | null,
    takeProfit: number | null
  ): void {
    const position = this.getPosition(cacheKey)
    if (!position || !contracts) return

    const datafeed = this.getDatafeed()
    const lastBar = datafeed?.getLastBarForChart?.(this.chart)
    const mark = lastBar?.close ?? entry

    if (!position.line) {
      debugTradeseaSl('lines:create-all', { cacheKey, entry, mark, stopLoss, takeProfit, contracts })
      const line = this.createLines(cacheKey, entry, mark, contracts, stopLoss, takeProfit)
      if (line) position.line = line
      lastAppliedSlVisualKey = `${entry}|${contracts}|${stopLoss}`
      lastAppliedTpVisualKey = `${entry}|${contracts}|${takeProfit}`
      return
    }

    position.line.updatePositionLine(entry, mark, contracts)

    const slKey = `${entry}|${contracts}|${stopLoss}`
    const tpKey = `${entry}|${contracts}|${takeProfit}`
    const slWrapper = position.line.get?.('stop_loss') as { hasTvLine?: () => boolean } | undefined
    const tpWrapper = position.line.get?.('take_profit') as { hasTvLine?: () => boolean } | undefined
    const hasSlWrapper = Boolean(slWrapper)
    const hasSlTvLine = Boolean(slWrapper?.hasTvLine?.())
    const hasTpWrapper = Boolean(tpWrapper)
    const hasTpTvLine = Boolean(tpWrapper?.hasTvLine?.())
    const skipSlRedraw = slKey === lastAppliedSlVisualKey && hasSlTvLine && stopLoss != null
    const skipTpRedraw = tpKey === lastAppliedTpVisualKey && hasTpTvLine && takeProfit != null

    if (stopLoss == null) {
      lastAppliedSlVisualKey = `${entry}|${contracts}|null`
      this.forceRemoveBracketLine(cacheKey, 'stop_loss')
    } else if (!skipSlRedraw && typeof position.line.updateStopLossLine === 'function') {
      debugTradeseaSl('lines:updateStopLoss-sync', {
        cacheKey,
        entry,
        stopLoss,
        contracts,
        hadWrapper: hasSlWrapper,
        hadTvLine: hasSlTvLine,
      })
      position.line.updateStopLossLine(entry, stopLoss, contracts, !hasSlWrapper, 'sync')
      lastAppliedSlVisualKey = slKey
    }

    if (takeProfit == null) {
      lastAppliedTpVisualKey = `${entry}|${contracts}|null`
      this.forceRemoveBracketLine(cacheKey, 'take_profit')
    } else if (!skipTpRedraw && typeof position.line.updateTakeProfitLine === 'function') {
      debugTradeseaSl('lines:updateTakeProfit-sync', {
        cacheKey,
        entry,
        takeProfit,
        contracts,
        hadWrapper: hasTpWrapper,
        hadTvLine: hasTpTvLine,
      })
      position.line.updateTakeProfitLine(
        entry,
        takeProfit,
        contracts,
        !hasTpWrapper,
        'sync'
      )
      lastAppliedTpVisualKey = tpKey
    }
  }

  /** Remove SL/TP from chart widget and internal line cache. */
  private forceRemoveBracketLine(cacheKey: string, lineType: 'stop_loss' | 'take_profit'): void {
    const position = this.getPosition(cacheKey) as TradeseaCachedPosition | undefined
    const lineBundle = position?.line as {
      get?: (t: string) => { line?: { remove?: () => void }; hasTvLine?: () => boolean }
      remove?: (t: string) => void
    } | undefined
    if (!lineBundle) return

    const wrapped = lineBundle.get?.(lineType)
    debugTradeseaSl('lines:force-remove', {
      cacheKey,
      lineType,
      hadCached: Boolean(wrapped),
      hadTvLine: Boolean(wrapped?.hasTvLine?.() ?? wrapped?.line),
    })

    try {
      if (wrapped?.line?.remove) {
        wrapped.line.remove()
      }
    } catch {
      /* ignore */
    }

    if (typeof lineBundle.remove === 'function') {
      lineBundle.remove(lineType)
    }
  }

  /**
   * WS bracket orders lag behind modifyPosition — keep optimistic SL/TP until orderUpdates arrives.
   */
  private resolveBracketPrices(
    existing: TradeseaCachedPosition | undefined,
    brackets: ReturnType<typeof bracketOrdersForPosition>
  ): {
    stopLoss: number | null
    takeProfit: number | null
    stopLossOrderId: string | null
    takeProfitOrderId: string | null
  } {
    const pending =
      existing?.bracketPendingUntil != null && Date.now() < existing.bracketPendingUntil

    let stopLoss = brackets.stopLoss?.stopPrice ?? null
    let takeProfit = brackets.takeProfit?.limitPrice ?? null
    let stopLossOrderId = brackets.stopLoss?.id ?? null
    let takeProfitOrderId = brackets.takeProfit?.id ?? null

    if (brackets.stopLoss) {
      if (existing) delete existing.bracketPendingUntil
    } else if (pending && existing?.stopLoss != null) {
      stopLoss = existing.stopLoss
      stopLossOrderId =
        existing.stopLossOrderId != null ? String(existing.stopLossOrderId) : null
      debugTradeseaSl('sync:keep-pending-sl', { stopLoss, stopLossOrderId })
    }

    if (brackets.takeProfit) {
      if (existing) delete existing.bracketPendingUntil
    } else if (pending && existing?.takeProfit != null) {
      takeProfit = existing.takeProfit
      takeProfitOrderId =
        existing.takeProfitOrderId != null ? String(existing.takeProfitOrderId) : null
    }

    return { stopLoss, takeProfit, stopLossOrderId, takeProfitOrderId }
  }

  async handleClosePosition(
    position: Record<string, unknown>,
    _price: number,
    _exitTime: number,
    context?: string
  ): Promise<void> {
    if (context !== 'onCancel') {
      super.handleClosePosition(position, _price, _exitTime, context)
      return
    }

    const accountId = this.propFirm.selectedAccountId
    if (!accountId) {
      aurenToast.error('Select a Tradesea account first')
      return
    }

    let positionId = String(position.positionId || '')
    if (!positionId) {
      const symbol = String(position.symbol || this.activeChartSymbol())
      const matches = findPositionsForInstrument(this.propFirm.positions, symbol)
      if (matches[0]?.id) {
        positionId = String(matches[0].id)
        position.positionId = positionId
      }
    }

    if (!positionId) {
      aurenToast.error('No open position to close')
      return
    }

    try {
      const result = await tradeseaAPI.closePosition({ accountId, positionId })
      if (result.success && result.s === 'ok') {
        aurenToast.success('Position closed')
        const instrument = this.handler.resolveInstrumentPublic(String(position.symbol || this.activeChartSymbol()))
        this.clearSoftStop(instrument)
        super.handleClosePosition(position, _price, _exitTime, context)
        setTimeout(() => this.handler.syncFromStream(), 600)
      } else {
        aurenToast.error(result.error || result.errmsg || 'Failed to close position')
      }
    } catch (err) {
      aurenToast.error(err instanceof Error ? err.message : 'Failed to close position')
    }
  }
}
