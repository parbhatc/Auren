export type TradeContextHandlers = {
  onMarketBuy?: (quantity: number, price: number, time?: number) => void
  onMarketSell?: (quantity: number, price: number, time?: number) => void
  onAutoBuy?: (price: number, time?: number) => void
  onAutoSell?: (price: number, time?: number) => void
  onLimitBuy?: (quantity: number, limitPrice: number, price: number, time?: number) => void
  onStopSell?: (quantity: number, stopPrice: number, price: number, time?: number) => void
}

export type ChartAutoTradeSide = 'buy' | 'sell'

export type ChartAutoTradeRequest = {
  side: ChartAutoTradeSide
  accountId?: string
  requestId: number
}

export const CHART_AUTO_TRADE_REQUESTED = 'auren:chart-auto-trade-requested'

let nextAutoTradeRequestId = 0

export function requestChartAutoTrade(side: ChartAutoTradeSide, accountId?: string): void {
  if (typeof window === 'undefined') return
  nextAutoTradeRequestId += 1
  window.dispatchEvent(new CustomEvent<ChartAutoTradeRequest>(CHART_AUTO_TRADE_REQUESTED, {
    detail: {
      side,
      accountId: String(accountId || '').trim() || undefined,
      requestId: nextAutoTradeRequestId,
    },
  }))
}

type BwcHostHooks = {
  registerTradeContextActions: (handlers: TradeContextHandlers) => void
  clearChartContextActions: () => void
}

let hostHooks: BwcHostHooks | null = null

/** Called from AurenChart after loading BetterweightChartPro sdk (src/chart/aurenChartBoot.ts). */
export function bindBwcTradeContextHooks(hooks: BwcHostHooks): void {
  hostHooks = hooks
}

export function registerTradeContextActions(handlers: TradeContextHandlers): void {
  hostHooks?.registerTradeContextActions(handlers)
}

export function clearChartContextActions(): void {
  hostHooks?.clearChartContextActions()
}
