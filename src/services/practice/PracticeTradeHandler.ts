import { aurenToast } from '../../utils/aurenToast'
import { type PracticePosition } from '../../api/practice.api'
import {
  getPracticeAccountById,
  patchPracticeAccount,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../../constants/practice'
import { TradeseaPropFirm } from '../../propfirms/tradesea'
import { TradeseaDatafeed } from '../tradesea/TradeseaDatafeed'
import {
  practiceBookBidAsk,
  resolvePracticeBookMark,
  type PracticeChartDatafeed,
  type PracticeMarketBook,
} from './practiceDatafeed'
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
import { createWorkingOrderLine } from '../../chart/positionLineApi'
import {
  isPracticeLimitFillable,
  type PracticePendingOrder,
} from './practicePendingOrders'
import { evaluatePracticeRules } from './practiceRules'
import { evaluatePracticeLockout } from './practiceLockout'
import { getPracticeDailyRealizedPl } from './practiceSessionReset'
import { isBwcChartPanning, whenBwcPanEnds } from '../../utils/bwcPan'
import { t } from '../../utils/translator'
import { MARKET_CLOSED_MESSAGE } from '../../utils/marketSession'
import { connectPracticeAccountWs, type PracticeAccountWsClient } from './practiceAccountWs'
import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'

/** Keep quote-driven P&L/risk UI responsive without running it on every MDS packet. */
const UPL_REFRESH_MIN_INTERVAL_MS = 120
/** A single malformed market-data tick must never permanently fail an account. */
const BLOWN_CONFIRMATION_MS = 750

export class PracticeTradeHandler {
  tradeCache: PracticeTradeCache | null = null
  private pendingOrders: PracticePendingOrder[] = []
  private widget: unknown = null
  private upl = 0
  private disconnectAccountWs: (() => void) | null = null
  private accountWs: PracticeAccountWsClient | null = null
  private marketBookUnsub: (() => void) | null = null
  private uplRefreshRaf: number | null = null
  private uplRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private uplLastRefreshAt = 0
  private uplDeferredWhilePan: number | null = null
  private uplPanFlushScheduled = false
  private uplRefreshDeferredWhilePan = false
  private blownEnforcing = false
  private blownConfirmationTimer: ReturnType<typeof setTimeout> | null = null
  private blownCandidateSince: number | null = null
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

  /** Lockout message when trading is blocked, or null if allowed. */
  getTradingLockMessage(): string | null {
    const account = this.getAccount()
    if (!account) return 'Practice account not found'
    if (account.status !== 'active') {
      return account.status === 'blown'
        ? 'Practice account has blown. Max drawdown reached.'
        : account.status === 'passed'
          ? 'Practice evaluation already passed'
          : 'Practice account is not active'
    }
    if (this.isAccountBlown() || this.blownModalShown) {
      return 'Practice account has blown. Max drawdown reached.'
    }
    if (this.passedModalShown || this.hasEvalPassed()) {
      return 'Practice evaluation already passed'
    }
    const lock = evaluatePracticeLockout(account)
    return lock.locked ? lock.message : null
  }

  private getMarketClosedMessage(chartSymbol?: string): string | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    if (!datafeed?.isMarketOpenForChart) return null
    const symbol = chartSymbol?.trim() || this.getChartSymbol()
    return datafeed.isMarketOpenForChart(symbol) ? null : MARKET_CLOSED_MESSAGE
  }

  setUnrealizedPl(value: number): void {
    const rounded = Math.round(value * 100) / 100
    if (this.upl === rounded) return
    if (isBwcChartPanning()) {
      this.uplDeferredWhilePan = rounded
      if (!this.uplPanFlushScheduled) {
        this.uplPanFlushScheduled = true
        whenBwcPanEnds(() => {
          this.uplPanFlushScheduled = false
          this.flushDeferredUnrealizedPl()
        })
      }
      return
    }
    this.upl = rounded
    this.propFirm.setUnrealizedPl(rounded, { fromStream: false })
    this.onUnrealizedPnLUpdate?.(rounded)
  }

  private flushDeferredUnrealizedPl(): void {
    if (this.uplDeferredWhilePan == null) return
    const next = this.uplDeferredWhilePan
    this.uplDeferredWhilePan = null
    this.setUnrealizedPl(next)
  }

  getAccountInfo(): { balance: number; mll?: number; rpl: number; upl: number } {
    const account = this.getAccount()
    if (!account) {
      return { balance: 0, rpl: 0, upl: 0 }
    }
    const rpl = getPracticeDailyRealizedPl(account)
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
    if (!chart) {
      console.warn('[PracticeTradeHandler] chart API missing on widget — order lines disabled')
      return
    }
    if (typeof (chart as { createOrderLine?: unknown }).createOrderLine !== 'function') {
      console.warn(
        '[PracticeTradeHandler] widget.chart().createOrderLine missing — update betterweightchartpro (github:parbhatc/BetterweightChartPro)'
      )
    }

    this.tradeCache = new PracticeTradeCache(this, widget, this.practiceAccountId)
    const df = chartDatafeed ?? this.propFirm.chartServices?.datafeed ?? null
    df?.setTradeHandler(this as never)

    for (const order of this.pendingOrders) {
      void this.attachPendingOrderLine(order)
    }

    this.connectAccountStream()
    this.attachLiveBracketWatcher(df)
    void this.loadState()
  }

  /** Watch MDS LTP for fast SL/TP fills while the chart session is online. */
  private attachLiveBracketWatcher(datafeed: TradeseaDatafeed | null): void {
    this.marketBookUnsub?.()
    this.marketBookUnsub = null
    if (!datafeed?.subscribeMarketBook) return
    this.marketBookUnsub = datafeed.subscribeMarketBook((streamId) => {
      this.tradeCache?.onMarketBookTick(streamId)
    })
  }

  /** Send position mutations over practice-account-ws (not REST). */
  getAccountWs(): PracticeAccountWsClient | null {
    return this.accountWs
  }

  /** Practice sim account WS (positions, balance) — separate from Tradesea MDS market data. */
  private connectAccountStream(): void {
    this.accountWs?.close()
    this.accountWs = null
    this.disconnectAccountWs = null

    const client = connectPracticeAccountWs(this.practiceAccountId, {
      onSnapshot: (event) => {
        if (event.account) patchPracticeAccount(event.account)
        this.ensureMarketBooksForPositions(event.positions)
        void this.tradeCache?.loadPositionsFromServer(event.positions).then(() => {
          this.tradeCache?.scheduleReconcilePositionLines()
        })
        this.refreshUnrealizedPl()
        this.onAccountUpdated?.()
      },
      onOpenPosition: (event) => {
        if (event.account) patchPracticeAccount(event.account)
        this.ensureMarketBooksForPositions([event.position])
        this.tradeCache?.applyServerPositionUpdate(event.position)
        this.onAccountUpdated?.()
        this.syncAccountBlownState()
      },
      onModifyPosition: (event) => {
        if (event.account) patchPracticeAccount(event.account)
        this.tradeCache?.applyServerPositionUpdate(event.position)
        this.onAccountUpdated?.()
        this.syncAccountBlownState()
      },
      onClosePosition: (event) => {
        if (event.account) patchPracticeAccount(event.account)
        if (
          event.reason === 'stop_loss' ||
          event.reason === 'take_profit'
        ) {
          if (event.symbol != null && event.exitPrice != null && event.exitTime != null) {
            this.tradeCache?.applyServerBracketClose(
              event.symbol,
              event.exitPrice,
              event.exitTime,
              event.reason,
              event.positionId
            )
          }
        } else {
          this.tradeCache?.applyServerPositionClose(event.symbol, event.positionId)
        }
        this.onAccountUpdated?.()
        this.syncAccountBlownState()
        this.checkPassedWhileTrading()
      },
      onMutationError: (message) => {
        aurenToast.error(message || 'Position update failed')
      },
    })

    if (client) {
      this.accountWs = client
      this.disconnectAccountWs = () => client.close()
    }
  }

  dispose(): void {
    this.marketBookUnsub?.()
    this.marketBookUnsub = null
    if (this.uplRefreshTimer != null) {
      clearTimeout(this.uplRefreshTimer)
      this.uplRefreshTimer = null
    }
    if (this.uplRefreshRaf != null) {
      cancelAnimationFrame(this.uplRefreshRaf)
      this.uplRefreshRaf = null
    }
    if (this.blownConfirmationTimer != null) {
      clearTimeout(this.blownConfirmationTimer)
      this.blownConfirmationTimer = null
    }
    this.disconnectAccountWs?.()
    this.disconnectAccountWs = null
    this.accountWs = null
    this.tradeCache?.dispose()
    this.tradeCache = null
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
    if (isBwcChartPanning()) {
      if (!this.uplRefreshDeferredWhilePan) {
        this.uplRefreshDeferredWhilePan = true
        whenBwcPanEnds(() => {
          this.uplRefreshDeferredWhilePan = false
          this.refreshUnrealizedPl()
        })
      }
      return
    }

    const cache = this.tradeCache
    const prevUpl = this.upl
    if (!cache?.hasAnyOpenPosition()) {
      this.setUnrealizedPl(0)
      if (prevUpl !== this.upl) {
        this.checkBlownWhileTrading()
        this.checkPassedWhileTrading()
      }
      return
    }
    const datafeed = this.propFirm.chartServices?.datafeed
    let total = 0
    let anyMark = false
    for (const [, position] of cache.getCache()) {
      const contracts = Number(position?.contracts)
      if (!contracts) continue
      const cacheKey = String(position.symbol || '')
      // Display unrealized P&L at the current last-traded price. Bid/ask is
      // reserved for actual market-order execution and liquidation.
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
    if (prevUpl !== this.upl) {
      this.checkBlownWhileTrading()
      this.checkPassedWhileTrading()
    }
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
    if (!this.isAccountBlown()) {
      this.blownCandidateSince = null
      if (this.blownConfirmationTimer != null) {
        clearTimeout(this.blownConfirmationTimer)
        this.blownConfirmationTimer = null
      }
      return
    }

    const account = this.getAccount()
    if (account?.status !== 'blown') {
      const now = Date.now()
      if (this.blownCandidateSince == null) this.blownCandidateSince = now
      const remaining = BLOWN_CONFIRMATION_MS - (now - this.blownCandidateSince)
      if (remaining <= 0) {
        this.blownCandidateSince = null
      } else {
        if (this.blownConfirmationTimer == null) {
          this.blownConfirmationTimer = setTimeout(() => {
            this.blownConfirmationTimer = null
            this.refreshUnrealizedPl()
          }, remaining)
        }
        return
      }
    }

    this.blownCandidateSince = null
    if (this.blownConfirmationTimer != null) {
      clearTimeout(this.blownConfirmationTimer)
      this.blownConfirmationTimer = null
    }

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
        cache.flattenAllAtMarket((key, contracts) =>
          this.getPositionMarkPrice(key, contracts)
        )
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
    this.onAccountUpdated?.()
    this.onUnrealizedPnLUpdate?.(this.upl)
    this.checkBlownWhileTrading()
    this.checkPassedWhileTrading()
  }

  attachToDatafeed(chartDatafeed?: PracticeChartDatafeed | null): void {
    const df = chartDatafeed ?? (this.propFirm.chartServices?.datafeed as PracticeChartDatafeed | undefined) ?? null
    df?.setTradeHandler(this as never)
    if (df && 'subscribeMarketBook' in df) {
      this.attachLiveBracketWatcher(df as TradeseaDatafeed)
    }
  }

  onRealTimeBar(symbol: string, _resolution: string, bar: { close?: number; low?: number; high?: number; time?: number }): void {
    if (!this.tradeCache || !bar) return
    if (isBwcChartPanning()) {
      whenBwcPanEnds(() => this.onRealTimeBar(symbol, _resolution, bar))
      return
    }
    const low = bar.low ?? bar.close
    const high = bar.high ?? bar.close
    const close = bar.close
    if (low != null && high != null) {
      this.tryFillPendingOrders(symbol, low, high, close ?? low, bar.time)
    }
    this.tradeCache.onRealTimeBar(symbol, bar)
    if (close != null) {
      this.scheduleRefreshUnrealizedPl()
    }
  }

  scheduleRefreshUnrealizedPl(): void {
    if (isBwcChartPanning()) {
      whenBwcPanEnds(() => this.scheduleRefreshUnrealizedPl())
      return
    }
    if (this.uplRefreshRaf != null || this.uplRefreshTimer != null) return

    const scheduleFrame = () => {
      this.uplRefreshTimer = null
      if (this.uplRefreshRaf != null) return
      this.uplRefreshRaf = requestAnimationFrame(() => {
        this.uplRefreshRaf = null
        if (isBwcChartPanning()) {
          whenBwcPanEnds(() => this.scheduleRefreshUnrealizedPl())
          return
        }
        this.uplLastRefreshAt = performance.now()
        this.refreshUnrealizedPl()
      })
    }

    const elapsed = performance.now() - this.uplLastRefreshAt
    const delay = Math.max(0, UPL_REFRESH_MIN_INTERVAL_MS - elapsed)
    if (delay > 0) {
      this.uplRefreshTimer = setTimeout(scheduleFrame, delay)
    } else {
      scheduleFrame()
    }
  }

  /** Place a working limit (Join Bid / Join Ask / chart limit / order tab limit). */
  async placeLimitOrder(
    side: 'buy' | 'sell',
    quantity: number,
    limitPrice: number,
    brackets?: { stopLoss?: number | null; takeProfit?: number | null },
    tradeSymbolOverride?: string
  ): Promise<void> {
    const lockMsg = this.getTradingLockMessage()
    if (lockMsg) {
      aurenToast.error(lockMsg)
      return
    }

    const account = this.getAccount()
    if (!account) return

    const tradeSymbol = this.resolveTradeSymbol(tradeSymbolOverride)
    const closedMsg = this.getMarketClosedMessage(tradeSymbol)
    if (closedMsg) {
      aurenToast.error(closedMsg)
      return
    }

    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      aurenToast.error('Enter a valid quantity')
      return
    }
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      aurenToast.error('Enter a valid limit price')
      return
    }

    const mark = this.getMarkPrice(tradeSymbol)
    if (mark == null) {
      aurenToast.error('Waiting for market data…')
      return
    }

    const datafeed = this.propFirm.chartServices?.datafeed ?? null
    const tickSize = datafeed?.getTickSize?.(tradeSymbol) ?? 0.25
    const cache = this.tradeCache
    if (!cache) return

    const signed = side === 'buy' ? qty : -qty
    const currentPos = cache.getPosition(tradeSymbol)
    const currentContracts = Number(currentPos?.contracts) || 0
    const sizeErr = validatePracticePositionSize(
      account,
      tradeSymbol,
      Math.abs(currentContracts + signed),
      datafeed
    )
    if (sizeErr) {
      aurenToast.error(sizeErr)
      return
    }

    const sl = brackets?.stopLoss ?? null
    const tp = brackets?.takeProfit ?? null

    const order: PracticePendingOrder = {
      id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: tradeSymbol,
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
    const product = practiceOrderProductSymbol(tradeSymbol, datafeed)
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
    aurenToast.info(t('toast.order.canceledTitle'), t('toast.order.canceledSubtitle'))
  }

  private async attachPendingOrderLine(order: PracticePendingOrder): Promise<void> {
    const chart = (this.widget as { chart?: () => unknown })?.chart?.()
    if (!chart || typeof (chart as { createOrderLine?: unknown }).createOrderLine !== 'function') {
      return
    }
    const datafeed = this.propFirm.chartServices?.datafeed ?? null
    const result = await createWorkingOrderLine({
      chart,
      datafeed,
      symbol: order.symbol,
      price: order.limitPrice,
      quantity: order.contracts,
      side: order.side,
      orderType: 'limit',
      onCancel: () => this.cancelPendingOrder(order.id),
    })
    if (result?.tvLine) {
      order.line = result.tvLine
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
    return chartSymbolToProductRoot(symbol)
  }

  updateUnrealizedFromMark(_markPrice: number, _chartSymbol?: string): void {
    this.scheduleRefreshUnrealizedPl()
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
    this.refreshUnrealizedPl()
  }

  /** Always use the TradingView chart ticker (e.g. CME:MNQ), not the short MNQ label. */
  private getChartSymbol(): string {
    try {
      const w = this.widget as { chart?: () => { symbol?: () => string } }
      return w?.chart?.()?.symbol?.() || this.propFirm.chartSymbol || 'CME:NQ'
    } catch {
      return this.propFirm.chartSymbol || 'CME:NQ'
    }
  }

  getActiveMarketBook(symbolKey?: string): PracticeMarketBook | null {
    const datafeed = this.propFirm.chartServices?.datafeed as PracticeChartDatafeed | undefined
    if (!datafeed?.getMarketBookForChart) return null
    const symbol = symbolKey?.trim()
      ? this.resolveStreamLabel(symbolKey)
      : this.getChartSymbol()
    return datafeed.getMarketBookForChart(symbol)
  }

  private resolveStreamLabel(productOrKey: string): string {
    const datafeed = this.propFirm.chartServices?.datafeed
    const raw = String(productOrKey || '').trim()
    if (!raw) return ''
    if (raw.includes(':')) return datafeed?.resolveStreamInstrument?.(raw) ?? raw
    return datafeed?.resolveStreamInstrument?.(`CME:${raw}`) ?? `CME:${raw}`
  }

  private resolveTradeSymbol(override?: string): string {
    const raw = String(override || '').trim()
    if (raw) return this.resolveStreamLabel(raw)
    return this.getChartSymbol()
  }

  getMarkPriceForPositionKey(cacheKey: string): number | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    const stream = this.resolveStreamLabel(cacheKey)
    if (!stream) return null

    const chartSym = this.getChartSymbol()
    let barClose: number | null = null
    try {
      const chart = (this.widget as { chart?: () => unknown } | null | undefined)?.chart?.()
      if (chart) {
        const lastBar = datafeed?.getLastBarForChart?.(chart)
        barClose =
          lastBar?.close != null && Number.isFinite(lastBar.close) ? lastBar.close : null
      }
    } catch {
      // Widget may be torn down during theme change or chart remount.
    }

    const sameAsActiveChart =
      this.normalizeSymbolKey(stream) === this.normalizeSymbolKey(chartSym) ||
      this.normalizeSymbolKey(cacheKey) === this.normalizeSymbolKey(chartSym)

    const book = datafeed?.getMarketBookForChart?.(stream)
    const { bestBid, bestAsk, last: bookLastRaw } = practiceBookBidAsk(book)
    const bookLast =
      bookLastRaw != null && Number.isFinite(bookLastRaw) ? bookLastRaw : null
    const mid =
      bestBid != null &&
      bestAsk != null &&
      Number.isFinite(bestBid) &&
      Number.isFinite(bestAsk)
        ? (bestBid + bestAsk) / 2
        : null

    const activeBook = sameAsActiveChart
      ? datafeed?.getMarketBookForChart?.(chartSym)
      : null
    const activeBookMark = resolvePracticeBookMark(activeBook)

    if (sameAsActiveChart && barClose != null) {
      if (bookLast != null && this.markPricesAgree(barClose, bookLast)) return bookLast
      if (mid != null && this.markPricesAgree(barClose, mid)) return mid
      return barClose
    }

    if (sameAsActiveChart && activeBookMark != null) return activeBookMark

    const safeBookMark = resolvePracticeBookMark(book)
    if (safeBookMark != null) return safeBookMark
    if (sameAsActiveChart && barClose != null) return barClose
    return bestBid ?? bestAsk ?? null
  }

  /** Executable top-of-book price for a market order. */
  getMarketExecutionPrice(
    symbolKey: string,
    side: 'buy' | 'sell'
  ): number | null {
    const datafeed = this.propFirm.chartServices?.datafeed
    const stream = this.resolveStreamLabel(symbolKey)
    if (!stream) return null
    const book = datafeed?.getMarketBookForChart?.(stream)
    const { bestBid, bestAsk } = practiceBookBidAsk(book)
    const price = side === 'buy' ? bestAsk : bestBid
    return price != null && Number.isFinite(price) && price > 0 ? price : null
  }

  /** Liquidation value: longs sell to bid; shorts buy back at ask. */
  getPositionMarkPrice(cacheKey: string, contracts: number): number | null {
    const side = contracts > 0 ? 'sell' : 'buy'
    return (
      this.getMarketExecutionPrice(cacheKey, side) ??
      this.getMarkPriceForPositionKey(cacheKey)
    )
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
  getActiveMarkPrice(symbolKey?: string): number | null {
    return this.getMarkPrice(symbolKey?.trim() || this.getChartSymbol())
  }

  private getDomPositionContextFor(symbolKey: string): DomPositionContext | null {
    const cache = this.tradeCache
    if (!cache) return null
    const tradeSymbol = this.resolveStreamLabel(symbolKey)
    const position = cache.getPosition(tradeSymbol)
    const contracts = Number(position?.contracts)
    if (!position || !contracts) return null
    const datafeed = this.propFirm.chartServices?.datafeed
    const tickSize = datafeed?.getTickSize?.(tradeSymbol) ?? 0.25
    const tickValue =
      datafeed?.getTickValue?.(tradeSymbol) ??
      datafeed?.getTickValue?.(`CME:${tradeSymbol}`) ??
      tickSize * 2
    return {
      entry: position.entry as number,
      signedContracts: contracts,
      tickSize,
      tickValue,
    }
  }

  private getActiveChartDomPositionContext(): DomPositionContext | null {
    return this.getDomPositionContextFor(this.getChartSymbol())
  }

  getDomPositionFor(symbolKey: string): DomPositionContext | null {
    return this.getDomPositionContextFor(symbolKey)
  }

  getPositionUplFor(symbolKey: string): number | null {
    const ctx = this.getDomPositionContextFor(symbolKey)
    if (!ctx) return null
    const tradeSymbol = this.resolveStreamLabel(symbolKey)
    const mark = this.getMarkPriceForPositionKey(tradeSymbol)
    if (mark == null) return null
    return calcTradeseaTickPnL(
      ctx.entry,
      mark,
      ctx.signedContracts,
      ctx.tickSize,
      ctx.tickValue
    )
  }

  /** UP&L for the position on the active chart symbol (null if flat). */
  getActiveChartPositionUpl(): number | null {
    const ctx = this.getActiveChartDomPositionContext()
    if (!ctx) return null
    const mark = this.getMarkPriceForPositionKey(this.getChartSymbol())
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
    const lockMsg = this.getTradingLockMessage()
    if (lockMsg) {
      aurenToast.error(lockMsg)
      return
    }

    const account = this.getAccount()
    if (!account) return

    const tradeSymbol = this.resolveTradeSymbol(data?.symbol)
    const closedMsg = this.getMarketClosedMessage(tradeSymbol)
    if (closedMsg) {
      aurenToast.error(closedMsg)
      return
    }

    const isEntry = buttonName === 'Buy' || buttonName === 'Sell'
    const isReverse = buttonName === 'Reverse Position'
    const qty = Number(data?.quantity)

    if (isEntry || isReverse) {
      if (!Number.isFinite(qty) || qty <= 0) {
        aurenToast.error('Enter a valid quantity')
        return
      }
    }

    const mark = this.getMarkPrice(tradeSymbol)
    if (mark == null) {
      aurenToast.error('Waiting for market data…')
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

    const currentPos = cache.getPosition(tradeSymbol)
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
          }, data?.symbol)
          break
        }
        const sizeErr = validatePracticePositionSize(account, tradeSymbol, projectedAbs('buy'), datafeed)
        if (sizeErr) {
          aurenToast.error(sizeErr)
          return
        }
        const fillPrice = this.getMarketExecutionPrice(tradeSymbol, 'buy')
        if (fillPrice == null) {
          aurenToast.error('Waiting for ask…')
          return
        }
        cache.onOpenPosition(tradeSymbol, fillPrice, qty, data?.stopLoss ?? null, data?.takeProfit ?? null)
        if (currentContracts + qty !== 0) {
          const product = practiceOrderProductSymbol(tradeSymbol, datafeed)
          showPracticeOrderToast(
            'buy',
            practiceOrderLine('buy', qty, product, fillPrice),
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
          }, data?.symbol)
          break
        }
        const sizeErr = validatePracticePositionSize(account, tradeSymbol, projectedAbs('sell'), datafeed)
        if (sizeErr) {
          aurenToast.error(sizeErr)
          return
        }
        const fillPrice = this.getMarketExecutionPrice(tradeSymbol, 'sell')
        if (fillPrice == null) {
          aurenToast.error('Waiting for bid…')
          return
        }
        cache.onOpenPosition(tradeSymbol, fillPrice, -qty, data?.stopLoss ?? null, data?.takeProfit ?? null)
        if (currentContracts - qty !== 0) {
          const product = practiceOrderProductSymbol(tradeSymbol, datafeed)
          showPracticeOrderToast(
            'sell',
            practiceOrderLine('sell', qty, product, fillPrice),
            practiceOrderBracketDetail({
              stopLoss: data?.stopLoss ?? null,
              takeProfit: data?.takeProfit ?? null,
            })
          )
        }
        break
      }
      case 'Close Position': {
        const resolved = cache.getPosition(tradeSymbol)
        if (!resolved?.contracts) {
          aurenToast.error('No open position')
          return
        }
        const contracts = Number(resolved.contracts)
        const exitPrice = this.getMarketExecutionPrice(
          tradeSymbol,
          contracts > 0 ? 'sell' : 'buy'
        )
        if (exitPrice == null) {
          aurenToast.error(contracts > 0 ? 'Waiting for bid…' : 'Waiting for ask…')
          return
        }
        cache.onClosePosition(tradeSymbol, Math.abs(contracts), exitPrice)
        break
      }
      case 'Reverse Position': {
        const resolved = cache.getPosition(tradeSymbol)
        if (!resolved?.contracts) {
          aurenToast.error('No open position')
          return
        }
        const c = resolved.contracts as number
        const side = c > 0 ? 'sell' : 'buy'
        const fillPrice = this.getMarketExecutionPrice(tradeSymbol, side)
        if (fillPrice == null) {
          aurenToast.error(side === 'sell' ? 'Waiting for bid…' : 'Waiting for ask…')
          return
        }
        const product = practiceOrderProductSymbol(tradeSymbol, datafeed)
        const exitSide = practiceExitSide(c)
        const entrySide = side
        this.suppressCloseToasts = true
        cache.onClosePosition(tradeSymbol, Math.abs(c), fillPrice)
        cache.onOpenPosition(tradeSymbol, fillPrice, c > 0 ? -qty : qty, null, null)
        showPracticeOrderToast(
          exitSide,
          practiceOrderLine(exitSide, Math.abs(c), product, fillPrice)
        )
        showPracticeOrderToast(entrySide, practiceOrderLine(entrySide, qty, product, fillPrice))
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
    if (n > 0) {
      aurenToast.success(t('toast.order.workingCanceledTitle'), t('toast.order.workingCanceledSubtitle'))
    } else {
      aurenToast.info(t('toast.order.workingCanceledTitle'), t('toast.order.workingNoneSubtitle'))
    }
  }

  getPendingOrderCount(): number {
    return this.pendingOrders.length
  }
}
