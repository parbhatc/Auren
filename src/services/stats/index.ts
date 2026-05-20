/**
 * Statistics service exports (practice)
 */
export { StatsCalculator, type TradeData, type CalculatedStats } from './StatsCalculator'
export { TradeseaStats } from './TradeseaStats'

import { StatsCalculator } from './StatsCalculator'
import { TradeseaStats } from './TradeseaStats'

export function getStatsCalculator(type: 'tradesea'): StatsCalculator {
  if (type === 'tradesea') {
    return new TradeseaStats()
  }
  throw new Error(`Unknown stats calculator type: ${type}`)
}
