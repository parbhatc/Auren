import type ChartTradeCache from '../components/common/ChartTradeCache'
import { isBwcChartPanning } from '../utils/bwcPan'

export type BwcPositionSnapshot = {
  entry: number
  qty: number
  stopLoss: number | null
  takeProfit: number | null
}

export type BwcPositionPresentation = {
  symbolLabel?: string | null
  quantityLabel?: string | null
  tickSize?: number | null
  tickValue?: number | null
}

export type BwcPositionOverlayApi = {
  buy: (priceOrOpts?: number | { price?: number; qty?: number }) => Promise<unknown>
  sell: (priceOrOpts?: number | { price?: number; qty?: number }) => Promise<unknown>
  clear: () => void
  clearStopLoss: () => boolean
  clearTakeProfit: () => boolean
  setStopLoss: (price: number | null) => Promise<unknown>
  setTakeProfit: (price: number | null) => Promise<unknown>
  getPosition: () => BwcPositionSnapshot | null
  modifyPosition?: (opts: { entry: number; qty: number }) => Promise<unknown> | unknown
  refreshLayout?: () => number
  setMarkPrice?: (price: number) => boolean
  setPresentation?: (presentation: BwcPositionPresentation) => BwcPositionPresentation
  onClose: (cb: (snapshot: BwcPositionSnapshot) => void) => () => void
  onStopLossChanged: (cb: (oldPrice: number | null, newPrice: number | null) => void) => () => void
  onTakeProfitChanged: (cb: (oldPrice: number | null, newPrice: number | null) => void) => () => void
}

type BwcWidgetWithOverlay = {
  positionOverlay?: BwcPositionOverlayApi
  onLiveBar?: (cb: (bar: { close?: number; open?: number }) => void) => () => void
  chart?: () => unknown
}

export type { BwcWidgetWithOverlay }

type LineType = 'position' | 'stop_loss' | 'take_profit'

/** Compat shim so ChartTradeCache can keep its existing `position.line` API. */
export class BwcPositionLineHandle {
  constructor(
    private readonly bridge: BwcPositionBridge,
    private readonly symbol: string
  ) {}

  private active(): boolean {
    return this.bridge.isActiveSymbol(this.symbol)
  }

  get(type: LineType): { hasTvLine?: () => boolean; getPrice?: () => number } | undefined {
    if (!this.active()) return undefined
    const snap = this.bridge.getOverlay()?.getPosition()
    if (!snap) return undefined
    if (type === 'position') {
      return {
        hasTvLine: () => Boolean(snap),
        getPrice: () => snap.entry,
      }
    }
    if (type === 'stop_loss') {
      return { hasTvLine: () => snap.stopLoss != null }
    }
    if (type === 'take_profit') {
      return { hasTvLine: () => snap.takeProfit != null }
    }
    return undefined
  }

  updatePositionLine(
    entry: number,
    markOrContracts: number,
    contractsOrType: number | string
  ): boolean {
    if (!this.active()) return false
    // ChartTradeCache has two legacy call shapes:
    //   (entry, mark, signedContracts) while scaling in, and
    //   (entry, signedContracts, positionType) after a partial close.
    // Reading the third argument unconditionally turned "short" into the
    // quantity, causing BWC to clear the position overlay after closing one
    // contract even though the host cache still held the remainder.
    const thirdArgContracts = Number(contractsOrType)
    const contracts = Number.isFinite(thirdArgContracts)
      ? thirdArgContracts
      : Number(markOrContracts)
    if (!Number.isFinite(contracts) || contracts === 0) return false
    const position = this.bridge.tradeCache.getPosition(this.symbol) as {
      stopLoss?: number | null
      takeProfit?: number | null
    } | null
    void this.bridge.sync(
      this.symbol,
      entry,
      contracts,
      position?.stopLoss ?? null,
      position?.takeProfit ?? null
    )
    return true
  }

  updateStopLossLine(
    entry: number,
    price: number | null | undefined,
    contracts: number,
    createIfNotFound = false,
    context?: string,
    createBrackets = true
  ): boolean {
    if (!this.active()) return false
    return this.bridge.updateStopLoss(
      this.symbol,
      entry,
      price ?? null,
      contracts,
      createIfNotFound,
      context,
      createBrackets
    )
  }

  updateTakeProfitLine(
    entry: number,
    price: number | null | undefined,
    contracts: number,
    createIfNotFound = false,
    context?: string,
    createBrackets = true
  ): boolean {
    if (!this.active()) return false
    return this.bridge.updateTakeProfit(
      this.symbol,
      entry,
      price ?? null,
      contracts,
      createIfNotFound,
      context,
      createBrackets
    )
  }

  onSizeUpdate(entry: number, newSize: number): void {
    if (!this.active()) return
    const position = this.bridge.tradeCache.getPosition(this.symbol) as { stopLoss?: number | null; takeProfit?: number | null } | undefined
    void this.bridge.sync(this.symbol, entry, newSize, position?.stopLoss ?? null, position?.takeProfit ?? null)
  }

  remove(type: LineType): void {
    if (!this.active()) return
    const overlay = this.bridge.getOverlay()
    if (!overlay) return
    if (type === 'position') this.bridge.clear()
    else if (type === 'stop_loss') overlay.clearStopLoss()
    else if (type === 'take_profit') overlay.clearTakeProfit()
  }

  removeAll(): void {
    if (!this.active()) return
    this.bridge.clear()
  }

  clear(): void {
    this.removeAll()
  }
}

export class BwcPositionBridge {
  private wired = false
  private activeSymbol: string | null = null
  private readonly handles = new Map<string, BwcPositionLineHandle>()
  private offLiveBar: (() => void) | null = null
  private syncRevision = 0
  private syncQueue: Promise<void> = Promise.resolve()
  private suppressedCloseEvents = 0

  constructor(
    private readonly widget: BwcWidgetWithOverlay,
    readonly tradeCache: ChartTradeCache,
    private readonly onUplChange: (pnl: number) => void
  ) {}

  getOverlay(): BwcPositionOverlayApi | null {
    return this.widget.positionOverlay ?? null
  }

  isActiveSymbol(symbol: string): boolean {
    return this.activeSymbol === symbol
  }

  updateMarkPrice(mark: number): void {
    if (!Number.isFinite(mark)) return
    this.getOverlay()?.setMarkPrice?.(mark)
  }

  createCompatHandle(symbol: string): BwcPositionLineHandle {
    let handle = this.handles.get(symbol)
    if (!handle) {
      handle = new BwcPositionLineHandle(this, symbol)
      this.handles.set(symbol, handle)
    }
    return handle
  }

  wire(): void {
    if (this.wired) return
    const overlay = this.getOverlay()
    if (!overlay) return

    overlay.onClose(() => {
      if (this.suppressedCloseEvents > 0) {
        this.suppressedCloseEvents -= 1
        return
      }
      const symbol = this.activeSymbol
      if (!symbol) return
      const position = this.tradeCache.getPosition(symbol) as {
        entry?: number
        contracts?: number
      } | null
      if (!position?.contracts) return
      const datafeed = this.tradeCache.getDatafeed()
      const bar = datafeed?.getLastBarForChart?.(this.tradeCache.getChart())
      const price = bar?.close ?? position.entry ?? 0
      const exitTime = bar?.time ?? Date.now()
      const qty = Math.abs(Number(position.contracts))
      this.tradeCache.onClosePosition(symbol, qty, price, exitTime, 'onCancel')
    })

    overlay.onStopLossChanged((_old, newPrice) => {
      const symbol = this.activeSymbol
      if (!symbol) return
      if (newPrice == null) this.tradeCache.updateStopLoss(symbol, null, 'onCancel')
      else this.tradeCache.updateStopLoss(symbol, newPrice, 'onUpdate')
    })

    overlay.onTakeProfitChanged((_old, newPrice) => {
      const symbol = this.activeSymbol
      if (!symbol) return
      if (newPrice == null) this.tradeCache.updateTakeProfit(symbol, null, 'onCancel')
      else this.tradeCache.updateTakeProfit(symbol, newPrice, 'onUpdate')
    })

    if (!this.offLiveBar && typeof this.widget.onLiveBar === 'function') {
      this.offLiveBar = this.widget.onLiveBar((bar) => {
        if (isBwcChartPanning()) return
        const active = this.tradeCache.getActivePositionForUpl()
        if (!active) return
        const mark = bar.close ?? bar.open
        if (mark == null) return
        const pnl = this.tradeCache.calcMarkPnl(active.key, active.entry, mark, active.contracts)
        this.onUplChange(pnl)
        this.tradeCache.notifyLiveBracketBar(active.key, {
          close: bar.close,
          open: bar.open,
          time: (bar as { time?: number }).time,
        })
      })
    }

    this.wired = true
  }

  clear(): void {
    this.syncRevision += 1
    this.clearOverlayProgrammatically()
    this.activeSymbol = null
  }

  private clearOverlayProgrammatically(
    overlay = this.getOverlay()
  ): void {
    if (!overlay) return
    this.suppressedCloseEvents += 1
    overlay.clear()
    // BWC currently emits close synchronously. Expire an unused guard so a
    // later user click can never be mistaken for this programmatic clear.
    setTimeout(() => {
      if (this.suppressedCloseEvents > 0) this.suppressedCloseEvents -= 1
    }, 0)
  }

  async sync(
    symbol: string,
    entry: number,
    contracts: number,
    stopLoss: number | null,
    takeProfit: number | null,
    opts: { createBrackets?: boolean; presentation?: BwcPositionPresentation | null } = {}
  ): Promise<void> {
    const overlay = this.getOverlay()
    if (!overlay) return

    this.wire()
    if (opts.presentation) this.getOverlay()?.setPresentation?.(opts.presentation)
    this.activeSymbol = symbol
    const revision = ++this.syncRevision
    const run = () =>
      this.performSync(
        revision,
        symbol,
        entry,
        contracts,
        stopLoss,
        takeProfit,
        opts
      )
    const queued = this.syncQueue.then(run, run)
    this.syncQueue = queued.catch(() => undefined)
    return queued
  }

  private async performSync(
    revision: number,
    symbol: string,
    entry: number,
    contracts: number,
    stopLoss: number | null,
    takeProfit: number | null,
    opts: { createBrackets?: boolean; presentation?: BwcPositionPresentation | null }
  ): Promise<void> {
    const overlay = this.getOverlay()
    if (!overlay || revision !== this.syncRevision || this.activeSymbol !== symbol) return

    const createBrackets = opts.createBrackets !== false
    const cachedPosition = this.tradeCache.getPosition(symbol) as {
      stopLoss?: number | null
      takeProfit?: number | null
    } | null
    // A queued sync can start after the user has already dragged a bracket.
    // Always prefer the live cache over the prices captured when sync() was
    // enqueued so an older chart task cannot restore a stale exit level.
    const desiredStopLoss = cachedPosition
      ? cachedPosition.stopLoss ?? null
      : stopLoss
    const desiredTakeProfit = cachedPosition
      ? cachedPosition.takeProfit ?? null
      : takeProfit
    const current = overlay.getPosition()
    const unchanged =
      current?.entry === entry &&
      current.qty === contracts &&
      (!createBrackets ||
        (current.stopLoss === desiredStopLoss &&
          current.takeProfit === desiredTakeProfit))
    if (unchanged) return

    const sameSide =
      current &&
      current.qty !== 0 &&
      Math.sign(current.qty) === Math.sign(contracts)

    if (
      sameSide &&
      overlay.modifyPosition &&
      (current.entry !== entry || current.qty !== contracts)
    ) {
      await overlay.modifyPosition({ entry, qty: contracts })
    } else if (
      !current ||
      current.entry !== entry ||
      current.qty !== contracts ||
      !sameSide
    ) {
      this.clearOverlayProgrammatically(overlay)
      // `setMarkPrice` is intentionally sticky so the host can drive the
      // executable mark between candle paints. A mark from the previous
      // position must not be reused for a new fill, otherwise a fresh replay
      // trade can display non-zero UPL before the next bar is requested.
      overlay.setMarkPrice?.(entry)
      const qty = Math.abs(contracts)
      if (contracts > 0) await overlay.buy({ price: entry, qty })
      else if (contracts < 0) await overlay.sell({ price: entry, qty })
    }

    if (revision !== this.syncRevision || this.activeSymbol !== symbol) {
      // A close occurred while the async overlay mutation was in flight.
      // Newer syncs are queued behind this one, so clearing here cannot erase
      // a replacement position.
      this.clearOverlayProgrammatically(overlay)
      return
    }

    if (!createBrackets) return

    const snap = overlay.getPosition()
    if (desiredStopLoss != null) {
      if (snap?.stopLoss !== desiredStopLoss) {
        await overlay.setStopLoss(desiredStopLoss)
      }
    } else if (snap?.stopLoss != null) {
      overlay.clearStopLoss()
    }

    if (desiredTakeProfit != null) {
      if (snap?.takeProfit !== desiredTakeProfit) {
        await overlay.setTakeProfit(desiredTakeProfit)
      }
    } else if (snap?.takeProfit != null) {
      overlay.clearTakeProfit()
    }

    if (revision !== this.syncRevision || this.activeSymbol !== symbol) {
      this.clearOverlayProgrammatically(overlay)
      return
    }

    this.getOverlay()?.refreshLayout?.()
  }

  updateStopLoss(
    symbol: string,
    _entry: number,
    price: number | null,
    _contracts: number,
    _createIfNotFound: boolean,
    context?: string,
    createBrackets = true
  ): boolean {
    if (!createBrackets) {
      this.tradeCache.updateStopLoss(symbol, price, context)
      return false
    }
    const overlay = this.getOverlay()
    if (!overlay || !this.isActiveSymbol(symbol)) return false

    if (price == null) {
      overlay.clearStopLoss()
      if (context !== 'sync') this.tradeCache.updateStopLoss(symbol, null, context)
      return true
    }
    if (context === 'sync') {
      void overlay.setStopLoss(price)
      return true
    }
    this.tradeCache.updateStopLoss(symbol, price, context)
    void overlay.setStopLoss(price)
    return true
  }

  updateTakeProfit(
    symbol: string,
    _entry: number,
    price: number | null,
    _contracts: number,
    _createIfNotFound: boolean,
    context?: string,
    createBrackets = true
  ): boolean {
    if (!createBrackets) {
      this.tradeCache.updateTakeProfit(symbol, price, context)
      return false
    }
    const overlay = this.getOverlay()
    if (!overlay || !this.isActiveSymbol(symbol)) return false

    if (price == null) {
      overlay.clearTakeProfit()
      if (context !== 'sync') this.tradeCache.updateTakeProfit(symbol, null, context)
      return true
    }
    if (context === 'sync') {
      void overlay.setTakeProfit(price)
      return true
    }
    this.tradeCache.updateTakeProfit(symbol, price, context)
    void overlay.setTakeProfit(price)
    return true
  }
}
