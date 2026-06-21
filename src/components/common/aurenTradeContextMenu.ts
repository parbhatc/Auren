export type TradeContextHandlers = {
  onMarketBuy?: (quantity: number, price: number, time?: number) => void
  onMarketSell?: (quantity: number, price: number, time?: number) => void
  onLimitBuy?: (quantity: number, limitPrice: number, price: number, time?: number) => void
  onStopSell?: (quantity: number, stopPrice: number, price: number, time?: number) => void
}

type BwcHostHooks = {
  registerTradeContextActions: (handlers: TradeContextHandlers) => void
  clearChartContextActions: () => void
}

let hostHooks: BwcHostHooks | null = null

/** Called from AurenChart after loading BetterweightChart sdk (src/chart/aurenChartBoot.ts). */
export function bindBwcTradeContextHooks(hooks: BwcHostHooks): void {
  hostHooks = hooks
}

export function registerTradeContextActions(handlers: TradeContextHandlers): void {
  hostHooks?.registerTradeContextActions(handlers)
}

export function clearChartContextActions(): void {
  hostHooks?.clearChartContextActions()
}
