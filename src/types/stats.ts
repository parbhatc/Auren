/**
 * Statistics-related TypeScript interfaces
 */

export interface TradeData {
  entry_price: number
  exit_price: number | null
  contracts: number
  direction?: 'long' | 'short'
  entry_time?: string
  exit_time?: string
  [key: string]: any
}

export interface CalculatedStats {
  totalTrades: number
  winRate: string
  totalProfit: string
  avgWin: string
  avgLoss: string
  largestWin: string
  largestLoss: string
  profitFactor: string
  avgWinLossFactor: string
  sharpeRatio: string
  wins?: number  // Optional: direct count of winning trades
  losses?: number  // Optional: direct count of losing trades (includes breakeven)
}
