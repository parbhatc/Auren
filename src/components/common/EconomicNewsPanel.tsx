import { Component, createRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Settings, X } from 'lucide-react'
import { EconomicNewsPanelProps } from '../../types/common'
import { economicNewsAPI } from '../../api/economicNews.api'
import Checkbox from './Checkbox'

/**
 * Economic News Panel Component
 * Compact panel showing today's economic news for trading/backtester pages
 */
class EconomicNewsPanel extends Component<EconomicNewsPanelProps> {
  settingsDialogRef = createRef<HTMLDivElement>()

  state = {
    events: [] as any[],
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
    if (prevProps.date !== this.props.date) {
      this.fetchTodayEvents()
    }
  }

  componentWillUnmount() {
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
    }, () => {
      this.fetchTodayEvents()
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
    }, () => {
      this.fetchTodayEvents()
    })
  }

  handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'user_timezone' && e.newValue) {
      this.setState({ timezone: e.newValue }, () => {
        this.fetchTodayEvents()
      })
    }
  }

  fetchTodayEvents = async () => {
    try {
      // Use provided date prop if available (for backtester sessions), otherwise use current date
      const dateToUse = this.props.date 
        ? (typeof this.props.date === 'string' ? new Date(this.props.date) : this.props.date)
        : new Date()
      const year = dateToUse.getFullYear()
      const month = dateToUse.getMonth() + 1

      const response = await economicNewsAPI.getEvents(year, month)
      
      if (response.success && response.events) {
        // Filter events for the target date using timezone
        const timezone = this.state.timezone
        const targetDate = dateToUse
        const targetDateStr = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(targetDate)
        const [monthPart, dayPart, yearPart] = targetDateStr.split('/')
        const formattedTargetDate = `${yearPart}-${monthPart}-${dayPart}`
        
        let todayEvents = response.events.filter((event: any) => {
          if (!event.date) return false
          const eventDate = event.date.split('T')[0]
          return eventDate === formattedTargetDate
        })

        // Apply filters
        const { filters } = this.state
        todayEvents = todayEvents.filter((event: any) => {
          // Currency filter
          const currencyMatch = filters.currencies[event.currency as keyof typeof filters.currencies] || 
                                filters.currencies.ALL
          
          // Impact filter
          const impactKey = event.impact?.toLowerCase() || 'low'
          const impactMatch = filters.impact[impactKey as keyof typeof filters.impact] || false
          
          return currencyMatch && impactMatch
        })

        // Sort by time and limit to top 5
        const sortedEvents = todayEvents
          .sort((a: any, b: any) => {
            const timeA = this.parseTime(a.time)
            const timeB = this.parseTime(b.time)
            return timeA - timeB
          })
          .slice(0, 5)

        this.setState({ events: sortedEvents, loading: false })
      } else {
        this.setState({ loading: false })
      }
    } catch (error: any) {
      console.error('Error fetching economic news:', error)
      this.setState({ error: 'Failed to load news', loading: false })
    }
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
    const { events, loading, error, showSettings, filters } = this.state

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
                          {event.time}
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

