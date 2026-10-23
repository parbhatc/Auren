/**
 * Net realized P&L for one backtester fill.
 * Direction carries the side, so contract quantity is always treated as an
 * absolute fill size. This is important for partial short closes, which may
 * arrive from the chart cache as a signed quantity such as -1.
 */
export function calculateBacktesterTradePnl({
  direction,
  entryPrice,
  exitPrice,
  contracts,
  tickSize,
  tickValue,
  totalFees = 0,
}) {
  const entry = Number(entryPrice)
  const exit = Number(exitPrice)
  const quantity = Math.abs(Number(contracts))
  const size = Number(tickSize)
  const value = Number(tickValue)
  const fees = Number(totalFees)
  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(exit) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(size) ||
    size <= 0 ||
    !Number.isFinite(value) ||
    !Number.isFinite(fees)
  ) return 0

  const priceDifference = String(direction || '').toLowerCase() === 'short'
    ? entry - exit
    : exit - entry
  const grossPnl = (priceDifference / size) * value * quantity
  const netPnl = grossPnl - fees * quantity
  return Number.isFinite(netPnl) ? netPnl : 0
}
