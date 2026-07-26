import { aurenToast } from '../../utils/aurenToast'
import { practiceExitSide, practiceOrderLine } from './practiceOrderToasts'
import { showPracticeOrderToast } from './showPracticeOrderToast'
import ChartTradeCache from '../../components/common/ChartTradeCache'
import { type PracticePosition } from '../../api/practice.api'
import { practiceFillCommission } from './practiceCommission'

import { PracticeTradeHandler } from './PracticeTradeHandler'

import { resolvePracticeProductSymbol } from './practiceSymbol'
import {
  clearBracketCheckpoint,
  entryTimeToMs,
  writeBracketCheckpointSec,
} from './practiceBracketReplay'
import { resolveBracketCrossHit } from '../../utils/practiceBracketMath'

import type { TradeseaDatafeed } from '../tradesea/TradeseaDatafeed'
import { isBwcChartPanning } from '../../utils/bwcPan'



export class PracticeTradeCache extends ChartTradeCache {

  private accountId: string

  private positionIds = new Map<string, string>()

  /** True while applying account_snapshot — do not echo positions back over WS. */
  private hydratingFromServer = false

  private reconcileTimers: ReturnType<typeof setTimeout>[] = []

  private closingBracketIds = new Set<string>()

  /** Previous mark per cache key — detect bracket crosses between ticks. */
  private lastBracketMark = new Map<string, number>()

  private pendingBracketCloses = new Map<
    string,
    { price: number; time?: number; reason: 'stop_loss' | 'take_profit' }
  >()

  private readonly onChartLayoutResize = () => {
    const widget = this.getWidget() as {
      positionOverlay?: { refreshLayout?: () => void }
      orderLines?: { requestRefresh?: () => void }
    } | null
    widget?.positionOverlay?.refreshLayout?.()
    widget?.orderLines?.requestRefresh?.()
    this.scheduleReconcilePositionLines()
  }

  constructor(

    private tradeHandler: PracticeTradeHandler,

    chart: unknown,

    accountId: string

  ) {

    super(tradeHandler, chart)

    this.accountId = accountId

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onChartLayoutResize, { passive: true })
      window.visualViewport?.addEventListener('resize', this.onChartLayoutResize, { passive: true })
    }

  }

  /** Release DOM listeners, timers, and chart handles when leaving the terminal. */
  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onChartLayoutResize)
      window.visualViewport?.removeEventListener('resize', this.onChartLayoutResize)
    }
    for (const timer of this.reconcileTimers) clearTimeout(timer)
    this.reconcileTimers = []
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = null
    this.pendingPersist = null
    for (const [, position] of this.cache.entries()) {
      const line = position?.line as { removeAll?: () => void } | undefined
      line?.removeAll?.()
    }
    this.cache.clear()
    this.positionIds.clear()
    this.lastBracketMark.clear()
    this.pendingBracketCloses.clear()
    this.closingBracketIds.clear()
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

  private seedBracketCheckpoint(cacheKey: string, entryTime: number | null | undefined): void {
    const sec =
      entryTime != null
        ? Math.floor(entryTimeToMs(entryTime) / 1000)
        : Math.floor(Date.now() / 1000)
    writeBracketCheckpointSec(this.accountId, cacheKey, sec)
  }

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

  private findCacheEntryForProduct(
    productSymbol: string,
    positionId?: string | null
  ): { key: string; position: Record<string, unknown> } | null {
    const preferred = this.chartCacheKeyForProduct(productSymbol)
    const direct = this.cache.get(preferred)
    if (direct?.contracts) return { key: preferred, position: direct }

    const upper = String(productSymbol || '').trim().toUpperCase()
    const posId = String(positionId || '').trim()
    for (const [key, position] of this.cache.entries()) {
      if (!position?.contracts) continue
      if (posId && this.positionIds.get(key) === posId) {
        return { key, position }
      }
      if (key.toUpperCase() === upper) return { key, position }
      if (this.productSymbol(key).toUpperCase() === upper) return { key, position }
    }
    return null
  }

  private clearPositionFromChart(
    cacheKey: string,
    position: Record<string, unknown>,
    options?: { toast?: boolean; exitPrice?: number; productSymbol?: string }
  ): void {
    if (options?.toast) {
      const tradeSymbol = this.productSymbol(cacheKey)
      const exitContracts = Math.abs(Number(position.contracts))
      const exitSide = practiceExitSide(Number(position.contracts), String(position.type || 'long'))
      const exitFillLine = practiceOrderLine(
        exitSide,
        exitContracts,
        tradeSymbol,
        options.exitPrice ?? Number(position.entry)
      )
      if (!this.tradeHandler.suppressCloseToasts) {
        showPracticeOrderToast(exitSide, exitFillLine)
      }
    }

    clearBracketCheckpoint(this.accountId, cacheKey)

    const line = position.line as { removeAll?: () => void } | undefined
    line?.removeAll?.()

    this.cache.delete(cacheKey)
    this.positionIds.delete(cacheKey)
    this.clearBracketMark(cacheKey)
    this.tradeHandler.refreshUnrealizedPl()
    this.tradeHandler.onAccountUpdated?.()
    this.tradeHandler.syncAccountBlownState()
  }



  onOpenPosition(

    symbol: string,

    price: number,

    contracts: number,

    stopLoss: number | null = null,

    takeProfit: number | null = null,

    entryTime: number | null = null,

    id: number | string | null = null,

    stopLossOrderId: number | string | null = null,

    takeProfitOrderId: number | string | null = null

  ) {

    const cacheKey = String(symbol || '').trim() || this.activeChartSymbol()

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

        typeof id === 'string' ? Number(id) || null : id,

        stopLossOrderId,

        takeProfitOrderId

      )

      this.handleOpenPosition(data)

      if (mark != null && Number.isFinite(mark)) {
        this.lastBracketMark.set(cacheKey, mark)
      }

      if (stopLoss != null || takeProfit != null) {
        this.seedBracketCheckpoint(cacheKey, entryTime ?? data.entryTime)
      }

      return data

    }



    const opened = super.onOpenPosition(

      cacheKey,

      price,

      contracts,

      stopLoss,

      takeProfit,

      entryTime,

      typeof id === 'string' ? Number(id) || null : id,

      stopLossOrderId,

      takeProfitOrderId

    )

    if (mark != null && Number.isFinite(mark)) {
      this.lastBracketMark.set(cacheKey, mark)
    }

    if (stopLoss != null || takeProfit != null) {
      this.seedBracketCheckpoint(cacheKey, entryTime ?? opened?.entryTime)
    }

    return opened

  }

  onClosePosition(
    symbol: string,
    contracts: number,
    price: number | null = null,
    exitTime: number | null = null
  ) {
    clearBracketCheckpoint(this.accountId, symbol)
    super.onClosePosition(symbol, contracts, price, exitTime)
  }

  /** Resolve cache row when line symbol differs from key (MNQ vs CME:MNQ). */
  private resolveCachePosition(
    symbol: string
  ): { key: string; position: Record<string, unknown> } | null {
    const resolved = this.getPositionForActiveChart(symbol)
    if (resolved) return resolved as { key: string; position: Record<string, unknown> }

    const direct = this.cache.get(symbol)
    if (direct) return { key: symbol, position: direct }

    const product = this.productSymbol(symbol).toUpperCase()
    for (const [key, position] of this.cache.entries()) {
      if (!position?.contracts) continue
      if (this.productSymbol(key).toUpperCase() === product) {
        return { key, position }
      }
    }
    return null
  }

  private resolvePositionId(cacheKey: string): string | undefined {
    const direct = this.positionIds.get(cacheKey)
    if (direct) return direct
    const cached = this.cache.get(cacheKey) as { positionId?: string } | undefined
    if (cached?.positionId) return String(cached.positionId)
    const product = this.productSymbol(cacheKey).toUpperCase()
    for (const [key, id] of this.positionIds.entries()) {
      if (this.productSymbol(key).toUpperCase() === product) return id
    }
    return undefined
  }

  /** Mark price for bracket drag — prefer visible chart bar when products match. */
  private getMarkForBracketClose(cacheKey: string): number | null {
    const resolved = this.resolveCachePosition(cacheKey)
    const contracts = Number(resolved?.position?.contracts)
    if (contracts) {
      const executable = this.tradeHandler.getPositionMarkPrice(cacheKey, contracts)
      if (executable != null && Number.isFinite(executable)) return executable
    }
    if (this.positionBelongsOnActiveChart(cacheKey)) {
      const lastBar = this.getDatafeed()?.getLastBarForChart?.(this.chart)
      const close = lastBar?.close
      if (close != null && Number.isFinite(close)) return close
    }
    const mark = this.tradeHandler.getMarkPriceForPositionKey(cacheKey)
    return mark != null && Number.isFinite(mark) ? mark : null
  }

  updateStopLoss(symbol: string, price: number | null, context: string | undefined = undefined) {
    const resolved = this.resolveCachePosition(symbol)
    if (!resolved) return
    const { key, position } = resolved
    const oldPrice = position.stopLoss as number | null | undefined
    position.stopLoss = price
    position.symbol = key
    this.handleUpdateStopLoss(price ?? null, oldPrice ?? null, position as never, context)
  }

  updateTakeProfit(symbol: string, price: number | null, context: string | undefined = undefined) {
    const resolved = this.resolveCachePosition(symbol)
    if (!resolved) return
    const { key, position } = resolved
    const oldPrice = position.takeProfit as number | null | undefined
    position.takeProfit = price
    position.symbol = key
    this.handleUpdateTakeProfit(price ?? null, oldPrice ?? null, position as never, context)
  }



  getPosition(symbol: string) {

    const resolved = this.getPositionForActiveChart(symbol)

    if (resolved) return resolved.position

    return super.getPosition(symbol)

  }



  async loadPositionsFromServer(positions: PracticePosition[]): Promise<void> {
    this.hydratingFromServer = true
    try {
      await this.hydratePositionsFromServer(positions)
    } finally {
      this.hydratingFromServer = false
    }
  }

  private async hydratePositionsFromServer(positions: PracticePosition[]): Promise<void> {
    const data: Record<string, unknown> = {}

    // A snapshot is authoritative. Remove old visual handles before replacing the
    // cache so reconnects cannot leave ghost positions or stale bracket lines.
    for (const [, existing] of this.cache.entries()) {
      const line = existing?.line as { removeAll?: () => void } | undefined
      line?.removeAll?.()
    }
    this.positionIds.clear()
    this.lastBracketMark.clear()
    this.pendingBracketCloses.clear()

    for (const p of positions) {

      const cacheKey = this.chartCacheKeyForProduct(p.symbol)

      this.positionIds.set(cacheKey, p.id)

      data[cacheKey] = {

        symbol: cacheKey,

        entry: p.entry,

        contracts: p.contracts,

        stopLoss: p.stopLoss,

        takeProfit: p.takeProfit,

        entryTime: Math.floor(entryTimeToMs(p.entryTime) / 1000),

        type: p.type,

        id: p.id,

        positionId: p.id,

      }

    }

    this.load(data, true)

    this.scheduleReconcilePositionLines()

    // Reconcile immediately against a mark already in memory. This closes a
    // restored position beyond TP/SL even if no new tick follows the snapshot.
    for (const p of positions) {
      const cacheKey = this.chartCacheKeyForProduct(p.symbol)
      const mark = this.tradeHandler.getMarkPriceForPositionKey(cacheKey)
      if (mark != null && Number.isFinite(mark)) {
        this.checkMarkBracketFills(cacheKey, mark, Date.now())
      }
    }
  }

  private positionChartLinesReady(line: unknown): boolean {
    if (!line || typeof line !== 'object') return false
    const pos = (line as { get?: (t: string) => { hasTvLine?: () => boolean } }).get?.('position')
    return Boolean(pos?.hasTvLine?.())
  }

  /** Retry line reconcile until bars / async order lines are ready (post-refresh symbol switches). */
  scheduleReconcilePositionLines(): void {
    if (isBwcChartPanning()) return
    for (const id of this.reconcileTimers) clearTimeout(id)
    this.reconcileTimers = []
    for (const ms of [0, 200, 600, 1500, 3000]) {
      this.reconcileTimers.push(
        setTimeout(() => {
          this.reconcilePositionLines()
        }, ms)
      )
    }
  }

  private positionBelongsOnActiveChart(cacheKey: string): boolean {
    const chartSym = this.activeChartSymbol()
    if (!chartSym) return false
    const chartProduct = this.productSymbol(chartSym).toUpperCase()
    const keyProduct = this.productSymbol(cacheKey).toUpperCase()
    return Boolean(chartProduct && keyProduct && chartProduct === keyProduct)
  }

  /** Create chart lines for open positions that match the active chart product (e.g. NQ vs MNQ). */
  reconcilePositionLines(): void {
    if (isBwcChartPanning()) return
    for (const [cacheKey, position] of this.cache.entries()) {
      if (!position?.contracts) continue

      if (!this.positionBelongsOnActiveChart(cacheKey)) {
        const line = position.line as { removeAll?: () => void } | undefined
        if (line?.removeAll) {
          line.removeAll()
          position.line = null
        }
        continue
      }

      if (position.line) {
        if (this.positionChartLinesReady(position.line)) {
          const widget = this.getWidget() as {
            positionOverlay?: { refreshLayout?: () => void }
          } | null
          widget?.positionOverlay?.refreshLayout?.()
          continue
        }
        const stale = position.line as { removeAll?: () => void }
        stale?.removeAll?.()
        position.line = null
      }

      const p = position as {
        entry: number
        contracts: number
        stopLoss?: number | null
        takeProfit?: number | null
        entryTime?: number
        id?: number | string | null
        stopLossOrderId?: number | string | null
        takeProfitOrderId?: number | string | null
      }
      const datafeed = this.getDatafeed()
      const lastBar = datafeed?.getLastBarForChart?.(this.chart)
      const mark = lastBar?.close ?? p.entry
      if (mark == null) continue

      position.line = this.createLines(
        cacheKey,
        p.entry,
        mark,
        p.contracts,
        p.stopLoss ?? null,
        p.takeProfit ?? null
      )
    }
  }

  onRealTimeBar(symbol: string, bar: { close?: number; low?: number; high?: number; time?: number }): void {
    for (const [cacheKey, position] of this.cache.entries()) {
      if (!position?.contracts) continue
      if (!this.positionBelongsOnActiveChart(cacheKey)) continue
      if (this.positionChartLinesReady(position.line)) continue
      this.scheduleReconcilePositionLines()
      break
    }
    super.onRealTimeBar(symbol, bar)
  }

  /** MDS LTP tick — fastest bracket path while the chart session is online. */
  onMarketBookTick(streamId: string): void {
    // Process every notification. Animation-frame coalescing retained only the
    // final price and could discard a brief TP/SL touch within one frame.
    this.processMarketBookTick(streamId)
  }

  private processMarketBookTick(streamId: string): void {
    const df = this.getDatafeed()
    if (!df?.getMarketBookForStream) return
    const book = df.getMarketBookForStream(streamId)
    const price = book?.last
    if (price == null || !Number.isFinite(price)) return

    const streamKey = this.normalizeStreamKey(streamId)
    let positionMarkChanged = false
    for (const [cacheKey, position] of this.cache.entries()) {
      if (!position?.contracts) continue
      const posStream = this.normalizeStreamKey(this.streamForCacheKey(cacheKey))
      if (posStream !== streamKey) continue
      const executable = this.tradeHandler.getPositionMarkPrice(
        cacheKey,
        Number(position.contracts)
      )
      if (executable != null) {
        position.line?.updatePositionLine?.(
          Number(position.entry),
          executable,
          Number(position.contracts)
        )
        positionMarkChanged = true
      }
      this.mergeOverlayBracketsIntoCache(cacheKey)
      if (position.stopLoss == null && position.takeProfit == null) continue
      this.checkMarkBracketFills(cacheKey, price, book?.updatedAt)
    }
    if (positionMarkChanged) this.tradeHandler.refreshUnrealizedPl()
  }

  private streamForCacheKey(cacheKey: string): string {
    const df = this.getDatafeed()
    const raw = String(cacheKey || '').trim()
    if (!raw) return ''
    if (raw.includes(':')) return df?.resolveStreamInstrument?.(raw) ?? raw
    return df?.resolveStreamInstrument?.(`CME:${raw}`) ?? `CME:${raw}`
  }

  private normalizeStreamKey(stream: string): string {
    const s = String(stream || '').trim().toUpperCase()
    const colon = s.indexOf(':')
    return colon >= 0 ? s.slice(colon + 1) : s
  }

  /** On each mark tick: detect SL/TP cross from previous → current price. */
  private checkMarkBracketFills(cacheKey: string, mark: number, time?: number): void {
    this.mergeOverlayBracketsIntoCache(cacheKey)
    const resolved = this.resolveCachePosition(cacheKey)
    if (!resolved?.position?.contracts) return

    const key = resolved.key
    const position = resolved.position
    if (position.stopLoss == null && position.takeProfit == null) return

    const prev = this.lastBracketMark.get(key)
    const hit = resolveBracketCrossHit(position as never, prev, mark)
    this.lastBracketMark.set(key, mark)
    if (!hit) return

    this.closeOnBracketHit(key, position, hit.exitPrice, time, hit.reason)
  }

  private clearBracketMark(cacheKey: string): void {
    this.lastBracketMark.delete(cacheKey)
    const product = this.productSymbol(cacheKey).toUpperCase()
    for (const key of [...this.lastBracketMark.keys()]) {
      if (this.productSymbol(key).toUpperCase() === product) {
        this.lastBracketMark.delete(key)
      }
    }
  }

  private closeOnBracketHit(
    cacheKey: string,
    position: Record<string, unknown>,
    price: number,
    time: number | undefined,
    reason: 'stop_loss' | 'take_profit'
  ): void {
    const posId = this.resolvePositionId(cacheKey)
    if (!posId) {
      this.pendingBracketCloses.set(cacheKey, { price, time, reason })
      return
    }
    this.pendingBracketCloses.delete(cacheKey)
    if (this.closingBracketIds.has(posId)) return
    this.closingBracketIds.add(posId)

    try {
      const exitTime = time ?? Date.now()
      writeBracketCheckpointSec(
        this.accountId,
        cacheKey,
        Math.floor(entryTimeToMs(exitTime) / 1000)
      )
      this.handleClosePosition(
        { ...(position as object), symbol: cacheKey } as never,
        price,
        exitTime
      )
    } finally {
      this.closingBracketIds.delete(posId)
    }
  }

  private flushPendingBracketClose(cacheKey: string): void {
    const pending = this.pendingBracketCloses.get(cacheKey)
    if (!pending) return
    const resolved = this.resolveCachePosition(cacheKey)
    if (!resolved?.position?.contracts) return
    this.closeOnBracketHit(
      resolved.key,
      resolved.position,
      pending.price,
      pending.time,
      pending.reason
    )
  }

  onSymbolChange(_symbol: string): void {
    this.scheduleReconcilePositionLines()
  }

  hasAnyOpenPosition(): boolean {
    for (const [, position] of this.cache.entries()) {
      if (Math.abs(Number(position?.contracts)) > 0) return true
    }
    return false
  }



  handleClosePosition(position: { symbol: string; type: string; entry: number; contracts: number; entryTime: number; stopLoss?: number | null; takeProfit?: number | null }, price: number, exitTime: number) {

    const tradeSymbol = this.productSymbol(position.symbol)

    const account = this.tradeHandler.getAccount()
    const exitContracts = Math.abs(position.contracts)
    const exitSide = practiceExitSide(position.contracts, position.type)
    const exitFillLine = practiceOrderLine(exitSide, exitContracts, tradeSymbol, price)
    const fees = practiceFillCommission(account?.rules, exitContracts, tradeSymbol)

    if (!this.tradeHandler.suppressCloseToasts) {
      showPracticeOrderToast(exitSide, exitFillLine)
    }

    const posId = this.resolvePositionId(position.symbol)
    const exitTimeSec = Math.floor(entryTimeToMs(exitTime) / 1000)

    const ws = this.tradeHandler.getAccountWs()
    if (!posId || !ws) {
      if (!this.tradeHandler.suppressCloseToasts) {
        aurenToast.error(!posId ? 'Could not close position' : 'Account connection unavailable')
      }
      super.handleClosePosition(position, price, exitTime)
      return
    }

    ws.closePosition({
      positionId: posId,
      exitPrice: price,
      exitTime: exitTimeSec,
      fees,
      forcedExit: this.tradeHandler.suppressCloseToasts,
    })
    this.positionIds.delete(position.symbol)
    for (const [key, id] of [...this.positionIds.entries()]) {
      if (id === posId) this.positionIds.delete(key)
    }

    super.handleClosePosition(position, price, exitTime)
  }



  handleUpdateStopLoss(
    price: number | null,
    oldPrice: number | null,
    position: { symbol: string; entry: number; contracts: number; stopLoss?: number | null; takeProfit?: number | null; entryTime: number; type: string },
    context?: string
  ) {
    if (this.shouldCloseOnBracketDrag(position, 'stopLoss', price, context)) {
      this.closePositionAtMarket(position)
      return
    }
    super.handleUpdateStopLoss(price, oldPrice, position, context)
    if (context === 'sync') return
    this.schedulePersistPosition(position)
  }

  handleUpdateTakeProfit(
    price: number | null,
    oldPrice: number | null,
    position: { symbol: string; entry: number; contracts: number; stopLoss?: number | null; takeProfit?: number | null; entryTime: number; type: string },
    context?: string
  ) {
    if (this.shouldCloseOnBracketDrag(position, 'takeProfit', price, context)) {
      this.closePositionAtMarket(position)
      return
    }
    super.handleUpdateTakeProfit(price, oldPrice, position, context)
    if (context === 'sync') return
    this.schedulePersistPosition(position)
  }

  /** Bracket dragged through market — close now instead of setting a working order. */
  private shouldCloseOnBracketDrag(
    position: { symbol: string; contracts: number },
    bracket: 'stopLoss' | 'takeProfit',
    price: number | null,
    context?: string
  ): boolean {
    if (context === 'sync' || context === 'onCancel' || price == null) return false
    const mark = this.getMarkForBracketClose(position.symbol)
    if (mark == null) return false
    const isLong = Number(position.contracts) > 0
    const entry = Number((position as { entry?: number }).entry)
    const tickSize = this.getDatafeed()?.getTickSize?.(position.symbol) ?? 0.25
    const pad = tickSize / 2
    if (bracket === 'takeProfit') {
      // Take profit must be on the profit side of entry; do not flatten when placing TP in profit zone.
      if (Number.isFinite(entry)) {
        return isLong ? price <= entry + pad : price >= entry - pad
      }
      return isLong ? price <= mark + pad : price >= mark - pad
    }
    return isLong ? price >= mark - pad : price <= mark + pad
  }

  private closePositionAtMarket(position: {
    symbol: string
    type: string
    entry: number
    contracts: number
    entryTime: number
    stopLoss?: number | null
    takeProfit?: number | null
  }): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
      this.pendingPersist = null
    }
    const mark = this.getMarkForBracketClose(position.symbol)
    if (mark == null) return
    const datafeed = this.getDatafeed()
    const lastBar = datafeed?.getLastBarForChart?.(this.chart)
    const exitTime = lastBar?.time ?? Date.now()
    this.handleClosePosition(position, mark, exitTime)
  }

  handleOpenPosition(
    position: {
      symbol: string
      entry: number
      contracts: number
      stopLoss?: number | null
      takeProfit?: number | null
      entryTime: number
      type: string
    },
    context?: string
  ) {
    super.handleOpenPosition(position)
    if (context === 'sync' || this.hydratingFromServer) return
    this.flushPersistPosition(position, 'open')
  }

  handleUpdateSize(
    oldSize: number,
    newSize: number,
    position: {
      symbol: string
      entry: number
      contracts: number
      stopLoss?: number | null
      takeProfit?: number | null
      entryTime: number
      type: string
    }
  ) {
    super.handleUpdateSize(oldSize, newSize, position)
    this.flushPersistPosition(position, 'modify')
  }

  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private pendingPersist: {
    symbol: string
    entry: number
    contracts: number
    stopLoss?: number | null
    takeProfit?: number | null
    entryTime: number
    type: string
    positionId?: string | null
  } | null = null

  /** Debounce SL/TP — one WS upsert after the line settles. */
  private schedulePersistPosition(position: {
    symbol: string
    entry: number
    contracts: number
    stopLoss?: number | null
    takeProfit?: number | null
    entryTime: number
    type: string
    positionId?: string | null
  }) {
    this.pendingPersist = position
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      const pending = this.pendingPersist
      this.pendingPersist = null
      if (pending) this.flushPersistPosition(pending, 'modify')
    }, 200)
  }

  private buildDbPosition(position: {
    symbol: string
    entry: number
    contracts: number
    stopLoss?: number | null
    takeProfit?: number | null
    entryTime: number
    type: string
    positionId?: string | null
  }) {
    const tradeSymbol = this.productSymbol(position.symbol)
    const cacheKey = position.symbol
    let existingId = this.positionIds.get(cacheKey) || position.positionId || undefined
    if (!existingId) {
      existingId =
        globalThis.crypto?.randomUUID?.() ??
        `pp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      this.positionIds.set(cacheKey, existingId)
      position.positionId = existingId
    }
    const entryTimeSec = Math.floor(entryTimeToMs(position.entryTime) / 1000)

    return {
      id: existingId,
      symbol: tradeSymbol,
      instrument: tradeSymbol,
      contracts: position.contracts,
      entry: position.entry,
      stopLoss: position.stopLoss ?? null,
      takeProfit: position.takeProfit ?? null,
      entryTime: entryTimeSec,
      type: (position.type === 'short' ? 'short' : 'long') as 'long' | 'short',
    }
  }

  private flushPersistPosition(
    position: {
    symbol: string
    entry: number
    contracts: number
    stopLoss?: number | null
    takeProfit?: number | null
    entryTime: number
    type: string
    positionId?: string | null
  },
    action: 'open' | 'modify'
  ) {
    if (!position.contracts) return
    const payload = this.buildDbPosition(position)
    const ws = this.tradeHandler.getAccountWs()
    if (!ws) {
      aurenToast.error('Account connection unavailable')
      return
    }
    if (action === 'open') ws.openPosition(payload)
    else ws.modifyPosition(payload)
  }

  clearLocalPositionIds(): void {
    this.positionIds.clear()
  }



  protected onPositionUplChange(pnl: number): void {
    this.tradeHandler.setUnrealizedPl(pnl)
  }

  protected onLiveBracketBar(
    cacheKey: string,
    bar: { close?: number; open?: number; time?: number }
  ): void {
    if (isBwcChartPanning()) return
    const mark = bar.close ?? bar.open
    if (mark == null || !Number.isFinite(mark)) return
    this.checkMarkBracketFills(cacheKey, mark, bar.time)
  }

  /** Keep cache SL/TP aligned with BWC widget.positionOverlay (source of truth on chart). */
  private mergeOverlayBracketsIntoCache(cacheKey: string): void {
    const widget = this.getWidget() as {
      positionOverlay?: {
        getPosition: () => {
          entry: number
          qty: number
          stopLoss: number | null
          takeProfit: number | null
        } | null
      }
    } | null
    const snap = widget?.positionOverlay?.getPosition()
    const position = this.cache.get(cacheKey)
    if (!snap || !position?.contracts) return
    if (Math.sign(snap.qty) !== Math.sign(Number(position.contracts))) return
    position.stopLoss = snap.stopLoss
    position.takeProfit = snap.takeProfit
  }

  async handlePriceUpdate(
    symbol: string,
    _entryPrice: number,
    bar: { close?: number; time?: number },
    _tickSize?: number,
    _tickValue?: number
  ) {
    if (isBwcChartPanning()) return

    const resolved = this.getPositionForActiveChart(symbol)
    const cacheKey = resolved?.key ?? symbol
    const mark = bar.close
    if (mark == null || !Number.isFinite(mark)) return
    if (resolved?.position) {
      this.checkMarkBracketFills(cacheKey, mark, bar.time)
    }
  }

  /** Backend closed the position (SL/TP bracket) — trade already recorded server-side. */
  applyServerBracketClose(
    productSymbol: string,
    exitPrice: number,
    exitTimeSec: number,
    _reason: 'stop_loss' | 'take_profit',
    positionId?: string | null
  ): void {
    void exitTimeSec
    const entry = this.findCacheEntryForProduct(productSymbol, positionId)
    if (!entry?.position?.contracts) return
    this.clearPositionFromChart(entry.key, entry.position, {
      toast: true,
      exitPrice,
      productSymbol,
    })
  }

  /** Server removed an open position (any close path). */
  applyServerPositionClose(productSymbol?: string | null, positionId?: string | null): void {
    const entry = this.findCacheEntryForProduct(String(productSymbol || ''), positionId)
    if (!entry?.position?.contracts) return
    this.clearPositionFromChart(entry.key, entry.position)
  }

  applyServerPositionUpdate(position: PracticePosition): void {
    const cacheKey = this.chartCacheKeyForProduct(position.symbol)
    this.positionIds.set(cacheKey, position.id)
    let existing = this.cache.get(cacheKey)
    if (!existing) {
      this.hydratingFromServer = true
      try {
        this.load(
          {
            [cacheKey]: {
              symbol: cacheKey,
              entry: position.entry,
              contracts: position.contracts,
              stopLoss: position.stopLoss,
              takeProfit: position.takeProfit,
              entryTime: Math.floor(entryTimeToMs(position.entryTime) / 1000),
              type: position.type,
              id: position.id,
              positionId: position.id,
            },
          },
          false
        )
      } finally {
        this.hydratingFromServer = false
      }
      existing = this.cache.get(cacheKey)
      this.scheduleReconcilePositionLines()
    }
    this.flushPendingBracketClose(cacheKey)
    if (!existing) return

    const unchanged =
      existing.entry === position.entry &&
      existing.contracts === position.contracts &&
      existing.stopLoss === position.stopLoss &&
      existing.takeProfit === position.takeProfit &&
      existing.entryTime === position.entryTime &&
      existing.type === position.type &&
      (existing as { positionId?: string }).positionId === position.id
    if (unchanged) return

    existing.entry = position.entry
    existing.contracts = position.contracts
    existing.stopLoss = position.stopLoss
    existing.takeProfit = position.takeProfit
    existing.entryTime = position.entryTime
    existing.type = position.type
    ;(existing as { positionId?: string }).positionId = position.id
    if (existing.line && typeof existing.line.updateStopLossLine === 'function' && position.stopLoss != null) {
      existing.line.updateStopLossLine(existing.entry, position.stopLoss, existing.contracts, false, 'sync')
    }
    if (existing.line && typeof existing.line.updateTakeProfitLine === 'function' && position.takeProfit != null) {
      existing.line.updateTakeProfitLine(existing.entry, position.takeProfit, existing.contracts, false, 'sync')
    }
  }

  didBarHitPrice(bar: { low?: number; high?: number }, price: number) {
    if (bar.low == null || bar.high == null) return false
    return price >= bar.low && price <= bar.high
  }



  onFlattenAllPosition() {
    this.flattenAllAtMarket((symbol, contracts) =>
      this.tradeHandler.getPositionMarkPrice(symbol, contracts)
    )
  }

  /** Close every open position at market using per-symbol marks (e.g. NQ while chart is MNQ). */
  flattenAllAtMarket(
    getMark: (cacheKey: string, contracts: number) => number | null
  ): void {
    const datafeed = this.getDatafeed()
    const lastBar = datafeed?.getLastBarForChart?.(this.chart)
    const chartFallback = lastBar?.close ?? null
    const exitTime = lastBar?.time ?? Date.now()

    for (const [symbol, position] of [...this.cache.entries()]) {
      if (!position?.contracts) continue
      const qty = Math.abs(Number(position.contracts))
      if (qty <= 0) continue
      const mark =
        getMark(symbol, Number(position.contracts)) ??
        chartFallback ??
        Number(position.entry)
      this.onClosePosition(symbol, qty, mark, exitTime)
    }

    this.positionIds.clear()
    this.tradeHandler.setUnrealizedPl(0)
  }

}


