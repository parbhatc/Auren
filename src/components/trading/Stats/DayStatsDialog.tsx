import { X } from 'lucide-react'
import TradingTimeline from './TradingTimeline'
import { DayStatsDialogProps } from '../../../types/common'

const DayStatsDialog = ({
  isDark,
  selectedDayData,
  tradesLoading = false,
  selectedTimelinePoint,
  symbolData,
  onClose,
  onTimelinePointClick,
  onTimelinePointClose,
  calculateTradePnL,
  parseTradeTimestamp,
  formatCurrency
}: DayStatsDialogProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className={`rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
          isDark 
            ? 'bg-slate-900 border-slate-700' 
            : 'bg-white border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header */}
        <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${
          isDark ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {(() => {
                const [year, month, day] = selectedDayData.date.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                return date.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })
              })()}
            </h2>
            <p className={`text-sm mt-1 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Trading Statistics
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
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-4 sm:p-6 space-y-6 relative">
          {tradesLoading && (
            <div
              className={`absolute inset-0 z-10 flex items-center justify-center rounded-lg ${
                isDark ? 'bg-slate-900/80' : 'bg-white/80'
              }`}
            >
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Loading trades…</span>
            </div>
          )}
          {/* Profit/Loss Card */}
          <div className={`rounded-lg p-4 border ${
            selectedDayData.profit >= 0
              ? isDark ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
              : isDark ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Net P&L
              </span>
              <span className={`text-2xl sm:text-3xl font-bold ${
                selectedDayData.profit >= 0
                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                  : isDark ? 'text-red-400' : 'text-red-600'
              }`}>
                {formatCurrency(selectedDayData.profit, false)}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Total Trades */}
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Total Trades
              </div>
              <div className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {selectedDayData.totalTrades}
              </div>
            </div>

            {/* Total Contracts */}
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Total Contracts
              </div>
              <div className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {selectedDayData.totalContracts}
              </div>
            </div>

            {/* Win Rate */}
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Win Rate
              </div>
              <div className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {selectedDayData.totalTrades > 0 
                  ? ((selectedDayData.wins / selectedDayData.totalTrades) * 100).toFixed(1)
                  : '0'
                }%
              </div>
            </div>

            {/* Long Trades */}
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Long Trades
              </div>
              <div className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {selectedDayData.longTrades}
              </div>
              <div className={`text-xs mt-1 ${
                isDark ? 'text-slate-500' : 'text-slate-600'
              }`}>
                {selectedDayData.longContracts} contracts
              </div>
            </div>

            {/* Short Trades */}
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Short Trades
              </div>
              <div className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {selectedDayData.shortTrades}
              </div>
              <div className={`text-xs mt-1 ${
                isDark ? 'text-slate-500' : 'text-slate-600'
              }`}>
                {selectedDayData.shortContracts} contracts
              </div>
            </div>

            {/* Total Fees */}
            <div className={`rounded-lg p-4 border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`text-xs font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Total Fees
              </div>
              <div className={`text-xl font-bold ${
                isDark ? 'text-red-400' : 'text-red-600'
              }`}>
                ${selectedDayData.totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Wins/Losses Breakdown */}
          <div className={`rounded-lg p-4 border ${
            isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className={`text-sm font-semibold mb-3 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Trade Results
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className={`text-xs font-medium mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Wins
                </div>
                <div className={`text-lg font-bold ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`}>
                  {selectedDayData.wins}
                </div>
              </div>
              <div className="flex-1">
                <div className={`text-xs font-medium mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Losses
                </div>
                <div className={`text-lg font-bold ${
                  isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                  {selectedDayData.losses}
                </div>
              </div>
            </div>
          </div>

          {/* Trading Timeline */}
          {selectedDayData.trades && selectedDayData.trades.length > 0 && (
            <TradingTimeline
              isDark={isDark}
              trades={selectedDayData.trades}
              profit={selectedDayData.profit}
              date={selectedDayData.date}
              symbolData={symbolData}
              selectedTimelinePoint={selectedTimelinePoint}
              onPointClick={onTimelinePointClick}
              onPointClose={onTimelinePointClose}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
            />
          )}

          {/* All Trades List */}
          {selectedDayData.trades && selectedDayData.trades.length > 0 && (
            <div className={`rounded-lg border ${
              isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`p-4 border-b ${
                isDark ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <div className={`text-sm font-semibold ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  All Trades ({selectedDayData.trades.length})
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
                        Time
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
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Entry
                      </th>
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Exit
                      </th>
                      <th className={`text-left py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Duration
                      </th>
                      <th className={`text-right py-2 px-3 text-xs font-semibold ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDayData.trades
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
                        const exitTime = parseTradeTimestamp(trade.exit_time)
                        const duration = entryTime && exitTime 
                          ? Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000)
                          : null
                        
                        const formatDuration = (seconds: number): string => {
                          if (!seconds || seconds < 0) return '0 min 0 sec'
                          const mins = Math.floor(seconds / 60)
                          const secs = seconds % 60
                          if (mins === 0) return `${secs} sec`
                          if (secs === 0) return `${mins} min`
                          return `${mins} min ${secs} sec`
                        }
                        
                        return (
                          <tr
                            key={index}
                            className={`border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'} hover:${
                              isDark ? 'bg-slate-700/50' : 'bg-slate-50'
                            } transition-colors`}
                          >
                            <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {entryTime ? entryTime.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              }) : '—'}
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
                            <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {trade.entry_price?.toFixed(2) || '—'}
                            </td>
                            <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {trade.exit_price?.toFixed(2) || '—'}
                            </td>
                            <td className={`py-2 px-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {duration !== null ? formatDuration(duration) : '—'}
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

export default DayStatsDialog

