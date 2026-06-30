import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { SessionDateNavigationProps } from '../../../types/backtester'

/**
 * Session Date Navigation Component
 * Displays current session date with next/previous navigation buttons and calendar selector
 * Logs navigation to BacktesterTradeHandler when buttons are pressed
 */
const SessionDateNavigation = ({
  isDark,
  session,
  tradeHandler,
  compact = false,
}: SessionDateNavigationProps & { compact?: boolean }) => {
  const dateInputRef = useRef<HTMLInputElement>(null)

  if (!session) {
    return null
  }

  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  }

  const formatSessionDate = (dateString: string): { full: string; medium: string; short: string } => {
    const date = parseDateString(dateString)
    return {
      full: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }),
      medium: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }),
      short: date.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
      }),
    }
  }

  const sessionDate = formatSessionDate(session.startDate)

  const formatDateForInput = (dateString: string): string => dateString

  const handlePrevious = () => {
    tradeHandler?.logDateNavigation('previous', session.startDate)
  }

  const handleNext = () => {
    tradeHandler?.logDateNavigation('next', session.startDate)
  }

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value
    if (tradeHandler && selectedDate) {
      tradeHandler.logDateNavigation('calendar', selectedDate)
    }
  }

  const handleCalendarClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dateInputRef.current) return
    dateInputRef.current.focus()
    if (typeof dateInputRef.current.showPicker === 'function') {
      try {
        dateInputRef.current.showPicker()
      } catch {
        dateInputRef.current.click()
      }
    } else {
      dateInputRef.current.click()
    }
  }

  const toolbarChipShell = isDark
    ? 'border border-[#475569]/60 bg-[#0f172a]/80 text-[#e6edf3]'
    : 'border border-slate-200 bg-white/95 text-slate-700'
  const toolbarChipBtn = isDark
    ? 'text-[#94a3b8] hover:text-[#e6edf3] hover:bg-[#1e293b]/80 active:bg-[#1e293b]'
    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200'

  const shell = compact
    ? toolbarChipShell
    : isDark
      ? 'bg-slate-900/90 border-slate-700/80 text-slate-200'
      : 'bg-white/95 border-slate-200 text-slate-700'
  const btn = compact
    ? toolbarChipBtn
    : isDark
      ? 'hover:bg-slate-700 text-slate-300 active:bg-slate-600'
      : 'hover:bg-slate-100 text-slate-600 active:bg-slate-200'
  const dateBtn = compact
    ? isDark
      ? 'text-[#e6edf3] hover:bg-[#1e293b]/80'
      : 'text-slate-700 hover:bg-slate-100/50'
    : isDark
      ? 'text-slate-200 hover:bg-slate-700/50'
      : 'text-slate-700 hover:bg-slate-100/50'

  return (
    <div className={`session-date-nav ${compact ? 'session-date-nav--compact' : ''} relative min-w-0`}>
      <div
        className={`session-date-nav__shell flex items-center justify-center rounded-md border ${shell} ${
          compact ? 'gap-0.5 px-1 py-0.5' : 'gap-1 px-2 py-1 rounded-lg'
        }`}
      >
        <button
          type="button"
          onClick={handlePrevious}
          className={`session-date-nav__btn rounded transition-colors flex-shrink-0 ${btn} ${
            compact ? 'p-0.5' : 'p-1'
          }`}
          aria-label="Previous date"
        >
          <ChevronLeft className={compact ? 'w-3 h-3' : 'w-4 h-4'} aria-hidden />
        </button>

        <div className="flex items-center min-w-0 flex-1 justify-center">
          <div className="relative min-w-0 max-w-full">
            <button
              type="button"
              onClick={handleCalendarClick}
              className={`session-date-nav__date w-full px-0.5 font-medium text-center truncate cursor-pointer rounded transition-colors ${dateBtn} ${
                compact ? 'text-[11px] leading-tight' : 'text-xs sm:text-sm'
              }`}
              aria-label="Select date"
              title={sessionDate.full}
            >
              {compact ? sessionDate.medium : (
                <>
                  <span className="hidden sm:inline">{sessionDate.full}</span>
                  <span className="sm:hidden">{sessionDate.medium}</span>
                </>
              )}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={formatDateForInput(session.startDate)}
              onChange={handleDateSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Select date"
              min="2000-01-01"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          {!compact && (
            <button
              type="button"
              onClick={handleCalendarClick}
              className={`p-1 rounded transition-colors flex-shrink-0 ${btn}`}
              aria-label="Open calendar"
            >
              <Calendar className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className={`session-date-nav__btn rounded transition-colors flex-shrink-0 ${btn} ${
            compact ? 'p-0.5' : 'p-1'
          }`}
          aria-label="Next date"
        >
          <ChevronRight className={compact ? 'w-3 h-3' : 'w-4 h-4'} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export default SessionDateNavigation
