/** OHLC bar used to replay stop / target fills while the user was offline. */
export type BracketReplayBar = {
  time: number
  low?: number
  high?: number
  close?: number
}

export type BracketExit = { price: number; time: number }

/**
 * Walk bars in time order; stop is checked before target on each bar (conservative).
 * Long: SL if low <= stop, TP if high >= target. Short: inverted.
 */
export function findBracketExitInBars(
  bars: BracketReplayBar[],
  isLong: boolean,
  stopLoss: number | null,
  takeProfit: number | null
): BracketExit | null {
  const sorted = [...bars].sort((a, b) => a.time - b.time)
  for (const bar of sorted) {
    const low = bar.low ?? bar.close
    const high = bar.high ?? bar.close
    if (low == null || high == null) continue

    if (isLong) {
      if (stopLoss != null && low <= stopLoss) {
        return { price: stopLoss, time: bar.time }
      }
      if (takeProfit != null && high >= takeProfit) {
        return { price: takeProfit, time: bar.time }
      }
    } else {
      if (stopLoss != null && high >= stopLoss) {
        return { price: stopLoss, time: bar.time }
      }
      if (takeProfit != null && low <= takeProfit) {
        return { price: takeProfit, time: bar.time }
      }
    }
  }
  return null
}

export function entryTimeToMs(entryTime: number | null | undefined): number {
  if (entryTime == null || !Number.isFinite(entryTime)) return Date.now()
  return entryTime < 1e12 ? entryTime * 1000 : entryTime
}
