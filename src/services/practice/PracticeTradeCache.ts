import { toast } from 'react-toastify'
import { practiceExitSide, practiceOrderLine } from './practiceOrderToasts'
import { showPracticeOrderToast } from './showPracticeOrderToast'
import ChartTradeCache from '../../components/common/ChartTradeCache'
import { practiceAPI, type PracticePosition } from '../../api/practice.api'
import { practiceFillCommission } from './practiceCommission'

import { refreshPracticeFromApi } from '../../constants/practice'

import { PracticeTradeHandler } from './PracticeTradeHandler'

import { resolvePracticeProductSymbol } from './practiceSymbol'
import {
  entryTimeToMs,
  findBracketExitInBars,
} from './practiceBracketReplay'

import type { TradeseaDatafeed } from '../tradesea/TradeseaDatafeed'



export class PracticeTradeCache extends ChartTradeCache {

  private accountId: string

  private positionIds = new Map<string, string>()



  constructor(

    private tradeHandler: PracticeTradeHandler,

    chart: unknown,

    accountId: string

  ) {

    super(tradeHandler, chart)

    this.accountId = accountId

  }



  getDatafeed(): TradeseaDatafeed | null {

    return (this.tradeHandler.propFirm.chartServices?.datafeed as TradeseaDatafeed) ?? null

  }



  private activeChartSymbol(): string {

    try {

      return String((this.chart as { symbol?: () => string })?.symbol?.() || '').trim()

    } catch {

      return ''

    }

  }



  private resolveTicks(symbol: string): { tickSize: number; tickValue: number } {

    const datafeed = this.getDatafeed()

    const chartSym = this.activeChartSymbol() || symbol

    const tickSize = datafeed?.getTickSize?.(chartSym) ?? datafeed?.getTickSize?.(symbol) ?? 0.25

    const tickValue =

      datafeed?.getTickValue?.(chartSym) ??

      datafeed?.getTickValue?.(symbol) ??

      tickSize * 2

    return { tickSize, tickValue }

  }



  private productSymbol(chartSymbol: string): string {

    return resolvePracticeProductSymbol(chartSymbol, this.getDatafeed())

  }



  /** Map stored NQ/MNQ to active chart symbol for line cache keys. */

  private chartCacheKeyForProduct(productSymbol: string): string {

    try {

      const chartSym = this.activeChartSymbol()

      if (chartSym && this.productSymbol(chartSym) === productSymbol.toUpperCase()) {

        return chartSym

      }

    } catch {

      /* ignore */

    }

    return productSymbol

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



    if (!lastBar && mark != null && contracts !== 0) {

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



  getPosition(symbol: string) {

    const resolved = this.getPositionForActiveChart(symbol)

    if (resolved) return resolved.position

    return super.getPosition(symbol)

  }



  async loadPositionsFromServer(positions: PracticePosition[]): Promise<void> {

    const data: Record<string, unknown> = {}

    for (const p of positions) {

      const cacheKey = this.chartCacheKeyForProduct(p.symbol)

      this.positionIds.set(cacheKey, p.id)

      data[cacheKey] = {

        symbol: cacheKey,

        entry: p.entry,

        contracts: p.contracts,

        stopLoss: p.stopLoss,

        takeProfit: p.takeProfit,

        entryTime: p.entryTime,

        id: p.id,

      }

    }

    if (Object.keys(data).length) {

      this.load(data, true)

    }

    this.reconcilePositionLines()
    await this.reconcileMissedBracketFills()
  }

  /**
   * After reload or reconnect, replay 1m bars since entry so TP/SL fill even if price
   * moved while the tab was closed.
   */
  async reconcileMissedBracketFills(): Promise<void> {
    const account = this.tradeHandler.getAccount()
    if (!account || account.status !== 'active') return

    const datafeed = this.getDatafeed()
    if (!datafeed) return

    const nowSec = Math.floor(Date.now() / 1000)

    for (const [cacheKey, position] of [...this.cache.entries()]) {
      if (!position?.contracts) continue
      const contracts = Number(position.contracts)
      if (!Number.isFinite(contracts) || Math.abs(contracts) === 0) continue

      const stopLoss = position.stopLoss as number | null
      const takeProfit = position.takeProfit as number | null
      if (stopLoss == null && takeProfit == null) continue

      const entryMs = entryTimeToMs(position.entryTime as number)
      const fromSec = Math.floor(entryMs / 1000)
      if (nowSec <= fromSec) continue

      let bars = await datafeed.fetchHistoryBars(cacheKey, '1', fromSec, nowSec)
      const lastBar = datafeed.getLastBarForChart?.(this.chart)
      if (lastBar) {
        bars = [...bars, lastBar]
      }

      const isLong = contracts > 0
      const exit = findBracketExitInBars(bars, isLong, stopLoss, takeProfit)
      if (exit) {
        this.onClosePosition(cacheKey, Math.abs(contracts), exit.price, exit.time)
        return
      }
    }
  }

  /** Create chart lines for open positions that match the active chart product (e.g. NQ vs MNQ). */
  reconcilePositionLines(): void {
    for (const [cacheKey, position] of this.cache.entries()) {
      if (!position?.contracts) continue
      const resolved = this.getPositionForActiveChart(cacheKey)
      if (!resolved?.position) continue
      if (position.line) continue
      const p = resolved.position as {
        entry: number
        contracts: number
        stopLoss?: number | null
        takeProfit?: number | null
        entryTime?: number
        id?: number | string | null
        stopLossOrderId?: number | string | null
        takeProfitOrderId?: number | string | null
      }
      this.onOpenPosition(
        resolved.key,
        p.entry,
        p.contracts,
        p.stopLoss ?? null,
        p.takeProfit ?? null,
        p.entryTime ?? null,
        p.id ?? null,
        p.stopLossOrderId ?? null,
        p.takeProfitOrderId ?? null
      )
    }
  }

  hasAnyOpenPosition(): boolean {
    for (const [, position] of this.cache.entries()) {
      if (Math.abs(Number(position?.contracts)) > 0) return true
    }
    return false
  }



  handleClosePosition(position: { symbol: string; type: string; entry: number; contracts: number; entryTime: number; stopLoss?: number | null; takeProfit?: number | null }, price: number, exitTime: number) {

    const { tickSize, tickValue } = this.resolveTicks(position.symbol)

    const pnl = this.calcPnL(position.entry, price, position.contracts, tickSize, tickValue)



    const tradeSymbol = this.productSymbol(position.symbol)

    const account = this.tradeHandler.getAccount()
    const exitContracts = Math.abs(position.contracts)
    const exitSide = practiceExitSide(position.contracts, position.type)
    const exitFillLine = practiceOrderLine(exitSide, exitContracts, tradeSymbol, price)
    const fees = practiceFillCommission(account?.rules, exitContracts, tradeSymbol)

    if (!this.tradeHandler.suppressCloseToasts) {
      showPracticeOrderToast(exitSide, exitFillLine)
    }

    void practiceAPI

      .recordTrade(this.accountId, {

        symbol: tradeSymbol,

        direction: position.type as 'long' | 'short',

        entryPrice: position.entry,

        exitPrice: price,

        contracts: exitContracts,

        pnl,

        fees,

        entryTime: Math.floor(position.entryTime / 1000) || position.entryTime,

        exitTime: Math.floor(exitTime / 1000) || exitTime,

        stopLoss: position.stopLoss,

        takeProfit: position.takeProfit,

        forcedExit: this.tradeHandler.suppressCloseToasts,

      })

      .then(() => {
        void refreshPracticeFromApi().then(() => {
          this.tradeHandler.onAccountUpdated?.()
          this.tradeHandler.syncAccountBlownState()
        })
      })

      .catch((err: { response?: { data?: { message?: string } } }) => {

        toast.error(err?.response?.data?.message || 'Failed to record trade')

      })



    const posId = this.positionIds.get(position.symbol)

    if (posId) {

      void practiceAPI.deletePosition(this.accountId, posId)

      this.positionIds.delete(position.symbol)

    }



    super.handleClosePosition(position, price, exitTime)

  }



  handleUpdateStopLoss(

    price: number | null,

    _oldPrice: number | null,

    position: { symbol: string; entry: number; contracts: number; stopLoss?: number | null; takeProfit?: number | null; entryTime: number; type: string },

    _context?: string

  ) {

    super.handleUpdateStopLoss(price, _oldPrice, position, _context)

    void this.persistPosition(position)

  }



  handleUpdateTakeProfit(

    price: number | null,

    _oldPrice: number | null,

    position: { symbol: string; entry: number; contracts: number; stopLoss?: number | null; takeProfit?: number | null; entryTime: number; type: string },

    _context?: string

  ) {

    super.handleUpdateTakeProfit(price, _oldPrice, position, _context)

    void this.persistPosition(position)

  }



  handleOpenPosition(position: { symbol: string; entry: number; contracts: number; stopLoss?: number | null; takeProfit?: number | null; entryTime: number; type: string }) {

    super.handleOpenPosition(position)

    void this.persistPosition(position)

  }



  private async persistPosition(position: {

    symbol: string

    entry: number

    contracts: number

    stopLoss?: number | null

    takeProfit?: number | null

    entryTime: number

    type: string

  }) {

    if (!position.contracts) return

    const tradeSymbol = this.productSymbol(position.symbol)

    const id = this.positionIds.get(position.symbol) || `pp_${tradeSymbol}`

    try {

      const saved = await practiceAPI.upsertPosition(this.accountId, {

        id,

        symbol: tradeSymbol,

        instrument: tradeSymbol,

        contracts: position.contracts,

        entry: position.entry,

        stopLoss: position.stopLoss ?? null,

        takeProfit: position.takeProfit ?? null,

        entryTime: position.entryTime,

        type: (position.type === 'short' ? 'short' : 'long') as 'long' | 'short',

      })

      if (saved.position?.id) {

        this.positionIds.set(position.symbol, saved.position.id)

      }

      if (saved.account) {

        void refreshPracticeFromApi()

        this.tradeHandler.onAccountUpdated?.()

      }

    } catch (err: unknown) {

      const msg =

        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||

        'Order rejected'

      toast.error(msg)

    }

  }



  async handlePriceUpdate(

    symbol: string,

    entryPrice: number,

    bar: { low?: number; high?: number; close?: number; time?: number },

    tickSize?: number,

    tickValue?: number

  ) {

    const ticks = this.resolveTicks(symbol)

    const size = tickSize ?? ticks.tickSize

    const value = tickValue ?? ticks.tickValue

    const position = this.getPosition(symbol)

    if (!position) return



    const stopLoss = position.stopLoss as number | null

    const takeProfit = position.takeProfit as number | null



    if (stopLoss != null && this.didBarHitPrice(bar, stopLoss)) {

      this.onClosePosition(symbol, Math.abs(position.contracts as number), stopLoss, bar.time)

      return

    }

    if (takeProfit != null && this.didBarHitPrice(bar, takeProfit)) {

      this.onClosePosition(symbol, Math.abs(position.contracts as number), takeProfit, bar.time)

      return

    }



    const pnl = this.calcPnL(entryPrice, bar.close ?? entryPrice, position.contracts as number, size, value)

    this.tradeHandler.setUnrealizedPl(pnl)

  }



  didBarHitPrice(bar: { low?: number; high?: number }, price: number) {

    if (bar.low == null || bar.high == null) return false

    return price >= bar.low && price <= bar.high

  }



  onFlattenAllPosition() {
    this.flattenAllAtMarket((symbol) => this.tradeHandler.getMarkPriceForPositionKey(symbol))
  }

  /** Close every open position at market using per-symbol marks (e.g. NQ while chart is MNQ). */
  flattenAllAtMarket(getMark: (cacheKey: string) => number | null): void {
    const datafeed = this.getDatafeed()
    const lastBar = datafeed?.getLastBarForChart?.(this.chart)
    const chartFallback = lastBar?.close ?? null
    const exitTime = lastBar?.time ?? Date.now()

    for (const [symbol, position] of [...this.cache.entries()]) {
      if (!position?.contracts) continue
      const qty = Math.abs(Number(position.contracts))
      if (qty <= 0) continue
      const mark =
        getMark(symbol) ?? chartFallback ?? Number(position.entry)
      this.onClosePosition(symbol, qty, mark, exitTime)
    }

    void practiceAPI.clearPositions(this.accountId)
    this.positionIds.clear()
    this.tradeHandler.setUnrealizedPl(0)
  }

}


