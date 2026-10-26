import ChartTradeCache from '../../components/common/ChartTradeCache'
import { backtesterAPI } from '../../api/backtester.api'
import { BacktesterTradeHandler } from './BacktesterTradeHandler'
import type { BacktesterChartDataFeed } from '../components/chart/BacktesterChartDataFeed'
import {
  loadSavedReplayPositions,
  saveReplayPositions,
  type SavedReplayPosition,
} from '../../utils/replayPreferences'

/**
 * Backtester Trade Cache
 * Extends ChartTradeCache with backtester-specific functionality
 */
class BacktesterTradeCache extends ChartTradeCache {
  private tradeHandler: BacktesterTradeHandler
  private sessionId: string | null = null
  private pendingExecutionSymbol: string | null = null
  private restoringSavedPositions = false

  private normalizeTradeTimestampSec(value: number | null | undefined): number {
    const num = Number(value)
    if (!Number.isFinite(num) || num <= 0) return Math.floor(Date.now() / 1000)
    if (num > 1e15) return Math.floor(num / 1000000)
    if (num > 1e12) return Math.floor(num / 1000)
    if (num > 1e9) return Math.floor(num)
    if (num > 1e6) return Math.floor(num * 1000)
    return Math.floor(num)
  }
  
  constructor(handler: BacktesterTradeHandler, chart: unknown) {
    super(handler as never, chart)
    this.tradeHandler = handler
    const session = handler.getSession()
    this.sessionId = session?.id || null
    this.restoreSavedPositions()
    // Load balance from database
    this.loadSessionBalance()
  }

  private getSavedPositionRows(): SavedReplayPosition[] {
    return [...this.cache.entries()].flatMap(([chartSymbol, position]) => {
      const contracts = Number(position?.contracts)
      if (!position || !Number.isFinite(contracts) || contracts === 0) return []
      return [{
        chartSymbol,
        executionSymbol: String(position.executionSymbol || '').trim() || undefined,
        entry: Number(position.entry),
        contracts,
        stopLoss:
          position.stopLoss != null && Number.isFinite(Number(position.stopLoss))
            ? Number(position.stopLoss)
            : null,
        takeProfit:
          position.takeProfit != null && Number.isFinite(Number(position.takeProfit))
            ? Number(position.takeProfit)
            : null,
        entryTime: this.normalizeTradeTimestampSec(position.entryTime),
        stopLossMode: position.stopLossMode === 'soft' ? 'soft' as const : 'hard' as const,
        softStopTrigger: 'bar_close' as const,
      }]
    })
  }

  private persistSavedPositions(): void {
    if (this.restoringSavedPositions) return
    saveReplayPositions(this.sessionId, this.getSavedPositionRows())
  }

  private restoreSavedPositions(): void {
    const saved = loadSavedReplayPositions(this.sessionId)
    if (!saved.length) return
    this.restoringSavedPositions = true
    try {
      for (const row of saved) {
        const position = super.onOpenPosition(
          row.chartSymbol,
          row.entry,
          row.contracts,
          row.stopLoss,
          row.takeProfit,
          row.entryTime,
          null,
          null,
          null,
          row.stopLossMode,
          row.softStopTrigger,
        )
        if (position) position.executionSymbol = row.executionSymbol || row.chartSymbol
      }
    } finally {
      this.restoringSavedPositions = false
    }
    queueMicrotask(() => {
      this.tradeHandler.onPositionUpdate?.()
      const symbol = this.tradeHandler.resolveChartSymbol()
      this.tradeHandler.onUnrealizedPnLUpdate?.(
        this.tradeHandler.getPositionUplFor(symbol) ?? 0
      )
    })
  }

  switchSession(sessionId: string | null): void {
    if (sessionId === this.sessionId) return
    this.persistSavedPositions()
    this.restoringSavedPositions = true
    try {
      super.onFlattenAllPosition()
    } finally {
      this.restoringSavedPositions = false
    }
    this.sessionId = sessionId
    this.restoreSavedPositions()
  }

  getDatafeed(): BacktesterChartDataFeed | null {
    return this.tradeHandler.getDatafeed()
  }

  /**
   * Keep a micro execution attached to the visible mini chart while giving the
   * position overlay and replay accounting the actual execution identity.
   */
  openRoutedPosition(
    chartSymbol: string,
    executionSymbol: string,
    price: number,
    contracts: number,
    stopLoss: number | null,
    takeProfit: number | null
  ) {
    this.pendingExecutionSymbol = executionSymbol
    try {
      const position = super.onOpenPosition(
        chartSymbol,
        price,
        contracts,
        stopLoss,
        takeProfit
      )
      if (position) {
        position.executionSymbol = executionSymbol
        this.persistSavedPositions()
      }
      return position
    } finally {
      this.pendingExecutionSymbol = null
    }
  }

  protected getPositionPresentation(symbol: string, contracts: number) {
    const position = this.getPosition(symbol)
    const executionSymbol = String(
      this.pendingExecutionSymbol || position?.executionSymbol || symbol
    )
    const datafeed = this.getDatafeed()
    const tickSize = datafeed?.getTickSize(executionSymbol) ?? 0.25
    const tickValue = datafeed?.getTickValue(executionSymbol) ?? tickSize * 2
    return {
      symbolLabel: executionSymbol,
      quantityLabel: String(Math.abs(contracts)),
      tickSize,
      tickValue,
    }
  }

  async loadSessionBalance() {
    if (!this.sessionId) return
    try {
      const stats = await backtesterAPI.getSessionStats(this.sessionId)
      if (stats.success) {
        // Initial balance loaded but not stored (for future use)
      }
    } catch (error) {
      // Ignore errors
    }
  }

  handleClosePosition(position: any, price: number, exitTime: number) {
    if(!this.sessionId || !position) {
      super.handleClosePosition(position, price, exitTime)
      return
    }

    this.closeTrade(
      position.executionSymbol || position.symbol,
      position.type, 
      position.entry, 
      price, 
      position.contracts, 
      this.normalizeTradeTimestampSec(position.entryTime), 
      this.normalizeTradeTimestampSec(exitTime),
      position.stopLoss ?? null,
      position.takeProfit ?? null
    )
    super.handleClosePosition(position, price, exitTime)
    this.persistSavedPositions()
  }

  handleOpenPosition(position: any) {
    super.handleOpenPosition(position)
    this.persistSavedPositions()
  }

  handleUpdateSize(oldSize: number, newSize: number, position: any) {
    let diff = newSize - oldSize;
    let isReducingPosition = position.type === 'long' ? diff < 0 : diff > 0;

    if(isReducingPosition){
      let contracts = position.type === 'long' ? Math.abs(diff) : -Math.abs(diff);
      let datafeed = this.getDatafeed()
      let lastBar = datafeed.getLastBarForSymbol(position.symbol)

      if(!lastBar){
        console.error('[Backtester Trade Cache] No last bar found for symbol: ', position.symbol)
        return;
      }
      this.closeTrade(
        position.executionSymbol || position.symbol,
        position.type, 
        position.entry, 
        lastBar.close, 
        contracts, 
        this.normalizeTradeTimestampSec(position.entryTime), 
        this.normalizeTradeTimestampSec(lastBar.time),
        position.stopLoss ?? null,
        position.takeProfit ?? null
      )
    }
    super.handleUpdateSize(oldSize, newSize, position)
    this.persistSavedPositions()
  }

  handleUpdateStopLoss(price: number | null, oldPrice: number | null, position: any, context?: string) {
    super.handleUpdateStopLoss(price, oldPrice, position, context)
    this.persistSavedPositions()
    // The BWC overlay reports its initial programmatic bracket sync through the
    // same callback as a user drag. It is not a move and must not fill against
    // the already-completed replay candle.
    if (price === oldPrice) return
    this.closeIfMovedBracketShouldFill(position, price, 'stop loss')
  }

  handleUpdateTakeProfit(price: number | null, oldPrice: number | null, position: any, context?: string) {
    super.handleUpdateTakeProfit(price, oldPrice, position, context)
    this.persistSavedPositions()
    if (price === oldPrice) return
    this.closeIfMovedBracketShouldFill(position, price, 'take profit')
  }

  private closeIfMovedBracketShouldFill(
    position: any,
    price: number | null,
    bracket: 'stop loss' | 'take profit'
  ): boolean {
    const bracketPrice = Number(price)
    const contracts = Number(position?.contracts)
    const symbol = String(position?.symbol || '').trim()
    if (
      price == null ||
      !Number.isFinite(bracketPrice) ||
      !Number.isFinite(contracts) ||
      contracts === 0 ||
      !symbol ||
      this.getPosition(symbol) !== position
    ) return false

    const bar = this.getDatafeed()?.getLastBarForSymbol(symbol)
    const mark = Number(bar?.close)
    if (!Number.isFinite(mark)) return false

    const isLong = contracts > 0
    const marketable = bracket === 'take profit'
      ? (isLong ? mark >= bracketPrice : mark <= bracketPrice)
      : (isLong ? mark <= bracketPrice : mark >= bracketPrice)
    const touchedByCurrentReplayBar = this.didBarHitPrice(bar, bracketPrice)
    if (!marketable && !touchedByCurrentReplayBar) return false

    this.onClosePosition(
      symbol,
      Math.abs(contracts),
      bracketPrice,
      bar?.time ?? Date.now()
    )
    this.tradeHandler.onPositionUpdate?.()
    this.tradeHandler.onUnrealizedPnLUpdate?.(0)
    console.log(
      `[Backtester Trade Cache] Moved ${bracket} fills on the current replay bar for symbol: `,
      symbol,
      ' at price: ',
      bracketPrice,
      ' with mark: ',
      mark
    )
    return true
  }

  onFlattenAllPosition() {
    super.onFlattenAllPosition()
    this.persistSavedPositions()
  }

  /**
   * Discard one open replay position without booking it as a completed trade.
   * This is intentionally different from closing at market: it removes the
   * position and its attached brackets from both the chart and replay restore
   * storage, while leaving realized P&L and session statistics unchanged.
   */
  cancelOpenPosition(symbol?: string): boolean {
    const requestedSymbol = String(symbol || '').trim()
    const position = requestedSymbol ? this.getPosition(requestedSymbol) : null
    const fallback = position ?? [...this.cache.values()].find(
      (candidate) => Number(candidate?.contracts) !== 0
    )
    if (!fallback) return false

    this.clearPositionLocal(fallback)
    fallback.contracts = 0
    this.persistSavedPositions()
    return true
  }

  /** Discard every open replay position when its owning session is reset. */
  cancelAllOpenPositions(): boolean {
    const hadOpenPosition = [...this.cache.values()].some(
      (position) => Number(position?.contracts) !== 0
    )
    if (!hadOpenPosition) return false
    this.onFlattenAllPosition()
    return true
  }

  async handlePriceUpdate(symbol: string, entryPrice: number, bar: any, tickSize: number, tickValue: number) {
    if (!this.sessionId) return

    const position = this.getPosition(symbol)
    if (position) {
      const executionSymbol = position.executionSymbol || symbol
      const datafeed = this.getDatafeed()
      tickSize = datafeed?.getTickSize(executionSymbol) ?? tickSize
      tickValue = datafeed?.getTickValue(executionSymbol) ?? tickValue
      let stopLoss = position.stopLoss
      let takeProfit = position.takeProfit
      const mark = Number(bar?.close)
      const barTime = this.normalizeTradeTimestampSec(bar?.time)
      const entryTime = this.normalizeTradeTimestampSec(position.entryTime)

      // BWC's overlay uses an explicit host mark once a routed position opens.
      // Refresh it from the owning symbol's replay bar so the position pill no
      // longer remains frozen at $0.00.
      if (Number.isFinite(mark)) {
        this.updateActivePositionMark(mark)
      }

      // A replay market order fills at the close of the currently revealed bar.
      // That bar's earlier high/low happened before the position existed, so it
      // must not immediately trigger a newly attached bracket. Begin evaluating
      // SL/TP only when replay advances to a later bar.
      if (barTime <= entryTime) {
        const pnl = Number.isFinite(mark)
          ? this.calcPnL(entryPrice, mark, position.contracts, tickSize, tickValue)
          : 0
        this.tradeHandler.onUnrealizedPnLUpdate?.(pnl)
        return
      }

      if(this.didBarHitPrice(bar, stopLoss)){
        //stop loss hit
        this.onClosePosition(symbol, Math.abs(position.contracts), stopLoss, bar.time)
        this.tradeHandler.onPositionUpdate?.()
        this.tradeHandler.onUnrealizedPnLUpdate?.(0)
        console.log('[Backtester Trade Cache] Stop loss hit for symbol: ', symbol, ' at price: ', stopLoss, ' at time: ', bar.time)
      } else if(this.didBarHitPrice(bar, takeProfit)){
        //take profit hit
        this.onClosePosition(symbol, Math.abs(position.contracts), takeProfit, bar.time)
        this.tradeHandler.onPositionUpdate?.()
        this.tradeHandler.onUnrealizedPnLUpdate?.(0)
        console.log('[Backtester Trade Cache] Take profit hit for symbol: ', symbol, ' at price: ', takeProfit, ' at time: ', bar.time)
      } else {
        //no hit, update unrealized P&L
        let pnl = this.calcPnL(entryPrice, bar.close, position.contracts, tickSize, tickValue)
        if (this.tradeHandler && (this.tradeHandler as any).onUnrealizedPnLUpdate) {
          (this.tradeHandler as any).onUnrealizedPnLUpdate(pnl)
        }
        console.log('[Backtester Trade Cache] No hit for symbol: ', symbol, ' at price: ', bar.close, ' at time: ', bar.time)
      }
    }
  }

  /**
   * Reprice an open position after the replay cursor moves backward.
   * Rewinding is navigation, not market playback, so this deliberately updates
   * the chart mark and UP&L without evaluating the historical bar for SL/TP.
   */
  repriceOpenPosition(symbol: string, bar: { close?: number } | null | undefined): boolean {
    const resolved = this.getPosition(symbol)
      ? { key: symbol, position: this.getPosition(symbol) }
      : this.getPositionForActiveChart(symbol)
    const position = resolved?.position as any
    const mark = Number(bar?.close)
    const contracts = Number(position?.contracts)
    const entry = Number(position?.entry)
    if (
      !resolved ||
      !position ||
      !Number.isFinite(mark) ||
      !Number.isFinite(contracts) ||
      contracts === 0 ||
      !Number.isFinite(entry)
    ) return false

    const executionSymbol = String(position.executionSymbol || resolved.key)
    const datafeed = this.getDatafeed()
    const tickSize = datafeed?.getTickSize(executionSymbol) ?? 0.25
    const tickValue = datafeed?.getTickValue(executionSymbol) ?? tickSize * 2
    this.updateActivePositionMark(mark)
    this.tradeHandler.onUnrealizedPnLUpdate?.(
      this.calcPnL(entry, mark, contracts, tickSize, tickValue)
    )
    return true
  }

  closeTrade(symbol: string, direction: 'long' | 'short', entryPrice: number, exitPrice: number, contracts: number, entryTime: number, exitTime: number, stopLoss?: number | null, takeProfit?: number | null) {
    let tradeData = this.getTradeData(symbol, direction, entryPrice, exitPrice, Math.abs(contracts), entryTime, exitTime, stopLoss, takeProfit)
    backtesterAPI.saveTrade(tradeData as any)
      .then(() => {
        // Notify handler that stats should be refreshed
        if (this.tradeHandler && (this.tradeHandler as any).onTradeSaved) {
          try {
            (this.tradeHandler as any).onTradeSaved(tradeData)
          } catch (callbackError) {
            // Ignore callback errors
          }
        }
      })
      .catch(() => {
        // Ignore save errors; still close position locally
      })
  }

  getTradeData(symbol: string, direction: 'long' | 'short', entryPrice: number, exitPrice: number, contracts: number, entryTime: number, exitTime: number, stopLoss?: number | null, takeProfit?: number | null) {
    return {
      sessionId: this.sessionId,
      symbol: symbol,
      direction: direction,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
      contracts: contracts,
      entryTime: entryTime,
      exitTime: exitTime,
    }
  }

  getTradeDataFromPosition(position: any, exitPrice: number, exitTime: number) {
    return this.getTradeData(
      position.executionSymbol || position.symbol,
      position.type,
      position.entry,
      exitPrice,
      position.contracts,
      this.normalizeTradeTimestampSec(position.entryTime),
      this.normalizeTradeTimestampSec(exitTime)
    )
  }

  didBarHitPrice(bar: any, price: number | null | undefined) {
    return price != null && price >= bar.low && price <= bar.high
  }
}

export default BacktesterTradeCache
