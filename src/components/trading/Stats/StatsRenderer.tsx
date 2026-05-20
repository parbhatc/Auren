import { Component, createRef } from 'react'
import { TrendingUp } from 'lucide-react'
import TradingNav from '../../common/TradingNav'
import { TradingHandler } from '../../../services/trading/TradingHandler'
import { StatsRendererProps, StatsRendererState } from '../../../types/common'
import DayStatsDialog from './DayStatsDialog'
import WeekStatsDialog from './WeekStatsDialog'
import StatsHeader from './StatsHeader'
import { PracticeTradeHeader } from '../Trading/PracticeTradeHeader'
import DateRangeSelector from './DateRangeSelector'
import StatsTabs from './StatsTabs'
import OverviewTab from './OverviewTab'
import StatsCalendar from './StatsCalendar'
import TradesTable from './TradesTable'
import { propFirmRegistry } from '../../../services/propfirms'
import { TradeseaPropFirm } from '../../../services/propfirms/TradeseaPropFirm'
import {
  buildDayStatsPayload,
  isSyntheticTradeseaTrade,
  monthDateRangeLocal,
} from '../../../services/tradesea/tradeseaTradelensStats'
import { saveSelectedAccountId } from '../../../utils/marketAccountDisplay'
import { saveTradeTradeseaAccount } from '../../../constants/trade'
import { practiceTradePanelClass } from '../Practice/practiceTradeTheme'
import { PracticeEvalStatsPanel } from '../Practice/PracticeEvalStatsPanel'
import {
  getInitialPracticeShowNav,
  savePracticeShowNav,
} from '../../../utils/practiceTradePreferences'

/**
 * Unified Stats page renderer component
 * Practice session stats
 */
class StatsRenderer extends Component<StatsRendererProps, StatsRendererState> {
  private accountDropdownRef = createRef<HTMLDivElement>()
  private isInitialMount = true

  private usesStringAccountIds(firmId?: string): boolean {
    return firmId === 'tradesea'
  }

  private getActivePropFirmId(): string {
    return localStorage.getItem('activePropFirm') || propFirmRegistry[0]?.id || ''
  }

  /**
   * Find the prop firm that has the given account
   */
  private findPropFirmWithAccount(accountKey: number | string): any {
    const activePropFirmId = this.getActivePropFirmId()
    for (const firm of propFirmRegistry) {
      const firmAny = firm as any
      if (firm.id !== activePropFirmId) continue
      if (!firmAny.formattedAccounts || !Array.isArray(firmAny.formattedAccounts)) continue

      const hasAccount = firmAny.formattedAccounts.some((acc: any) => {
        if (this.usesStringAccountIds(firm.id)) {
          return acc.account?.id === accountKey || acc.account?.id === String(accountKey)
        }
        return acc.accountId === accountKey
      })
      if (hasAccount) return firmAny
    }
    return null
  }

  /**
   * Update prop firm account selection
   */
  private updatePropFirmAccount(accountKey: number | string, formattedAccount?: any): void {
    const firm = this.findPropFirmWithAccount(accountKey)
    if (!firm) return

    if (this.usesStringAccountIds(firm.id)) {
      const realId = formattedAccount?.account?.id ?? accountKey
      firm.selectedAccountId = String(realId)
      if (firm.id === 'tradesea' && formattedAccount?.displayName) {
        saveTradeTradeseaAccount(String(realId), formattedAccount.displayName)
      }
    } else {
      firm.selectedAccountId = accountKey
      saveSelectedAccountId(Number(accountKey))
    }

    if (firm.onSelectedAccountChanged) {
      const skipStreams = firm.id === 'tradesea'
      firm.onSelectedAccountChanged(skipStreams ? { skipStreams: true } : undefined)
    }
  }

  private resolveFormattedAccount(displayName: string): any {
    const accounts = this.props.accounts || []
    return (accounts as any[]).find((a: any) => a.displayName === displayName)
  }

  private accountKeyFromFormatted(formattedAccount: any): number | string | null {
    if (!formattedAccount) return null
    const firmId = this.getActivePropFirmId()
    if (this.usesStringAccountIds(firmId)) {
      return formattedAccount.account?.id ?? null
    }
    return formattedAccount.accountId ?? null
  }

  constructor(props: StatsRendererProps) {
    super(props)
    
    let initialDateRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    }

    const initialCurrentMonth = new Date()
    if (props.practiceMode) {
      initialDateRange = { startDate: '', endDate: '' }
    }

    this.state = {
      selectedAccount: 'Account 1',
      showAccountDropdown: false,
      showNav: true,
      activeTab: 'overview',
      dateRange: initialDateRange,
      currentMonth: initialCurrentMonth,
      trades: [],
      loading: false,
      symbolData: undefined,
      showDayDialog: false,
      selectedDayData: null,
      dayTradesLoading: false,
      selectedTimelinePoint: null,
      showWeekDialog: false,
      selectedWeekData: null,
      propFirmStats: null, // Store prop firm stats data
    }
  }

  async componentDidMount() {
    this.isInitialMount = false
    
    if (this.props.showAccountDropdown) {
      document.addEventListener('mousedown', this.handleClickOutside)
    }
    
    // Load showNav state from localStorage
    const savedShowNav = localStorage.getItem('trading_show_nav')
    if (this.props.practiceMode && this.props.practiceAccountId) {
      this.setState({ showNav: getInitialPracticeShowNav(this.props.practiceAccountId) })
    } else if (savedShowNav !== null) {
      this.setState({ showNav: savedShowNav === 'true' })
    }

    // Initialize prop firm account info if selectedAccount prop is provided
    if (this.props.selectedAccount) {
      this.setState({ selectedAccount: this.props.selectedAccount })
      // Find the account ID from the display name
      const accounts = this.props.accounts || []
      const formattedAccount = this.resolveFormattedAccount(this.props.selectedAccount)
      const accountKey = this.accountKeyFromFormatted(formattedAccount)
      if (accountKey != null) {
        this.updatePropFirmAccount(accountKey, formattedAccount)
      }
    }

    this.loadPropFirmStats()
  }

  componentDidUpdate(prevProps: StatsRendererProps, prevState: StatsRendererState) {
    // Update prop firm when selectedAccount prop changes
    if (this.props.selectedAccount && this.props.selectedAccount !== prevProps.selectedAccount) {
      this.setState({ selectedAccount: this.props.selectedAccount })
      // Find the account ID from the display name
      const accounts = this.props.accounts || []
      const formattedAccount = this.resolveFormattedAccount(this.props.selectedAccount)
      const accountKey = this.accountKeyFromFormatted(formattedAccount)
      if (accountKey != null) {
        this.updatePropFirmAccount(accountKey, formattedAccount)
      }
    }
    
    // Reload prop firm stats when date range changes (overview/trades only)
    if (!this.isInitialMount &&
        this.state.activeTab !== 'calendar' &&
        (prevState.dateRange.startDate !== this.state.dateRange.startDate ||
         prevState.dateRange.endDate !== this.state.dateRange.endDate)) {
      // Clear cached overview stats since date range changed
      this.setState({ overviewPropFirmStats: undefined })
      this.loadPropFirmStats()
    }

    // Load prop firm stats when month changes (for calendar view)
    if (!this.isInitialMount &&
        this.state.activeTab === 'calendar' &&
        prevState.currentMonth.getTime() !== this.state.currentMonth.getTime()) {
      const { startDate: monthStartStr, endDate: monthEndStr } = monthDateRangeLocal(
        this.state.currentMonth.getFullYear(),
        this.state.currentMonth.getMonth()
      )

      // Load stats with month-specific date range (don't update main dateRange state)
      // Skip profit factor API call for calendar view
      this.loadPropFirmStats({
        startDate: monthStartStr,
        endDate: monthEndStr
      }, true) // skipProfitFactorAPI = true for calendar
    }

    // Load trades/stats when switching to calendar tab
    if (!this.isInitialMount &&
        prevState.activeTab !== 'calendar' &&
        this.state.activeTab === 'calendar') {
      // Save the current date range (for overview) before switching to calendar
      const savedDateRange = this.state.dateRange
      
      const { startDate: monthStartStr, endDate: monthEndStr } = monthDateRangeLocal(
        this.state.currentMonth.getFullYear(),
        this.state.currentMonth.getMonth()
      )

      this.setState({ savedDateRange: savedDateRange })
      this.loadPropFirmStats({
        startDate: monthStartStr,
        endDate: monthEndStr
      }, true)
    }

    // Load trades when opening Trades tab with an empty list (e.g. after removing synthetic fallback)
    if (
      !this.isInitialMount &&
      prevState.activeTab !== 'trades' &&
      this.state.activeTab === 'trades'
    ) {
      const hasRealTrades = this.state.trades.some((t) => !isSyntheticTradeseaTrade(t))
      if (
        !hasRealTrades &&
        this.state.dateRange.startDate &&
        this.state.dateRange.endDate
      ) {
        this.loadPropFirmStats()
      }
    }

    // Restore date range when switching FROM calendar TO overview/trades
    if (!this.isInitialMount &&
        prevState.activeTab === 'calendar' &&
        this.state.activeTab !== 'calendar' &&
        this.state.savedDateRange) {
      // Restore the saved date range
      const restoredDateRange = this.state.savedDateRange
      
      this.setState({
        dateRange: restoredDateRange,
        savedDateRange: undefined,
      }, () => {
        const overviewTrades = (this.state.overviewPropFirmStats?.trades || []).filter(
          (t) => !isSyntheticTradeseaTrade(t)
        )
        const calendarTrades = (this.state.calendarPropFirmStats?.trades || []).filter(
          (t) => !isSyntheticTradeseaTrade(t)
        )
        const tradesToUse = overviewTrades.length > 0 ? overviewTrades : calendarTrades
        const statsSource =
          overviewTrades.length > 0
            ? this.state.overviewPropFirmStats
            : this.state.calendarPropFirmStats || this.state.overviewPropFirmStats

        if (tradesToUse.length > 0 && statsSource) {
          this.setState({
            trades: tradesToUse,
            propFirmStats: { ...statsSource, trades: tradesToUse },
            symbolData: statsSource.symbolData || this.state.symbolData,
          })
        } else {
          this.loadPropFirmStats()
        }
      })
    }
  }

  loadPropFirmStats = async (dateRangeOverride?: { startDate: string; endDate: string }, skipProfitFactorAPI?: boolean) => {
    // Determine if this is for calendar or overview
    const isCalendar = !!dateRangeOverride || this.state.activeTab === 'calendar'
    const dateRangeToUse = dateRangeOverride || this.state.dateRange
    
    // Check if we have cached data for this date range
    if (isCalendar) {
      // For calendar: check if we have cached calendar stats for this specific month
      const currentMonthKey = `${this.state.currentMonth.getFullYear()}-${String(this.state.currentMonth.getMonth() + 1).padStart(2, '0')}`
      if (this.state.calendarPropFirmStats && this.state.calendarCacheMonth === currentMonthKey) {
        // Use cached calendar data for this month
        this.setState({
          trades: this.state.calendarPropFirmStats.trades || [],
          propFirmStats: this.state.calendarPropFirmStats,
          symbolData: this.state.calendarPropFirmStats.symbolData || this.state.symbolData
        })
        return
      }
    } else {
      // For overview: check if we have cached overview stats for this date range
      const cachedOverviewTrades = (this.state.overviewPropFirmStats?.trades || []).filter(
        (t) => !isSyntheticTradeseaTrade(t)
      )
      if (
        this.state.overviewPropFirmStats &&
        this.state.dateRange.startDate === dateRangeToUse.startDate &&
        this.state.dateRange.endDate === dateRangeToUse.endDate &&
        cachedOverviewTrades.length > 0
      ) {
        this.setState({
          trades: cachedOverviewTrades,
          propFirmStats: { ...this.state.overviewPropFirmStats, trades: cachedOverviewTrades },
          symbolData: this.state.overviewPropFirmStats.symbolData || this.state.symbolData,
        })
        return
      }
    }

    // No cached data, fetch from API
    this.setState({ loading: true })
    try {
      // Find the active prop firm using activePropFirmId from localStorage
      const activePropFirmId = localStorage.getItem('activePropFirm') || propFirmRegistry[0]?.id
      const activeFirm = propFirmRegistry.find((firm: any) => firm.id === activePropFirmId) as any

      if (activeFirm && activeFirm.getStats) {
        const statsData = await activeFirm.getStats(dateRangeToUse, skipProfitFactorAPI)
        if (statsData) {
          // Cache the data based on whether it's for calendar or overview
          if (isCalendar) {
            const currentMonthKey = `${this.state.currentMonth.getFullYear()}-${String(this.state.currentMonth.getMonth() + 1).padStart(2, '0')}`
            this.setState({
              trades: statsData.trades || [],
              propFirmStats: statsData,
              calendarPropFirmStats: statsData, // Cache calendar data
              calendarCacheMonth: currentMonthKey, // Store which month this cache is for
              symbolData: statsData.symbolData || this.state.symbolData
            })
          } else {
            this.setState({
              trades: statsData.trades || [],
              propFirmStats: statsData,
              overviewPropFirmStats: statsData, // Cache overview data
              symbolData: statsData.symbolData || this.state.symbolData
            })
          }
        }
      }
    } catch (error) {
      console.error('Error loading prop firm stats:', error)
    } finally {
      this.setState({ loading: false })
    }
  }

  componentWillUnmount() {
    if (this.props.showAccountDropdown) {
      document.removeEventListener('mousedown', this.handleClickOutside)
    }
  }

  handleClickOutside = (event: MouseEvent) => {
    if (
      this.accountDropdownRef.current &&
      !this.accountDropdownRef.current.contains(event.target as Node)
    ) {
      this.setState({ showAccountDropdown: false })
    }
  }

  // Helper function to parse trade timestamp
  private parseTradeTimestamp(timestamp: number | string | null | undefined): Date | null {
    if (!timestamp) return null
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000)
    }
    return new Date(timestamp)
  }


  // Helper to format date as YYYY-MM-DD in local timezone (not UTC)
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to calculate trade P&L
  private calculateTradePnL(trade: any): number {
    if (!trade.exit_price || !trade.entry_price || !trade.contracts) return 0
    
    // Get tick size and tick value for this symbol (defaults to 1 if not found)
    const tickSize = this.state.symbolData?.[trade.symbol]?.tickSize ?? 1
    const tickValue = this.state.symbolData?.[trade.symbol]?.tickValue ?? 1
    
    // Calculate P&L based on direction
    // For long: profit when exit > entry, so (exit - entry) / tickSize * tickValue * contracts
    // For short: profit when exit < entry, so (entry - exit) / tickSize * tickValue * contracts
    // Use absolute value of contracts since short trades may have negative contract values
    const contracts = Math.abs(trade.contracts || 0)
    if (trade.direction?.toLowerCase() === 'short') {
      const priceDiff = trade.entry_price - trade.exit_price
      const ticks = priceDiff / tickSize
      return ticks * tickValue * contracts
    } else {
      const priceDiff = trade.exit_price - trade.entry_price
      const ticks = priceDiff / tickSize
      return ticks * tickValue * contracts
    }
  }

  // Helper function to calculate trade duration in seconds
  private calculateTradeDuration(trade: any, parseFn?: (timestamp: any) => Date | null): number | null {
    const parseTimestamp = parseFn || this.parseTradeTimestamp.bind(this)
    const entryTime = parseTimestamp(trade.entry_time)
    const exitTime = parseTimestamp(trade.exit_time)
    if (!entryTime || !exitTime) return null
    return Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000)
  }

  // Format duration as "X min Y sec"
  private formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return '0m 0s'
    const totalSeconds = Math.round(seconds) // Round to nearest second
    if (totalSeconds < 60) return `${totalSeconds}s`
    if (totalSeconds < 3600) {
      const mins = Math.floor(totalSeconds / 60)
      const secs = totalSeconds % 60
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
    }
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (secs > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  // Format currency with K notation for small devices
  private formatCurrency(value: number, useCompact: boolean = false): string {
    const absValue = Math.abs(value)
    const sign = value >= 0 ? '+' : '-'
    
    if (useCompact && absValue >= 1000) {
      // Use K notation for compact display (e.g., 1.4K, 2.5K)
      const kValue = absValue / 1000
      return `${sign}$${kValue.toFixed(1)}K`
    } else {
      // Use full format with commas
      return `${sign}$${absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }

  // Calculate day-based statistics
  private calculateDayStats(trades: any[], calculatePnL?: (trade: any) => number, parseFn?: (timestamp: any) => Date | null) {
    const calculateTradePnL = calculatePnL || this.calculateTradePnL.bind(this)
    const parseTradeTimestamp = parseFn || this.parseTradeTimestamp.bind(this)
    const dayMap = new Map<string, { count: number; profit: number }>()
    

    trades.forEach(trade => {
      // Use prop firm's parse function if available
      const entryTime = parseTradeTimestamp(trade.entry_time)
      if (!entryTime) return
      const date = entryTime.toISOString().split('T')[0]
      
      // Calculate P&L - use gross P/L when available, then subtract fees
      let grossPnl = 0
      if (trade.originalTrade && trade.originalTrade.pnL !== undefined) {
        grossPnl = trade.originalTrade.pnL
      } else {
        grossPnl = calculateTradePnL(trade)
      }
      
      // Get fees - use trade.fees when present, else symbol data
      let fees = 0
      if (trade.fees !== undefined || trade.originalTrade?.fees !== undefined) {
        fees = trade.fees || trade.originalTrade?.fees || 0
      } else {
      const symbol = trade.symbol || ''
      const symbolInfo = this.state.symbolData?.[symbol]
      const totalFees = symbolInfo?.totalFees || 0
        fees = totalFees * Math.abs(trade.contracts || 0)
      }
      const netPnl = grossPnl - fees
      
      const existing = dayMap.get(date) || { count: 0, profit: 0 }
      dayMap.set(date, {
        count: existing.count + 1,
        profit: existing.profit + netPnl
      })
    })

    let mostActiveDay = { date: 'N/A', count: 0 }
    let mostProfitableDay = { date: 'N/A', profit: -Infinity }
    let leastProfitableDay = { date: 'N/A', profit: Infinity }

    dayMap.forEach((stats, date) => {
      if (stats.count > mostActiveDay.count) {
        mostActiveDay = { date, count: stats.count }
      }
      // Most Profitable Day: day with highest profit (even if negative)
      if (stats.profit > mostProfitableDay.profit) {
        mostProfitableDay = { date, profit: stats.profit }
      }
      if (stats.profit < leastProfitableDay.profit) {
        leastProfitableDay = { date, profit: stats.profit }
      }
    })

    return { mostActiveDay, mostProfitableDay, leastProfitableDay }
  }

  // Calculate trade duration statistics
  private calculateDurationStats(trades: any[], parseFn?: (timestamp: any) => Date | null, calculatePnL?: (trade: any) => number) {
    const parseTradeTimestamp = parseFn || this.parseTradeTimestamp.bind(this)
    const calculateTradePnL = calculatePnL || this.calculateTradePnL.bind(this)
    const durations: number[] = []
    const winDurations: number[] = []
    const lossDurations: number[] = []

    trades.forEach(trade => {
      const duration = this.calculateTradeDuration(trade, parseTradeTimestamp)
      if (duration === null) return
      
      durations.push(duration)
      const pnl = calculateTradePnL(trade)
      
      if (pnl > 0) {
        winDurations.push(duration)
      } else if (pnl < 0) {
        lossDurations.push(duration)
      }
    })

    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0
    const avgWinDuration = winDurations.length > 0
      ? winDurations.reduce((a, b) => a + b, 0) / winDurations.length
      : 0
    const avgLossDuration = lossDurations.length > 0
      ? lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length
      : 0

    return {
      avgDuration,
      avgWinDuration,
      avgLossDuration
    }
  }

  // Find best and worst trades
  private findBestWorstTrades(trades: any[], calculatePnL?: (trade: any) => number) {
    const calculateTradePnL = calculatePnL || this.calculateTradePnL.bind(this)
    let bestTrade: any = null
    let worstTrade: any = null
    let bestPnL = -Infinity
    let worstPnL = Infinity

    trades.forEach(trade => {
      const pnl = calculateTradePnL(trade)
      if (pnl > bestPnL) {
        bestPnL = pnl
        bestTrade = trade
      }
      if (pnl < worstPnL) {
        worstPnL = pnl
        worstTrade = trade
      }
    })

    return { bestTrade, worstTrade }
  }

  private handleCalendarDayClick = async (
    dayData: NonNullable<StatsRendererState['selectedDayData']>,
    calculateTradePnL: (trade: any) => number
  ) => {
    if (this.getActivePropFirmId() === 'tradesea') {
      const firm = propFirmRegistry.find((f) => f.id === 'tradesea') as TradeseaPropFirm | undefined
      this.setState({
        showDayDialog: true,
        selectedDayData: dayData,
        dayTradesLoading: true,
        selectedTimelinePoint: null,
      })
      const dayTrades = firm ? await firm.fetchTradelensDayTrades(dayData.date) : []
      if (dayTrades.length > 0) {
        const day = dayData.day ?? (Number(dayData.date.split('-')[2]) || 1)
        this.setState({
          selectedDayData: buildDayStatsPayload(dayData.date, day, dayTrades, calculateTradePnL),
          dayTradesLoading: false,
        })
        return
      }
      this.setState({ dayTradesLoading: false })
      return
    }

    this.setState({
      showDayDialog: true,
      selectedDayData: dayData,
      dayTradesLoading: false,
      selectedTimelinePoint: null,
    })
  }

  render() {
    const { isDark, toggleTheme, navigate, showAccountDropdown: showAccountDropdownProp, accounts: accountsProp, title = 'Statistics' } = this.props
    const { selectedAccount, showAccountDropdown, showNav, activeTab, dateRange, trades, loading, showDayDialog, selectedDayData, dayTradesLoading, selectedTimelinePoint, showWeekDialog, selectedWeekData, propFirmStats } = this.state

    // Dummy data or use prop
    const accounts = accountsProp || ['Account 1', 'Account 2', 'Account 3']

    const referenceDate = new Date()
    const formatDateForInput = (date: Date): string => date.toISOString().split('T')[0]

    // Use prop firm helper functions if available, otherwise use local methods
    const calculateTradePnL = propFirmStats?.calculateTradePnL || this.calculateTradePnL.bind(this)
    const parseTradeTimestamp = propFirmStats?.parseTradeTimestamp || this.parseTradeTimestamp.bind(this)
    const formatDuration = propFirmStats?.formatDuration || this.formatDuration.bind(this)
    const displayTrades = trades.filter((trade) => !isSyntheticTradeseaTrade(trade))

    // Calculate additional stats from trades
    const closedTrades = trades.filter(t => t.exit_price !== null && t.exit_price !== undefined)
    const dayStats = this.calculateDayStats(closedTrades, calculateTradePnL, parseTradeTimestamp)
    const durationStats = this.calculateDurationStats(closedTrades, parseTradeTimestamp, calculateTradePnL)
    const { bestTrade, worstTrade } = this.findBestWorstTrades(closedTrades, calculateTradePnL)

    // Calculate trade duration analysis data
    const calculateDurationAnalysisData = () => {
      const buckets = [
        { label: 'Under 15 sec', min: 0, max: 15 },
        { label: '15 - 45 sec', min: 15, max: 45 },
        { label: '45 sec - 1 min', min: 45, max: 60 },
        { label: '1 min - 2 min', min: 60, max: 120 },
        { label: '2 min - 5 min', min: 120, max: 300 },
        { label: '5 min - 10 min', min: 300, max: 600 },
        { label: '10 min - 30 min', min: 600, max: 1800 },
        { label: '30 min - 1 hour', min: 1800, max: 3600 },
        { label: '1 hour - 2 hours', min: 3600, max: 7200 },
        { label: '2 hours - 4 hours', min: 7200, max: 14400 },
        { label: '4 hours and up', min: 14400, max: Infinity },
      ]

      const counts = buckets.map(() => 0)
      
      closedTrades.forEach(trade => {
        const duration = this.calculateTradeDuration(trade, parseTradeTimestamp)
        if (duration === null) return
        
        const bucketIndex = buckets.findIndex(b => duration >= b.min && duration < b.max)
        if (bucketIndex >= 0) {
          counts[bucketIndex]++
        }
      })

      return buckets.map((bucket, idx) => ({
        label: bucket.label,
        count: counts[idx]
      }))
    }

    // Calculate win rate analysis data (by duration buckets)
    const calculateWinRateAnalysisData = () => {
      const buckets = [
        { label: 'Under 15 sec', min: 0, max: 15 },
        { label: '15 - 45 sec', min: 15, max: 45 },
        { label: '45 sec - 1 min', min: 45, max: 60 },
        { label: '1 min - 2 min', min: 60, max: 120 },
        { label: '2 min - 5 min', min: 120, max: 300 },
        { label: '5 min - 10 min', min: 300, max: 600 },
        { label: '10 min - 30 min', min: 600, max: 1800 },
        { label: '30 min - 1 hour', min: 1800, max: 3600 },
        { label: '1 hour - 2 hours', min: 3600, max: 7200 },
        { label: '2 hours - 4 hours', min: 7200, max: 14400 },
        { label: '4 hours and up', min: 14400, max: Infinity },
      ]

      return buckets.map(bucket => {
        const tradesInBucket = closedTrades.filter(trade => {
          const duration = this.calculateTradeDuration(trade, parseTradeTimestamp)
          if (duration === null) return false
          return duration >= bucket.min && duration < bucket.max
        })

        if (tradesInBucket.length === 0) {
          return { label: bucket.label, rate: 0 }
        }

        const wins = tradesInBucket.filter(trade => calculateTradePnL(trade) > 0).length
        const winRate = (wins / tradesInBucket.length) * 100

        return { label: bucket.label, rate: winRate }
      })
    }

    // Calculate equity curve data
    const calculateEquityCurveData = () => {
      // Use prop firm equity curve data if available
      if (propFirmStats?.equityCurveData && propFirmStats.equityCurveData.length > 0) {
        return propFirmStats.equityCurveData
      }

      if (closedTrades.length === 0) return []
      
      // Sort trades by entry time
      const sortedTrades = [...closedTrades].sort((a, b) => {
        const timeA = parseTradeTimestamp(a.entry_time)?.getTime() || 0
        const timeB = parseTradeTimestamp(b.entry_time)?.getTime() || 0
        return timeA - timeB
      })

      // Get initial balance (from prop firm stats or session or default)
      const initialBalance = propFirmStats?.initialBalance || 50000
      const points: Array<{ date: string; value: number }> = []
      let runningBalance = initialBalance

      sortedTrades.forEach(trade => {
        const pnl = calculateTradePnL(trade)
        // Subtract fees - use fees directly from trade data
        const fees = trade.fees || trade.originalTrade?.fees || 0
        const netPnl = pnl - fees
        runningBalance += netPnl
        
        const entryTime = parseTradeTimestamp(trade.entry_time)
        if (entryTime) {
          points.push({
            date: this.formatDateLocal(entryTime),
            value: runningBalance
          })
        }
      })

      return points
    }

    const durationAnalysisData =
      propFirmStats?.durationAnalysisData ?? calculateDurationAnalysisData()
    const winRateAnalysisData =
      propFirmStats?.winRateAnalysisData ?? calculateWinRateAnalysisData()
    const equityCurveData = calculateEquityCurveData()
    const chartInitialBalance = propFirmStats?.initialBalance

    const calculateStats = () => {
      if (propFirmStats?.stats) {
        return propFirmStats.stats
      }
      return {
        totalTrades: 0,
        winRate: '0.0',
        totalProfit: '0.00',
        avgWin: '0.00',
        avgLoss: '0.00',
        largestWin: '0.00',
        largestLoss: '0.00',
        profitFactor: '0.00',
        sharpeRatio: '0.00',
        wins: 0,
        losses: 0,
      }
    }
    
    const stats = calculateStats()

    const { practiceMode } = this.props

    return (
      <div
        className={`${
          practiceMode ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'
        } transition-all duration-700 ease-in-out flex ${
          practiceMode
            ? isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
              : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'
            : isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
              : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        {/* Navigation - Desktop sidebar (animated) */}
        <div className={`hidden lg:block transition-all duration-300 ease-in-out ${
          showNav ? `${practiceMode ? 'w-11' : 'w-16'} opacity-100` : 'w-0 opacity-0 overflow-hidden'
        }`}>
          {showNav && (
            <TradingNav
              compact={practiceMode}
              isDark={isDark}
              navigate={navigate}
              currentPath={window.location.pathname}
              onToggleNav={() => {
                this.setState({ showNav: false })
                if (practiceMode && this.props.practiceAccountId) {
                  savePracticeShowNav(this.props.practiceAccountId, false)
                } else {
                  localStorage.setItem('trading_show_nav', 'false')
                }
              }}
              showDesktopNav={true}
              showMobileNav={false}
            />
          )}
        </div>
        
        {/* Mobile Bottom Nav - Animated */}
        <div className={`lg:hidden fixed bottom-0 left-0 right-0 transition-all duration-300 ease-in-out transform z-50 ${
          showNav ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}>
          {showNav && (
            <TradingNav
              compact={practiceMode}
              isDark={isDark}
              navigate={navigate}
              currentPath={window.location.pathname}
              onToggleNav={() => {
                this.setState({ showNav: false })
                if (practiceMode && this.props.practiceAccountId) {
                  savePracticeShowNav(this.props.practiceAccountId, false)
                } else {
                  localStorage.setItem('trading_show_nav', 'false')
                }
              }}
              showDesktopNav={false}
              showMobileNav={true}
            />
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {practiceMode ? (
            <PracticeTradeHeader
              isDark={isDark}
              navigate={navigate}
              toggleTheme={toggleTheme}
              practiceAccountId={this.props.practiceAccountId}
              showNav={showNav}
              onShowNav={() => {
                this.setState({ showNav: true })
                if (practiceMode && this.props.practiceAccountId) {
                  savePracticeShowNav(this.props.practiceAccountId, true)
                } else {
                  localStorage.setItem('trading_show_nav', 'true')
                }
              }}
              showStatsBar={false}
            />
          ) : (
          <StatsHeader
            isDark={isDark}
            showNav={showNav}
            showAccountDropdown={showAccountDropdown}
            showAccountDropdownProp={showAccountDropdownProp || false}
            selectedAccount={selectedAccount}
            accounts={accounts}
            navigate={navigate}
            toggleTheme={toggleTheme}
            onShowNav={() => {
              this.setState({ showNav: true })
              localStorage.setItem('trading_show_nav', 'true')
            }}
            onAccountChange={(account) => {
              const oldAccount = selectedAccount
              this.setState({ selectedAccount: account, showAccountDropdown: false }, () => {
                if (oldAccount !== account) {
                  TradingHandler.logAccountChange(oldAccount, account)
                  // Save to localStorage if it's a formatted account
                  const formattedAccount = this.resolveFormattedAccount(account)
                  const accountKey = this.accountKeyFromFormatted(formattedAccount)
                  if (accountKey != null) {
                    this.updatePropFirmAccount(accountKey, formattedAccount)
                    this.setState({
                      overviewPropFirmStats: undefined,
                      calendarPropFirmStats: undefined,
                    }, () => this.loadPropFirmStats())
                  }
                }
              })
            }}
            onToggleAccountDropdown={() => this.setState({ showAccountDropdown: !showAccountDropdown })}
          />
          )}

          {/* Main Content */}
          <main
            className={
              practiceMode
                ? 'flex-1 min-h-0 flex flex-col px-2 py-2 pb-20 lg:pb-2 overflow-hidden'
                : 'flex-1 overflow-auto py-3 sm:py-4 pb-20 lg:pb-4 px-4 sm:px-6 lg:px-8'
            }
          >
          <div
            className={
              practiceMode
                ? `flex-1 min-h-0 overflow-auto p-3 sm:p-4 ${practiceTradePanelClass(isDark)}`
                : ''
            }
          >
          {practiceMode && (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/60">
                <TrendingUp className={`w-5 h-5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {title}
                </h1>
              </div>
              {this.props.practiceAccountId && (
                <PracticeEvalStatsPanel
                  practiceAccountId={this.props.practiceAccountId}
                  isDark={isDark}
                />
              )}
            </>
          )}
          {!practiceMode && (
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <h1 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h1>
            </div>
          </div>
          )}

          {activeTab !== 'calendar' && (
            <DateRangeSelector
              isDark={isDark}
              practiceMode={practiceMode}
              dateRange={dateRange}
              referenceDate={referenceDate}
              onDateRangeChange={(range) => this.setState({ dateRange: range })}
              formatDateForInput={formatDateForInput}
            />
          )}

          {/* Tabs */}
          <StatsTabs
            isDark={isDark}
            activeTab={activeTab}
            onTabChange={(tab) => this.setState({ activeTab: tab })}
            practiceMode={practiceMode}
          />

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab
              isDark={isDark}
              practiceMode={practiceMode}
              stats={stats}
              dayStats={dayStats}
              durationStats={durationStats}
              bestTrade={bestTrade}
              worstTrade={worstTrade}
              equityCurveData={equityCurveData}
              initialBalance={chartInitialBalance}
              durationAnalysisData={durationAnalysisData}
              winRateAnalysisData={winRateAnalysisData}
              dateRange={dateRange}
              symbolData={this.state.symbolData}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
              formatDuration={formatDuration}
              trades={trades}
            />
          )}

          {activeTab === 'calendar' && (
            <StatsCalendar
              isDark={isDark}
              currentMonth={this.state.currentMonth}
              trades={displayTrades}
              calendarDaySummaries={propFirmStats?.tradeseaCalendarDays}
              dateRange={dateRange}
              referenceDate={referenceDate}
              symbolData={this.state.symbolData}
              formatDateForInput={formatDateForInput}
              formatCurrency={this.formatCurrency.bind(this)}
              calculateTradePnL={calculateTradePnL}
              onDayClick={(dayData) => {
                void this.handleCalendarDayClick(dayData, calculateTradePnL)
              }}
              onWeekClick={(weekData) => {
                this.setState({
                  showWeekDialog: true,
                  selectedWeekData: weekData
                })
              }}
              onMonthChange={(month) => this.setState({ currentMonth: month })}
            />
          )}

          {activeTab === 'trades' && (
            <TradesTable
              isDark={isDark}
              loading={loading}
              trades={displayTrades}
              dateRange={dateRange}
              symbolData={this.state.symbolData}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
              calculateTradeDuration={(trade: any) => this.calculateTradeDuration(trade, parseTradeTimestamp)}
              formatDuration={formatDuration}
            />
          )}



          {/* Day Stats Dialog */}
          {showDayDialog && selectedDayData && (
            <DayStatsDialog
              isDark={isDark}
              selectedDayData={selectedDayData}
              tradesLoading={dayTradesLoading}
              selectedTimelinePoint={selectedTimelinePoint || null}
              symbolData={this.state.symbolData}
              onClose={() =>
                this.setState({
                  showDayDialog: false,
                  selectedDayData: null,
                  dayTradesLoading: false,
                  selectedTimelinePoint: null,
                })
              }
              onTimelinePointClick={(point) => this.setState({ selectedTimelinePoint: point })}
              onTimelinePointClose={() => this.setState({ selectedTimelinePoint: null })}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
              formatCurrency={this.formatCurrency.bind(this)}
            />
          )}

          {/* Weekly Stats Dialog */}
          {showWeekDialog && selectedWeekData && (
            <WeekStatsDialog
              isDark={isDark}
              selectedWeekData={selectedWeekData}
              symbolData={this.state.symbolData}
              selectedTimelinePoint={selectedTimelinePoint || null}
              onClose={() => this.setState({ showWeekDialog: false, selectedWeekData: null, selectedTimelinePoint: null })}
              onTimelinePointClick={(point) => this.setState({ selectedTimelinePoint: point })}
              onTimelinePointClose={() => this.setState({ selectedTimelinePoint: null })}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
            />
          )}
          </div>
        </main>
        </div>
      </div>
    )
  }
}

export default StatsRenderer

