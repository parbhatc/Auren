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
  BRACKET_REPLAY_RESOLUTION,
  clearBracketCheckpoint,
  entryTimeToMs,
  findBracketExitInBars,
  readBracketCheckpointSec,
  writeBracketCheckpointSec,
} from './practiceBracketReplay'
import {
  barMatchesSnapshot,
  formatSnapshotTime,
  parseBracketSnapshot,
  replayFromSecForSnapshot,
  type PracticeBracketSnapshot,
} from './practiceBracketSnapshot'

import type { TradeseaDatafeed } from '../tradesea/TradeseaDatafeed'



export class PracticeTradeCache extends ChartTradeCache {

  private accountId: string

  private positionIds = new Map<string, string>()

  private lastSnapshotPersistMs = new Map<string, number>()



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

      id,

      stopLossOrderId,

      takeProfitOrderId

    )

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

        bracketSnapshot: p.bracketSnapshot ?? null,

      }

    }

    if (Object.keys(data).length) {

      this.load(data, true)

    }

    this.reconcilePositionLines()
  }

  private chartResolution(): string {
    try {
      return String((this.chart as { resolution?: () => string })?.resolution?.() || '1')
    } catch {
      return '1'
    }
  }

  private buildSnapshotFromBar(
    bar: { time?: number; open?: number; high?: number; low?: number; close?: number },
    resolution: string,
    reason: PracticeBracketSnapshot['reason']
  ): PracticeBracketSnapshot | null {
    const barTimeMs = entryTimeToMs(bar.time ?? Date.now())
    const open = bar.open ?? bar.close
    const high = bar.high ?? bar.close
    const low = bar.low ?? bar.close
    const close = bar.close
    if (open == null || high == null || low == null || close == null) return null

    return {
      barTimeSec: Math.floor(barTimeMs / 1000),
      barTimeMs,
      barTimeLabel: formatSnapshotTime(barTimeMs),
      open,
      high,
      low,
      close,
      resolution,
      recordedAtSec: Math.floor(Date.now() / 1000),
      reason,
    }
  }

  async persistBracketSnapshot(
    cacheKey: string,
    reason: PracticeBracketSnapshot['reason'],
    barOverride?: { time?: number; open?: number; high?: number; low?: number; close?: number }
  ): Promise<void> {
    const position = this.cache.get(cacheKey)
    if (!position?.contracts) return
    const stopLoss = position.stopLoss as number | null
    const takeProfit = position.takeProfit as number | null
    if (stopLoss == null && takeProfit == null) return

    const positionId = this.positionIds.get(cacheKey)
    if (!positionId) return

    const datafeed = this.getDatafeed()
    const resolution = this.chartResolution()
    const lastBar = barOverride ?? datafeed?.getLastBarForChart?.(this.chart)
    if (!lastBar) return

    const snapshot = this.buildSnapshotFromBar(lastBar, resolution, reason)
    if (!snapshot) return

    position.bracketSnapshot = snapshot

    console.info('[PracticeBracket] snapshot', {
      reason,
      cacheKey,
      positionId,
      candle: snapshot.barTimeLabel,
      barTimeSec: snapshot.barTimeSec,
      resolution: snapshot.resolution,
      ohlc: { o: snapshot.open, h: snapshot.high, l: snapshot.low, c: snapshot.close },
    })

    try {
      await practiceAPI.saveBracketSnapshot(this.accountId, positionId, snapshot)
    } catch (err) {
      console.warn('[PracticeBracket] failed to save snapshot', err)
    }
  }

  async saveBracketSnapshotsForOpenPositions(
    reason: PracticeBracketSnapshot['reason']
  ): Promise<void> {
    const tasks: Promise<void>[] = []
    for (const [cacheKey, position] of this.cache.entries()) {
      if (!position?.contracts) continue
      if (position.stopLoss == null && position.takeProfit == null) continue
      tasks.push(this.persistBracketSnapshot(cacheKey, reason))
    }
    await Promise.all(tasks)
  }

  /**
   * After MDS reconnect: replay 1s bars only after the last saved candle (+3s), not from entry.
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

      const entrySec = Math.floor(entryTimeToMs(position.entryTime as number) / 1000)
      const snapshot = parseBracketSnapshot(position.bracketSnapshot)
      const checkpointSec = readBracketCheckpointSec(this.accountId, cacheKey)

      let replayFromSec = replayFromSecForSnapshot(snapshot, entrySec, nowSec)
      if (checkpointSec != null) {
        replayFromSec = Math.max(replayFromSec, checkpointSec)
      }

      if (snapshot) {
        const { tickSize } = this.resolveTicks(cacheKey)
        const anchorBars = await datafeed.fetchHistoryBars(
          cacheKey,
          BRACKET_REPLAY_RESOLUTION,
          snapshot.barTimeSec,
          snapshot.barTimeSec + 2
        )
        const anchor = anchorBars.find(
          (b) => Math.abs(Math.floor(b.time / 1000) - snapshot.barTimeSec) <= 2
        )
        if (anchor && !barMatchesSnapshot(anchor, snapshot, tickSize)) {
          replayFromSec = Math.max(entrySec, snapshot.barTimeSec)
          console.info('[PracticeBracket] saved candle changed — replay from snapshot time', {
            cacheKey,
            saved: snapshot.barTimeLabel,
            savedOhlc: { o: snapshot.open, h: snapshot.high, l: snapshot.low, c: snapshot.close },
            liveOhlc: { o: anchor.open, h: anchor.high, l: anchor.low, c: anchor.close },
          })
        }
      }

      if (nowSec <= replayFromSec + 1) {
        console.info('[PracticeBracket] reconcile skipped (too soon)', { cacheKey, replayFromSec, nowSec })
        continue
      }

      const bars = await datafeed.fetchHistoryBars(
        cacheKey,
        BRACKET_REPLAY_RESOLUTION,
        replayFromSec,
        nowSec
      )

      const replayFromMs = replayFromSec * 1000
      const filtered = bars.filter((b) => b.time >= replayFromMs)

      console.info('[PracticeBracket] reconcile', {
        cacheKey,
        replayFromSec,
        replayFromLabel: formatSnapshotTime(replayFromSec * 1000),
        barCount: filtered.length,
        snapshot: snapshot
          ? {
              candle: snapshot.barTimeLabel,
              reason: snapshot.reason,
              ohlc: { o: snapshot.open, h: snapshot.high, l: snapshot.low, c: snapshot.close },
            }
          : null,
        stopLoss,
        takeProfit,
      })

      const isLong = contracts > 0
      const exit = findBracketExitInBars(filtered, isLong, stopLoss, takeProfit)
      if (exit) {
        console.info('[PracticeBracket] replay exit', { cacheKey, exit })
        clearBracketCheckpoint(this.accountId, cacheKey)
        this.onClosePosition(cacheKey, Math.abs(contracts), exit.price, exit.time)
        return
      }

      writeBracketCheckpointSec(this.accountId, cacheKey, nowSec)
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

        entryTime: Math.floor(entryTimeToMs(position.entryTime) / 1000),

        exitTime: Math.floor(entryTimeToMs(exitTime) / 1000),

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

    if (stopLoss != null || takeProfit != null) {
      const barSec = bar.time != null ? Math.floor(entryTimeToMs(bar.time) / 1000) : Math.floor(Date.now() / 1000)
      writeBracketCheckpointSec(this.accountId, symbol, barSec)

      const now = Date.now()
      const lastPersist = this.lastSnapshotPersistMs.get(symbol) ?? 0
      if (now - lastPersist >= 15_000) {
        this.lastSnapshotPersistMs.set(symbol, now)
        void this.persistBracketSnapshot(symbol, 'live_bar', bar)
      }
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


