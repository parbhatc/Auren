import { StatsCalculator, TradeData, CalculatedStats } from './StatsCalculator'

/**
 * Tradesea TradeLens statistics calculator (net P&L after fees).
 */
export class TradeseaStats extends StatsCalculator {
  calculate(trades: TradeData[]): CalculatedStats {
    const closedTrades = trades.filter(
      (t) => t.exit_price !== null && t.exit_price !== undefined
    )

    if (closedTrades.length === 0) {
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

    const pnlArray = closedTrades.map((trade) => this.netPnlForTrade(trade))
    const wins = pnlArray.filter((pnl) => pnl > 0)
    const losses = pnlArray.filter((pnl) => pnl <= 0)

    const totalProfit = pnlArray.reduce((sum, pnl) => sum + pnl, 0)
    const totalTrades = closedTrades.length
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0

    const avgWin = wins.length > 0 ? wins.reduce((sum, pnl) => sum + pnl, 0) / wins.length : 0
    const avgLoss =
      losses.length > 0 ? losses.reduce((sum, pnl) => sum + pnl, 0) / losses.length : 0
    const largestWin = wins.length > 0 ? Math.max(...wins) : 0
    const largestLoss = losses.length > 0 ? Math.min(...losses) : 0

    const totalWins = wins.reduce((sum, pnl) => sum + pnl, 0)
    const totalLosses = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0))
    const profitFactor =
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
    const avgWinLossFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0

    const sharpeRatio = this.calculateSharpeRatio(pnlArray, totalProfit, totalTrades)

    return {
      totalTrades,
      winRate: winRate.toFixed(1),
      totalProfit: totalProfit.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      largestWin: largestWin.toFixed(2),
      largestLoss: largestLoss.toFixed(2),
      avgWinLossFactor: avgWinLossFactor === Infinity ? '∞' : avgWinLossFactor.toFixed(2),
      profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      wins: wins.length,
      losses: losses.length,
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

  private calculateSharpeRatio(pnlArray: number[], totalProfit: number, totalTrades: number): number {
    if (totalTrades < 2 || pnlArray.length < 2) return 0
    const mean = totalProfit / totalTrades
    const variance =
      pnlArray.reduce((sum, pnl) => sum + Math.pow(pnl - mean, 2), 0) / totalTrades
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) return 0
    return mean / stdDev
  }
}
