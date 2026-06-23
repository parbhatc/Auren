/**
 * Check open brackets against the current LTP/mark.
 * @returns {'stop_loss' | 'take_profit' | null}
 */
export function resolveBracketLtpHit(position, ltp) {
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

/** @deprecated bar-range replay — prefer resolveBracketLtpHit for live marks. */
export function didBarHitPrice(bar, price) {
  if (bar?.low == null || bar?.high == null || price == null) return false
  return price >= bar.low && price <= bar.high
}

/**
 * Stop is checked before target on each bar (conservative when both hit).
 * @returns {'stop_loss' | 'take_profit' | null}
 */
export function resolveBracketHit(position, bar) {
  const stopLoss = position.stopLoss
  const takeProfit = position.takeProfit
  if (stopLoss == null && takeProfit == null) return null

  const isLong = position.type === 'long' || Number(position.contracts) > 0

  if (isLong) {
    if (stopLoss != null && didBarHitPrice(bar, stopLoss)) return 'stop_loss'
    if (takeProfit != null && didBarHitPrice(bar, takeProfit)) return 'take_profit'
  } else {
    if (stopLoss != null && didBarHitPrice(bar, stopLoss)) return 'stop_loss'
    if (takeProfit != null && didBarHitPrice(bar, takeProfit)) return 'take_profit'
  }
  return null
}

export function bracketExitPrice(position, reason) {
  if (reason === 'stop_loss') return position.stopLoss
  if (reason === 'take_profit') return position.takeProfit
  return null
}

export function normalizeBarTimeSec(time) {
  if (time == null || !Number.isFinite(Number(time))) return Math.floor(Date.now() / 1000)
  const n = Number(time)
  return n < 1e12 ? Math.floor(n) : Math.floor(n / 1000)
}
