import { TradeseaTradeOrder } from './tradeseaTradesMessages'
import { debugTradeseaSl } from './tradeseaDebug'

let lastBracketLogKey = ''

export function isActiveBracketOrder(order: TradeseaTradeOrder): boolean {
  const status = String(order.status || '').toLowerCase()
  if (
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'filled' ||
    status === 'rejected' ||
    status === 'expired' ||
    status === 'inactive'
  ) {
    return false
  }
  return status === 'working' || status === 'placing' || status === 'pending'
}

export function bracketOrdersForPosition(
  orders: TradeseaTradeOrder[],
  positionId: string
): { stopLoss?: TradeseaTradeOrder; takeProfit?: TradeseaTradeOrder } {
  if (!positionId) return {}

  let stopLoss: TradeseaTradeOrder | undefined
  let takeProfit: TradeseaTradeOrder | undefined

  for (const order of orders) {
    if (order.parentId !== positionId || order.parentType !== 'position') continue
    if (!isActiveBracketOrder(order)) continue

    const type = String(order.type || '').toLowerCase()
    if (type === 'stop' || type === 'stoplimit') {
      stopLoss = order
    } else if (type === 'limit') {
      takeProfit = order
    }
  }

  const bracketKey = `${positionId}|${stopLoss?.id ?? ''}|${stopLoss?.stopPrice ?? ''}|${takeProfit?.id ?? ''}|${takeProfit?.limitPrice ?? ''}`
  if (bracketKey !== lastBracketLogKey) {
    lastBracketLogKey = bracketKey
    debugTradeseaSl('brackets:resolve', {
      positionId,
      stopLoss: stopLoss
        ? { id: stopLoss.id, status: stopLoss.status, stopPrice: stopLoss.stopPrice }
        : null,
      takeProfit: takeProfit
        ? { id: takeProfit.id, status: takeProfit.status, limitPrice: takeProfit.limitPrice }
        : null,
      parentOrders: orders.filter((o) => o.parentId === positionId).map((o) => ({
        id: o.id,
        type: o.type,
        status: o.status,
        stopPrice: o.stopPrice,
        limitPrice: o.limitPrice,
      })),
    })
  }

  return { stopLoss, takeProfit }
}