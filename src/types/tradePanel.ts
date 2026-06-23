import type { OrderSide, OrderType } from './order'
import type { TradeseaMarketBook } from '../services/tradesea/tradeseaMarketBook'
import type { DomPositionContext } from '../services/tradesea/tradeseaPnL'
import type { TradingMode } from './tradingMode'

export type TradePanelTab = 'quick' | 'dom' | 'ticket'

/** @deprecated use TradePanelTab */
export type PadTab = TradePanelTab

/** @deprecated use TradePanelTab */
export type PracticeTradePanelTab = TradePanelTab

export type TradePanelSettings = {
  hideBuySell: boolean
  hideJoinBidAsk: boolean
  hideClosePosition: boolean
  hideReverse: boolean
  hideCancelAll: boolean
  hideFlattenAll: boolean
}

/** @deprecated use TradePanelSettings */
export type PracticeTradePanelSettings = TradePanelSettings

export type BracketOptions = {
  stopLoss: number | null
  takeProfit: number | null
}

/** @deprecated use BracketOptions */
export type PracticeBracketOptions = BracketOptions

export type OrderSubmitOptions = {
  orderType: OrderType
  entryPrice?: number
  stopLimitPrice?: number
}

/** @deprecated use OrderSubmitOptions */
export type PracticeOrderSubmitOptions = OrderSubmitOptions

export type TradePanelProps = {
  accountId: string
  mode?: TradingMode
  isDark: boolean
  chartSymbol?: string
  onChartSymbolChange?: (symbol: string) => void
  quantity: string | number
  onQuantityChange: (delta: number) => void
  onQuantityUpdate: (n: number) => void
  onQuantityInputChange: (v: string) => void
  onQuantityBlur: () => void
  onBuy: () => void
  onSell: () => void
  onJoinBid?: () => void
  onJoinAsk?: () => void
  onSubmitOrder?: (side: OrderSide, brackets: BracketOptions, order?: OrderSubmitOptions) => void
  onClose: () => void
  onReverse: () => void
  onFlatten: () => void
  markPrice?: number | null
  tickSize?: number
  getMarketBook?: () => TradeseaMarketBook | null
  subscribeMarketBook?: (onUpdate: () => void) => () => void
  ensureMarketBook?: () => void
  getChartPositionUpl?: () => number | null
  getDomPositionContext?: () => DomPositionContext | null
  hideDetach?: boolean
  onDetach?: () => void
  fullWidth?: boolean
  /** When false, buy/sell and order controls are disabled (MDS offline). */
  marketDataLive?: boolean
}

/** @deprecated use TradePanelProps */
export type PracticeTradePanelProps = TradePanelProps
