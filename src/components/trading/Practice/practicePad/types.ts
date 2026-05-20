export type OrderType = 'market' | 'limit' | 'stop'
export type OrderSide = 'buy' | 'sell'
export type BracketDistanceUnit = 'ticks' | 'points'

export type PracticeBracketOptions = {
  stopLoss: number | null
  takeProfit: number | null
}

export type PracticeOrderSubmitOptions = {
  orderType: OrderType
  entryPrice?: number
  stopLimitPrice?: number
}

export type PracticeTradePanelProps = {
  quantity: string | number
  onQuantityChange: (delta: number) => void
  onQuantityInputChange: (v: string) => void
  onQuantityBlur: () => void
  onBuy: () => void
  onSell: () => void
  onSubmitOrder?: (
    side: OrderSide,
    brackets: PracticeBracketOptions,
    order?: PracticeOrderSubmitOptions
  ) => void
}

export const DEFAULT_SL_TICKS = 10
export const DEFAULT_TP_TICKS = 10
