import { DateRangeSelectorProps } from '../../../types/common'

const DateRangeSelector = ({
  isDark,
  practiceMode,
  dateRange,
  onDateRangeChange,
  formatDateForInput,
}: DateRangeSelectorProps & { practiceMode?: boolean }) => {
  const handleQuickSelect = (type: 'all' | 'today' | 'lastWeek' | 'lastMonth') => {
    if (type === 'all') {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 30)
      onDateRangeChange({ startDate: formatDateForInput(startDate), endDate: formatDateForInput(endDate) })
    } else if (type === 'today') {
      const today = new Date()
      onDateRangeChange({ startDate: formatDateForInput(today), endDate: formatDateForInput(today) })
    } else if (type === 'lastWeek') {
      const today = new Date()
      const lastWeek = new Date(today)
      lastWeek.setDate(today.getDate() - 7)
      onDateRangeChange({ startDate: formatDateForInput(lastWeek), endDate: formatDateForInput(today) })
    } else if (type === 'lastMonth') {
      const today = new Date()
      const lastMonth = new Date(today)
      lastMonth.setMonth(today.getMonth() - 1)
      onDateRangeChange({ startDate: formatDateForInput(lastMonth), endDate: formatDateForInput(today) })
    }
  }

  const quickLabels: Record<'all' | 'today' | 'lastWeek' | 'lastMonth', string> = {
    all: 'All',
    today: 'Today',
    lastWeek: 'Last Week',
    lastMonth: 'Last Month',
  }

  return (
    <div
      className={`mb-4 sm:mb-6 rounded-xl border max-w-3xl ${practiceMode ? '' : 'mx-auto'} ${
        practiceMode
          ? isDark
            ? 'bg-slate-950/80 border-slate-700/80'
            : 'bg-slate-50 border-slate-200'
          : isDark
            ? 'bg-slate-900/50 border-slate-700/50 backdrop-blur-sm'
            : 'bg-white/50 border-slate-200/50 backdrop-blur-sm'
      }`}
    >
      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Quick Select:
            </span>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'today', 'lastWeek', 'lastMonth'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleQuickSelect(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    practiceMode
                      ? isDark
                        ? 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border border-violet-500/30'
                        : 'bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200'
                      : isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  {quickLabels[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
                max={dateRange.endDate}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-100'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
            <div className="pt-6 shrink-0">
              <span className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
            </div>
            <div className="flex-1">
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
                min={dateRange.startDate}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-100'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DateRangeSelector
