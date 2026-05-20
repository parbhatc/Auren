import Modal from '../../ui/Modal'
import TradingTimeline from './TradingTimeline'
import { DayStatsDialogProps } from '../../../types/common'
import { resolvePracticeTradeFees } from '../../../services/practice/practiceCommission'

function formatDayTitle(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

function tradeNetPnl(
  trade: DayStatsDialogProps['selectedDayData']['trades'][0],
  calculateTradePnL: DayStatsDialogProps['calculateTradePnL'],
  symbolData: DayStatsDialogProps['symbolData']
): number {
  const grossPnl = calculateTradePnL(trade)
  let fees = resolvePracticeTradeFees(trade)
  if (fees <= 0) {
    const symbolInfo = symbolData?.[trade.symbol || '']
    fees = (symbolInfo?.totalFees || 0) * Math.abs(trade.contracts || 0)
  }
  return grossPnl - fees
}

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
  formatCurrency,
}: DayStatsDialogProps) => {
  const winRate =
    selectedDayData.totalTrades > 0
      ? ((selectedDayData.wins / selectedDayData.totalTrades) * 100).toFixed(1)
      : '0'
  const profitPositive = selectedDayData.profit >= 0
  const sortedTrades = [...(selectedDayData.trades || [])].sort((a, b) => {
    const timeA = parseTradeTimestamp(a.entry_time)?.getTime() || 0
    const timeB = parseTradeTimestamp(b.entry_time)?.getTime() || 0
    return timeA - timeB
  })

  const shell = isDark
    ? 'rounded-xl border border-slate-800/80 bg-slate-950/40'
    : 'rounded-xl border border-slate-200 bg-slate-50/80'

  const label = isDark ? 'text-slate-500' : 'text-slate-500'
  const value = isDark ? 'text-slate-100' : 'text-slate-900'

  const metrics = [
    { label: 'Trades', value: String(selectedDayData.totalTrades) },
    { label: 'Contracts', value: String(selectedDayData.totalContracts) },
    { label: 'Win rate', value: `${winRate}%` },
    {
      label: 'W / L',
      value: `${selectedDayData.wins} / ${selectedDayData.losses}`,
      accent: true,
    },
    {
      label: 'Long',
      value: `${selectedDayData.longTrades}`,
      sub: `${selectedDayData.longContracts} ct`,
    },
    {
      label: 'Short',
      value: `${selectedDayData.shortTrades}`,
      sub: `${selectedDayData.shortContracts} ct`,
    },
    {
      label: 'Fees',
      value: `$${selectedDayData.totalFees.toFixed(2)}`,
      danger: true,
    },
  ]

  return (
    <Modal
      isOpen
      isDark={isDark}
      onClose={onClose}
      size="xl"
      bodyClassName="max-h-[min(82vh,720px)]"
      title={formatDayTitle(selectedDayData.date)}
      subtitle={`${selectedDayData.totalTrades} trade${selectedDayData.totalTrades === 1 ? '' : 's'} · ${selectedDayData.totalContracts} contracts`}
    >
      <div className="space-y-5 relative">
        {tradesLoading && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl ${
              isDark ? 'bg-slate-950/85' : 'bg-white/85'
            }`}
          >
            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Loading trades…</span>
          </div>
        )}

        <div
          className={`rounded-2xl px-5 py-6 text-center border ${
            profitPositive
              ? isDark
                ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent'
                : 'border-emerald-200 bg-gradient-to-b from-emerald-50 to-white'
              : isDark
                ? 'border-red-500/30 bg-gradient-to-b from-red-500/10 to-transparent'
                : 'border-red-200 bg-gradient-to-b from-red-50 to-white'
          }`}
        >
          <p className={`text-xs font-medium uppercase tracking-wider ${label}`}>Net P&L</p>
          <p
            className={`mt-1 text-3xl sm:text-4xl font-bold tabular-nums ${
              profitPositive
                ? isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-600'
                : isDark
                  ? 'text-red-400'
                  : 'text-red-600'
            }`}
          >
            {formatCurrency(selectedDayData.profit, false)}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className={`${shell} px-3 py-2.5`}>
              <p className={`text-[10px] font-medium uppercase tracking-wide ${label}`}>{m.label}</p>
              <p
                className={`mt-0.5 text-base font-semibold tabular-nums ${
                  m.danger
                    ? isDark
                      ? 'text-red-400'
                      : 'text-red-600'
                    : m.accent
                      ? isDark
                        ? 'text-violet-300'
                        : 'text-violet-700'
                      : value
                }`}
              >
                {m.value}
              </p>
              {m.sub ? <p className={`text-[10px] mt-0.5 ${label}`}>{m.sub}</p> : null}
            </div>
          ))}
        </div>

        {sortedTrades.length > 0 && (
          <TradingTimeline
            isDark={isDark}
            trades={sortedTrades}
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

        {sortedTrades.length > 0 && (
          <div className="space-y-2">
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Trades ({sortedTrades.length})
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...sortedTrades].reverse().map((trade, index) => {
                const netPnl = tradeNetPnl(trade, calculateTradePnL, symbolData)
                const isProfit = netPnl > 0
                const entryTime = parseTradeTimestamp(trade.entry_time)
                const exitTime = parseTradeTimestamp(trade.exit_time)
                const duration =
                  entryTime && exitTime
                    ? Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000)
                    : null
                const isLong = trade.direction?.toLowerCase() === 'long'

                return (
                  <div
                    key={`${trade.symbol}-${index}-${trade.entry_time}`}
                    className={`${shell} px-3 py-3 flex flex-wrap items-center gap-x-3 gap-y-2`}
                  >
                    <div className="min-w-[4.5rem]">
                      <p className={`text-[10px] ${label}`}>Time</p>
                      <p className={`text-xs font-medium ${value}`}>
                        {entryTime
                          ? entryTime.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${label}`}>Symbol</p>
                      <p className={`text-xs font-semibold ${value}`}>{trade.symbol || '—'}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${label}`}>Side</p>
                      <p
                        className={`text-xs font-semibold ${
                          isLong
                            ? isDark
                              ? 'text-emerald-400'
                              : 'text-emerald-600'
                            : isDark
                              ? 'text-red-400'
                              : 'text-red-600'
                        }`}
                      >
                        {trade.direction?.toUpperCase() || '—'}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${label}`}>Size</p>
                      <p className={`text-xs tabular-nums ${value}`}>{Math.abs(trade.contracts || 0)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className={`text-[10px] ${label}`}>Entry → Exit</p>
                      <p className={`text-xs tabular-nums ${value}`}>
                        {trade.entry_price?.toFixed(2) ?? '—'} → {trade.exit_price?.toFixed(2) ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[10px] ${label}`}>Hold</p>
                      <p className={`text-xs ${value}`}>
                        {duration !== null ? formatDuration(duration) : '—'}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className={`text-[10px] ${label}`}>P&L</p>
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isProfit
                            ? isDark
                              ? 'text-emerald-400'
                              : 'text-emerald-600'
                            : isDark
                              ? 'text-red-400'
                              : 'text-red-600'
                        }`}
                      >
                        {netPnl >= 0 ? '+' : ''}$
                        {netPnl.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {sortedTrades.length === 0 && !tradesLoading && (
          <p className={`text-sm text-center py-6 ${label}`}>No trades recorded for this day.</p>
        )}
      </div>
    </Modal>
  )
}

export default DayStatsDialog
