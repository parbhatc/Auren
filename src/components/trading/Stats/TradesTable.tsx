import { TradesTableProps } from '../../../types/common'
import { getTradeCalendarDate } from '../../../utils/tradeCalendarDate'

const TradesTable = ({
  isDark,
  loading,
  trades,
  dateRange,
  symbolData,
  calculateTradePnL,
  parseTradeTimestamp,
  calculateTradeDuration,
  formatDuration,
}: TradesTableProps) => {
  const rangedTrades =
    dateRange?.startDate && dateRange?.endDate
      ? trades.filter((trade) => {
          const tradeDate = getTradeCalendarDate(trade, parseTradeTimestamp)
          return (
            tradeDate &&
            tradeDate >= dateRange.startDate &&
            tradeDate <= dateRange.endDate
          )
        })
      : trades
  return (
    <div className={`min-w-0 rounded-lg sm:rounded-xl shadow-lg border ${
      isDark
        ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
        : 'bg-white/90 border-slate-200 backdrop-blur-sm'
    }`}>
      <div className="p-4 sm:p-6">
        <h2 className={`text-lg sm:text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Trades
        </h2>
        
        {/* Trades Table */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Date
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Symbol
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Direction
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Size
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Entry
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Exit
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Entry Time
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Exit Time
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Duration
                </th>
                <th className={`text-right py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Gross P&L
                </th>
                <th className={`text-left py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Fees
                </th>
                <th className={`text-right py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Net P&L
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className={`text-center py-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Loading trades...
                  </td>
                </tr>
              ) : rangedTrades.length === 0 ? (
                <tr>
                  <td colSpan={12} className={`text-center py-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    No trades found for the selected date range
                  </td>
                </tr>
              ) : (() => {
                // Format and sort actual trades
                const formattedTrades = rangedTrades.map((trade, index) => {
                  const entryDate =
                    (trade.entry_time != null && parseTradeTimestamp?.(trade.entry_time)) ||
                    (trade.entry_time ? new Date(trade.entry_time) : new Date())
                  const entryDateStr =
                    getTradeCalendarDate(trade, parseTradeTimestamp) ||
                    entryDate.toLocaleDateString('en-CA')
                  const entryTimeStr = entryDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })

                  let exitTimeStr: string = '—'
                  if (trade.exit_time != null) {
                    const exitDate =
                      parseTradeTimestamp?.(trade.exit_time) || new Date(trade.exit_time)
                    if (!Number.isNaN(exitDate.getTime())) {
                      exitTimeStr = exitDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })
                    }
                  }
                  
                  // Calculate P&L (gross)
                  const grossPnl = calculateTradePnL(trade)
                  
                  let fees = 0
                  const fromPractice = trade.fees ?? trade.originalTrade?.fees
                  if (fromPractice != null && Number(fromPractice) > 0) {
                    fees = Number(fromPractice)
                  } else if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
                    fees = Number(trade.fees ?? trade.originalTrade?.fees ?? 0)
                  } else {
                    const symbol = trade.symbol || ''
                    const symbolInfo = symbolData?.[symbol]
                    const totalFees = symbolInfo?.totalFees || 0
                    fees = totalFees * Math.abs(trade.contracts || 0)
                  }
                  
                  // Net P&L = gross P&L - fees
                  const netPnl = grossPnl - fees
                  const isProfit = netPnl > 0
                  
                  return {
                    id: trade.id || index,
                    date: entryDateStr,
                    symbol: trade.symbol || '—',
                    direction: trade.direction || '—',
                    size: Math.abs(trade.contracts || 0),
                    entry: trade.entry_price?.toFixed(2) || '—',
                    exit: trade.exit_price?.toFixed(2) || '—',
                    entryTime: entryTimeStr,
                    exitTime: exitTimeStr,
                    grossPnl: grossPnl.toFixed(2),
                    fees: fees.toFixed(2),
                    netPnl: netPnl.toFixed(2),
                    isProfit,
                    entryTimestamp: entryDate.getTime(),
                    originalTrade: trade // Store original trade for duration calculation
                  }
                })
                
                // Sort by entry time (newest first)
                formattedTrades.sort((a, b) => b.entryTimestamp - a.entryTimestamp)
                
                return formattedTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className={`border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'} hover:${
                      isDark ? 'bg-slate-700/50' : 'bg-slate-50'
                    } transition-colors`}
                  >
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {trade.date}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {trade.symbol}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${
                      trade.direction?.toLowerCase() === 'long'
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {trade.direction?.toUpperCase() || '—'}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {trade.size}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {trade.entry}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {trade.exit}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {trade.entryTime}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {trade.exitTime}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {(() => {
                        const duration = calculateTradeDuration(trade.originalTrade)
                        if (duration === null) return '—'
                        return formatDuration(duration)
                      })()}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium text-right ${
                      parseFloat(trade.grossPnl) >= 0
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {parseFloat(trade.grossPnl) > 0 ? '+' : ''}${parseFloat(trade.grossPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      ${parseFloat(trade.fees).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium text-right ${
                      trade.isProfit
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {parseFloat(trade.netPnl) > 0 ? '+' : ''}${parseFloat(trade.netPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default TradesTable
