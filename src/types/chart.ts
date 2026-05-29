/**
 * TradingView chart types — re-exported from tradingview-chart package, plus Auren extensions.
 */
export * from 'tradingview-chart/types/chart'
import type { TradingViewChartProps as TradingViewChartPropsBase } from 'tradingview-chart/types/chart'

export type TradingViewChartProps = TradingViewChartPropsBase & {
  containerId?: string
  accountId?: string
  practiceAccountId?: string
  tradeseaServices?: Record<string, unknown> | null
  tradeseaTradeHandler?: {
    handleSymbolChange(symbol: string): void
    onReady(widget: unknown, datafeed?: unknown): void
    logButtonPress?(label: string, details?: Record<string, unknown>): void | Promise<void>
    placeLimitOrder?(side: string, quantity: number, price: number): void | Promise<void>
  }
}
