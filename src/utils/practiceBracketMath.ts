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

function entryPrice(position: BracketPosition): number | null {
  const entry = Number(position.entry)
  return Number.isFinite(entry) ? entry : null
}

/** Long stop: exit when price falls to the stop level. */
function isLongStopHit(stopLoss: number, ltp: number): boolean {
  return ltp <= stopLoss
}

/** Short stop: exit when price rises to the stop level. */
function isShortStopHit(stopLoss: number, ltp: number): boolean {
  return ltp >= stopLoss
}

/**
 * Long take profit — standard target above entry fills when market trades at/through TP.
 * TP at/below entry uses limit-style (ltp <= target).
 */
function isLongTakeProfitHit(entry: number, takeProfit: number, ltp: number): boolean {
  if (takeProfit > entry) {
    return ltp >= takeProfit
  }
  return ltp <= takeProfit
}

/**
 * Short take profit — standard target below entry fills when market trades at/through TP.
 */
function isShortTakeProfitHit(entry: number, takeProfit: number, ltp: number): boolean {
  if (takeProfit < entry) {
    return ltp <= takeProfit
  }
  return ltp >= takeProfit
}

export type BracketCrossHit = {
  reason: 'stop_loss' | 'take_profit'
  exitPrice: number
}

/**
 * Detect bracket fill on this tick, including gaps between the previous and current mark.
 * Stop is evaluated before target when both cross on the same step.
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
  const entry = entryPrice(position)
  const prev = prevLtp != null && Number.isFinite(prevLtp) ? prevLtp : null

  if (isLong) {
    if (stopLoss != null) {
      if (ltp <= stopLoss && (prev == null || prev > stopLoss)) {
        return { reason: 'stop_loss', exitPrice: stopLoss }
      }
    }
    if (takeProfit != null && entry != null) {
      if (takeProfit > entry) {
        if (ltp >= takeProfit && (prev == null || prev < takeProfit)) {
          return { reason: 'take_profit', exitPrice: takeProfit }
        }
      } else if (ltp <= takeProfit && (prev == null || prev > takeProfit)) {
        return { reason: 'take_profit', exitPrice: takeProfit }
      }
    } else if (takeProfit != null && ltp >= takeProfit && (prev == null || prev < takeProfit)) {
      return { reason: 'take_profit', exitPrice: takeProfit }
    }
  } else {
    if (stopLoss != null) {
      if (ltp >= stopLoss && (prev == null || prev < stopLoss)) {
        return { reason: 'stop_loss', exitPrice: stopLoss }
      }
    }
    if (takeProfit != null && entry != null) {
      if (takeProfit < entry) {
        if (ltp <= takeProfit && (prev == null || prev > takeProfit)) {
          return { reason: 'take_profit', exitPrice: takeProfit }
        }
      } else if (ltp >= takeProfit && (prev == null || prev < takeProfit)) {
        return { reason: 'take_profit', exitPrice: takeProfit }
      }
    } else if (takeProfit != null && ltp <= takeProfit && (prev == null || prev > takeProfit)) {
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
  const entry = entryPrice(position)

  if (isLong) {
    if (stopLoss != null && isLongStopHit(stopLoss, ltp)) return 'stop_loss'
    if (takeProfit != null && entry != null && isLongTakeProfitHit(entry, takeProfit, ltp)) {
      return 'take_profit'
    }
    if (takeProfit != null && entry == null && ltp >= takeProfit) return 'take_profit'
  } else {
    if (stopLoss != null && isShortStopHit(stopLoss, ltp)) return 'stop_loss'
    if (takeProfit != null && entry != null && isShortTakeProfitHit(entry, takeProfit, ltp)) {
      return 'take_profit'
    }
    if (takeProfit != null && entry == null && ltp <= takeProfit) return 'take_profit'
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
