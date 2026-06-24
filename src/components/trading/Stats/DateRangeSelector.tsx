import { DateRangeSelectorProps } from '../../../types/common'

function StatsDateInput({
  id,
  value,
  min,
  max,
  isDark,
  onChange,
}: {
  id: string
  value: string
  min?: string
  max?: string
  isDark: boolean
  onChange: (value: string) => void
}) {
  return (
    <div
      className={`date-input-shell ${isDark ? 'date-input-shell-dark' : 'date-input-shell-light'}`}
    >
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="date-input-field"
      />
    </div>
  )
}

const DateRangeSelector = ({
  isDark,
  practiceMode,
  dateRange,
  referenceDate,
  onDateRangeChange,
  formatDateForInput,
}: DateRangeSelectorProps & { practiceMode?: boolean }) => {
  const handleQuickSelect = (type: 'all' | 'today' | 'lastWeek' | 'lastMonth') => {
    if (type === 'all') {
      const endDate = new Date()
      const startDate = new Date()
      if (practiceMode) {
        startDate.setFullYear(endDate.getFullYear() - 5)
      } else {
        startDate.setDate(endDate.getDate() - 30)
      }
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

  const todayMax = formatDateForInput(referenceDate)

  return (
    <div
      className={`mb-4 sm:mb-6 rounded-xl border max-w-3xl min-w-0 w-full overflow-hidden ${practiceMode ? '' : 'mx-auto'} ${
        practiceMode
          ? isDark
            ? 'bg-slate-950/80 border-slate-700/80'
            : 'bg-slate-50 border-slate-200'
          : isDark
            ? 'bg-slate-900/50 border-slate-700/50 backdrop-blur-sm'
            : 'bg-white/50 border-slate-200/50 backdrop-blur-sm'
      }`}
    >
      <div className="p-3 sm:p-4 min-w-0 overflow-hidden">
        <div className="flex flex-col gap-3 min-w-0 max-w-full">
          <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:flex-wrap">
            <span className={`shrink-0 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Quick Select:
            </span>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 min-w-0 max-w-full">
              {(['all', 'today', 'lastWeek', 'lastMonth'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleQuickSelect(key)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
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

          <div className="grid grid-cols-1 gap-3 min-w-0 w-full max-w-full lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            <div className="min-w-0 w-full max-w-full overflow-hidden">
              <label
                htmlFor="stats-start-date"
                className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                Start Date
              </label>
              <StatsDateInput
                id="stats-start-date"
                value={dateRange.startDate}
                max={dateRange.endDate || undefined}
                isDark={isDark}
                onChange={(startDate) => onDateRangeChange({ ...dateRange, startDate })}
              />
            </div>

            <div className="hidden lg:flex pb-2 shrink-0 px-1 self-end">
              <span className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
            </div>

            <div className="min-w-0 w-full max-w-full overflow-hidden">
              <label
                htmlFor="stats-end-date"
                className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                End Date
              </label>
              <StatsDateInput
                id="stats-end-date"
                value={dateRange.endDate}
                min={dateRange.startDate || undefined}
                max={todayMax}
                isDark={isDark}
                onChange={(endDate) => onDateRangeChange({ ...dateRange, endDate })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DateRangeSelector
