/** Shared bracket hit math (mirrors server practiceBracketMath.js). */

export type BracketPosition = {
  contracts: number
  type?: string
  entry?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
}

function isLongPosition(position: BracketPosition): boolean {
  return position.type === 'long' || Number(position.contracts) > 0
}

/** Long stop: exit when price falls to the stop level. */
function isLongStopHit(stopLoss: number, ltp: number): boolean {
  return ltp <= stopLoss
}

/** Short stop: exit when price rises to the stop level. */
function isShortStopHit(stopLoss: number, ltp: number): boolean {
  return ltp >= stopLoss
}

/** A long take-profit is a sell limit and fills at or above its level. */
function isLongTakeProfitHit(takeProfit: number, ltp: number): boolean {
  return ltp >= takeProfit
}

/** A short take-profit is a buy limit and fills at or below its level. */
function isShortTakeProfitHit(takeProfit: number, ltp: number): boolean {
  return ltp <= takeProfit
}

export type BracketCrossHit = {
  reason: 'stop_loss' | 'take_profit'
  exitPrice: number
}

/**
 * Detect a bracket fill from the current executable mark.
 *
 * A restored position must close even when both the previous and current marks are
 * beyond the bracket. Requiring a new cross strands it after refresh/reconnect.
 * Stop is evaluated before target when both are executable.
 */
export function resolveBracketCrossHit(
  position: BracketPosition,
  prevLtp: number | null | undefined,
  ltp: number
): BracketCrossHit | null {
  if (!Number.isFinite(ltp)) return null

  const stopLoss = position.stopLoss
  const takeProfit = position.takeProfit
  if (stopLoss == null && takeProfit == null) return null

  const isLong = isLongPosition(position)
  void prevLtp

  if (isLong) {
    if (stopLoss != null && isLongStopHit(stopLoss, ltp)) {
      return { reason: 'stop_loss', exitPrice: stopLoss }
    }
    if (takeProfit != null && isLongTakeProfitHit(takeProfit, ltp)) {
      return { reason: 'take_profit', exitPrice: takeProfit }
    }
  } else {
    if (stopLoss != null && isShortStopHit(stopLoss, ltp)) {
      return { reason: 'stop_loss', exitPrice: stopLoss }
    }
    if (takeProfit != null && isShortTakeProfitHit(takeProfit, ltp)) {
      return { reason: 'take_profit', exitPrice: takeProfit }
    }
  }

  return null
}

/**
 * Check open brackets against the current LTP/mark.
 * Long: SL when ltp <= stop. TP when ltp reaches target (rise or pullback).
 * Short: SL when ltp >= stop. TP when ltp reaches target (fall or pullback).
 * Stop is evaluated before target on the same print.
 */
export function resolveBracketLtpHit(
  position: BracketPosition,
  ltp: number | null | undefined
): 'stop_loss' | 'take_profit' | null {
  if (ltp == null || !Number.isFinite(ltp)) return null

  const stopLoss = position.stopLoss
  const takeProfit = position.takeProfit
  if (stopLoss == null && takeProfit == null) return null

  const isLong = isLongPosition(position)
  if (isLong) {
    if (stopLoss != null && isLongStopHit(stopLoss, ltp)) return 'stop_loss'
    if (takeProfit != null && isLongTakeProfitHit(takeProfit, ltp)) return 'take_profit'
  } else {
    if (stopLoss != null && isShortStopHit(stopLoss, ltp)) return 'stop_loss'
    if (takeProfit != null && isShortTakeProfitHit(takeProfit, ltp)) return 'take_profit'
  }
  return null
}

/** Classify a bracket dragged from the position line (before persisting). */
export function resolvePositionLineBracketType(
  contracts: number,
  entry: number,
  targetPrice: number,
  mark: number | null | undefined,
  tickSize?: number | null
): 'stop_loss' | 'take_profit' {
  const eps = tickSize && tickSize > 0 ? tickSize / 1000 : 1e-6
  const isLong = contracts > 0
  const isShort = contracts < 0

  if (isLong) {
    if (targetPrice <= entry + eps) return 'stop_loss'
    // Above entry: profit-side level — take profit even when below current mark.
    return 'take_profit'
  }

  if (isShort) {
    if (targetPrice >= entry - eps) return 'stop_loss'
    return 'take_profit'
  }

  void mark
  return 'stop_loss'
}
