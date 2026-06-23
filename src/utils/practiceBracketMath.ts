/** Shared bracket hit math (mirrors server practiceBracketMath.js). */

/**
 * Check open brackets against the current LTP/mark.
 * Long: SL when ltp <= stop, TP when ltp >= target.
 * Short: SL when ltp >= stop, TP when ltp <= target.
 * Stop is evaluated before target on the same print.
 */
export function resolveBracketLtpHit(
  position: {
    contracts: number
    type?: string
    stopLoss?: number | null
    takeProfit?: number | null
  },
  ltp: number | null | undefined
): 'stop_loss' | 'take_profit' | null {
  if (ltp == null || !Number.isFinite(ltp)) return null

  const stopLoss = position.stopLoss
  const takeProfit = position.takeProfit
  if (stopLoss == null && takeProfit == null) return null

  const isLong = position.type === 'long' || Number(position.contracts) > 0

  if (isLong) {
    if (stopLoss != null && ltp <= stopLoss) return 'stop_loss'
    if (takeProfit != null && ltp >= takeProfit) return 'take_profit'
  } else {
    if (stopLoss != null && ltp >= stopLoss) return 'stop_loss'
    if (takeProfit != null && ltp <= takeProfit) return 'take_profit'
  }
  return null
}
