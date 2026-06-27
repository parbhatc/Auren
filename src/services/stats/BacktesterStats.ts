import { StatsCalculator, TradeData, CalculatedStats } from './StatsCalculator'
import { BacktestSession } from '../../types/backtester'

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
    if (!trade.exit_price || !trade.entry_price || !trade.contracts) return 0
    
    // Get tick size and tick value for this symbol (defaults to 1 if not found)
    const symbol = (trade as any).symbol || ''
    const tickSize = this.symbolData?.[symbol]?.tickSize ?? 1
    const tickValue = this.symbolData?.[symbol]?.tickValue ?? 1
    
    // Calculate P&L based on direction
    // For long: profit when exit > entry, so (exit - entry) / tickSize * tickValue * contracts
    // For short: profit when exit < entry, so (entry - exit) / tickSize * tickValue * contracts
    // Use absolute value of contracts since short trades may have negative contract values
    const contracts = Math.abs(trade.contracts || 0)
    if (trade.direction?.toLowerCase() === 'short') {
      const priceDiff = trade.entry_price - trade.exit_price
      const ticks = priceDiff / tickSize
      return ticks * tickValue * contracts
    } else {
      const priceDiff = trade.exit_price - trade.entry_price
      const ticks = priceDiff / tickSize
      return ticks * tickValue * contracts
    }
  }

  /**
   * Calculate statistics from backtester trades
   */
  calculate(trades: TradeData[]): CalculatedStats {
    // Filter only closed trades (trades with exit_price)
    const closedTrades = trades.filter(t => t.exit_price !== null && t.exit_price !== undefined)
    
    if (closedTrades.length === 0) {
      return this.getEmptyStats()
    }

    // Calculate P&L for each trade (with fees subtracted)
    const pnlArray = closedTrades.map(trade => {
      const pnl = this.calculateTradePnL(trade)
      // Subtract fees
      const symbol = (trade as any).symbol || ''
      const totalFees = this.symbolData?.[symbol]?.totalFees || 0
      const feesPerTrade = totalFees * Math.abs(trade.contracts || 0)
      return pnl - feesPerTrade
    })

    // Separate wins and losses
    // Breakeven trades (pnl === 0) are counted as losses (standard convention)
    const wins = pnlArray.filter(pnl => pnl > 0)
    const losses = pnlArray.filter(pnl => pnl <= 0)
    
    // Basic statistics
    const totalProfit = pnlArray.reduce((sum, pnl) => sum + pnl, 0)
    const totalTrades = closedTrades.length
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
    
    // Win/Loss statistics
    const avgWin = wins.length > 0 ? wins.reduce((sum, pnl) => sum + pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? losses.reduce((sum, pnl) => sum + pnl, 0) / losses.length : 0
    const largestWin = wins.length > 0 ? Math.max(...wins) : 0
    const largestLoss = losses.length > 0 ? Math.min(...losses) : 0
    
    // Risk metrics
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (avgWin > 0 ? Infinity : 0)
    const sharpeRatio = this.calculateSharpeRatio(pnlArray, totalProfit, totalTrades)

    return {
      totalTrades,
      winRate: winRate.toFixed(1),
      totalProfit: totalProfit.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      largestWin: largestWin.toFixed(2),
      largestLoss: largestLoss.toFixed(2),
      profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
      avgWinLossFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(2),
      wins: wins.length,
      losses: losses.length,
    }
  }

  /**
   * Calculate Sharpe Ratio
   * Simple implementation using standard deviation of returns
   */
  private calculateSharpeRatio(pnlArray: number[], totalProfit: number, totalTrades: number): number {
    if (totalTrades === 0 || pnlArray.length === 0) return 0

    const meanReturn = totalProfit / totalTrades
    const variance = pnlArray.reduce((sum, pnl) => sum + Math.pow(pnl - meanReturn, 2), 0) / totalTrades
    const stdDev = Math.sqrt(variance)
    
    // Avoid division by zero
    return stdDev !== 0 ? meanReturn / stdDev : 0
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
