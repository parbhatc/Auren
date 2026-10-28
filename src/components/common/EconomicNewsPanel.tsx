import { Component, createRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Settings, X } from 'lucide-react'
import { EconomicNewsPanelProps } from '../../types/common'
import { economicNewsAPI, type EconomicEvent } from '../../api/economicNews.api'
import { getAuthToken } from '../../api/api'
import Checkbox from './Checkbox'
import { formatNewsTime } from '../../utils/newsTime'

/**
 * Economic News Panel Component
 * Compact panel showing today's economic news for trading/backtester pages
 */
class EconomicNewsPanel extends Component<EconomicNewsPanelProps> {
  settingsDialogRef = createRef<HTMLDivElement>()
  private mounted = false
  private request: AbortController | null = null
  private requestKey: string | null = null
  private requestId = 0
  private owner: string | null = null

  state = {
    monthEvents: [] as EconomicEvent[],
    monthKey: null as string | null,
    loading: true,
    error: null as string | null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    showSettings: false,
    filters: {
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
    },
  }

  componentDidMount() {
    this.mounted = true
    // Load timezone from localStorage
    const savedTimezone = localStorage.getItem('user_timezone')
    if (savedTimezone) {
      this.setState({ timezone: savedTimezone })
    }
    // Load filters from localStorage
    this.loadFiltersFromStorage()
    this.fetchTodayEvents()
    // Listen for timezone changes
    window.addEventListener('storage', this.handleStorageChange)
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  componentDidUpdate(prevProps: EconomicNewsPanelProps) {
    // Refetch events if date prop changes (e.g., when backtester session date changes)
    if (prevProps.date !== this.props.date || this.owner !== getAuthToken()) {
      this.fetchTodayEvents()
    }
  }

  componentWillUnmount() {
    this.mounted = false
    this.requestId += 1
    this.request?.abort()
    this.request = null
    this.requestKey = null
    window.removeEventListener('storage', this.handleStorageChange)
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  loadFiltersFromStorage = () => {
    try {
      const savedFilters = localStorage.getItem('economicNews_filters')
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters)
        this.setState({ filters: parsed })
      }
    } catch (error) {
      console.error('Error loading filters from localStorage:', error)
    }
  }

  saveFiltersToStorage = (filters: any) => {
    try {
      localStorage.setItem('economicNews_filters', JSON.stringify(filters))
    } catch (error) {
      console.error('Error saving filters to localStorage:', error)
    }
  }

  handleClickOutside = (event: MouseEvent) => {
    if (this.settingsDialogRef.current && !this.settingsDialogRef.current.contains(event.target as Node)) {
      this.setState({ showSettings: false })
    }
  }

  handleFilterChange = (category: 'currencies' | 'impact', key: string, checked: boolean) => {
    this.setState((prevState: any) => {
      const newFilters = {
        ...prevState.filters,
        [category]: {
          ...prevState.filters[category],
          [key]: checked,
        },
      }
      this.saveFiltersToStorage(newFilters)
      return { filters: newFilters }
    })
  }

  handleSelectAll = (category: 'currencies' | 'impact', select: boolean) => {
    this.setState((prevState: any) => {
      const newFilters = {
        ...prevState.filters,
        [category]: Object.keys(prevState.filters[category]).reduce((acc: any, key: string) => {
          acc[key] = select
          return acc
        }, {}),
      }
      this.saveFiltersToStorage(newFilters)
      return { filters: newFilters }
    })
  }

  handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'user_timezone' && e.newValue) {
      this.setState({ timezone: e.newValue })
    }
  }

  getTargetDate = () => {
    // Keep date-only replay dates on their intended local calendar day.
    return this.props.date
      ? (typeof this.props.date === 'string'
          ? /^\d{4}-\d{2}-\d{2}$/.test(this.props.date)
            ? new Date(`${this.props.date}T12:00:00`)
            : new Date(this.props.date)
          : this.props.date)
      : new Date()
  }

  getMonthKey = (date: Date) => JSON.stringify([getAuthToken(), date.getFullYear(), date.getMonth() + 1])

  fetchTodayEvents = async () => {
    const dateToUse = this.getTargetDate()
    const monthKey = this.getMonthKey(dateToUse)
    this.owner = getAuthToken()
    if (this.requestKey === monthKey) return
    this.request?.abort()
    const requestId = ++this.requestId
    this.requestKey = null
    this.request = null
    if (this.state.monthKey === monthKey) {
      this.setState({ loading: false, error: null })
      return
    }
    const controller = new AbortController()
    this.request = controller
    this.requestKey = monthKey
    const owner = this.owner
    const isCurrent = () => this.mounted && requestId === this.requestId && owner === getAuthToken()
    this.setState({ loading: true, error: null })
    try {
      const response = await economicNewsAPI.getEvents(dateToUse.getFullYear(), dateToUse.getMonth() + 1, { signal: controller.signal })
      if (!isCurrent()) return
      this.setState({ monthEvents: response.success ? response.events || [] : [], monthKey, loading: false })
    } catch (error: any) {
      if (!isCurrent()) return
      console.error('Error fetching economic news:', error)
      this.setState({ error: 'Failed to load news', loading: false })
    } finally {
      if (requestId === this.requestId) {
        this.request = null
        this.requestKey = null
      }
    }
  }

  getTodayEvents = () => {
    const date = this.getTargetDate()
    if (this.state.monthKey !== this.getMonthKey(date)) return []
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: this.state.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
    const [month, day, year] = formatted.split('/')
    const targetDate = `${year}-${month}-${day}`
    const { filters } = this.state
    return this.state.monthEvents.filter((event) => {
      if (event.date?.split('T')[0] !== targetDate) return false
      const currencyMatch = filters.currencies[event.currency as keyof typeof filters.currencies] || filters.currencies.ALL
      const impactKey = event.impact?.toLowerCase() || 'low'
      return currencyMatch && filters.impact[impactKey as keyof typeof filters.impact]
    }).sort((a, b) => this.parseTime(a.time) - this.parseTime(b.time)).slice(0, 5)
  }

  parseTime = (timeStr: string): number => {
    // Parse time string like "8:30 AM" or "14:30"
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

  getImpactColor = (impact: string) => {
    switch (impact?.toLowerCase()) {
      case 'high':
        return 'bg-red-500'
      case 'medium':
        return 'bg-orange-500'
      case 'low':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  render() {
    const { isDark } = this.props
    const { loading, error, showSettings, filters } = this.state
    const events = this.getTodayEvents()

    return (
      <div
        className={`rounded-lg sm:rounded-xl shadow-lg border ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm'
            : 'bg-white/90 border-slate-200 backdrop-blur-sm'
        }`}
      >
        <div className={`p-3 sm:p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Trading Day News
              </h3>
            </div>
            <button
              onClick={() => this.setState({ showSettings: !showSettings })}
              className={`p-1.5 rounded-lg transition-all ${
                isDark
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Filter Settings Dialog - Rendered via Portal */}
        {showSettings && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4" 
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => this.setState({ showSettings: false })}
          >
            <div
              ref={this.settingsDialogRef}
              className={`max-w-md w-full max-h-[85vh] overflow-y-auto rounded-lg shadow-xl p-4 ${
                isDark
                  ? 'bg-slate-900 border border-slate-700'
                  : 'bg-white border border-slate-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Filter Settings
                </h4>
                <button
                  onClick={() => this.setState({ showSettings: false })}
                  className={`p-1 rounded ${
                    isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Currencies */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Currencies
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.handleSelectAll('currencies', true)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => this.handleSelectAll('currencies', false)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(filters.currencies).map((currency) => (
                    <Checkbox
                      key={currency}
                      checked={filters.currencies[currency as keyof typeof filters.currencies]}
                      onChange={(checked) => this.handleFilterChange('currencies', currency, checked)}
                      label={currency}
                      isDark={isDark}
                      size="sm"
                    />
                  ))}
                </div>
              </div>

              {/* Impact */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Impact
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.handleSelectAll('impact', true)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => this.handleSelectAll('impact', false)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(filters.impact).map((impact) => (
                    <Checkbox
                      key={impact}
                      checked={filters.impact[impact as keyof typeof filters.impact]}
                      onChange={(checked) => this.handleFilterChange('impact', impact, checked)}
                      label={impact.charAt(0).toUpperCase() + impact.slice(1)}
                      isDark={isDark}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
        <div className="p-3 sm:p-4">
          {loading ? (
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Loading news...
            </div>
          ) : error ? (
            <div className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              No events scheduled for today
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event: any, index: number) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg border ${
                    isDark
                      ? 'bg-slate-900/50 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${this.getImpactColor(event.impact)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {formatNewsTime(event.date, event.time, this.state.timezone)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                          {event.currency}
                        </span>
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} line-clamp-2`}>
                        {event.event}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }
}

export default EconomicNewsPanel
