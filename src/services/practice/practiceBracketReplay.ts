/** Resolution for offline TP/SL replay (1-second bars). */
export const BRACKET_REPLAY_RESOLUTION = '1S'

/** OHLC bar used to replay stop / target fills while the user was offline. */
export type BracketReplayBar = {
  time: number
  low?: number
  high?: number
  close?: number
}

export type BracketExit = { price: number; time: number }

/**
 * Walk 1s bars in time order; stop is checked before target on each bar (conservative when both hit the same bar).
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

const BRACKET_CHECKPOINT_PREFIX = 'auren_practice_bracket_'

export function bracketCheckpointKey(accountId: string, cacheKey: string): string {
  return `${BRACKET_CHECKPOINT_PREFIX}${accountId}_${cacheKey}`
}

/** Last time (unix sec) we confirmed brackets were still open via live or replay checks. */
export function readBracketCheckpointSec(accountId: string, cacheKey: string): number | null {
  try {
    const raw = sessionStorage.getItem(bracketCheckpointKey(accountId, cacheKey))
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
  } catch {
    return null
  }
}

export function writeBracketCheckpointSec(
  accountId: string,
  cacheKey: string,
  throughSec: number
): void {
  try {
    sessionStorage.setItem(
      bracketCheckpointKey(accountId, cacheKey),
      String(Math.floor(throughSec))
    )
  } catch {
    /* storage full / private mode */
  }
}

export function clearBracketCheckpoint(accountId: string, cacheKey: string): void {
  try {
    sessionStorage.removeItem(bracketCheckpointKey(accountId, cacheKey))
  } catch {
    /* ignore */
  }
}
