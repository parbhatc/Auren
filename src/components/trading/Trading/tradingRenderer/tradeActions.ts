import { TradingHandler } from '../../../../services/trading/TradingHandler'
import { aurenToast } from '../../../../utils/aurenToast'

export type TradeActionExtra = {
  quantity?: number
  symbol?: string
  stopLoss?: number | null
  takeProfit?: number | null
  stopLossMode?: 'hard' | 'soft'
  softStopTrigger?: 'bar_close'
  softStopResolution?: string
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
    const requestedQuantity = Number(extra?.quantity)
    const payload = {
      quantity:
        Number.isFinite(requestedQuantity) && requestedQuantity > 0
          ? Math.floor(requestedQuantity)
          : qty,
      symbol: extra?.symbol || tradeRoot,
      ...(action === 'Buy' || action === 'Sell'
        ? {
            orderType: extra?.orderType,
            entryPrice: extra?.entryPrice,
            stopLoss: extra?.stopLoss ?? null,
            takeProfit: extra?.takeProfit ?? null,
            stopLossMode: extra?.stopLossMode ?? 'hard',
            softStopTrigger: extra?.softStopTrigger ?? 'bar_close',
            softStopResolution: extra?.softStopResolution,
          }
        : {}),
    }
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
