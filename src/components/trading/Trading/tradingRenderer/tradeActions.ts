import { TradingHandler } from '../../../../services/trading/TradingHandler'
import { aurenToast } from '../../../../utils/aurenToast'

export type TradeActionExtra = {
  stopLoss?: number | null
  takeProfit?: number | null
  orderType?: 'market' | 'limit' | 'stop'
  entryPrice?: number
}

export type RunTradeContext = {
  tradingBlocked: boolean
  contractQuantity: number | string
  practiceMode?: boolean
  practiceAccountId?: string
  getTradeHandler: () => any
  getTradePadRoot: () => string
}

export function createRunTrade(ctx: RunTradeContext) {
  return (action: string, extra?: TradeActionExtra) => {
    if (ctx.tradingBlocked) {
      aurenToast.warning('Market data offline', 'Reconnect the stream before trading')
      return
    }
    const qty = Number(ctx.contractQuantity) || 1
    const handler = ctx.getTradeHandler()
    const tradeRoot = ctx.getTradePadRoot()
    const payload =
      ctx.practiceMode && ctx.practiceAccountId
        ? {
            quantity: qty,
            symbol: tradeRoot,
            ...(action === 'Buy' || action === 'Sell'
              ? {
                  orderType: extra?.orderType,
                  entryPrice: extra?.entryPrice,
                  stopLoss: extra?.stopLoss ?? null,
                  takeProfit: extra?.takeProfit ?? null,
                }
              : {}),
          }
        : action === 'Buy' || action === 'Sell'
          ? {
              quantity: qty,
              symbol: tradeRoot,
              orderType: extra?.orderType,
              entryPrice: extra?.entryPrice,
              stopLoss: extra?.stopLoss ?? null,
              takeProfit: extra?.takeProfit ?? null,
            }
          : undefined
    if (handler) {
      void handler.logButtonPress(action, payload)
    } else if (payload) {
      TradingHandler.logButtonPress(action, payload)
    } else {
      TradingHandler.logButtonPress(action)
    }
  }
}

export function logTradeIfAllowed(
  tradingBlocked: boolean,
  action: () => void
): void {
  if (tradingBlocked) {
    aurenToast.warning('Market data offline', 'Reconnect the stream before trading')
    return
  }
  action()
}
