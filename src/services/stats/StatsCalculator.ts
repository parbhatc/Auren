/**
 * Base interface for trading statistics calculators
 * This allows easy swapping between live and backtester providers.
 */

import { TradeData, CalculatedStats } from '../../types/stats'
import { calculateDirectionalPnl } from './tradePnl.js'
import { filterTradesByDateRange } from './tradeDateRange.js'

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
    return calculateDirectionalPnl({
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      contracts: trade.contracts,
      direction: trade.direction,
    })
  }

  /**
   * Calculate statistics from trades
   */
  abstract calculate(trades: TradeData[]): CalculatedStats

  /**
   * Filter trades by date range (optional, can be overridden)
   */
  filterByDateRange(trades: TradeData[], startDate: string, endDate: string): TradeData[] {
    return filterTradesByDateRange(trades, startDate, endDate)
  }
}
