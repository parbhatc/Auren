export type PracticePendingOrder = {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  contracts: number
  limitPrice: number
  stopLoss: number | null
  takeProfit: number | null
  createdAt: number
  /** Mark when the order was placed (drives fill direction). */
  placementMark: number
  /** TradingView order line handle */
  line?: { remove?: () => void }
}

/**
 * Fill when price trades through the limit, not when the limit is merely marketable.
 */
export function isPracticeLimitFillable(
  side: 'buy' | 'sell',
  limitPrice: number,
  low: number,
  high: number,
  placementMark: number,
  tickSize: number
): boolean {
  const eps = tickSize > 0 ? tickSize / 2 : 0.0001
  if (side === 'buy') {
    if (limitPrice > placementMark + eps) {
      return high >= limitPrice - eps
    }
    return low <= limitPrice + eps
  }
  if (limitPrice < placementMark - eps) {
    return low <= limitPrice + eps
  }
  return high >= limitPrice - eps
}
