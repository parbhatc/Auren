import ChartPositionLine from '../components/common/ChartPositionLine'
import { sideToChartAction } from '../constants/tradingSide'
import type { OrderSide } from '../types/order'

export type PositionLineContext = {
  chart: unknown
  datafeed?: unknown
  symbol: string
}

export type WorkingOrderLineOptions = PositionLineContext & {
  price: number
  quantity: number
  side: OrderSide
  orderType?: 'limit' | 'stop'
  onCancel?: () => void
}

export type PositionBundleOptions = PositionLineContext & {
  entry: number
  mark: number
  contracts: number
  stopLoss?: number | null
  takeProfit?: number | null
  onClose?: () => void
  onStopLossMove?: (price: number) => void
  onTakeProfitMove?: (price: number) => void
}

/** Pending limit/stop line on chart — simpler than constructing ChartPositionLine manually. */
export async function createWorkingOrderLine(opts: WorkingOrderLineOptions) {
  const manager = new ChartPositionLine({
    symbol: opts.symbol,
    price: opts.price,
    entryPrice: opts.price,
    contracts: opts.side === 'buy' ? opts.quantity : -opts.quantity,
    lineType: 'position',
    chart: opts.chart as any,
    datafeed: opts.datafeed,
  })

  const tvLine = await manager.createWorkingOrder({
    price: opts.price,
    quantity: opts.quantity,
    side: opts.side,
    orderType: opts.orderType ?? 'limit',
    onCancel: opts.onCancel,
  })

  return tvLine ? { manager, tvLine } : null
}

/** Re-export for callers that still need the class. */
export { ChartPositionLine, sideToChartAction }
