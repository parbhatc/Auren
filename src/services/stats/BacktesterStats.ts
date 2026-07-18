import { StatsCalculator, TradeData, CalculatedStats } from './StatsCalculator'
import { BacktestSession } from '../../types/backtester'
import { PnlAccumulator } from './pnlSummary.js'
import { calculateDirectionalPnl } from './tradePnl.js'

/**
 * Backtester Statistics Calculator
 * Calculates trading statistics from backtester trade data
 */
export class BacktesterStats extends StatsCalculator {
  private symbolData?: Record<string, { 
    tickSize: number
    tickValue: number
    totalFees?: number
  }>

  /**
   * Set symbol data for P&L calculations
   */
  setSymbolData(symbolData?: Record<string, { 
    tickSize: number
    tickValue: number
    totalFees?: number
  }>) {
    this.symbolData = symbolData
  }

  /**
   * Get reference date for date calculations
   * For backtester, this is the session start date/time
   * For prop firms, this can be overridden to use different reference dates
   */
  getReferenceDate(session?: BacktestSession | null): Date {
    if (session?.startDate && session?.startTime) {
      // Parse session start date and time
      const [year, month, day] = session.startDate.split('-').map(Number)
      const [hours, minutes] = session.startTime.split(':').map(Number)
      return new Date(year, month - 1, day, hours, minutes, 0, 0)
    }
    // Default to current date if no session provided
    return new Date()
  }

  /**
   * Format date for HTML date input (YYYY-MM-DD)
   */
  formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  /**
   * Get "Today" date based on session start date
   */
  getTodayDate(session?: BacktestSession | null): Date {
    return this.getReferenceDate(session)
  }

  /**
   * Get "Last Week" start date (7 days before reference date)
   */
  getLastWeekStartDate(session?: BacktestSession | null): Date {
    const referenceDate = this.getReferenceDate(session)
    const lastWeek = new Date(referenceDate)
    lastWeek.setDate(referenceDate.getDate() - 7)
    return lastWeek
  }

  /**
   * Get "Last Month" start date (1 month before reference date)
   */
  getLastMonthStartDate(session?: BacktestSession | null): Date {
    const referenceDate = this.getReferenceDate(session)
    const lastMonth = new Date(referenceDate)
    lastMonth.setMonth(referenceDate.getMonth() - 1)
    return lastMonth
  }

  /**
   * Get default date range for stats view
   * Returns start and end dates formatted for date inputs
   */
  getDefaultDateRange(session?: BacktestSession | null): { startDate: string; endDate: string } {
    if (session?.startDate) {
      return {
        startDate: session.startDate,
        endDate: session.startDate,
      }
    }
    // Default to last 30 days if no session
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    return {
      startDate: this.formatDateForInput(thirtyDaysAgo),
      endDate: this.formatDateForInput(today),
    }
  }
  /**
   * Calculate P&L for a single trade using tick size and tick value
   */
  protected calculateTradePnL(trade: TradeData): number {
    const symbol = (trade as any).symbol || ''
    return calculateDirectionalPnl({
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      contracts: trade.contracts,
      direction: trade.direction,
      tickSize: this.symbolData?.[symbol]?.tickSize,
      tickValue: this.symbolData?.[symbol]?.tickValue,
    })
  }

  /**
   * Calculate statistics from backtester trades
   */
  calculate(trades: TradeData[]): CalculatedStats {
    const accumulator = new PnlAccumulator()
    for (const trade of trades) {
      if (trade.exit_price == null) continue
      const pnl = this.calculateTradePnL(trade)
      const symbol = (trade as any).symbol || ''
      const fee = Number(this.symbolData?.[symbol]?.totalFees)
      const feePerContract = Number.isFinite(fee) ? fee : 0
      accumulator.add(pnl - feePerContract * Math.abs(Number(trade.contracts) || 0))
    }

    const summary = accumulator.summary()
    if (summary.count === 0) return this.getEmptyStats()
    const winRate = (summary.wins / summary.count) * 100

    return {
      totalTrades: summary.count,
      winRate: winRate.toFixed(1),
      totalProfit: summary.total.toFixed(2),
      avgWin: summary.avgWin.toFixed(2),
      avgLoss: summary.avgLoss.toFixed(2),
      largestWin: summary.largestWin.toFixed(2),
      largestLoss: summary.largestLoss.toFixed(2),
      profitFactor: summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2),
      avgWinLossFactor:
        summary.avgWinLossFactor === Infinity ? '∞' : summary.avgWinLossFactor.toFixed(2),
      sharpeRatio: summary.sharpeRatio.toFixed(2),
      wins: summary.wins,
      losses: summary.losses,
    }
  }

  /**
   * Get empty stats object (no trades)
   */
  private getEmptyStats(): CalculatedStats {
    return {
      totalTrades: 0,
      winRate: '0.0',
      wins: 0,
      losses: 0,
      totalProfit: '0.00',
      avgWin: '0.00',
      avgLoss: '0.00',
      largestWin: '0.00',
      largestLoss: '0.00',
      profitFactor: '0.00',
      avgWinLossFactor: '0.00',
      sharpeRatio: '0.00',
    }
  }
}
