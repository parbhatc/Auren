import { useCallback, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Settings, X } from 'lucide-react'
import { economicNewsAPI } from '../../../../api/economicNews.api'
import Checkbox from '../../../common/Checkbox'
import { formatNewsTime } from '../../../../utils/newsTime'

const DEFAULT_FILTERS = {
  currencies: {
    ALL: true,
    AUD: true,
    CAD: true,
    CHF: true,
    CNY: true,
    EUR: true,
    GBP: true,
    JPY: true,
    NZD: true,
    USD: true,
  },
  impact: {
    high: true,
    medium: true,
    low: true,
    holiday: true,
  },
}

function parseTime(timeStr: string): number {
  if (!timeStr || timeStr === 'All Day') return 0
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return 0
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

function impactDotClass(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'high':
      return 'bg-red-500'
    case 'medium':
      return 'bg-orange-500'
    case 'low':
      return 'bg-yellow-500'
    default:
      return 'bg-[#7F838B]'
  }
}

type EconomicNewsViewProps = {
  isDark: boolean
}

export function EconomicNewsView({ isDark }: EconomicNewsViewProps) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [showSettings, setShowSettings] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const settingsRef = useRef<HTMLDivElement>(null)

  const shell = isDark
    ? 'bg-[#18181B] border-[#27272A] text-[#FAFAFA]'
    : 'bg-white border-[#E4E4E7] text-[#09090B]'
  const muted = isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
  const row = isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-[#FAFAFA] border-[#E4E4E7]'

  const loadFilters = useCallback(() => {
    try {
      const saved = localStorage.getItem('economicNews_filters')
      if (saved) setFilters(JSON.parse(saved))
    } catch {
      /* ignore */
    }
  }, [])

  const saveFilters = useCallback((next: typeof DEFAULT_FILTERS) => {
    try {
      localStorage.setItem('economicNews_filters', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const fetchTodayEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const response = await economicNewsAPI.getEvents(now.getFullYear(), now.getMonth() + 1)
      if (!response.success || !response.events) {
        setEvents([])
        setLoading(false)
        return
      }

      const targetDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
      const [monthPart, dayPart, yearPart] = targetDateStr.split('/')
      const formattedTargetDate = `${yearPart}-${monthPart}-${dayPart}`

      let todayEvents = response.events.filter((event: any) => {
        if (!event.date) return false
        return event.date.split('T')[0] === formattedTargetDate
      })

      todayEvents = todayEvents.filter((event: any) => {
        const currencyMatch =
          filters.currencies[event.currency as keyof typeof filters.currencies] ||
          filters.currencies.ALL
        const impactKey = event.impact?.toLowerCase() || 'low'
        const impactMatch = filters.impact[impactKey as keyof typeof filters.impact] || false
        return currencyMatch && impactMatch
      })

      todayEvents.sort((a: any, b: any) => parseTime(a.time) - parseTime(b.time))
      setEvents(todayEvents)
    } catch {
      setError('Failed to load economic news')
    } finally {
      setLoading(false)
    }
  }, [filters, timezone])

  useEffect(() => {
    const savedTz = localStorage.getItem('user_timezone')
    if (savedTz) setTimezone(savedTz)
    loadFilters()
  }, [loadFilters])

  useEffect(() => {
    void fetchTodayEvents()
  }, [fetchTodayEvents])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'user_timezone' && e.newValue) {
        setTimezone(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const updateFilter = (category: 'currencies' | 'impact', key: string, checked: boolean) => {
    setFilters((prev) => {
      const next = {
        ...prev,
        [category]: { ...prev[category], [key]: checked },
      }
      saveFilters(next)
      return next
    })
  }

  const selectAllFilters = (category: 'currencies' | 'impact', select: boolean) => {
    setFilters((prev) => {
      const next = {
        ...prev,
        [category]: Object.keys(prev[category]).reduce(
          (acc, key) => {
            acc[key] = select
            return acc
          },
          {} as Record<string, boolean>
        ),
      }
      saveFilters(next)
      return next
    })
  }

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className={`rounded-2xl border flex flex-col min-h-0 max-h-full ${shell}`}>
      <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#3b82f6]' : 'text-blue-600'}`} />
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold truncate ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
              Economic News
            </h2>
            <p className={`text-xs truncate ${muted}`}>{todayLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className={`p-1.5 rounded-lg shrink-0 transition-colors ${
            isDark ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]' : 'text-[#52525B] hover:bg-[#F4F4F5]'
          }`}
          title="Filter settings"
          aria-label="Filter settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <p className={`text-sm ${muted}`}>Loading news…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : events.length === 0 ? (
          <p className={`text-sm ${muted}`}>No events scheduled for today</p>
        ) : (
          <div className="space-y-2">
            {events.map((event: any, index: number) => (
              <div key={`${event.time}-${event.event}-${index}`} className={`p-3 rounded-xl border ${row}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${impactDotClass(event.impact)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                        {event.time ? formatNewsTime(event.date, event.time, timezone) : '—'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isDark ? 'bg-[#27272A] text-[#A1A1AA]' : 'bg-[#F4F4F5] text-[#52525B]'
                        }`}
                      >
                        {event.currency}
                      </span>
                      {event.impact && (
                        <span className={`text-[10px] font-medium capitalize ${muted}`}>{event.impact}</span>
                      )}
                    </div>
                    <p className={`text-sm leading-snug ${isDark ? 'text-[#FAFAFA]' : 'text-[#52525B]'}`}>
                      {event.event}
                    </p>
                    {(event.actual || event.forecast || event.previous) && (
                      <div className={`mt-2 flex flex-wrap gap-3 text-[11px] ${muted}`}>
                        {event.actual != null && event.actual !== '' && (
                          <span>
                            Actual:{' '}
                            <span className={isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}>{event.actual}</span>
                          </span>
                        )}
                        {event.forecast != null && event.forecast !== '' && (
                          <span>
                            Forecast:{' '}
                            <span className={isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}>{event.forecast}</span>
                          </span>
                        )}
                        {event.previous != null && event.previous !== '' && (
                          <span>
                            Previous:{' '}
                            <span className={isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}>{event.previous}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSettings &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
            onClick={() => setShowSettings(false)}
          >
            <div
              ref={settingsRef}
              className={`max-w-md w-full max-h-[85vh] overflow-y-auto rounded-xl p-4 border ${
                isDark ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-[#E4E4E7]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-sm font-bold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                  Filter settings
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className={`p-1 rounded ${isDark ? 'hover:bg-[#27272A] text-[#A1A1AA]' : 'hover:bg-[#F4F4F5] text-[#52525B]'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(['currencies', 'impact'] as const).map((category) => (
                <div key={category} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-xs font-medium capitalize ${isDark ? 'text-[#FAFAFA]' : 'text-[#52525B]'}`}>
                      {category}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllFilters(category, true)}
                        className={`text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-[#27272A] text-[#FAFAFA]' : 'bg-[#F4F4F5] text-[#52525B]'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => selectAllFilters(category, false)}
                        className={`text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-[#27272A] text-[#FAFAFA]' : 'bg-[#F4F4F5] text-[#52525B]'
                        }`}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(filters[category]).map((key) => (
                      <Checkbox
                        key={key}
                        checked={filters[category][key as keyof (typeof filters)[typeof category]]}
                        onChange={(checked) => updateFilter(category, key, checked)}
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                        isDark={isDark}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
