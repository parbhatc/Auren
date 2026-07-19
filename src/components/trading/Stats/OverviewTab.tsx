import { DollarSign, Target, Calendar, TrendingUp, Clock, TrendingDown, BarChart3 } from 'lucide-react'
import EquityCurve from '../../common/EquityCurve'
import TradeDurationAnalysis from '../../common/TradeDurationAnalysis'
import WinRateAnalysis from '../../common/WinRateAnalysis'
import { OverviewTabProps } from '../../../types/common'
import { practiceStatCardClass, practiceStatIconMutedClass } from '../Practice/practiceTradeTheme'

function statCardShell(isDark: boolean, practiceMode?: boolean): string {
  if (practiceMode) {
    return `${practiceStatCardClass(isDark)} p-4 sm:p-6 transition-colors`
  }
  return `rounded-xl p-4 sm:p-6 border transition-colors duration-500 ${
    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  }`
}

function statIconClass(isDark: boolean, practiceMode?: boolean): string {
  if (practiceMode) {
    return `w-4 h-4 sm:w-5 sm:h-5 transition-colors ${practiceStatIconMutedClass(isDark)}`
  }
  return `w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-500 ${
    isDark ? 'text-slate-500' : 'text-slate-400'
  }`
}

const OverviewTab = ({
  isDark,
  practiceMode,
  stats,
  dayStats,
  durationStats,
  bestTrade,
  worstTrade,
  equityCurveData,
  initialBalance,
  durationAnalysisData,
  winRateAnalysisData,
  dateRange,
  calculateTradePnL,
  parseTradeTimestamp,
  formatDuration,
  trades,
  riskStats
}: OverviewTabProps) => {
  // Calculate total lots (sum of all contracts across all trades)
  const totalLots = trades ? trades.reduce((sum: number, trade: any) => sum + Math.abs(trade.contracts || 0), 0) : 0
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* First Row - 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Total P&L */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Total P&L
            </h3>
            <DollarSign className={statIconClass(isDark, practiceMode)} />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-2 transition-colors duration-500 ${
            parseFloat(stats.totalProfit) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }`}>
            ${parseFloat(stats.totalProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Trade Win %} */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Trade Win %
            </h3>
            <Target className={statIconClass(isDark, practiceMode)} />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {stats.winRate}%
          </p>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Wins
              </span>
              <span className="text-emerald-400">
                {stats.wins !== undefined ? stats.wins : Math.round(parseInt(stats.totalTrades.toString()) * parseFloat(stats.winRate) / 100)} wins
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Losses
              </span>
              <span className="text-red-400">
                {stats.losses !== undefined ? stats.losses : Math.round(parseInt(stats.totalTrades.toString()) * (1 - parseFloat(stats.winRate) / 100))} losses
              </span>
            </div>
          </div>
          <div className={`mt-3 sm:mt-4 pt-3 sm:pt-4 border-t transition-colors duration-500 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className={`h-2 rounded-full overflow-hidden transition-colors duration-500 ${
              isDark ? 'bg-slate-800' : 'bg-slate-200'
            }`}>
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${stats.winRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Avg Win / Avg Loss */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Avg Win / Avg Loss
            </h3>
            <BarChart3 className={statIconClass(isDark, practiceMode)} />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {stats.avgWinLossFactor}
          </p>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Avg Win
              </span>
              <span className="text-emerald-400">${parseFloat(stats.avgWin).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Avg Loss
              </span>
              <span className="text-red-400">${parseFloat(stats.avgLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Day Win %} */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Day Win %
            </h3>
            <Calendar className={statIconClass(isDark, practiceMode)} />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-2 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {Number(stats.totalTrades) > 0 ? `${stats.winRate}%` : 'No trades'}
          </p>
        </div>

        {/* Profit Factor */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Profit Factor
            </h3>
            <TrendingUp className={statIconClass(isDark, practiceMode)} />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {stats.profitFactor}
          </p>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Profit
              </span>
              <span className="text-emerald-400">${parseFloat(stats.totalProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Total Loss
              </span>
              <span className="text-red-400">${Math.abs(parseFloat(stats.avgLoss) * parseInt(stats.totalTrades.toString()) * (1 - parseFloat(stats.winRate) / 100)).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Best Day % of Total Profit */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Best Day % of Total Profit
            </h3>
            <TrendingUp className={statIconClass(isDark, practiceMode)} />
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-2 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {Number(stats.totalTrades) > 0 ? `${((parseFloat(stats.largestWin) / parseFloat(stats.totalProfit)) * 100).toFixed(2)}%` : '0.00%'}
          </p>
        </div>
      </div>

      {/* Second Row - 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Most Active Day */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Most Active Day
            </h3>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-1 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {dayStats.mostActiveDay.date !== 'N/A' 
              ? (() => {
                  const [year, month, day] = dayStats.mostActiveDay.date.split('-').map(Number)
                  const date = new Date(year, month - 1, day)
                  return date.toLocaleDateString('en-US', { weekday: 'short' })
                })()
              : 'N/A'}
          </p>
          {dayStats.mostActiveDay.date !== 'N/A' && (
            <div className={`text-[10px] sm:text-xs mb-2 transition-colors duration-500 ${
              isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>
              {(() => {
                const [year, month, day] = dayStats.mostActiveDay.date.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              })()}
            </div>
          )}
          <div className={`text-xs sm:text-sm transition-colors duration-500 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {(() => {
              const totalTrades = Number(stats.totalTrades) || 0
              const daysDiff = Math.max(1, Math.ceil((new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)))
              const avgTradesPerDay = totalTrades > 0 ? (totalTrades / daysDiff).toFixed(1) : '0'
              return `${totalTrades} total trades • ${avgTradesPerDay} avg trades/day`
            })()}
          </div>
        </div>

        {/* Most Profitable Day */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Most Profitable Day
            </h3>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-1 transition-colors duration-500 text-emerald-400`}>
            {dayStats.mostProfitableDay.date !== 'N/A' 
              ? (() => {
                  const [year, month, day] = dayStats.mostProfitableDay.date.split('-').map(Number)
                  const date = new Date(year, month - 1, day)
                  return date.toLocaleDateString('en-US', { weekday: 'short' })
                })()
              : 'N/A'}
          </p>
          {dayStats.mostProfitableDay.date !== 'N/A' && (
            <div className={`text-[10px] sm:text-xs mb-2 transition-colors duration-500 ${
              isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>
              {(() => {
                const [year, month, day] = dayStats.mostProfitableDay.date.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              })()}
            </div>
          )}
          {dayStats.mostProfitableDay.date !== 'N/A' && (
            <div className={`text-xs sm:text-sm transition-colors duration-500 ${
              dayStats.mostProfitableDay.profit >= 0
                ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                : (isDark ? 'text-red-400' : 'text-red-600')
            }`}>
              ${dayStats.mostProfitableDay.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>

        {/* Least Profitable Day */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Least Profitable Day
            </h3>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-1 transition-colors duration-500 text-red-400`}>
            {dayStats.leastProfitableDay.date !== 'N/A' 
              ? (() => {
                  const [year, month, day] = dayStats.leastProfitableDay.date.split('-').map(Number)
                  const date = new Date(year, month - 1, day)
                  return date.toLocaleDateString('en-US', { weekday: 'short' })
                })()
              : 'N/A'}
          </p>
          {dayStats.leastProfitableDay.date !== 'N/A' && (
            <div className={`text-[10px] sm:text-xs mb-2 transition-colors duration-500 ${
              isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>
              {(() => {
                const [year, month, day] = dayStats.leastProfitableDay.date.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              })()}
            </div>
          )}
          <div className={`text-xs sm:text-sm transition-colors duration-500 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            ${dayStats.leastProfitableDay.profit !== Infinity ? dayStats.leastProfitableDay.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : parseFloat(stats.largestLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Total Trades */}
        <div className={statCardShell(isDark, practiceMode)}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-xs sm:text-sm font-medium transition-colors duration-500 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Total Trades
            </h3>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-2 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {stats.totalTrades}
          </p>
          <div className={`text-xs sm:text-sm transition-colors duration-500 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {totalLots.toLocaleString('en-US')} total lots
          </div>
        </div>
      </div>

      {/* Third Row - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Trade Duration */}
        <div className={statCardShell(isDark, practiceMode)}>
          <h3 className={`text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center gap-2 transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            Trade Duration
          </h3>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Average Trade Duration
              </span>
              <span className={`font-semibold text-xs sm:text-sm transition-colors duration-500 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {formatDuration(durationStats.avgDuration)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Average Win Duration
              </span>
              <span className="font-semibold text-xs sm:text-sm transition-colors duration-500 text-emerald-400">
                {formatDuration(durationStats.avgWinDuration)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className={`transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Average Loss Duration
              </span>
              <span className="font-semibold text-xs sm:text-sm transition-colors duration-500 text-red-400">
                {formatDuration(durationStats.avgLossDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Best/Worst Trade */}
        <div className="space-y-4 sm:space-y-4">
          {/* Best Trade */}
          <div className={statCardShell(isDark, practiceMode)}>
            <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2 transition-colors duration-500 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              Best Trade
            </h3>
            {bestTrade ? (
              <div className="space-y-2">
                <div className={`text-lg sm:text-xl font-bold transition-colors duration-500 text-emerald-400`}>
                  ${(() => {
                    // Trades may include gross P/L and fees separately
                    // Net P&L = pnL - fees
                    // Get gross P&L from originalTrade if available
                    let grossPnl = 0
                    if (bestTrade.originalTrade && bestTrade.originalTrade.pnL !== undefined) {
                      grossPnl = bestTrade.originalTrade.pnL
                    } else {
                      grossPnl = calculateTradePnL(bestTrade)
                    }
                    
                    // Subtract fees - use fees directly from trade data
                    const fees = bestTrade.fees || bestTrade.originalTrade?.fees || 0
                    const netPnl = grossPnl - fees
                    return netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  })()}
                </div>
                <div className="space-y-1">
                  <div className={`text-xs transition-colors duration-500 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {(bestTrade.direction || 'LONG').toUpperCase()} • {bestTrade.symbol || 'N/A'}
                  </div>
                  <div className={`text-xs transition-colors duration-500 ${
                    isDark ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {(() => {
                      const entryTime = parseTradeTimestamp(bestTrade.entry_time)
                      if (!entryTime) return 'N/A'
                      return entryTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
                             ' • ' + entryTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    })()}
                  </div>
                  <div className={`text-xs transition-colors duration-500 ${
                    isDark ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {Math.abs(bestTrade.contracts || 0)} contracts
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-sm transition-colors duration-500 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                No trades available
              </div>
            )}
          </div>

          {/* Worst Trade */}
          <div className={statCardShell(isDark, practiceMode)}>
            <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2 transition-colors duration-500 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              Worst Trade
            </h3>
            {worstTrade ? (
              <div className="space-y-2">
                <div className={`text-lg sm:text-xl font-bold transition-colors duration-500 text-red-400`}>
                  ${(() => {
                    // Trades may include gross P/L and fees separately
                    // Net P&L = pnL - fees
                    // Get gross P&L from originalTrade if available
                    let grossPnl = 0
                    if (worstTrade.originalTrade && worstTrade.originalTrade.pnL !== undefined) {
                      grossPnl = worstTrade.originalTrade.pnL
                    } else {
                      grossPnl = calculateTradePnL(worstTrade)
                    }
                    
                    // Subtract fees - use fees directly from trade data
                    const fees = worstTrade.fees || worstTrade.originalTrade?.fees || 0
                    const netPnl = grossPnl - fees
                    return netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  })()}
                </div>
                <div className="space-y-1">
                  <div className={`text-xs transition-colors duration-500 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {(worstTrade.direction || 'SHORT').toUpperCase()} • {worstTrade.symbol || 'N/A'}
                  </div>
                  <div className={`text-xs transition-colors duration-500 ${
                    isDark ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {(() => {
                      const entryTime = parseTradeTimestamp(worstTrade.entry_time)
                      if (!entryTime) return 'N/A'
                      return entryTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
                             ' • ' + entryTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    })()}
                  </div>
                  <div className={`text-xs transition-colors duration-500 ${
                    isDark ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {Math.abs(worstTrade.contracts || 0)} contracts
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-sm transition-colors duration-500 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                No trades available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk row — Avg R, max drawdown, streaks (only when riskStats provided) */}
      {riskStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {([
            {
              title: 'Avg R',
              Icon: Target,
              value: riskStats.avgR == null ? '—' : `${riskStats.avgR > 0 ? '+' : ''}${riskStats.avgR.toFixed(2)}R`,
              valueClass: riskStats.avgR == null
                ? (isDark ? 'text-slate-500' : 'text-slate-400')
                : riskStats.avgR >= 0 ? 'text-emerald-400' : 'text-red-400',
              sub: riskStats.tradesWithR > 0
                ? `${riskStats.tradesWithR} trade${riskStats.tradesWithR === 1 ? '' : 's'} with a stop`
                : 'Set stop losses to track R',
            },
            {
              title: 'Max Drawdown',
              Icon: TrendingDown,
              value: `-$${riskStats.maxDrawdown.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              valueClass: 'text-red-400',
              sub: riskStats.maxDrawdownPct != null ? `${riskStats.maxDrawdownPct.toFixed(2)}% from peak` : null,
            },
            {
              title: 'Longest Win Streak',
              Icon: TrendingUp,
              value: String(riskStats.longestWinStreak),
              valueClass: 'text-emerald-400',
              sub: riskStats.currentStreak > 0 ? `Current: ${riskStats.currentStreak} wins` : null,
            },
            {
              title: 'Longest Loss Streak',
              Icon: TrendingDown,
              value: String(riskStats.longestLossStreak),
              valueClass: 'text-red-400',
              sub: riskStats.currentStreak < 0 ? `Current: ${Math.abs(riskStats.currentStreak)} losses` : null,
            },
          ] as const).map(({ title, Icon, value, valueClass, sub }) => (
            <div key={title} className={statCardShell(isDark, practiceMode)}>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {title}
                </h3>
                <Icon className={statIconClass(isDark, practiceMode)} />
              </div>
              <p className={`text-2xl sm:text-3xl font-bold mb-1 ${valueClass}`}>{value}</p>
              {sub && <p className="text-xs text-slate-500">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Fourth Row - Equity Curve, Trade Duration Analysis, Win Rate Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Equity Curve */}
        <div className={`lg:col-span-1 ${statCardShell(isDark, practiceMode)} flex flex-col`}>
          {!practiceMode ? (
            <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 transition-colors duration-500 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Equity Curve
            </h3>
          ) : null}
          <div className="flex-1 min-h-[200px]">
            <EquityCurve
              isDark={isDark} 
              data={equityCurveData} 
              initialBalance={initialBalance}
              embed={practiceMode}
            />
          </div>
        </div>

        {/* Trade Duration Analysis */}
        <TradeDurationAnalysis isDark={isDark} data={durationAnalysisData} />

        {/* Win Rate Analysis */}
        <WinRateAnalysis isDark={isDark} data={winRateAnalysisData} />
      </div>
    </div>
  )
}

export default OverviewTab
