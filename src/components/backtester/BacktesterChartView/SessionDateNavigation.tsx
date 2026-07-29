import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Shuffle,
  X,
} from 'lucide-react'
import { SessionDateNavigationProps } from '../../../types/backtester'

const HIDE_DATE_STORAGE_KEY = 'backtester_hide_date'
const MIN_YEAR = 2000
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2024, month, 1).toLocaleDateString('en-US', { month: 'short' }),
)
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type PickerMode = 'calendar' | 'random'
type RandomYear = number | 'all'

const fmtLocalYmd = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const parseDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)

const monthCanContainDate = (year: number, month: number, maxDate: Date): boolean => {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  return monthEnd >= new Date(MIN_YEAR, 0, 1) && monthStart <= maxDate
}

export function pickRandomReplayDate(
  year: RandomYear,
  months: number[],
  maxDate: Date,
): string | null {
  const eligibleDates: Date[] = []
  const years =
    year === 'all'
      ? Array.from(
          { length: maxDate.getFullYear() - MIN_YEAR + 1 },
          (_, index) => MIN_YEAR + index,
        )
      : [year]
  for (const candidateYear of years) {
    for (const month of months) {
      if (!monthCanContainDate(candidateYear, month, maxDate)) continue
      const daysInMonth = new Date(candidateYear, month + 1, 0).getDate()
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(candidateYear, month, day)
        if (date > maxDate || date < new Date(MIN_YEAR, 0, 1)) continue
        if (date.getDay() === 0 || date.getDay() === 6) continue
        eligibleDates.push(date)
      }
    }
  }
  if (!eligibleDates.length) return null
  return fmtLocalYmd(eligibleDates[Math.floor(Math.random() * eligibleDates.length)])
}

function calendarCellsForMonth(viewDate: Date): Date[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  return Array.from(
    { length: 42 },
    (_, index) => new Date(year, month, index - firstWeekday + 1),
  )
}

function formatSessionDate(dateString: string): {
  full: string
  medium: string
  short: string
} {
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

/**
 * Session date navigation mounted into BetterweightChartPro's top toolbar.
 * Uses a custom portal picker so browser-native date UI never escapes or clips
 * inside the chart toolbar.
 */
const SessionDateNavigation = ({
  isDark,
  session,
  tradeHandler,
  compact = false,
}: SessionDateNavigationProps & { compact?: boolean }) => {
  const anchorRef = useRef<HTMLDivElement>(null)
  const initialDate = parseDateString(session?.startDate ?? fmtLocalYmd(new Date()))
  const randomMaxDate = useMemo(() => {
    const date = startOfDay(new Date())
    date.setDate(date.getDate() - 7)
    return date
  }, [])
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null)
  const [viewDate, setViewDate] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  )
  const [randomYear, setRandomYear] = useState<RandomYear>(initialDate.getFullYear())
  const [randomMonths, setRandomMonths] = useState<number[]>(() =>
    Array.from({ length: 12 }, (_, month) => month).filter((month) =>
      monthCanContainDate(initialDate.getFullYear(), month, randomMaxDate),
    ),
  )
  const [pickerPosition, setPickerPosition] = useState<CSSProperties>({
    left: 8,
    top: 48,
    width: 360,
    maxHeight: 'calc(100vh - 16px)',
  })
  const [hideDate, setHideDate] = useState(() => {
    try {
      return localStorage.getItem(HIDE_DATE_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const sessionStartDate = session?.startDate
  useEffect(() => {
    if (!sessionStartDate) return
    const date = parseDateString(sessionStartDate)
    setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
  }, [sessionStartDate])

  useEffect(() => {
    if (!pickerMode) return

    const position = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const pad = 8
      const width = Math.min(360, window.innerWidth - pad * 2)
      const estimatedHeight = 570
      const below = rect.bottom + 8
      const top =
        below + estimatedHeight <= window.innerHeight
          ? below
          : Math.max(pad, rect.top - estimatedHeight - 8)
      const left = Math.max(
        pad,
        Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - pad),
      )
      setPickerPosition({ left, top, width, maxHeight: `calc(100vh - ${pad * 2}px)` })
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerMode(null)
    }

    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [pickerMode])

  const calendarCells = useMemo(() => calendarCellsForMonth(viewDate), [viewDate])
  const today = startOfDay(new Date())
  const todayIso = fmtLocalYmd(today)
  const years = Array.from({ length: today.getFullYear() - MIN_YEAR + 1 }, (_, index) =>
    today.getFullYear() - index,
  )
  const eligibleRandomMonths =
    randomYear === 'all'
      ? Array.from({ length: 12 }, (_, month) => month)
      : Array.from({ length: 12 }, (_, month) => month).filter((month) =>
          monthCanContainDate(randomYear, month, randomMaxDate),
        )

  if (!session) return null

  const sessionDate = formatSessionDate(session.startDate)

  const navigateToDate = (selectedDate: string) => {
    tradeHandler?.logDateNavigation('calendar', selectedDate)
    setPickerMode(null)
  }

  const handlePrevious = () => {
    tradeHandler?.logDateNavigation('previous', session.startDate)
  }

  const handleNext = () => {
    tradeHandler?.logDateNavigation('next', session.startDate)
  }

  const openPicker = (mode: PickerMode) => {
    if (mode === 'calendar' && hideDate) return
    const current = parseDateString(session.startDate)
    if (mode === 'calendar') {
      setViewDate(new Date(current.getFullYear(), current.getMonth(), 1))
    }
    setPickerMode((previous) => (previous === mode ? null : mode))
  }

  const handleRandomYearChange = (year: RandomYear) => {
    setRandomYear(year)
    setRandomMonths(
      year === 'all'
        ? Array.from({ length: 12 }, (_, month) => month)
        : Array.from({ length: 12 }, (_, month) => month).filter((month) =>
            monthCanContainDate(year, month, randomMaxDate),
          ),
    )
  }

  const toggleRandomMonth = (month: number) => {
    if (!eligibleRandomMonths.includes(month)) return
    setRandomMonths((current) =>
      current.includes(month)
        ? current.filter((candidate) => candidate !== month)
        : [...current, month].sort((a, b) => a - b),
    )
  }

  const chooseRandomDate = () => {
    const randomDate = pickRandomReplayDate(randomYear, randomMonths, randomMaxDate)
    if (randomDate) navigateToDate(randomDate)
  }

  const toggleHideDate = () => {
    setHideDate((previous) => {
      const next = !previous
      if (next) setPickerMode(null)
      try {
        localStorage.setItem(HIDE_DATE_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  const changeCalendarMonth = (offset: number) => {
    setViewDate(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )
  }

  const setCalendarMonth = (month: number) => {
    setViewDate((current) => new Date(current.getFullYear(), month, 1))
  }

  const setCalendarYear = (year: number) => {
    const month = year === today.getFullYear() ? Math.min(viewDate.getMonth(), today.getMonth()) : viewDate.getMonth()
    setViewDate(new Date(year, month, 1))
  }

  const previousMonthAllowed =
    new Date(viewDate.getFullYear(), viewDate.getMonth(), 0) >= new Date(MIN_YEAR, 0, 1)
  const nextMonthAllowed =
    new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1) <= today

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

  const panel = isDark
    ? 'border-[#334155] bg-[#0f172a] text-[#e6edf3] shadow-black/50'
    : 'border-slate-200 bg-white text-slate-900 shadow-slate-900/20'
  const panelMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const panelBorder = isDark ? 'border-[#334155]' : 'border-slate-200'
  const panelSurface = isDark ? 'bg-[#111c30]' : 'bg-slate-50'
  const panelHover = isDark ? 'hover:bg-[#1e293b]' : 'hover:bg-slate-100'
  const inputClass = isDark
    ? 'border-[#334155] bg-[#111c30] text-slate-100'
    : 'border-slate-200 bg-white text-slate-900'

  const hiddenLabel = '••• hidden •••'
  const navBtnCls = `session-date-nav__btn rounded transition-colors flex-shrink-0 ${btn} ${
    compact ? 'p-0.5' : 'p-1'
  }`
  const iconCls = compact ? 'w-3 h-3' : 'w-4 h-4'

  const picker =
    pickerMode && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[20000]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPickerMode(null)
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="replay-date-picker-title"
              className={`fixed overflow-y-auto rounded-xl border shadow-2xl ${panel}`}
              style={pickerPosition}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className={`flex items-center justify-between border-b px-4 py-3 ${panelBorder}`}>
                <div>
                  <h2 id="replay-date-picker-title" className="text-sm font-semibold">
                    Replay date
                  </h2>
                  <p className={`mt-0.5 text-[11px] ${panelMuted}`}>
                    Choose a date or generate a filtered random session.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerMode(null)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${panelMuted} ${panelHover}`}
                  aria-label="Close replay date picker"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <div className={`grid grid-cols-2 border-b p-1 ${panelBorder} ${panelSurface}`}>
                <button
                  type="button"
                  onClick={() => setPickerMode('calendar')}
                  className={`flex h-9 items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors ${
                    pickerMode === 'calendar'
                      ? isDark
                        ? 'bg-[#334155] text-white'
                        : 'bg-white text-slate-900 shadow-sm'
                      : `${panelMuted} ${panelHover}`
                  }`}
                  aria-pressed={pickerMode === 'calendar'}
                >
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode('random')}
                  className={`flex h-9 items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors ${
                    pickerMode === 'random'
                      ? isDark
                        ? 'bg-[#334155] text-white'
                        : 'bg-white text-slate-900 shadow-sm'
                      : `${panelMuted} ${panelHover}`
                  }`}
                  aria-pressed={pickerMode === 'random'}
                >
                  <Shuffle className="h-3.5 w-3.5" aria-hidden />
                  Random
                </button>
              </div>

              {pickerMode === 'calendar' ? (
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeCalendarMonth(-1)}
                      disabled={!previousMonthAllowed}
                      className={`flex h-9 w-9 items-center justify-center rounded-md ${panelHover} disabled:cursor-not-allowed disabled:opacity-30`}
                      aria-label="Previous calendar month"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                    <select
                      value={viewDate.getMonth()}
                      onChange={(event) => setCalendarMonth(Number(event.target.value))}
                      className={`h-9 min-w-0 flex-1 rounded-md border px-2 text-xs font-semibold outline-none focus:border-blue-500 ${inputClass}`}
                      aria-label="Calendar month"
                    >
                      {MONTHS.map((month, index) => (
                        <option
                          key={month}
                          value={index}
                          disabled={
                            viewDate.getFullYear() === today.getFullYear() &&
                            index > today.getMonth()
                          }
                        >
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      value={viewDate.getFullYear()}
                      onChange={(event) => setCalendarYear(Number(event.target.value))}
                      className={`h-9 w-24 rounded-md border px-2 text-xs font-semibold outline-none focus:border-blue-500 ${inputClass}`}
                      aria-label="Calendar year"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => changeCalendarMonth(1)}
                      disabled={!nextMonthAllowed}
                      className={`flex h-9 w-9 items-center justify-center rounded-md ${panelHover} disabled:cursor-not-allowed disabled:opacity-30`}
                      aria-label="Next calendar month"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className={`mb-1 grid grid-cols-7 text-center text-[10px] font-semibold ${panelMuted}`}>
                    {WEEKDAYS.map((day) => (
                      <span key={day} className="py-1">
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((date) => {
                      const iso = fmtLocalYmd(date)
                      const inMonth = date.getMonth() === viewDate.getMonth()
                      const selected = iso === session.startDate
                      const isToday = iso === todayIso
                      const disabled = date < new Date(MIN_YEAR, 0, 1) || date > today
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={disabled}
                          onClick={() => navigateToDate(iso)}
                          className={`flex aspect-square items-center justify-center rounded-md text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                            selected
                              ? 'bg-blue-600 font-bold text-white'
                              : isToday
                                ? isDark
                                  ? 'bg-blue-500/15 font-semibold text-blue-300'
                                  : 'bg-blue-50 font-semibold text-blue-700'
                                : `${inMonth ? '' : 'opacity-40'} ${panelHover}`
                          }`}
                          aria-label={`Select ${date.toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}`}
                          aria-current={selected ? 'date' : undefined}
                        >
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>
                  <div className={`mt-3 flex items-center justify-between border-t pt-3 ${panelBorder}`}>
                    <span className={`text-[11px] ${panelMuted}`}>Available through today</span>
                    <button
                      type="button"
                      onClick={() => navigateToDate(todayIso)}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold text-blue-500 hover:bg-blue-500/10"
                    >
                      Today
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className={`rounded-lg border p-3 ${panelBorder} ${panelSurface}`}>
                    <label className="block text-xs font-semibold" htmlFor="replay-random-year">
                      Year
                    </label>
                    <p className={`mt-0.5 text-[11px] ${panelMuted}`}>
                      {randomYear === 'all'
                        ? 'Random dates can come from any available year.'
                        : 'Random dates will only come from this year.'}
                    </p>
                    <select
                      id="replay-random-year"
                      value={randomYear}
                      onChange={(event) =>
                        handleRandomYearChange(
                          event.target.value === 'all' ? 'all' : Number(event.target.value),
                        )
                      }
                      className={`mt-2 h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none focus:border-blue-500 ${inputClass}`}
                    >
                      <option value="all">All years</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold">Months</h3>
                        <p className={`mt-0.5 text-[11px] ${panelMuted}`}>
                          Select one month or combine several.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setRandomMonths(
                            randomMonths.length === eligibleRandomMonths.length
                              ? []
                              : eligibleRandomMonths,
                          )
                        }
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-blue-500 hover:bg-blue-500/10"
                      >
                        {randomMonths.length === eligibleRandomMonths.length
                          ? 'Clear all'
                          : 'Select all'}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {MONTHS.map((month, index) => {
                        const selected = randomMonths.includes(index)
                        const eligible = eligibleRandomMonths.includes(index)
                        return (
                          <button
                            key={month}
                            type="button"
                            disabled={!eligible}
                            onClick={() => toggleRandomMonth(index)}
                            className={`h-9 rounded-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                              selected
                                ? 'border-blue-500 bg-blue-600 text-white'
                                : `${panelBorder} ${panelHover}`
                            }`}
                            aria-pressed={selected}
                            aria-label={`${selected ? 'Exclude' : 'Include'} ${month}`}
                          >
                            {month}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className={`mt-4 border-t pt-4 ${panelBorder}`}>
                    <button
                      type="button"
                      disabled={!randomMonths.length}
                      onClick={chooseRandomDate}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Shuffle className="h-4 w-4" aria-hidden />
                      Choose random weekday
                    </button>
                    <p className={`mt-2 text-center text-[10px] ${panelMuted}`}>
                      Weekends and the most recent seven days are excluded.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div
        ref={anchorRef}
        className={`session-date-nav ${compact ? 'session-date-nav--compact' : ''} relative min-w-0`}
      >
        <div
          className={`session-date-nav__shell flex items-center justify-center rounded-md border ${shell} ${
            compact ? 'gap-0.5 px-1 py-0.5' : 'gap-1 px-2 py-1 rounded-lg'
          }`}
        >
          <button
            type="button"
            onClick={handlePrevious}
            className={navBtnCls}
            aria-label="Previous date"
          >
            <ChevronLeft className={iconCls} aria-hidden />
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => openPicker('calendar')}
              className={`session-date-nav__date w-full truncate rounded px-0.5 text-center font-medium transition-colors ${dateBtn} ${
                compact ? 'text-[11px] leading-tight' : 'text-xs sm:text-sm'
              } ${hideDate ? 'cursor-default' : 'cursor-pointer'}`}
              aria-label="Select date"
              aria-expanded={pickerMode === 'calendar'}
              title={hideDate ? 'Date hidden' : sessionDate.full}
            >
              {hideDate ? (
                hiddenLabel
              ) : compact ? (
                sessionDate.medium
              ) : (
                <>
                  <span className="hidden sm:inline">{sessionDate.full}</span>
                  <span className="sm:hidden">{sessionDate.medium}</span>
                </>
              )}
            </button>
            {!compact && !hideDate && (
              <button
                type="button"
                onClick={() => openPicker('calendar')}
                className={`flex-shrink-0 rounded p-1 transition-colors ${btn}`}
                aria-label="Open calendar"
                aria-expanded={pickerMode === 'calendar'}
              >
                <Calendar className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className={navBtnCls}
            aria-label="Next date"
          >
            <ChevronRight className={iconCls} aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => openPicker('random')}
            className={navBtnCls}
            aria-label="Random date options"
            aria-expanded={pickerMode === 'random'}
            title="Choose a random date from selected years and months"
          >
            <Shuffle className={iconCls} aria-hidden />
          </button>

          <button
            type="button"
            onClick={toggleHideDate}
            className={navBtnCls}
            aria-label={hideDate ? 'Show date' : 'Hide date'}
            title={hideDate ? 'Show date' : 'Hide date (unbiased practice)'}
          >
            {hideDate ? (
              <EyeOff className={iconCls} aria-hidden />
            ) : (
              <Eye className={iconCls} aria-hidden />
            )}
          </button>
        </div>
      </div>
      {picker}
    </>
  )
}

export default SessionDateNavigation
