import { toast } from 'react-toastify'
import { practiceAPI, type PracticePosition } from '../../api/practice.api'
import {
  getPracticeAccountById,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../../constants/practice'
import { getPracticePlanFromAccount } from './practicePlans'
import { TradeseaPropFirm } from '../propfirms/TradeseaPropFirm'
import { TradeseaDatafeed, type TradeseaMarketBook } from '../tradesea/TradeseaDatafeed'
import { PracticeTradeCache } from './PracticeTradeCache'
import { calcTradeseaTickPnL } from '../tradesea/tradeseaPnL'
import type { DomPositionContext } from '../tradesea/tradeseaPnL'
import { validatePracticePositionSize } from './practiceLimits'
import {
  practiceOrderBracketDetail,
  practiceOrderLine,
  practiceOrderProductSymbol,
  practiceExitSide,
} from './practiceOrderToasts'
import { showPracticeOrderToast } from './showPracticeOrderToast'
import { debugPracticeChartSymbol } from '../tradesea/practiceChartSymbolDebug'
import ChartPositionLine from '../../components/common/ChartPositionLine'
import {
  isPracticeLimitFillable,
  type PracticePendingOrder,
} from './practicePendingOrders'
import { evaluatePracticeRules } from './practiceRules'

export class PracticeTradeHandler {
  tradeCache: PracticeTradeCache | null = null
  private pendingOrders: PracticePendingOrder[] = []
  private widget: unknown = null
  private upl = 0
  private blownEnforcing = false
  private blownModalShown = false
  private passedModalShown = false
  /** Suppress per-fill toasts while force-closing on blow. */
  suppressCloseToasts = false
  onUnrealizedPnLUpdate?: (upl: number) => void
  onAccountUpdated?: () => void
  onAccountBlown?: () => void
  onAccountPassed?: () => void

  constructor(
    readonly propFirm: TradeseaPropFirm,
    private practiceAccountId: string
  ) {}

  getAccount(): PracticeAccount | undefined {
    return getPracticeAccountById(this.practiceAccountId)
  }

  setUnrealizedPl(value: number): void {
    this.upl = value
    this.propFirm.setUnrealizedPl(value, { fromStream: false })
    this.onUnrealizedPnLUpdate?.(value)
    this.propFirm.notifyAccountInfoChanged?.()
  }

  getAccountInfo(): { balance: number; mll?: number; rpl: number; upl: number } {
    const account = this.getAccount()
    if (!account) {
      return { balance: 0, rpl: 0, upl: 0 }
    }
    const start = getPracticePlanFromAccount(account).startingBalance
    const rpl = account.balance - start
    return {
      balance: account.balance + this.upl,
      mll: undefined,
      rpl,
      upl: this.upl,
    }
  }

  onReady(widget: unknown, chartDatafeed?: TradeseaDatafeed | null): void {
    this.widget = widget
    const chart = (widget as { chart?: () => unknown })?.chart?.()
    if (!chart) return

    this.tradeCache = new PracticeTradeCache(this, chart, this.practiceAccountId)
    const df = chartDatafeed ?? this.propFirm.chartServices?.datafeed ?? null
    df?.setTradeHandler(this as never)

    for (const order of this.pendingOrders) {
      void this.attachPendingOrderLine(order)
    }

    void this.loadState()
  }

  hasAnyOpenPosition(): boolean {
    return this.tradeCache?.hasAnyOpenPosition?.() ?? false
  }

  private ensureMarketBooksForPositions(positions: PracticePosition[]): void {
    const df = this.propFirm.chartServices?.datafeed
    if (!df?.ensureMarketBookSubscription) return
    const seen = new Set<string>()
    for (const p of positions) {
      if (!Math.abs(Number(p.contracts))) continue
      const product = String(p.symbol || '').trim().toUpperCase()
      if (!product || seen.has(product)) continue
      seen.add(product)
      const chartLabel =
        df.resolveStreamInstrument?.(`CME:${product}`) ?? `CME:${product}`
      df.ensureMarketBookSubscription(chartLabel)
    }
  }

  /** Sum UP&L for every open position (any symbol), not only the active chart. */
  refreshUnrealizedPl(): void {
    const cache = this.tradeCache
    if (!cache?.hasAnyOpenPosition()) {
      this.setUnrealizedPl(0)
      return
    }
    const datafeed = this.propFirm.chartServices?.datafeed
    let total = 0
    let anyMark = false
    for (const [, position] of cache.getCache()) {
      const contracts = Number(position?.contracts)
      if (!contracts) continue
      const cacheKey = String(position.symbol || '')
      const mark = this.getMarkPriceForPositionKey(cacheKey)
      if (mark == null) continue
      anyMark = true
      const tickSize = datafeed?.getTickSize?.(cacheKey) ?? datafeed?.getTickSize?.(`CME:${cacheKey}`) ?? 0.25
      const tickValue =
        datafeed?.getTickValue?.(cacheKey) ?? datafeed?.getTickValue?.(`CME:${cacheKey}`) ?? tickSize * 2
      total += calcTradeseaTickPnL(
        position.entry as number,
        mark,
        contracts,
        tickSize,
        tickValue
      )
    }
    if (anyMark) this.setUnrealizedPl(total)
    this.checkBlownWhileTrading()
    this.checkPassedWhileTrading()
  }

  /** True when realized balance or equity (balance + UP&L) is at or below the drawdown floor. */
  isAccountBlown(): boolean {
    const account = this.getAccount()
    if (!account) return false
    if (account.status === 'blown') return true
    const equityBlown = evaluatePracticeRules({ ...account, balance: account.balance + this.upl }).blown
    return equityBlown
  }

  syncAccountBlownState(): void {
    this.checkBlownWhileTrading()
    this.checkPassedWhileTrading()
  }

  hasEvalPassed(): boolean {
    const account = this.getAccount()
    if (!account || account.mode !== 'eval') return false
    if (account.status === 'passed') return true
    if (account.status !== 'active') return false
    return evaluatePracticeRules(account).passed
  }

  private checkPassedWhileTrading(): void {
    if (this.passedModalShown || this.blownModalShown || this.blownEnforcing) return
    if (!this.hasEvalPassed()) return
    this.passedModalShown = true
    this.onAccountPassed?.()
  }

  private checkBlownWhileTrading(): void {
    if (this.blownEnforcing || this.blownModalShown || this.passedModalShown) return
    if (!this.isAccountBlown()) return

    const cache = this.tradeCache
    const hasOpen = cache?.hasAnyOpenPosition() ?? false
    const hasPending = this.pendingOrders.length > 0

    if (hasOpen || hasPending) {
      void this.enforceBlownAccount()
      return
    }

    if (!this.blownModalShown) {
      this.blownModalShown = true
      this.onAccountBlown?.()
    }
  }

  async enforceBlownAccount(): Promise<void> {
    if (this.blownEnforcing) return
    this.blownEnforcing = true
    this.suppressCloseToasts = true
    try {
      for (const order of [...this.pendingOrders]) {
        this.removePendingOrderLine(order)
      }
      this.pendingOrders = []

      const cache = this.tradeCache
      if (cache?.hasAnyOpenPosition()) {
        cache.flattenAllAtMarket((key) => this.getMarkPriceForPositionKey(key))
      }

      await refreshPracticeFromApi()
      this.setUnrealizedPl(0)

      if (!this.blownModalShown) {
        this.blownModalShown = true
        this.onAccountBlown?.()
      }
      this.onAccountUpdated?.()
    } finally {
      this.suppressCloseToasts = false
      this.blownEnforcing = false
    }
  }

  private async loadState(): Promise<void> {
    await refreshPracticeFromApi()
    try {
      const { positions } = await practiceAPI.getPositions(this.practiceAccountId)
      this.ensureMarketBooksForPositions(positions)
      await this.tradeCache?.loadPositionsFromServer(positions)
      this.refreshUnrealizedPl()
    } catch {
      /* ignore */
    }
    this.onAccountUpdated?.()
    this.onUnrealizedPnLUpdate?.()
    this.checkBlownWhileTrading()
    this.checkPassedWhileTrading()
  }

  attachToDatafeed(chartDatafeed?: TradeseaDatafeed | null): void {
    const df = chartDatafeed ?? this.propFirm.chartServices?.datafeed ?? null
    df?.setTradeHandler(this as never)
  }

  onRealTimeBar(symbol: string, _resolution: string, bar: { close?: number; low?: number; high?: number; time?: number }): void {
    if (!this.tradeCache || !bar) return
    const low = bar.low ?? bar.close
    const high = bar.high ?? bar.close
    const close = bar.close
    if (low != null && high != null) {
      this.tryFillPendingOrders(symbol, low, high, close ?? low, bar.time)
    }
    this.tradeCache.onRealTimeBar(symbol, bar)
    if (close != null) {
      this.refreshUnrealizedPl()
    }
  }

  /** Place a working limit (Join Bid / Join Ask / chart limit / order tab limit). */
  async placeLimitOrder(
    side: 'buy' | 'sell',
    quantity: number,
    limitPrice: number,
    brackets?: { stopLoss?: number | null; takeProfit?: number | null }
  ): Promise<void> {
    const account = this.getAccount()
    if (!account || account.status !== 'active') {
      toast.error('Practice account is not active')
      return
    }
    if (this.isAccountBlown() || this.blownModalShown) {
      toast.error('Practice account has blown. Max drawdown reached.')
      return
    }
    if (this.passedModalShown || this.hasEvalPassed()) {
      toast.error('Practice evaluation already passed')
      return
    }

    const chartSymbol = this.getChartSymbol()
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      toast.error('Enter a valid limit price')
      return
    }

    const mark = this.getMarkPrice(chartSymbol)
    if (mark == null) {
      toast.error('Waiting for market data…')
      return
    }

    const datafeed = this.propFirm.chartServices?.datafeed ?? null
    const tickSize = datafeed?.getTickSize?.(chartSymbol) ?? 0.25
    const cache = this.tradeCache
    if (!cache) return

    const signed = side === 'buy' ? qty : -qty
    const currentPos = cache.getPosition(chartSymbol)
    const currentContracts = Number(currentPos?.contracts) || 0
    const sizeErr = validatePracticePositionSize(
      account,
      chartSymbol,
      Math.abs(currentContracts + signed),
      datafeed
    )
    if (sizeErr) {
      toast.error(sizeErr)
      return
    }

    const sl = brackets?.stopLoss ?? null
    const tp = brackets?.takeProfit ?? null

    const order: PracticePendingOrder = {
      id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: chartSymbol,
      side,
      contracts: qty,
      limitPrice,
      stopLoss: sl,
      takeProfit: tp,
      createdAt: Date.now(),
      placementMark: mark,
    }
    this.pendingOrders.push(order)
    void this.attachPendingOrderLine(order)
    const product = practiceOrderProductSymbol(chartSymbol, datafeed)
    showPracticeOrderToast(
      'pending',
      practiceOrderLine(side, qty, product, limitPrice, { limitWorking: true })
    )
  }

  private removePendingOrderLine(order: PracticePendingOrder): void {
    if (!order.line) return
    try {
      order.line.remove?.()
    } catch {
      /* ignore */
    }
    order.line = undefined
  }

  cancelPendingOrder(orderId: string): void {
    const idx = this.pendingOrders.findIndex((o) => o.id === orderId)
    if (idx < 0) return
    const [order] = this.pendingOrders.splice(idx, 1)
    if (order) this.removePendingOrderLine(order)
    toast.info('Order canceled')
  }

  private async attachPendingOrderLine(order: PracticePendingOrder): Promise<void> {
    const chart = (this.widget as { chart?: () => unknown })?.chart?.()
    if (!chart || typeof (chart as { createOrderLine?: unknown }).createOrderLine !== 'function') {
      return
    }
    const datafeed = this.propFirm.chartServices?.datafeed ?? null
    const positionLine = new ChartPositionLine({
      symbol: order.symbol,
      price: order.limitPrice,
      entryPrice: order.limitPrice,
      contracts: order.contracts,
      lineType: 'position',
      chart,
      datafeed,
    })
    const line = await positionLine.createLimitOrder(
      order.limitPrice,
      order.contracts,
      'Limit',
      order.side === 'buy' ? 'Buy' : 'Sell',
      () => this.cancelPendingOrder(order.id)
    )
    if (line) {
      order.line = line
    }
  }

  private tryFillPendingOrders(
    symbol: string,
    low: number,
    high: number,
    close: number,
    time?: number
  ): void {
    if (!this.pendingOrders.length || !this.tradeCache) return

    const chartSymbol = this.getChartSymbol()
    const datafeed = this.propFirm.chartServices?.datafeed ?? null
    const tickSize = datafeed?.getTickSize?.(chartSymbol) ?? 0.25
    const account = this.getAccount()
    if (!account) return

    const next: PracticePendingOrder[] = []

    for (const order of this.pendingOrders) {
      const symMatch =
        order.symbol === symbol ||
        order.symbol === chartSymbol ||
        this.normalizeSymbolKey(order.symbol) === this.normalizeSymbolKey(chartSymbol)

      if (!symMatch) {
        next.push(order)
        continue
      }

      if (
        !isPracticeLimitFillable(
          order.side,
          order.limitPrice,
          low,
          high,
          order.placementMark,
          tickSize
        )
      ) {
        next.push(order)
        continue
      }

      this.removePendingOrderLine(order)
      const signed = order.side === 'buy' ? order.contracts : -order.contracts
      this.tradeCache.onOpenPosition(
        chartSymbol,
        order.limitPrice,
        signed,
        order.stopLoss,
        order.takeProfit,
        time != null ? Math.floor(time / 1000) : null
      )
      const product = practiceOrderProductSymbol(chartSymbol, datafeed)
      showPracticeOrderToast(
        order.side,
        practiceOrderLine(order.side, order.contracts, product, order.limitPrice)
      )
    }

    this.pendingOrders = next
  }

  private normalizeSymbolKey(symbol: string): string {
    const s = String(symbol || '').trim()
    const colon = s.indexOf(':')
    return (colon >= 0 ? s.slice(colon + 1) : s).toUpperCase()
  }

  updateUnrealizedFromMark(_markPrice: number, _chartSymbol?: string): void {
    this.refreshUnrealizedPl()
  }

  onAllPositionsClosed(): void {
    this.setUnrealizedPl(0)
  }

  handleSymbolChange(symbol: string): void {
    const prevFirm = this.propFirm.chartSymbol
    debugPracticeChartSymbol('PracticeTradeHandler.handleSymbolChange', {
      symbol,
      prevFirmChartSymbol: prevFirm,
    }, { force: true })
    this.tradeCache?.onSymbolChange(symbol)
    this.tradeCache?.reconcilePositionLines()
    this.refreshUnrealizedPl()
  }

  /** Always use the TradingView chart ticker (e.g. CME:MNQ), not the short MNQ label. */
  private getChartSymbol(): string {
    try {
      const w = this.widget as { chart?: () => { symbol?: () => string } }
      return w?.chart?.()?.symbol?.() || this.propFirm.chartSymbol || 'CME:MNQ'
    } catch {
      return this.propFirm.chartSymbol || 'CME:MNQ'
    }
  }

  getActiveMarketBook(): TradeseaMarketBook | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    if (!datafeed?.getMarketBookForChart) return null
    return datafeed.getMarketBookForChart(this.getChartSymbol())
  }

  private resolveStreamLabel(productOrKey: string): string {
    const datafeed = this.propFirm.chartServices?.datafeed
    const raw = String(productOrKey || '').trim()
    if (!raw) return ''
    if (raw.includes(':')) return datafeed?.resolveStreamInstrument?.(raw) ?? raw
    return datafeed?.resolveStreamInstrument?.(`CME:${raw}`) ?? `CME:${raw}`
  }

  getMarkPriceForPositionKey(cacheKey: string): number | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    const stream = this.resolveStreamLabel(cacheKey)
    if (!stream) return null

    const chartSym = this.getChartSymbol()
    const chart = (this.widget as { chart?: () => unknown })?.chart?.()
    const lastBar = datafeed?.getLastBarForChart?.(chart)
    const barClose =
      lastBar?.close != null && Number.isFinite(lastBar.close) ? lastBar.close : null

    const sameAsActiveChart =
      this.normalizeSymbolKey(stream) === this.normalizeSymbolKey(chartSym) ||
      this.normalizeSymbolKey(cacheKey) === this.normalizeSymbolKey(chartSym)

    const book = datafeed?.getMarketBookForChart?.(stream)
    const bookLast =
      book?.last != null && Number.isFinite(book.last) ? book.last : null
    const mid =
      book?.bestBid != null &&
      book?.bestAsk != null &&
      Number.isFinite(book.bestBid) &&
      Number.isFinite(book.bestAsk)
        ? (book.bestBid + book.bestAsk) / 2
        : null

    if (sameAsActiveChart && barClose != null) {
      if (bookLast != null && this.markPricesAgree(barClose, bookLast)) return bookLast
      if (mid != null && this.markPricesAgree(barClose, mid)) return mid
      return barClose
    }

    if (bookLast != null) return bookLast
    if (mid != null) return mid
    if (sameAsActiveChart && barClose != null) return barClose
    return book?.bestBid ?? book?.bestAsk ?? null
  }

  /** Reject MDS LTP that disagrees with the chart bar (e.g. scaled / stale). */
  private markPricesAgree(chartPrice: number, candidate: number): boolean {
    const diff = Math.abs(chartPrice - candidate)
    return diff <= Math.max(1, Math.abs(chartPrice) * 0.002)
  }

  private getMarkPrice(symbol: string): number | null {
    return this.getMarkPriceForPositionKey(symbol)
  }

  /** Last trade / MDS LTP for the active chart symbol. */
  getActiveMarkPrice(): number | null {
    return this.getMarkPrice(this.getChartSymbol())
  }

  private getActiveChartDomPositionContext(): DomPositionContext | null {
    const cache = this.tradeCache
    if (!cache) return null
    const chartSymbol = this.getChartSymbol()
    const position = cache.getPosition(chartSymbol)
    const contracts = Number(position?.contracts)
    if (!position || !contracts) return null
    const datafeed = this.propFirm.chartServices?.datafeed
    const tickSize = datafeed?.getTickSize?.(chartSymbol) ?? 0.25
    const tickValue =
      datafeed?.getTickValue?.(chartSymbol) ?? datafeed?.getTickValue?.(`CME:${chartSymbol}`) ?? tickSize * 2
    return {
      entry: position.entry as number,
      signedContracts: contracts,
      tickSize,
      tickValue,
    }
  }

  /** UP&L for the position on the active chart symbol (null if flat). */
  getActiveChartPositionUpl(): number | null {
    const ctx = this.getActiveChartDomPositionContext()
    if (!ctx) return null
    const mark = this.getMarkPrice(this.getChartSymbol())
    if (mark == null) return null
    return calcTradeseaTickPnL(
      ctx.entry,
      mark,
      ctx.signedContracts,
      ctx.tickSize,
      ctx.tickValue
    )
  }

  /** Entry/qty/tick inputs for DOM per-row P&L column. */
  getActiveChartDomPosition(): DomPositionContext | null {
    return this.getActiveChartDomPositionContext()
  }

  hasActiveChartPosition(): boolean {
    const position = this.tradeCache?.getPosition(this.getChartSymbol())
    return Boolean(position?.contracts)
  }

  async logButtonPress(
    buttonName: string,
    data?: {
      quantity?: number
      symbol?: string
      orderType?: 'market' | 'limit' | 'stop'
      entryPrice?: number
      stopLoss?: number | null
      takeProfit?: number | null
    }
  ): Promise<void> {
    const account = this.getAccount()
    if (!account || account.status !== 'active') {
      toast.error('Practice account is not active')
      return
    }
    if (this.isAccountBlown() || this.blownModalShown) {
      toast.error('Practice account has blown. Max drawdown reached.')
      return
    }
    if (this.passedModalShown || this.hasEvalPassed()) {
      toast.error('Practice evaluation already passed')
      return
    }

    const chartSymbol = this.getChartSymbol()
    const isEntry = buttonName === 'Buy' || buttonName === 'Sell'
    const isReverse = buttonName === 'Reverse Position'
    const qty = Number(data?.quantity)

    if (isEntry || isReverse) {
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error('Enter a valid quantity')
        return
      }
    }

    const mark = this.getMarkPrice(chartSymbol)
    if (mark == null) {
      toast.error('Waiting for market data…')
      return
    }

    const cache = this.tradeCache
    if (!cache) return

    const datafeed = this.propFirm.chartServices?.datafeed ?? null
    const orderType = data?.orderType
    const limitPrice =
      orderType !== 'market' &&
      data?.entryPrice != null &&
      Number.isFinite(data.entryPrice)
        ? data.entryPrice
        : null

    const currentPos = cache.getPosition(chartSymbol)
    const currentContracts = Number(currentPos?.contracts) || 0

    const projectedAbs = (side: 'buy' | 'sell') => {
      const delta = side === 'buy' ? qty : -qty
      return Math.abs(currentContracts + delta)
    }

    switch (buttonName) {
      case 'Buy': {
        if (limitPrice != null) {
          await this.placeLimitOrder('buy', qty, limitPrice, {
            stopLoss: data?.stopLoss ?? null,
            takeProfit: data?.takeProfit ?? null,
          })
          break
        }
        const sizeErr = validatePracticePositionSize(account, chartSymbol, projectedAbs('buy'), datafeed)
        if (sizeErr) {
          toast.error(sizeErr)
          return
        }
        cache.onOpenPosition(chartSymbol, mark, qty, data?.stopLoss ?? null, data?.takeProfit ?? null)
        if (currentContracts + qty !== 0) {
          const product = practiceOrderProductSymbol(chartSymbol, datafeed)
          showPracticeOrderToast(
            'buy',
            practiceOrderLine('buy', qty, product, mark),
            practiceOrderBracketDetail({
              stopLoss: data?.stopLoss ?? null,
              takeProfit: data?.takeProfit ?? null,
            })
          )
        }
        break
      }
      case 'Sell': {
        if (limitPrice != null) {
          await this.placeLimitOrder('sell', qty, limitPrice, {
            stopLoss: data?.stopLoss ?? null,
            takeProfit: data?.takeProfit ?? null,
          })
          break
        }
        const sizeErr = validatePracticePositionSize(account, chartSymbol, projectedAbs('sell'), datafeed)
        if (sizeErr) {
          toast.error(sizeErr)
          return
        }
        cache.onOpenPosition(chartSymbol, mark, -qty, data?.stopLoss ?? null, data?.takeProfit ?? null)
        if (currentContracts - qty !== 0) {
          const product = practiceOrderProductSymbol(chartSymbol, datafeed)
          showPracticeOrderToast(
            'sell',
            practiceOrderLine('sell', qty, product, mark),
            practiceOrderBracketDetail({
              stopLoss: data?.stopLoss ?? null,
              takeProfit: data?.takeProfit ?? null,
            })
          )
        }
        break
      }
      case 'Close Position': {
        const resolved = cache.getPosition(chartSymbol)
        if (!resolved?.contracts) {
          toast.error('No open position')
          return
        }
        cache.onClosePosition(chartSymbol, Math.abs(resolved.contracts as number), mark)
        break
      }
      case 'Reverse Position': {
        const resolved = cache.getPosition(chartSymbol)
        if (!resolved?.contracts) {
          toast.error('No open position')
          return
        }
        const c = resolved.contracts as number
        const product = practiceOrderProductSymbol(chartSymbol, datafeed)
        const exitSide = practiceExitSide(c)
        const entrySide = c > 0 ? 'sell' : 'buy'
        this.suppressCloseToasts = true
        cache.onClosePosition(chartSymbol, Math.abs(c), mark)
        cache.onOpenPosition(chartSymbol, mark, c > 0 ? -qty : qty, null, null)
        showPracticeOrderToast(
          exitSide,
          practiceOrderLine(exitSide, Math.abs(c), product, mark)
        )
        showPracticeOrderToast(entrySide, practiceOrderLine(entrySide, qty, product, mark))
        window.setTimeout(() => {
          this.suppressCloseToasts = false
        }, 4000)
        break
      }
      case 'Flatten All Position':
        cache.onFlattenAllPosition()
        break
      default:
        console.log('[PracticeTradeHandler]', buttonName, data)
    }
  }

  async cancelAllWorkingOrders(): Promise<void> {
    const n = this.pendingOrders.length
    for (const order of this.pendingOrders) {
      this.removePendingOrderLine(order)
    }
    this.pendingOrders = []
    toast.success(n > 0 ? `Canceled ${n} working order(s)` : 'No working orders')
  }

  getPendingOrderCount(): number {
    return this.pendingOrders.length
  }
}
