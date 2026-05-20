import TradingTimeline from './TradingTimeline'
import { WeekStatsDialogProps } from '../../../types/common'

const WeekStatsDialog = ({
  isDark,
  selectedWeekData,
  symbolData,
  selectedTimelinePoint,
  onClose,
  onTimelinePointClick,
  onTimelinePointClose,
  calculateTradePnL,
  parseTradeTimestamp
}: WeekStatsDialogProps) => {
  const wins = selectedWeekData.trades.filter(t => {
    const grossPnl = calculateTradePnL(t)
    let fees = 0
    if (t.fees !== undefined || t.originalTrade?.fees !== undefined) {
      fees = t.fees || t.originalTrade?.fees || 0
    } else {
    const symbol = t.symbol || ''
    const symbolInfo = symbolData?.[symbol]
    const totalFees = symbolInfo?.totalFees || 0
      fees = totalFees * Math.abs(t.contracts || 0)
    }
    return (grossPnl - fees) > 0
  }).length

  const losses = selectedWeekData.trades.filter(t => {
    const grossPnl = calculateTradePnL(t)
    let fees = 0
    if (t.fees !== undefined || t.originalTrade?.fees !== undefined) {
      fees = t.fees || t.originalTrade?.fees || 0
    } else {
    const symbol = t.symbol || ''
    const symbolInfo = symbolData?.[symbol]
    const totalFees = symbolInfo?.totalFees || 0
      fees = totalFees * Math.abs(t.contracts || 0)
    }
    return (grossPnl - fees) <= 0
  }).length

  const winRate = selectedWeekData.totalTrades > 0 
    ? ((wins / selectedWeekData.totalTrades) * 100).toFixed(1)
    : '0.0'

  const startDate = new Date(selectedWeekData.startDate)
  const endDate = new Date(selectedWeekData.endDate)
  const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`rounded-xl border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${
          isDark
            ? 'bg-slate-900 border-slate-700'
            : 'bg-white border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Week {selectedWeekData.weekNumber} Statistics
            </h2>
            <p className={`text-sm mt-1 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {dateRange}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Profit/Loss Card */}
          <div className={`rounded-xl p-4 sm:p-6 border ${
            selectedWeekData.profit >= 0
              ? isDark ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
              : isDark ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-sm font-medium mb-2 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Week P&L
            </div>
            <div className={`text-3xl sm:text-4xl font-bold ${
              selectedWeekData.profit >= 0
                ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                : isDark ? 'text-red-400' : 'text-red-600'
            }`}>
              {selectedWeekData.profit >= 0 ? '+' : ''}${selectedWeekData.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Total Trades
              </div>
              <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {selectedWeekData.totalTrades}
              </div>
            </div>
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Wins
              </div>
              <div className={`text-xl font-bold text-emerald-400`}>
                {wins}
              </div>
            </div>
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Losses
              </div>
              <div className={`text-xl font-bold text-red-400`}>
                {losses}
              </div>
            </div>
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Win Rate
              </div>
              <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {winRate}%
              </div>
            </div>
          </div>

          {/* Trading Timeline */}
          {selectedWeekData.trades && selectedWeekData.trades.length > 0 && (
            <TradingTimeline
              isDark={isDark}
              trades={selectedWeekData.trades}
              profit={selectedWeekData.profit}
              date={`${selectedWeekData.startDate}-${selectedWeekData.endDate}`}
              symbolData={symbolData}
              selectedTimelinePoint={selectedTimelinePoint || null}
              onPointClick={onTimelinePointClick || (() => {})}
              onPointClose={onTimelinePointClose || (() => {})}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
            />
          )}

          {/* All Trades Table */}
          {selectedWeekData.trades && selectedWeekData.trades.length > 0 && (
            <div className={`rounded-lg border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`p-4 border-b ${
                isDark ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <div className={`text-sm font-semibold ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  All Trades ({selectedWeekData.trades.length})
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${
                      isDark ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Date
                      </th>
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Symbol
                      </th>
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Direction
                      </th>
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Size
                      </th>
                      <th className={`text-right py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWeekData.trades
                      .sort((a, b) => {
                        const timeA = parseTradeTimestamp(a.entry_time)?.getTime() || 0
                        const timeB = parseTradeTimestamp(b.entry_time)?.getTime() || 0
                        return timeB - timeA
                      })
                      .map((trade, index) => {
                        const grossPnl = calculateTradePnL(trade)
                        // Get fees - use trade.fees when present, else symbol data
                        let fees = 0
                        if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
                          fees = trade.fees || trade.originalTrade?.fees || 0
                        } else {
                        const symbol = trade.symbol || ''
                        const symbolInfo = symbolData?.[symbol]
                        const totalFees = symbolInfo?.totalFees || 0
                          fees = totalFees * Math.abs(trade.contracts || 0)
                        }
                        const netPnl = grossPnl - fees
                        const isProfit = netPnl > 0
                        const entryTime = parseTradeTimestamp(trade.entry_time)
                        
                        return (
                          <tr
                            key={index}
                            className={`border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'} hover:${
                              isDark ? 'bg-slate-700/50' : 'bg-slate-50'
                            } transition-colors`}
                          >
                            <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {entryTime ? entryTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            </td>
                            <td className={`py-2 px-3 text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {trade.symbol || '—'}
                            </td>
                            <td className={`py-2 px-3 text-xs font-medium ${
                              trade.direction?.toLowerCase() === 'long'
                                ? isDark ? 'text-green-400' : 'text-green-600'
                                : isDark ? 'text-red-400' : 'text-red-600'
                            }`}>
                              {trade.direction?.toUpperCase() || '—'}
                            </td>
                            <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {Math.abs(trade.contracts || 0)}
                            </td>
                            <td className={`py-2 px-3 text-xs font-semibold text-right ${
                              isProfit
                                ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                                : isDark ? 'text-red-400' : 'text-red-600'
                            }`}>
                              {netPnl >= 0 ? '+' : ''}${netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WeekStatsDialog

