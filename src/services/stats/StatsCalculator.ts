/**
 * Base interface for trading statistics calculators
 * This allows easy swapping between different providers (Backtester, TopstepX, etc.)
 */

import { TradeData, CalculatedStats } from '../../types/stats'

// Re-export for backward compatibility
export type { TradeData, CalculatedStats }

/**
 * Base class for statistics calculators
 */
export abstract class StatsCalculator {
  /**
   * Calculate P&L for a single trade
   */
  protected calculateTradePnL(trade: TradeData): number {
    if (!trade.exit_price) return 0
    return (trade.exit_price - trade.entry_price) * trade.contracts
  }

  /**
   * Calculate statistics from trades
   */
  abstract calculate(trades: TradeData[]): CalculatedStats

  /**
   * Filter trades by date range (optional, can be overridden)
   */
  filterByDateRange(trades: TradeData[], startDate: string, endDate: string): TradeData[] {
    // Default implementation - can be overridden by subclasses
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    return trades.filter(trade => {
      const tradeDate = trade.entry_time ? new Date(trade.entry_time).getTime() : 0
      return tradeDate >= start && tradeDate <= end
    })
  }
}
