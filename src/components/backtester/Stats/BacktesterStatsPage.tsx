import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Play, RefreshCw, TrendingUp } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../../hooks/useTheme'
import { authAPI } from '../../../api/auth.api'
import { backtesterAPI } from '../../../api/backtester.api'
import { ROUTES } from '../../../constants/routes'
import type { BacktestSession } from '../../../types/backtester'
import type {
  DayStatsDialogProps,
  OverviewTabProps,
  StatsRendererState,
  WeekStatsDialogProps,
} from '../../../types/common'
import { BacktesterStats } from '../../../services/stats/BacktesterStats'
import { getTradeCalendarDate } from '../../../utils/tradeCalendarDate'
import { practiceTradePanelClass } from '../../trading/Practice/practiceTradeTheme'
import { TradeHeader } from '../../trading/Trading/TradeHeader'
import DateRangeSelector from '../../trading/Stats/DateRangeSelector'
import StatsTabs from '../../trading/Stats/StatsTabs'
import OverviewTab from '../../trading/Stats/OverviewTab'
import StatsCalendar from '../../trading/Stats/StatsCalendar'
import TradesTable from '../../trading/Stats/TradesTable'
import DayStatsDialog from '../../trading/Stats/DayStatsDialog'
import WeekStatsDialog from '../../trading/Stats/WeekStatsDialog'
import { t } from '../../../utils/translator'

type BacktestTrade = {
  id: string
  session_id: string
  symbol: string
  direction: 'long' | 'short' | string
  entry_price: number
  exit_price: number | null
  contracts: number
  entry_time: string | number
  exit_time: string | number | null
  fees?: number
  tradeseaDay?: string
  originalTrade?: { fees?: number; pnL?: number; tradeseaDay?: string }
}

type SymbolDataMap = Record<
  string,
  {
    tickSize: number
    tickValue: number
    totalFees?: number
    description?: string
    exchangeFee?: number
    regulatoryFee?: number
    commissionFee?: number
  }
>

type TimelinePoint = NonNullable<DayStatsDialogProps['selectedTimelinePoint']>

const replayHubPath = `${ROUTES.HOME}?mode=replay`

const practicePageBg = (isDark: boolean) =>
  isDark
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950'
    : 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100/60'

function parseTradeTimestamp(timestamp: string | number | null | undefined): Date | null {
  if (timestamp == null || timestamp === '') return null
  if (typeof timestamp === 'number') {
    const seconds =
      timestamp > 1e15
        ? timestamp / 1000000
        : timestamp > 1e12
          ? timestamp / 1000
          : timestamp > 1e9
            ? timestamp
            : timestamp > 1e6
              ? timestamp * 1000
              : timestamp
    const ms = seconds * 1000
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const numeric = Number(timestamp)
  if (Number.isFinite(numeric) && String(timestamp).trim() !== '') {
    return parseTradeTimestamp(numeric)
  }
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

function feesForTrade(trade: BacktestTrade, symbolData?: SymbolDataMap): number {
  const explicitFees = trade.fees ?? trade.originalTrade?.fees
  if (explicitFees != null) return Number(explicitFees) || 0
  const totalFees = symbolData?.[trade.symbol || '']?.totalFees || 0
  return totalFees * Math.abs(trade.contracts || 0)
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0m 0s'
  const totalSeconds = Math.round(seconds)
  if (totalSeconds < 60) return `${totalSeconds}s`
  if (totalSeconds < 3600) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (secs > 0) return `${hours}h ${minutes}m ${secs}s`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function formatCurrency(value: number, useCompact = false): string {
  const absValue = Math.abs(value)
  const sign = value >= 0 ? '+' : '-'
  if (useCompact && absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(1)}K`
  }
  return `${sign}$${absValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function calculateTradeDuration(trade: BacktestTrade): number | null {
  const entryTime = parseTradeTimestamp(trade.entry_time)
  const exitTime = parseTradeTimestamp(trade.exit_time)
  if (!entryTime || !exitTime) return null
  return Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000)
}

export default function BacktesterStatsPage() {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<BacktestSession[]>([])
  const [trades, setTrades] = useState<BacktestTrade[]>([])
  const [symbolData, setSymbolData] = useState<SymbolDataMap>()
  const [activeTab, setActiveTab] = useState<StatsRendererState['activeTab']>('overview')
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: '',
  })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showDayDialog, setShowDayDialog] = useState(false)
  const [selectedDayData, setSelectedDayData] =
    useState<DayStatsDialogProps['selectedDayData'] | null>(null)
  const [selectedTimelinePoint, setSelectedTimelinePoint] = useState<TimelinePoint | null>(null)
  const [showWeekDialog, setShowWeekDialog] = useState(false)
  const [selectedWeekData, setSelectedWeekData] =
    useState<WeekStatsDialogProps['selectedWeekData'] | null>(null)

  const statsCalculator = useMemo(() => new BacktesterStats(), [])
  const sessionId = searchParams.get('sessionId') || sessions[0]?.id || ''
  const currentSession = sessions.find((s) => s.id === sessionId) ?? null

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate(ROUTES.LOGIN)
          return
        }

        await authAPI.validateToken(token)

        const [sessionsRes, symbolsRes] = await Promise.all([
          backtesterAPI.getSessions(),
          backtesterAPI.getSymbolData(),
        ])

        if (sessionsRes.success) {
          setSessions(sessionsRes.sessions)
          if (!searchParams.get('sessionId') && sessionsRes.sessions[0]) {
            setSearchParams({ sessionId: sessionsRes.sessions[0].id }, { replace: true })
          }
        }

        if (symbolsRes.success) {
          setSymbolData(symbolsRes.symbols as SymbolDataMap)
        }

        setError(null)
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.removeItem('token')
          navigate(ROUTES.LOGIN)
          return
        }
        setError(err?.message || t('practice.page.loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [navigate, searchParams, setSearchParams])

  useEffect(() => {
    if (!sessions.length) return
    if (sessionId && currentSession) return
    if (sessions[0]) {
      setSearchParams({ sessionId: sessions[0].id }, { replace: true })
    }
  }, [currentSession, sessionId, sessions, setSearchParams])

  useEffect(() => {
    if (!currentSession) return
    const nextRange = statsCalculator.getDefaultDateRange(currentSession)
    setDateRange(nextRange)
    setCurrentMonth(new Date(`${currentSession.startDate}T00:00:00`))
    setActiveTab('overview')
    setShowDayDialog(false)
    setSelectedDayData(null)
    setSelectedTimelinePoint(null)
    setShowWeekDialog(false)
    setSelectedWeekData(null)
  }, [currentSession?.id, statsCalculator])

  useEffect(() => {
    if (!sessionId) {
      setTrades([])
      return
    }

    const loadTrades = async () => {
      setLoading(true)
      try {
        const tradesRes = await backtesterAPI.getTrades({ sessionId })
        setTrades(tradesRes.success ? (tradesRes.trades as BacktestTrade[]) : [])
        setError(null)
      } catch (err: any) {
        setTrades([])
        setError(err?.message || t('practice.page.loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    void loadTrades()
  }, [sessionId])

  const calculateTradePnL = useMemo(
    () => (trade: BacktestTrade): number => {
      if (trade.exit_price == null || trade.entry_price == null || !trade.contracts) return 0
      const tickSize = symbolData?.[trade.symbol || '']?.tickSize ?? 1
      const tickValue = symbolData?.[trade.symbol || '']?.tickValue ?? 1
      const contracts = Math.abs(trade.contracts || 0)
      if (trade.direction?.toLowerCase() === 'short') {
        return ((trade.entry_price - trade.exit_price) / tickSize) * tickValue * contracts
      }
      return ((trade.exit_price - trade.entry_price) / tickSize) * tickValue * contracts
    },
    [symbolData]
  )

  const rangedTrades = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return trades
    return trades.filter((trade) => {
      const tradeDate = getTradeCalendarDate(trade, parseTradeTimestamp)
      return tradeDate && tradeDate >= dateRange.startDate && tradeDate <= dateRange.endDate
    })
  }, [dateRange.endDate, dateRange.startDate, trades])

  const closedTrades = useMemo(
    () => rangedTrades.filter((trade) => trade.exit_price !== null && trade.exit_price !== undefined),
    [rangedTrades]
  )

  const stats = useMemo<OverviewTabProps['stats']>(() => {
    statsCalculator.setSymbolData(symbolData)
    return statsCalculator.calculate(closedTrades as Array<{
      entry_price: number
      exit_price: number | null
      contracts: number
      direction?: 'long' | 'short'
      entry_time?: string
      exit_time?: string
      symbol?: string
    }>)
  }, [closedTrades, statsCalculator, symbolData])

  const dayStats = useMemo<OverviewTabProps['dayStats']>(() => {
    const dayMap = new Map<string, { count: number; profit: number }>()

    closedTrades.forEach((trade) => {
      const entryTime = parseTradeTimestamp(trade.entry_time)
      if (!entryTime) return
      const date = entryTime.toISOString().split('T')[0]
      const netPnl = calculateTradePnL(trade) - feesForTrade(trade, symbolData)
      const existing = dayMap.get(date) || { count: 0, profit: 0 }
      dayMap.set(date, {
        count: existing.count + 1,
        profit: existing.profit + netPnl,
      })
    })

    let mostActiveDay = { date: 'N/A', count: 0 }
    let mostProfitableDay = { date: 'N/A', profit: -Infinity }
    let leastProfitableDay = { date: 'N/A', profit: Infinity }

    dayMap.forEach((row, date) => {
      if (row.count > mostActiveDay.count) mostActiveDay = { date, count: row.count }
      if (row.profit > mostProfitableDay.profit) mostProfitableDay = { date, profit: row.profit }
      if (row.profit < leastProfitableDay.profit) leastProfitableDay = { date, profit: row.profit }
    })

    return { mostActiveDay, mostProfitableDay, leastProfitableDay }
  }, [calculateTradePnL, closedTrades, symbolData])

  const durationStats = useMemo<OverviewTabProps['durationStats']>(() => {
    const durations: number[] = []
    const winDurations: number[] = []
    const lossDurations: number[] = []

    closedTrades.forEach((trade) => {
      const duration = calculateTradeDuration(trade)
      if (duration == null) return
      durations.push(duration)
      const grossPnl = calculateTradePnL(trade)
      if (grossPnl > 0) winDurations.push(duration)
      else if (grossPnl < 0) lossDurations.push(duration)
    })

    const avg = (values: number[]) =>
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

    return {
      avgDuration: avg(durations),
      avgWinDuration: avg(winDurations),
      avgLossDuration: avg(lossDurations),
    }
  }, [calculateTradePnL, closedTrades])

  const { bestTrade, worstTrade } = useMemo(() => {
    let nextBest: BacktestTrade | null = null
    let nextWorst: BacktestTrade | null = null
    let bestPnl = -Infinity
    let worstPnl = Infinity

    closedTrades.forEach((trade) => {
      const pnl = calculateTradePnL(trade)
      if (pnl > bestPnl) {
        bestPnl = pnl
        nextBest = trade
      }
      if (pnl < worstPnl) {
        worstPnl = pnl
        nextWorst = trade
      }
    })

    return { bestTrade: nextBest, worstTrade: nextWorst }
  }, [calculateTradePnL, closedTrades])

  const durationAnalysisData = useMemo<OverviewTabProps['durationAnalysisData']>(() => {
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
    closedTrades.forEach((trade) => {
      const duration = calculateTradeDuration(trade)
      if (duration == null) return
      const bucketIndex = buckets.findIndex((bucket) => duration >= bucket.min && duration < bucket.max)
      if (bucketIndex >= 0) counts[bucketIndex] += 1
    })

    return buckets.map((bucket, index) => ({ label: bucket.label, count: counts[index] }))
  }, [closedTrades])

  const winRateAnalysisData = useMemo<OverviewTabProps['winRateAnalysisData']>(() => {
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

    return buckets.map((bucket) => {
      const tradesInBucket = closedTrades.filter((trade) => {
        const duration = calculateTradeDuration(trade)
        return duration != null && duration >= bucket.min && duration < bucket.max
      })

      if (tradesInBucket.length === 0) return { label: bucket.label, rate: 0 }
      const wins = tradesInBucket.filter((trade) => calculateTradePnL(trade) > 0).length
      return { label: bucket.label, rate: (wins / tradesInBucket.length) * 100 }
    })
  }, [calculateTradePnL, closedTrades])

  const equityCurveData = useMemo(() => {
    if (closedTrades.length === 0) return []
    const sortedTrades = [...closedTrades].sort((a, b) => {
      const timeA = parseTradeTimestamp(a.entry_time)?.getTime() || 0
      const timeB = parseTradeTimestamp(b.entry_time)?.getTime() || 0
      return timeA - timeB
    })

    const points: Array<{ date: string; value: number }> = []
    let runningBalance = currentSession?.initialBalance || 50000

    sortedTrades.forEach((trade) => {
      runningBalance += calculateTradePnL(trade) - feesForTrade(trade, symbolData)
      const entryTime = parseTradeTimestamp(trade.entry_time)
      if (!entryTime) return
      points.push({
        date: formatDateForInput(entryTime),
        value: runningBalance,
      })
    })

    return points
  }, [calculateTradePnL, closedTrades, currentSession?.initialBalance, symbolData])

  if (loading && !sessions.length && !trades.length) {
    return (
      <div className={`h-screen flex items-center justify-center ${practicePageBg(isDark)}`}>
        <RefreshCw className={`w-8 h-8 animate-spin ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${practicePageBg(isDark)}`}>
        <div
          className={`max-w-md w-full p-6 rounded-2xl border ${
            isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(replayHubPath)}
            className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
          >
            {t('practice.trade.backToHub')}
          </button>
        </div>
      </div>
    )
  }

  if (!currentSession) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${practicePageBg(isDark)}`}>
        <div
          className={`max-w-md w-full p-6 rounded-2xl border ${
            isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
              {t('backtester.sessionNotFound')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(replayHubPath)}
            className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
          >
            {t('practice.trade.backToHub')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`practice-stats-shell h-dvh max-h-dvh min-h-0 flex flex-col overflow-hidden transition-all duration-700 ease-in-out ${practicePageBg(isDark)}`}
    >
      <TradeHeader
        isDark={isDark}
        navigate={navigate}
        toggleTheme={toggleTheme}
        showNav
        onShowNav={() => {}}
        hideNavToggle
        showStatsBar={false}
        showAccountSelector={false}
        showTradingSettings={false}
        showLogoAlways
        hubPath={replayHubPath}
        headerLabel={`${currentSession.name} · ${currentSession.symbol}`}
      />

      <main className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden practice-stats-scroll px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className={`min-w-0 p-3 sm:p-4 ${practiceTradePanelClass(isDark)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
              <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('backtester.stats.title', {}, 'Backtest Statistics')}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.BACKTESTER_CHART}?sessionId=${currentSession.id}`)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
            >
              <Play className="w-4 h-4" />
              {t('backtester.resumeReplay', {}, 'Resume replay')}
            </button>
          </div>

          <DateRangeSelector
            isDark={isDark}
            practiceMode
            dateRange={dateRange}
            referenceDate={new Date()}
            onDateRangeChange={setDateRange}
            formatDateForInput={formatDateForInput}
          />

          <StatsTabs
            isDark={isDark}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            practiceMode
          />

          {activeTab === 'overview' && (
            <OverviewTab
              isDark={isDark}
              practiceMode
              stats={stats}
              dayStats={dayStats}
              durationStats={durationStats}
              bestTrade={bestTrade}
              worstTrade={worstTrade}
              equityCurveData={equityCurveData}
              initialBalance={currentSession.initialBalance || 50000}
              durationAnalysisData={durationAnalysisData}
              winRateAnalysisData={winRateAnalysisData}
              dateRange={dateRange}
              symbolData={symbolData}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
              formatDuration={formatDuration}
              trades={rangedTrades}
            />
          )}

          {activeTab === 'calendar' && (
            <StatsCalendar
              isDark={isDark}
              currentMonth={currentMonth}
              trades={trades}
              dateRange={dateRange}
              referenceDate={new Date()}
              symbolData={symbolData}
              formatDateForInput={formatDateForInput}
              formatCurrency={formatCurrency}
              calculateTradePnL={calculateTradePnL}
              onDayClick={(dayData) => {
                setSelectedDayData(dayData)
                setSelectedTimelinePoint(null)
                setShowDayDialog(true)
              }}
              onWeekClick={(weekData) => {
                setSelectedWeekData(weekData)
                setSelectedTimelinePoint(null)
                setShowWeekDialog(true)
              }}
              onMonthChange={setCurrentMonth}
            />
          )}

          {activeTab === 'trades' && (
            <TradesTable
              isDark={isDark}
              loading={loading}
              trades={rangedTrades}
              dateRange={dateRange}
              symbolData={symbolData}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
              calculateTradeDuration={calculateTradeDuration}
              formatDuration={formatDuration}
            />
          )}

          {showDayDialog && selectedDayData && (
            <DayStatsDialog
              isDark={isDark}
              selectedDayData={selectedDayData}
              tradesLoading={false}
              selectedTimelinePoint={selectedTimelinePoint}
              symbolData={symbolData}
              onClose={() => {
                setShowDayDialog(false)
                setSelectedDayData(null)
                setSelectedTimelinePoint(null)
              }}
              onTimelinePointClick={setSelectedTimelinePoint}
              onTimelinePointClose={() => setSelectedTimelinePoint(null)}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
              formatCurrency={formatCurrency}
            />
          )}

          {showWeekDialog && selectedWeekData && (
            <WeekStatsDialog
              isDark={isDark}
              selectedWeekData={selectedWeekData}
              symbolData={symbolData}
              selectedTimelinePoint={selectedTimelinePoint}
              onClose={() => {
                setShowWeekDialog(false)
                setSelectedWeekData(null)
                setSelectedTimelinePoint(null)
              }}
              onTimelinePointClick={setSelectedTimelinePoint}
              onTimelinePointClose={() => setSelectedTimelinePoint(null)}
              calculateTradePnL={calculateTradePnL}
              parseTradeTimestamp={parseTradeTimestamp}
            />
          )}
        </div>
      </main>
    </div>
  )
}
