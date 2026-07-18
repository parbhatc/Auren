/**
 * Direction-aware tick P&L with explicit numeric validation.
 * Valid zero prices are preserved; malformed values return a safe zero.
 */
export function calculateDirectionalPnl({
  entryPrice,
  exitPrice,
  contracts,
  direction,
  tickSize = 1,
  tickValue = 1,
}) {
  if (entryPrice == null || exitPrice == null || contracts == null) return 0
  const entry = Number(entryPrice)
  const exit = Number(exitPrice)
  const quantity = Math.abs(Number(contracts))
  const configuredTickSize = Number(tickSize)
  const configuredTickValue = Number(tickValue)
  if (![entry, exit, quantity].every(Number.isFinite) || quantity === 0) return 0

  const size =
    Number.isFinite(configuredTickSize) && configuredTickSize > 0 ? configuredTickSize : 1
  const value = Number.isFinite(configuredTickValue) ? configuredTickValue : 1
  const priceMove = String(direction || '').toLowerCase() === 'short' ? entry - exit : exit - entry
  const pnl = (priceMove / size) * value * quantity
  return Number.isFinite(pnl) ? pnl : 0
}
