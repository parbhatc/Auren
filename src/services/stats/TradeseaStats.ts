import { StatsCalculator, TradeData, CalculatedStats } from './StatsCalculator'
import { PnlAccumulator } from './pnlSummary.js'

/**
 * Tradesea TradeLens statistics calculator (net P&L after fees).
 */
export class TradeseaStats extends StatsCalculator {
  calculate(trades: TradeData[]): CalculatedStats {
    const accumulator = new PnlAccumulator()
    for (const trade of trades) {
      if (trade.exit_price == null) continue
      accumulator.add(this.netPnlForTrade(trade))
    }
    const summary = accumulator.summary()

    if (summary.count === 0) {
      return {
        totalTrades: 0,
        winRate: '0.0',
        totalProfit: '0.00',
        avgWin: '0.00',
        avgLoss: '0.00',
        largestWin: '0.00',
        largestLoss: '0.00',
        profitFactor: '0.00',
        avgWinLossFactor: '0.00',
        sharpeRatio: '0.00',
        wins: 0,
        losses: 0,
      }
    }

    const winRate = (summary.wins / summary.count) * 100

    return {
      totalTrades: summary.count,
      winRate: winRate.toFixed(1),
      totalProfit: summary.total.toFixed(2),
      avgWin: summary.avgWin.toFixed(2),
      avgLoss: summary.avgLoss.toFixed(2),
      largestWin: summary.largestWin.toFixed(2),
      largestLoss: summary.largestLoss.toFixed(2),
      avgWinLossFactor:
        summary.avgWinLossFactor === Infinity ? '∞' : summary.avgWinLossFactor.toFixed(2),
      profitFactor: summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2),
      sharpeRatio: summary.sharpeRatio.toFixed(2),
      wins: summary.wins,
      losses: summary.losses,
    }
  }

  private netPnlForTrade(trade: TradeData): number {
    if (trade.pnl !== undefined && trade.pnl !== null && Number.isFinite(Number(trade.pnl))) {
      return Number(trade.pnl)
    }
    const raw = (trade as any).originalTrade
    if (raw?.netPnl !== undefined && Number.isFinite(Number(raw.netPnl))) {
      return Number(raw.netPnl)
    }
    if (raw?.pnl !== undefined && Number.isFinite(Number(raw.pnl))) {
      const fees = Number(raw.totalCharges ?? raw.commission ?? 0)
      return Number(raw.pnl) - fees
    }
    return this.calculateTradePnL(trade)
  }
}
