import {
  clearChartContextActions,
  registerChartContextActions,
  type ChartContextAction,
} from 'tradingview-chart/components/common/ChartContextMenu'

const QUANTITIES = [1, 2, 3, 4, 5, 10, 15]

export type TradeContextHandlers = {
  onMarketBuy?: (quantity: number, price: number, time?: number) => void
  onMarketSell?: (quantity: number, price: number, time?: number) => void
  onLimitBuy?: (quantity: number, limitPrice: number, price: number, time?: number) => void
  onStopSell?: (quantity: number, stopPrice: number, price: number, time?: number) => void
}

/** Wire practice/live trade actions into the package chart context menu. */
export function registerTradeContextActions(handlers: TradeContextHandlers): void {
  const actions: ChartContextAction[] = []

  if (handlers.onMarketBuy) {
    actions.push({
      id: 'market-buy',
      label: 'Market Buy',
      quantities: QUANTITIES,
      onClick: ({ quantity, price, time }) => handlers.onMarketBuy!(quantity, price, time),
    })
  }

  if (handlers.onMarketSell) {
    actions.push({
      id: 'market-sell',
      label: 'Market Sell',
      quantities: QUANTITIES,
      onClick: ({ quantity, price, time }) => handlers.onMarketSell!(quantity, price, time),
    })
  }

  if (handlers.onLimitBuy) {
    actions.push({
      id: 'limit-buy',
      label: 'Limit Buy',
      quantities: QUANTITIES,
      onClick: ({ quantity, price, time }) =>
        handlers.onLimitBuy!(quantity, price, price, time),
    })
  }

  if (handlers.onStopSell) {
    actions.push({
      id: 'stop-sell',
      label: 'Stop Sell',
      quantities: QUANTITIES,
      onClick: ({ quantity, price, time }) =>
        handlers.onStopSell!(quantity, price, price, time),
    })
  }

  registerChartContextActions(actions)
}

export function clearTradeContextActions(): void {
  clearChartContextActions()
}
