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

  // Parse date string (YYYY-MM-DD) to Date object in local timezone
  // This prevents timezone issues where UTC dates appear as previous day
  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    // Create date at midnight in local timezone (not UTC)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  }

  // Format the session date
  const formatSessionDate = (dateString: string): { full: string; short: string } => {
    const date = parseDateString(dateString)
    return {
      full: date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      short: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    }
  }

  const sessionDate = formatSessionDate(session.startDate)

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string): string => {
    return dateString // Already in YYYY-MM-DD format
  }

  const handlePrevious = () => {
    if (tradeHandler) {
      tradeHandler.logDateNavigation('previous', session.startDate)
    }
  }

  const handleNext = () => {
    if (tradeHandler) {
      tradeHandler.logDateNavigation('next', session.startDate)
    }
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
    // Trigger click on the date input to open native date picker
    if (dateInputRef.current) {
      dateInputRef.current.focus()
      // Try showPicker() method first (modern browsers), fallback to click()
      if (typeof dateInputRef.current.showPicker === 'function') {
        try {
          dateInputRef.current.showPicker()
        } catch (err) {
          dateInputRef.current.click()
        }
      } else {
        dateInputRef.current.click()
      }
    }
  }

  return (
    <div className={`${compact ? 'w-full max-w-full' : 'w-full sm:w-auto'} relative`}>
      <div
        className={`flex items-center justify-center gap-2 px-2 py-1 rounded-lg border ${
          compact ? 'w-full max-w-full' : 'w-full sm:w-auto'
        } ${
          isDark
            ? 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            : 'bg-white/95 border-slate-200 text-slate-700'
        }`}
      >
        <button
          onClick={handlePrevious}
          className={`p-1.5 sm:p-1 rounded transition-all flex-shrink-0 ${
            isDark
              ? 'hover:bg-slate-700 text-slate-300 cursor-pointer active:bg-slate-600'
              : 'hover:bg-slate-100 text-slate-600 cursor-pointer active:bg-slate-200'
          }`}
          aria-label="Previous date"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Date Display / Calendar Input */}
        <div className="flex items-center gap-1 flex-1 sm:flex-none min-w-0">
          <div className="flex-1 sm:flex-none relative min-w-0">
            <button
              onClick={handleCalendarClick}
              className={`w-full px-1 sm:px-2 text-xs sm:text-sm font-medium text-center min-w-0 cursor-pointer rounded transition-all ${
                isDark 
                  ? 'text-slate-200 hover:bg-slate-700/50' 
                  : 'text-slate-700 hover:bg-slate-100/50'
              }`}
              aria-label="Select date"
            >
              <span className="hidden sm:inline">{sessionDate.full}</span>
              <span className="sm:hidden">{sessionDate.short}</span>
            </button>
            {/* Date input overlay for direct clicks - positioned over the date button */}
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
          <button
            onClick={handleCalendarClick}
            className={`p-1 rounded transition-all flex-shrink-0 ${
              isDark
                ? 'hover:bg-slate-700 text-slate-300 cursor-pointer active:bg-slate-600'
                : 'hover:bg-slate-100 text-slate-600 cursor-pointer active:bg-slate-200'
            }`}
            aria-label="Open calendar"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleNext}
          className={`p-1.5 sm:p-1 rounded transition-all flex-shrink-0 ${
            isDark
              ? 'hover:bg-slate-700 text-slate-300 cursor-pointer active:bg-slate-600'
              : 'hover:bg-slate-100 text-slate-600 cursor-pointer active:bg-slate-200'
          }`}
          aria-label="Next date"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  )
}

export default SessionDateNavigation
