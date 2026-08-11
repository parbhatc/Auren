export function getPracticeTradeNetPnl(trade) {
  const grossPnl = Number(trade?.pnl)
  const fees = Number(trade?.fees)
  return (Number.isFinite(grossPnl) ? grossPnl : 0) - (Number.isFinite(fees) ? fees : 0)
}

export function getPracticeTradesNetPnl(trades) {
  return Array.isArray(trades)
    ? trades.reduce((total, trade) => total + getPracticeTradeNetPnl(trade), 0)
    : 0
}
