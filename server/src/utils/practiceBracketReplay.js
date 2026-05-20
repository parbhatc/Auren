/** @see src/services/practice/practiceBracketReplay.ts (client) — keep logic aligned */

export const BRACKET_REPLAY_RESOLUTION = '1S'
export const BRACKET_REPLAY_GRACE_SEC = 3

export function entryTimeToMs(entryTime) {
  if (entryTime == null || !Number.isFinite(Number(entryTime))) return Date.now()
  const n = Number(entryTime)
  return n < 1e12 ? n * 1000 : n
}

export function findBracketExitInBars(bars, isLong, stopLoss, takeProfit) {
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

export function barMatchesSnapshot(bar, snapshot, tickSize = 0.25) {
  const tol = Math.max(tickSize / 2, 0.01)
  const eq = (a, b) => Math.abs(a - b) <= tol
  return (
    eq(Number(bar.open), snapshot.open) &&
    eq(Number(bar.high), snapshot.high) &&
    eq(Number(bar.low), snapshot.low) &&
    eq(Number(bar.close), snapshot.close)
  )
}

export function replayFromSecForSnapshot(snapshot, entrySec, nowSec) {
  if (snapshot?.barTimeSec) {
    return Math.max(entrySec, snapshot.barTimeSec + BRACKET_REPLAY_GRACE_SEC)
  }
  return Math.max(entrySec, nowSec - 120)
}
