import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  LineChart,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  TrendingDown,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { practiceAPI, type PracticeTradeRecord } from '../../api/practice.api'
import { journalAPI, type JournalEntryRecord, type JournalRiskLeg, type JournalStrategyRecord } from '../../api/journal.api'
import { backtesterAPI } from '../../api/backtester.api'
import AurenChart from '../../services/chart/AurenChart'
import type { BwcWidget } from '../../services/chart/bwcDatafeed'
import type { Bar, IDatafeedChartApi, LibrarySymbolInfo } from '../../types/chart'
import ProductHeader from '../../components/layout/ProductHeader'
import { EconomicNewsView } from '../../components/trading/shared/news/EconomicNewsView'
import {
  evaluatePracticeRules,
  getPracticeAccounts,
  PRACTICE_STORAGE_KEYS,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../../constants/practice'
import { practiceSessionPath, ROUTES } from '../../constants/routes'
import { useDisplayUnit } from '../../contexts/DisplayUnitContext'
import { useTheme } from '../../hooks/useTheme'

type PracticeStats = {
  trades?: (PracticeTradeRecord & { id?: string })[]
  totalTrades?: number
  winRate?: number
  totalPnl?: number
}

type Playbook = {
  id: string
  name: string
  conditions: PlaybookCondition[]
}

type PlaybookCondition = {
  id: string
  label: string
  type: 'boolean' | 'time' | 'timeframe' | 'timeframe_time' | 'liquidity_sweep' | 'pda_delivery' | 'smt' | 'text' | 'number'
}

type LiquiditySweepRow = {
  sweepTime: string
  referenceTime: string
  level: 'high' | 'low'
  price: string
  sourceLabel?: string
}

type PdaDeliveryRow = {
  time: string
  timeframe: string
  pda: string
  candles: string[]
}

type TradeJournalDetails = {
  playbook: string
  sweep: string
  pdaDelivery: string
  ifvgTimeframe: string
  ifvgTime: string
  notes: string
}

type ManualJournalEntry = JournalEntryRecord

const EXAMPLE_JOURNAL: TradeJournalDetails = {
  playbook: 'LIQ SWEEP + HTF PDA DELIVERY + IFVG',
  sweep: '9:13 AM — 15m sweep\n9:14 AM — 1h sweep\n9:15 AM — 4h + 1h high sweep',
  pdaDelivery: '9:20 AM — tapped 15m FVG and 4h FVG',
  ifvgTimeframe: '1m',
  ifvgTime: '9:22 AM',
  notes: 'Entry taken only after liquidity, HTF delivery, and IFVG confirmation aligned.',
}

const EXAMPLE_MANUAL_JOURNAL: ManualJournalEntry = {
  id: 'example-liq-sweep-pda-ifvg',
  dateTime: '2026-07-16T09:22',
  exitDateTime: '2026-07-16T09:35',
  symbol: 'NQ',
  side: 'short',
  entryPrice: '29471.25',
  closePrice: '29417.25',
  size: '1',
  pnl: '1080.00',
  outcome: 'win',
  playbook: 'LIQ SWEEP + HTF PDA + IFVG',
  conditionResponses: {
    'Liquidity sweep': '9:13 AM | 9:00 AM | high | 29457.00\n9:14 AM | 9:00 AM | high | 29457.25\n9:15 AM | 8:00 AM | high | 29452.75',
    'HTF PDA delivery': '9:20 AM @ 15m + 4h @ FVG',
    'IFVG': '1m @ 9:22 AM',
  },
  notes: EXAMPLE_JOURNAL.notes,
}

const DEFAULT_PLAYBOOK: Playbook = {
  id: 'liquidity-sweep-fvg',
  name: 'Liquidity Sweep + FVG Tap',
  conditions: [
    { id: 'htf-bias-aligned', label: 'HTF bias aligned', type: 'boolean' },
    { id: 'liquidity-sweep', label: 'Liquidity sweep timeline', type: 'time' },
    { id: 'rr-two-to-one', label: 'R:R ≥ 2:1', type: 'boolean' },
  ],
}

function normalizePlaybookCondition(value: unknown, index: number): PlaybookCondition {
  if (value && typeof value === 'object') {
    const item = value as Partial<PlaybookCondition>
    const validTypes: PlaybookCondition['type'][] = ['boolean', 'time', 'timeframe', 'timeframe_time', 'liquidity_sweep', 'pda_delivery', 'smt', 'text', 'number']
    const label = String(item.label || `Condition ${index + 1}`)
    return {
      id: String(item.id || `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`),
      label,
      type: validTypes.includes(item.type as PlaybookCondition['type']) ? item.type as PlaybookCondition['type'] : 'text',
    }
  }
  const label = String(value || `Condition ${index + 1}`)
  return { id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`, label, type: 'text' }
}

const conditionTypeLabel = (type: PlaybookCondition['type']) => {
  if (type === 'boolean') return 'Yes / No'
  if (type === 'timeframe_time') return 'Timeframe + Time'
  if (type === 'liquidity_sweep') return 'Sweep + Reference + Price'
  if (type === 'pda_delivery') return 'Time + Timeframe + PDA'
  if (type === 'smt') return 'SMT + Pair + Timeframe'
  return type
}

const parseLiquiditySweeps = (value: unknown): LiquiditySweepRow[] => {
  const source = String(value ?? '')
  if (!source) return [{ sweepTime: '', referenceTime: '', level: 'high', price: '' }]
  return source.split('\n').map((line) => {
    const parts = line.split('|').map((part) => part.trim())
    const [sweepTime = '', referenceTime = '', rawLevel = 'high', price = '', sourceLabel = ''] = parts.length >= 4
      ? parts
      : [parts[0] || '', '', parts[1] || 'high', parts[2] || '']
    return { sweepTime, referenceTime, level: rawLevel.toLowerCase() === 'low' ? 'low' as const : 'high' as const, price: price.replace(/^\$/, ''), sourceLabel }
  })
}

const serializeLiquiditySweeps = (rows: LiquiditySweepRow[]) => rows
  .map((row) => `${row.sweepTime} | ${row.referenceTime} | ${row.level} | ${row.price} | ${row.sourceLabel || ''}`)
  .join('\n')

const extractClockValues = (value: unknown) => [...String(value || '').matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)\b/gi)]
  .map((match) => match[0])

const parsePdaDeliveries = (value: unknown, legacyCandles?: unknown): PdaDeliveryRow[] => {
  const lines = String(value ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return [{ time: '', timeframe: '', pda: '', candles: [] }]
  const legacy = extractClockValues(legacyCandles)
  return lines.map((line, index) => {
    const [time = '', timeframe = '', pda = '', candleText = ''] = line.split(/\s*@\s*/, 4)
    const candles = extractClockValues(candleText)
    return { time, timeframe, pda, candles: candles.length ? candles : index === 0 ? legacy : [] }
  })
}

const serializePdaDeliveries = (rows: PdaDeliveryRow[]) => rows
  .map((row) => [row.time, row.timeframe, row.pda, row.candles.filter(Boolean).join(', ')].join(' @ '))
  .join('\n')

const formatConditionResponse = (label: string, value: string | boolean) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (!value) return '—'
  if (label.toLowerCase().includes('liquidity sweep')) {
    return parseLiquiditySweeps(value).map((row) => {
      const numericPrice = Number(row.price)
      const price = row.price && Number.isFinite(numericPrice) ? `$${numericPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row.price
      const level = row.level[0].toUpperCase() + row.level.slice(1)
      const reference = row.sourceLabel
        ? `${row.sourceLabel}${row.referenceTime ? ` from ${row.referenceTime}` : ''}`
        : [row.referenceTime, level].filter(Boolean).join(' ')
      return `${row.sweepTime || 'Unknown time'} swept ${reference || level}${price ? ` at ${price}` : ''}`
    }).join('\n')
  }
  if (label === 'HTF PDA delivery') {
    return parsePdaDeliveries(value).map((row, index) => {
      const delivery = [row.time, row.timeframe, row.pda].filter(Boolean).join(' — ')
      const candles = row.candles.length ? `\nSource candles: ${row.candles.join(', ')}` : ''
      return `${index + 1}. ${delivery || 'Incomplete PDA'}${candles}`
    }).join('\n')
  }
  return value
}

const formatRiskLeg = (leg?: JournalRiskLeg) => {
  if (!leg || leg.mode === 'none') return 'Not set'
  const mode = leg.mode === 'strict_r' ? 'Strict R' : leg.mode[0].toUpperCase() + leg.mode.slice(1)
  const detail = leg.mode === 'fixed' ? leg.price : leg.value
  return [mode, detail, leg.basis, leg.timeframe].filter(Boolean).join(' · ')
}

const toTimeInputValue = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return value.match(/^\d{2}:\d{2}$/) ? value : ''
  let hour = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hour += 12
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

const fromTimeInputValue = (value: string) => {
  if (!value) return ''
  const [hourText, minute = '00'] = value.split(':')
  const hour = Number(hourText)
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

function useActivePracticeData() {
  const [account, setAccount] = useState<PracticeAccount | null>(() => {
    const accounts = getPracticeAccounts()
    try {
      const activeId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID)
      return accounts.find((item) => item.id === activeId) ?? accounts[0] ?? null
    } catch {
      return accounts[0] ?? null
    }
  })
  const [stats, setStats] = useState<PracticeStats>({})

  useEffect(() => {
    const sync = () => {
      const accounts = getPracticeAccounts()
      let activeId = ''
      try {
        activeId = localStorage.getItem(PRACTICE_STORAGE_KEYS.ACTIVE_TRADE_ID) || ''
      } catch {
        // Storage is optional.
      }
      setAccount(accounts.find((item) => item.id === activeId) ?? accounts[0] ?? null)
    }
    void refreshPracticeFromApi().then(sync).catch(sync)
    window.addEventListener('practiceAccountsChanged', sync)
    return () => {
      window.removeEventListener('practiceAccountsChanged', sync)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!account) {
      setStats({})
      return
    }
    void practiceAPI
      .getStats(account.id)
      .then((response) => {
        if (!cancelled) setStats(response as PracticeStats)
      })
      .catch(() => {
        if (!cancelled) setStats({})
      })
    return () => {
      cancelled = true
    }
  }, [account])

  return { account, stats }
}

function WorkspaceShell({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div className={`auren-shell-offset ${isDark ? 'min-h-screen bg-[#09090B]' : 'min-h-screen bg-[#FAFAFA]'}`}>
      <ProductHeader isDark={isDark} toggleTheme={toggleTheme} />
      {children}
    </div>
  )
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { isDark } = useTheme()
  return (
    <header className="mb-6 sm:mb-8">
      <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
        {eyebrow}
      </p>
      <h1 className={`mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
        {title}
      </h1>
      <p className={`mt-2 max-w-3xl text-sm leading-6 ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
        {description}
      </p>
    </header>
  )
}

function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { isDark } = useTheme()
  return (
    <section className={`rounded-xl border ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'} ${className}`}>
      {children}
    </section>
  )
}

function MetricCard({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  const { isDark } = useTheme()
  const valueTone = tone === 'positive' ? 'text-emerald-500' : tone === 'negative' ? 'text-red-500' : isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
  return (
    <Surface className="p-4 sm:p-5">
      <p className={`text-xs font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}>{value}</p>
      <p className={`mt-2 text-xs ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>{hint}</p>
    </Surface>
  )
}

function ProgressRow({ label, value, detail, tone = 'blue' }: { label: string; value: number; detail: string; tone?: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const { isDark } = useTheme()
  const bar = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'red' ? 'bg-red-500' : 'bg-blue-500'
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>{label}</span>
        <span className={`tabular-nums ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>{detail}</span>
      </div>
      <div className={isDark ? 'h-1.5 rounded-full bg-[#27272A]' : 'h-1.5 rounded-full bg-[#E4E4E7]'}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { isDark } = useTheme()
  const { account, stats } = useActivePracticeData()
  const { format } = useDisplayUnit()
  const pnl = stats.totalPnl ?? (account ? account.balance - account.rules.startingBalance : 0)
  const rules = account ? evaluatePracticeRules(account) : null
  const trades = stats.trades ?? []
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0
  const winRate = stats.winRate ?? (trades.length ? (trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100 : 0)
  const riskUnit = account ? Math.max(1, account.rules.maxLoss / 10) : 100
  const days = account?.dayPnL ?? []
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const calendarYear = calendarMonth.getFullYear()
  const calendarMonthIndex = calendarMonth.getMonth()
  const calendarLabel = calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const calendarDayMap = new Map(days.map((day) => [String(day.date).slice(0, 10), day.pnl]))
  const calendarCellCount = Math.ceil((new Date(calendarYear, calendarMonthIndex, 1).getDay() + new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()) / 7) * 7
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const date = new Date(calendarYear, calendarMonthIndex, index - new Date(calendarYear, calendarMonthIndex, 1).getDay() + 1)
    const inMonth = date.getMonth() === calendarMonthIndex
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { date, inMonth, pnl: inMonth ? calendarDayMap.get(key) : undefined }
  })
  const calendarWeeks = Array.from({ length: calendarCellCount / 7 }, (_, index) => calendarCells.slice(index * 7, index * 7 + 7))
  const calendarMonthPnl = calendarCells.reduce((total, cell) => total + (cell.pnl ?? 0), 0)
  const profitTargetProgress = account?.rules.profitTarget ? (Math.max(0, pnl) / account.rules.profitTarget) * 100 : 0
  const drawdownUsed = account && rules ? Math.max(0, account.rules.startingBalance - account.balance) : 0
  const drawdownProgress = account ? (drawdownUsed / Math.max(account.rules.maxLoss, 1)) * 100 : 0
  const points = useMemo(() => {
    const values = days.length ? days.slice(-20).map((day) => day.pnl) : [0]
    let running = 0
    const cumulative = values.map((value) => (running += value))
    const min = Math.min(...cumulative, 0)
    const max = Math.max(...cumulative, 1)
    return cumulative.map((value, index) => `${(index / Math.max(cumulative.length - 1, 1)) * 100},${88 - ((value - min) / Math.max(max - min, 1)) * 72}`).join(' ')
  }, [days])

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading eyebrow="Evaluation dashboard" title="Performance and guardrails" description="A high-density view of account performance, drawdown exposure, consistency, and daily execution discipline." />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Net P&L" value={format(pnl, account?.rules.startingBalance, riskUnit)} hint={`${stats.totalTrades ?? trades.length} realized trades`} tone={pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral'} />
          <MetricCard label="Win rate" value={`${winRate.toFixed(1)}%`} hint="Realized trades only" tone={winRate >= 50 ? 'positive' : 'neutral'} />
          <MetricCard label="Profit factor" value={profitFactor.toFixed(2)} hint={`Avg realized ${trades.length ? format(pnl / trades.length, account?.rules.startingBalance, riskUnit) : '—'}`} />
          <MetricCard label="Discipline score" value="100%" hint="No rule violations recorded" tone="positive" />
        </div>

        <Surface className="mt-4 p-4 sm:p-5">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Evaluation and prop-firm guardrails</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ProgressRow label="Profit target" value={profitTargetProgress} detail={account?.rules.profitTarget ? `${format(Math.max(0, pnl), account.rules.startingBalance, riskUnit)} / ${format(account.rules.profitTarget, account.rules.startingBalance, riskUnit)}` : 'Funded'} />
            <ProgressRow label={`${account?.rules.drawdownType === 'intraday' ? 'Trailing' : 'Static'} drawdown`} value={drawdownProgress} detail={`${format(drawdownUsed, account?.rules.startingBalance, riskUnit)} used`} tone={drawdownProgress > 70 ? 'red' : 'amber'} />
            <ProgressRow label="Daily loss limit" value={0} detail={account?.rules.lockoutEnabled ? format(account.rules.sessionDailyLossLimit ?? account.rules.dailyLossLimit ?? 0, account.rules.startingBalance, riskUnit) : 'Not enabled'} tone="amber" />
            <ProgressRow label="Consistency" value={Math.min(100, account?.rules.consistencyPct ?? 100)} detail={account?.rules.consistencyPct ? `${account.rules.consistencyPct}% max day` : 'No limit'} tone="emerald" />
          </div>
        </Surface>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="grid gap-4 xl:col-span-2">
            <Surface className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Cumulative P&L</h2>
                  <p className={`mt-1 text-xs ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>Last 20 recorded sessions</p>
                </div>
                <LineChart className="h-4 w-4 text-blue-500" />
              </div>
              <div className={`h-52 rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-label="Cumulative profit and loss chart">
                  <line x1="0" y1="88" x2="100" y2="88" stroke={isDark ? '#27272A' : '#E4E4E7'} strokeWidth="0.7" />
                  <polyline points={points} fill="none" stroke={isDark ? '#3B82F6' : '#2563EB'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </Surface>

            <Surface className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Daily P&L</h2>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex h-28 items-end gap-1.5 overflow-hidden">
                {(days.length ? days.slice(-20) : [{ date: '', pnl: 0 }]).map((day, index) => {
                  const max = Math.max(...days.map((item) => Math.abs(item.pnl)), 1)
                  return <div key={`${day.date}-${index}`} title={`${day.date}: ${day.pnl}`} className={`min-w-2 flex-1 rounded-t ${day.pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ height: `${Math.max(4, (Math.abs(day.pnl) / max) * 100)}%` }} />
                })}
              </div>
            </Surface>
          </div>

          <Surface className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" /><div><h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>P&amp;L calendar</h2><p className="mt-0.5 text-[10px] text-[#71717A]">{calendarLabel} total <span className={`font-semibold tabular-nums ${calendarMonthPnl > 0 ? 'text-emerald-500' : calendarMonthPnl < 0 ? 'text-red-500' : isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>{format(calendarMonthPnl, account?.rules.startingBalance, riskUnit)}</span></p></div></div>
              <div className={`flex items-center rounded-lg border ${isDark ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'}`}>
                <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))} className={`flex h-8 w-8 items-center justify-center ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}><ChevronLeft className="h-3.5 w-3.5" /></button>
                <span className={`min-w-28 border-x px-2 text-center text-xs font-semibold ${isDark ? 'border-[#3F3F46] text-[#FAFAFA]' : 'border-[#E4E4E7] text-[#09090B]'}`}>{calendarLabel}</span>
                <button type="button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))} className={`flex h-8 w-8 items-center justify-center ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_3.6rem] gap-1 text-center text-[10px]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[#71717A]">{day}</span>)}<span className="py-1 text-[#71717A]">Week</span>
              {calendarWeeks.flatMap((week, weekIndex) => {
                const weekPnl = week.reduce((total, cell) => total + (cell.pnl ?? 0), 0)
                return [...week.map((cell) => <div key={cell.date.toISOString()} className={`min-h-12 rounded-md border p-1 text-left ${!cell.inMonth ? 'border-transparent opacity-30' : cell.pnl != null ? cell.pnl >= 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10' : isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><span className="block text-[10px] text-[#71717A]">{cell.date.getDate()}</span>{cell.pnl != null && <span className={`mt-1 block truncate text-[10px] font-semibold tabular-nums ${cell.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{format(cell.pnl, account?.rules.startingBalance, riskUnit)}</span>}</div>), <div key={`week-${weekIndex}`} className={`flex min-h-12 flex-col justify-center rounded-md border px-1 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><span className="text-[9px] text-[#71717A]">W{weekIndex + 1}</span><span className={`mt-1 truncate text-[10px] font-semibold tabular-nums ${weekPnl > 0 ? 'text-emerald-500' : weekPnl < 0 ? 'text-red-500' : isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>{format(weekPnl, account?.rules.startingBalance, riskUnit)}</span></div>]
              })}
            </div>
          </Surface>
        </div>
      </main>
    </WorkspaceShell>
  )
}

export function AnalyticsPage() {
  const { isDark } = useTheme()
  const { account, stats } = useActivePracticeData()
  const { format } = useDisplayUnit()
  const [playbooks, setPlaybooks] = useState<Playbook[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('auren-playbooks') || '[]')
      if (!Array.isArray(saved)) return []
      return saved.map((item, index) =>
        typeof item === 'string'
          ? { id: `saved-${index}-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: item, conditions: [] }
          : {
              id: String(item.id || `saved-${index}`),
              name: String(item.name || 'Untitled playbook'),
              conditions: Array.isArray(item.conditions) ? item.conditions.map(normalizePlaybookCondition) : [],
            }
      )
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState('')
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, string>>({})
  const [conditionTypeDrafts, setConditionTypeDrafts] = useState<Record<string, PlaybookCondition['type']>>({})
  useEffect(() => {
    let cancelled = false
    const fromRecord = (strategy: JournalStrategyRecord): Playbook => {
      let conditions: PlaybookCondition[] = []
      try {
        const parsed = typeof strategy.entry_conditions === 'string' ? JSON.parse(strategy.entry_conditions) : strategy.entry_conditions
        conditions = Array.isArray(parsed) ? parsed.map(normalizePlaybookCondition) : []
      } catch {
        conditions = []
      }
      return { id: String(strategy.id), name: String(strategy.name), conditions }
    }
    void journalAPI.listStrategies().then(async (records) => {
      if (cancelled) return
      if (records.length) {
        setPlaybooks(records.map(fromRecord))
        return
      }
      const cached = playbooks
      if (!cached.length) {
        setPlaybooks([])
        return
      }
      const migrated = await Promise.all(cached.map((item) => journalAPI.createStrategy(item.name, item.conditions)))
      if (!cancelled) setPlaybooks(migrated.map(fromRecord))
    }).catch(() => {
      // Retain the local cache while the server is unavailable.
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    localStorage.setItem('auren-playbooks', JSON.stringify(playbooks))
  }, [playbooks])
  const addPlaybook = async () => {
    const name = draft.trim()
    if (!name || playbooks.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
    const created = await journalAPI.createStrategy(name, [])
    setPlaybooks((items) => [...items, { id: created.id, name, conditions: [] }])
    setDraft('')
  }
  const addCondition = async (playbookId: string) => {
    const condition = (conditionDrafts[playbookId] || '').trim()
    if (!condition) return
    const playbook = playbooks.find((item) => item.id === playbookId)
    if (!playbook || playbook.conditions.some((entry) => entry.label.toLowerCase() === condition.toLowerCase())) return
    const newCondition: PlaybookCondition = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `condition-${Date.now()}`,
      label: condition,
      type: conditionTypeDrafts[playbookId] || 'boolean',
    }
    const conditions = [...playbook.conditions, newCondition]
    await journalAPI.updateStrategy(playbook.id, playbook.name, conditions)
    setPlaybooks((items) => items.map((item) => item.id === playbookId ? { ...item, conditions } : item))
    setConditionDrafts((items) => ({ ...items, [playbookId]: '' }))
  }
  const removeCondition = async (playbook: Playbook, condition: PlaybookCondition) => {
    const conditions = playbook.conditions.filter((entry) => entry.id !== condition.id)
    await journalAPI.updateStrategy(playbook.id, playbook.name, conditions)
    setPlaybooks((items) => items.map((item) => item.id === playbook.id ? { ...item, conditions } : item))
  }
  const deletePlaybook = async (playbook: Playbook) => {
    await journalAPI.deleteStrategy(playbook.id)
    setPlaybooks((items) => items.filter((item) => item.id !== playbook.id))
  }
  const trades = stats.trades ?? []
  const wins = trades.filter((trade) => trade.pnl > 0)
  const losses = trades.filter((trade) => trade.pnl < 0)
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const hourly = Array.from({ length: 8 }, (_, index) => {
    const hour = index + 8
    const group = trades.filter((trade) => new Date(trade.entryTime).getHours() === hour)
    return { hour, value: group.length ? (group.filter((trade) => trade.pnl > 0).length / group.length) * 100 : 0 }
  })

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading eyebrow="Analytics and playbooks" title="Turn execution into a repeatable process" description="Compare setups, quantify behavioral mistakes, and find the time windows where your process performs best." />
        <div className="grid gap-4 xl:grid-cols-3">
          <Surface className="p-4 sm:p-5 xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Playbook builder</h2>
                <p className="mt-1 text-xs text-[#71717A]">Define the conditions that make a setup valid.</p>
              </div>
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void addPlaybook() }}>
                <input aria-label="New playbook name" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="New setup name" className={`h-11 min-w-0 flex-1 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:w-56 sm:text-sm ${isDark ? 'border-[#27272A] bg-[#18181B] text-[#FAFAFA]' : 'border-[#E4E4E7] bg-white text-[#09090B]'}`} />
                <button type="submit" disabled={!draft.trim()} className={`${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'} inline-flex h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9`}><Plus className="h-3.5 w-3.5" />Add</button>
              </form>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {playbooks.map((playbook) => (
                <article key={playbook.id} className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                  <div className="flex items-start justify-between gap-3"><div><h3 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{playbook.name}</h3><p className="mt-1 text-xs text-[#71717A]">{playbook.conditions.length} entry {playbook.conditions.length === 1 ? 'condition' : 'conditions'}</p></div><div className="flex items-center gap-1"><BookOpenCheck className="h-4 w-4 text-blue-500" /><button type="button" onClick={() => void deletePlaybook(playbook)} aria-label={`Delete ${playbook.name}`} className={`rounded-md p-1.5 ${isDark ? 'text-[#71717A] hover:bg-red-500/10 hover:text-red-400' : 'text-[#A1A1AA] hover:bg-red-50 hover:text-red-600'}`}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /></button></div></div>
                  {playbook.conditions.length ? <ul className="mt-4 space-y-2">{playbook.conditions.map((condition) => <li key={condition.id} className={`flex items-center gap-2 text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10"><Check className="h-2.5 w-2.5 text-emerald-500" /></span><span className="min-w-0 flex-1">{condition.label}</span><span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${isDark ? 'border-[#3F3F46] text-[#71717A]' : 'border-[#E4E4E7] text-[#71717A]'}`}>{conditionTypeLabel(condition.type)}</span><button type="button" onClick={() => void removeCondition(playbook, condition)} aria-label={`Remove condition ${condition.label}`} className={`rounded p-1 ${isDark ? 'text-[#71717A] hover:text-red-400' : 'text-[#A1A1AA] hover:text-red-600'}`}><Trash2 className="h-3 w-3" strokeWidth={1.75} /></button></li>)}</ul> : <p className="mt-4 text-xs text-[#71717A]">Add the first condition that must be true before entering.</p>}
                  <form className="mt-4 grid grid-cols-[minmax(0,1fr)_7.5rem_auto] gap-2" onSubmit={(event) => { event.preventDefault(); void addCondition(playbook.id) }}><input aria-label={`New condition for ${playbook.name}`} value={conditionDrafts[playbook.id] || ''} onChange={(event) => setConditionDrafts((items) => ({ ...items, [playbook.id]: event.target.value }))} placeholder="Condition label" className={`h-11 min-w-0 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`} /><select aria-label={`Condition type for ${playbook.name}`} value={conditionTypeDrafts[playbook.id] || 'boolean'} onChange={(event) => setConditionTypeDrafts((items) => ({ ...items, [playbook.id]: event.target.value as PlaybookCondition['type'] }))} className={`h-11 appearance-none rounded-lg border px-2 text-xs outline-none focus:border-blue-500 sm:h-9 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}><option value="boolean">Yes / No</option><option value="time">Time / Timeline</option><option value="timeframe">Timeframe</option><option value="timeframe_time">Timeframe + Time</option><option value="liquidity_sweep">Sweep + Reference + Price</option><option value="pda_delivery">Time + Timeframe + PDA</option><option value="smt">SMT · Pair + Timeframe + Close</option><option value="text">Text</option><option value="number">Number</option></select><button type="submit" disabled={!(conditionDrafts[playbook.id] || '').trim()} className={`h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Add</button></form>
                </article>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 sm:p-5">
            <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>Behavioral mistake cost</h2></div>
            <p className="mt-5 text-3xl font-semibold tabular-nums text-emerald-500">{format(0, account?.rules.startingBalance)}</p>
            <p className="mt-2 text-xs text-[#71717A]">No discipline-error losses tagged yet.</p>
            <div className="mt-5 flex flex-wrap gap-2">{['FOMO', 'Moved stop', 'Over-leveraging', 'Early exit'].map((tag) => <button key={tag} type="button" className={`rounded-md border px-2.5 py-1.5 text-[11px] ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:border-blue-500' : 'border-[#E4E4E7] text-[#52525B] hover:border-blue-600'}`}>{tag}</button>)}</div>
          </Surface>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Surface className="overflow-hidden">
            <div className="border-b border-inherit p-4 sm:p-5"><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>Strategy comparison</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className={isDark ? 'bg-[#121215] text-[#A1A1AA]' : 'bg-[#FAFAFA] text-[#52525B]'}><tr>{['Setup', 'Win rate', 'Profit factor', 'Expectancy', 'Net P&L'].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody><tr className={isDark ? 'border-t border-[#27272A]' : 'border-t border-[#E4E4E7]'}><td className="px-4 py-3 font-medium">Untagged trades</td><td className="px-4 py-3 tabular-nums">{trades.length ? `${((wins.length / trades.length) * 100).toFixed(1)}%` : '—'}</td><td className="px-4 py-3 tabular-nums">{grossLoss ? (grossProfit / grossLoss).toFixed(2) : '—'}</td><td className="px-4 py-3 tabular-nums">{trades.length ? format((grossProfit - grossLoss) / trades.length, account?.rules.startingBalance) : '—'}</td><td className={`px-4 py-3 font-semibold tabular-nums ${grossProfit - grossLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{format(grossProfit - grossLoss, account?.rules.startingBalance)}</td></tr></tbody></table></div>
          </Surface>

          <Surface className="p-4 sm:p-5">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-500" /><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>Performance by time of day</h2></div>
            <div className="mt-6 flex h-40 items-end gap-2">{hourly.map((item) => <div key={item.hour} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-blue-500" style={{ height: `${Math.max(3, item.value)}%` }} /><span className="text-[10px] text-[#71717A]">{item.hour}:00</span></div>)}</div>
          </Surface>
        </div>
      </main>
    </WorkspaceShell>
  )
}

export function TradeLinkedJournalPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const { account, stats } = useActivePracticeData()
  const { format } = useDisplayUnit()
  const [date, setDate] = useState('')
  const [symbol, setSymbol] = useState('all')
  const [accountType, setAccountType] = useState('all')
  const [setup, setSetup] = useState('all')
  const [mistake, setMistake] = useState('all')
  const [result, setResult] = useState('all')
  const [selectedJournalKey, setSelectedJournalKey] = useState('example')
  const [journalEntries, setJournalEntries] = useState<Record<string, TradeJournalDetails>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('auren-trade-journals') || '{}')
      return { example: EXAMPLE_JOURNAL, ...(saved && typeof saved === 'object' ? saved : {}) }
    } catch {
      return { example: EXAMPLE_JOURNAL }
    }
  })
  const playbookNames = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('auren-playbooks') || '[]')
      const names = Array.isArray(saved) ? saved.map((item) => typeof item === 'string' ? item : String(item?.name || '')).filter(Boolean) : []
      return names.length ? names : [EXAMPLE_JOURNAL.playbook]
    } catch {
      return [EXAMPLE_JOURNAL.playbook]
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('auren-trade-journals', JSON.stringify(journalEntries))
  }, [journalEntries])
  const selectedJournal = journalEntries[selectedJournalKey] ?? { ...EXAMPLE_JOURNAL, sweep: '', pdaDelivery: '', ifvgTimeframe: 'Any', ifvgTime: '', notes: '' }
  const updateJournal = (patch: Partial<TradeJournalDetails>) => {
    setJournalEntries((items) => ({ ...items, [selectedJournalKey]: { ...selectedJournal, ...patch } }))
  }
  const trades = (stats.trades ?? []).filter((trade, index) => {
    if (symbol !== 'all' && trade.symbol !== symbol) return false
    if (date && new Date(trade.entryTime).toISOString().slice(0, 10) !== date) return false
    if (accountType !== 'all' && account?.mode !== accountType) return false
    const tradeJournal = journalEntries[`${trade.entryTime}-${trade.exitTime}-${trade.symbol}-${index}`]
    if (setup === 'untagged' && tradeJournal) return false
    if (setup !== 'all' && setup !== 'untagged' && tradeJournal?.playbook !== setup) return false
    if (mistake !== 'all' && mistake !== 'none') return false
    if (result === 'win' && trade.pnl <= 0) return false
    if (result === 'loss' && trade.pnl >= 0) return false
    if (result === 'scratch' && trade.pnl !== 0) return false
    return true
  })
  const symbols = Array.from(new Set((stats.trades ?? []).map((trade) => trade.symbol)))
  const journalInput = `h-11 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-xs ${isDark ? 'border-[#27272A] bg-[#18181B] text-[#FAFAFA]' : 'border-[#E4E4E7] bg-white text-[#09090B]'}`

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading eyebrow="Journal and trade log" title="Every execution, one searchable record" description="Filter realized trades, review execution quality, and reopen the matching practice session for replay." />
        <Surface className="mb-4 overflow-hidden">
          <div className={`flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
            <div><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{selectedJournalKey === 'example' ? 'Example trade journal' : 'Trade journal details'}</h2><p className="mt-1 text-xs text-[#71717A]">The playbook stays generic; these details belong only to this execution.</p></div>
            {selectedJournalKey !== 'example' && <button type="button" onClick={() => setSelectedJournalKey('example')} className="text-xs font-medium text-blue-500">View example</button>}
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <label className="text-xs text-[#71717A]">Playbook<select aria-label="Journal playbook" value={selectedJournal.playbook} onChange={(event) => updateJournal({ playbook: event.target.value })} className={`${journalInput} mt-1.5 w-full`}>{playbookNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <label className="text-xs text-[#71717A]">IFVG timeframe<select aria-label="IFVG timeframe" value={selectedJournal.ifvgTimeframe} onChange={(event) => updateJournal({ ifvgTimeframe: event.target.value })} className={`${journalInput} mt-1.5 w-full`}>{['Any','30s','1m','2m','3m','5m','15m','30m','1h','4h','1D'].map((timeframe) => <option key={timeframe}>{timeframe}</option>)}</select></label>
              <label className="text-xs text-[#71717A]">IFVG time<input aria-label="IFVG event time" value={selectedJournal.ifvgTime} onChange={(event) => updateJournal({ ifvgTime: event.target.value })} placeholder="9:22 AM" className={`${journalInput} mt-1.5 w-full`} /></label>
            </div>
            <label className="text-xs text-[#71717A]">Liquidity sweep events<textarea aria-label="Liquidity sweep events" value={selectedJournal.sweep} onChange={(event) => updateJournal({ sweep: event.target.value })} rows={4} className={`${journalInput} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
            <label className="text-xs text-[#71717A]">HTF PDA delivery<textarea aria-label="HTF PDA delivery" value={selectedJournal.pdaDelivery} onChange={(event) => updateJournal({ pdaDelivery: event.target.value })} rows={4} className={`${journalInput} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
            <label className="text-xs text-[#71717A] lg:col-span-2">Execution notes<textarea aria-label="Execution notes" value={selectedJournal.notes} onChange={(event) => updateJournal({ notes: event.target.value })} rows={2} className={`${journalInput} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
          </div>
        </Surface>
        <Surface className="mb-4 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-xs text-[#71717A]"><Filter className="h-4 w-4" />Filters</div>
            <input aria-label="Trade date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={journalInput} />
            <select aria-label="Symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} className={journalInput}><option value="all">All symbols</option>{symbols.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Account type" value={accountType} onChange={(event) => setAccountType(event.target.value)} className={journalInput}><option value="all">All account types</option><option value="eval">Evaluation</option><option value="funded">Funded</option></select>
            <select aria-label="Strategy tag" value={setup} onChange={(event) => setSetup(event.target.value)} className={journalInput}><option value="all">All strategies</option><option value="untagged">Untagged</option>{playbookNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            <select aria-label="Mistake tag" value={mistake} onChange={(event) => setMistake(event.target.value)} className={journalInput}><option value="all">All mistake tags</option><option value="none">No mistake tag</option></select>
            <select aria-label="Result" value={result} onChange={(event) => setResult(event.target.value)} className={journalInput}><option value="all">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="scratch">Scratch</option></select>
            {(date || symbol !== 'all' || accountType !== 'all' || setup !== 'all' || mistake !== 'all' || result !== 'all') ? <button type="button" onClick={() => { setDate(''); setSymbol('all'); setAccountType('all'); setSetup('all'); setMistake('all'); setResult('all') }} className={`h-11 rounded-lg border px-3 text-sm font-medium sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:bg-[#27272A]' : 'border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5]'}`}>Clear filters</button> : null}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead className={isDark ? 'bg-[#121215] text-[#A1A1AA]' : 'bg-[#FAFAFA] text-[#52525B]'}><tr>{['Date / Time', 'Symbol', 'Side', 'Setup tag', 'Entry', 'Exit', 'Size', 'Net P&L', 'R-Multiple', 'Grade', 'Journal', 'Replay'].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody>{trades.length ? trades.map((trade, index) => {
                const journalKey = `${trade.entryTime}-${trade.exitTime}-${trade.symbol}-${index}`
                const details = journalEntries[journalKey]
                return <tr key={journalKey} className={isDark ? 'border-t border-[#27272A] text-[#D4D4D8]' : 'border-t border-[#E4E4E7] text-[#3F3F46]'}>
                  <td className="whitespace-nowrap px-3 py-2.5">{new Date(trade.entryTime).toLocaleString()}</td><td className="px-3 py-2.5 font-semibold">{trade.symbol}</td><td className={`px-3 py-2.5 capitalize ${trade.direction === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{trade.direction}</td><td className="px-3 py-2.5"><span className="rounded border border-[#3F3F46] px-2 py-1 text-[10px]">{details?.playbook || 'Untagged'}</span></td><td className="px-3 py-2.5 font-mono">{trade.entryPrice}</td><td className="px-3 py-2.5 font-mono">{trade.exitPrice}</td><td className="px-3 py-2.5">{trade.contracts}</td><td className={`px-3 py-2.5 font-semibold tabular-nums ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{format(trade.pnl, account?.rules.startingBalance)}</td><td className="px-3 py-2.5 tabular-nums">{(trade.pnl / Math.max(account?.rules.maxLoss ? account.rules.maxLoss / 10 : 100, 1)).toFixed(2)}R</td><td className="px-3 py-2.5">—</td>
                  <td className="px-3 py-2.5"><button type="button" onClick={() => { if (!details) setJournalEntries((items) => ({ ...items, [journalKey]: { ...EXAMPLE_JOURNAL, sweep: '', pdaDelivery: '', ifvgTime: '', notes: '' } })); setSelectedJournalKey(journalKey); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-500">{details ? 'Edit' : 'Add'}</button></td>
                  <td className="px-3 py-2.5"><button type="button" onClick={() => account && navigate(practiceSessionPath(account.id))} className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-500">Open <ChevronRight className="h-3 w-3" /></button></td>
                </tr>
              }) : <tr><td colSpan={12} className="px-4 py-16 text-center text-sm text-[#71717A]">No realized trades match these filters. Use the example journal above to preview the workflow.</td></tr>}</tbody>
            </table>
          </div>
        </Surface>
      </main>
    </WorkspaceShell>
  )
}

function LegacyJournalDayChart({ entry, isDark }: { entry: ManualJournalEntry; isDark: boolean }) {
  const [bars, setBars] = useState<Array<{ time: number; open: number; high: number; low: number; close: number }>>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    const center = new Date(entry.dateTime).getTime()
    const dayStart = new Date(entry.dateTime); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(entry.dateTime); dayEnd.setHours(23, 59, 59, 999)
    setLoading(true)
    void backtesterAPI.getHistory({ symbol: entry.symbol, resolution: '1', from: Math.floor(dayStart.getTime() / 1000), to: Math.floor(dayEnd.getTime() / 1000), countBack: 1600 }, { signal: controller.signal }).then((response) => {
      const normalized = (response.bars || []).map((bar) => ({ ...bar, time: bar.time < 1e12 ? bar.time * 1000 : bar.time })).filter((bar) => Math.abs(bar.time - center) <= 3 * 60 * 60 * 1000)
      if (!normalized.length) {
        console.warn('[LegacyJournalDayChart] No historical bars returned', { symbol: entry.symbol, sourceResolution: '1', from: dayStart.toISOString(), to: dayEnd.toISOString() })
      }
      setBars(normalized)
    }).catch((error) => {
      console.error('[JournalDayChart] Historical chart request failed', error)
      setBars([])
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [entry.dateTime, entry.symbol])
  if (loading) return <div className={`flex h-64 items-center justify-center rounded-lg border text-xs ${isDark ? 'border-[#27272A] bg-[#09090B] text-[#71717A]' : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]'}`}>Loading {entry.symbol} candles…</div>
  if (!bars.length) return <div className={`flex h-64 flex-col items-center justify-center rounded-lg border px-6 text-center ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className={isDark ? 'text-sm font-medium text-[#FAFAFA]' : 'text-sm font-medium text-[#09090B]'}>Historical candles unavailable</p><p className="mt-1 text-xs text-[#71717A]">Import {entry.symbol} data for this date in Replay Data Management to render the setup chart.</p></div>
  const eventMinutes = new Set(Object.values(entry.conditionResponses || {}).flatMap((value) => typeof value === 'string' ? [...value.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)].map((match) => { let hour = Number(match[1]) % 12; if (match[3].toUpperCase() === 'PM') hour += 12; return `${hour}:${match[2]}` }) : []))
  const low = Math.min(...bars.map((bar) => bar.low)); const high = Math.max(...bars.map((bar) => bar.high)); const range = Math.max(high - low, 0.01)
  const y = (price: number) => 240 - ((price - low) / range) * 210
  const step = 800 / Math.max(bars.length, 1); const bodyW = Math.max(1, Math.min(5, step * 0.65))
  return <div className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div className="mb-2 flex items-center justify-between text-[10px] text-[#71717A]"><span>{entry.symbol} · 1m · setup window</span><span>Highlighted candles match journal timestamps</span></div><svg viewBox="0 0 800 260" className="h-64 w-full" preserveAspectRatio="none" aria-label={`${entry.symbol} setup candles`}>{[0,1,2,3].map((grid) => <line key={grid} x1="0" x2="800" y1={20 + grid * 70} y2={20 + grid * 70} stroke={isDark ? '#27272A' : '#E4E4E7'} strokeWidth="1" />)}{bars.map((bar, index) => { const date = new Date(bar.time); const marked = eventMinutes.has(`${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`); const x = index * step + step / 2; const up = bar.close >= bar.open; const color = marked ? '#f59e0b' : up ? '#10b981' : '#ef4444'; return <g key={`${bar.time}-${index}`}><line x1={x} x2={x} y1={y(bar.high)} y2={y(bar.low)} stroke={color} strokeWidth={marked ? 2 : 1} /><rect x={x - bodyW / 2} y={Math.min(y(bar.open), y(bar.close))} width={bodyW} height={Math.max(1, Math.abs(y(bar.open) - y(bar.close)))} fill={color} />{marked && <circle cx={x} cy={y(bar.low)} r="4" fill="none" stroke="#f59e0b" strokeWidth="2" />}</g>})}{entry.entryPrice && <line x1="0" x2="800" y1={y(Number(entry.entryPrice))} y2={y(Number(entry.entryPrice))} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 4" />}</svg></div>
}

type JournalChartResolution = string
type JournalChartResolutionOption = { value: JournalChartResolution; label: string }

const JOURNAL_REVIEW_RESOLUTIONS: JournalChartResolutionOption[] = [
  { value: '30S', label: '30s' },
  { value: '1', label: '1m' },
  { value: '2', label: '2m' },
  { value: '3', label: '3m' },
  { value: '5', label: '5m' },
  { value: '10', label: '10m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '45', label: '45m' },
  { value: '60', label: '1h' },
  { value: '120', label: '2h' },
  { value: '180', label: '3h' },
  { value: '240', label: '4h' },
]

function journalChartResolutions(entry: ManualJournalEntry): JournalChartResolutionOption[] {
  const values = Object.values(entry.conditionResponses || {})
  const seconds = new Set<number>()
  for (const value of values) {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    for (const match of text.matchAll(/\b(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/gi)) {
      const amount = Number(match[1])
      if (!Number.isFinite(amount) || amount <= 0) continue
      const unit = match[2].toLowerCase()
      const totalSeconds = unit.startsWith('h') ? amount * 3600 : unit.startsWith('m') ? amount * 60 : amount
      if (totalSeconds >= 30 && totalSeconds <= 86400) seconds.add(totalSeconds)
    }
  }
  if (!seconds.size) seconds.add(60)
  return [...seconds]
    .sort((a, b) => a - b)
    .map((value) => ({
      value: value < 60 ? `${value}S` : String(value / 60),
      label: value < 60 ? `${value}s` : value >= 3600 && value % 3600 === 0 ? `${value / 3600}h` : `${value / 60}m`,
    }))
}

function journalResolutionMs(resolution: JournalChartResolution): number {
  const secondsMatch = String(resolution).match(/^(\d+)S$/i)
  return secondsMatch ? Number(secondsMatch[1]) * 1000 : Number(resolution) * 60_000
}

function aggregateJournalBars(bars: Bar[], resolution: JournalChartResolution): Bar[] {
  const bucketMs = journalResolutionMs(resolution)
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) return bars.map((bar) => ({ ...bar }))

  const aggregated: Bar[] = []
  for (const bar of bars) {
    const bucketTime = Math.floor(bar.time / bucketMs) * bucketMs
    const current = aggregated[aggregated.length - 1]
    if (!current || current.time !== bucketTime) {
      aggregated.push({ ...bar, time: bucketTime })
      continue
    }
    current.high = Math.max(current.high, bar.high)
    current.low = Math.min(current.low, bar.low)
    current.close = bar.close
    if (typeof current.volume === 'number' || typeof bar.volume === 'number') {
      current.volume = Number(current.volume || 0) + Number(bar.volume || 0)
    }
  }
  return aggregated
}

function createJournalChartDatafeed(symbol: string, bars: Bar[], resolutions: JournalChartResolution[]): IDatafeedChartApi {
  const symbolInfo: LibrarySymbolInfo = {
    name: symbol,
    ticker: symbol,
    symbol,
    description: `${symbol} journal review`,
    type: 'futures',
    session: '24x7',
    timezone: 'America/New_York',
    exchange: 'CME',
    listed_exchange: 'CME',
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    supported_resolutions: resolutions,
    intraday_multipliers: resolutions,
    data_status: 'endofday',
  }

  return {
    onReady(callback) {
      callback({ supported_resolutions: resolutions, supports_quotes: false })
    },
    searchSymbols(_query, _exchange, _type, onResult) {
      onResult([{ symbol, full_name: symbol, description: symbolInfo.description, exchange: 'CME', type: 'futures' }])
    },
    resolveSymbol(_symbolName, onResolve) {
      onResolve(symbolInfo)
    },
    getBars(_symbolInfo, _resolution, _periodParams, onResult) {
      onResult(bars.map((bar) => ({ ...bar })), { noData: bars.length === 0 })
    },
    subscribeBars() {},
    unsubscribeBars() {},
  }
}

function JournalDayChart({ entry, isDark }: { entry: ManualJournalEntry; isDark: boolean }) {
  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)
  const mentionedResolutions = useMemo(() => journalChartResolutions(entry), [entry])
  const sourceResolution = mentionedResolutions.some((item) => item.value === '30S') ? '30S' : '1'
  const [resolution, setResolution] = useState<JournalChartResolution>(() => mentionedResolutions[0]?.value || '1')
  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false)
  const [favoriteResolutions, setFavoriteResolutions] = useState<JournalChartResolution[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('auren-journal-timeframe-favorites') || '[]')
      return Array.isArray(saved) ? saved.filter((value) => JOURNAL_REVIEW_RESOLUTIONS.some((item) => item.value === value)) : []
    } catch {
      return []
    }
  })
  const chartBars = useMemo(() => aggregateJournalBars(bars, resolution), [bars, resolution])
  const datafeed = useMemo(
    () => createJournalChartDatafeed(entry.symbol, chartBars, JOURNAL_REVIEW_RESOLUTIONS.map((item) => item.value)),
    [entry.symbol, chartBars],
  )
  const chartServices = useMemo(() => ({ datafeed, streamConfig: { delayed: true }, accountId: `journal-${entry.id}` }), [datafeed, entry.id])

  useEffect(() => {
    localStorage.setItem('auren-journal-timeframe-favorites', JSON.stringify(favoriteResolutions))
  }, [favoriteResolutions])

  useEffect(() => {
    const controller = new AbortController()
    const center = new Date(entry.dateTime).getTime()
    const dayStart = new Date(entry.dateTime); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(entry.dateTime); dayEnd.setTime(center + 4 * 60 * 60 * 1000)
    setLoading(true)
    void backtesterAPI.getHistory({ symbol: entry.symbol, resolution: sourceResolution, from: Math.floor(dayStart.getTime() / 1000), to: Math.floor(dayEnd.getTime() / 1000), countBack: 1200 }, { signal: controller.signal }).then((response) => {
      const normalized = (response.bars || [])
        .map((bar) => ({ ...bar, time: bar.time < 1e12 ? bar.time * 1000 : bar.time }))
        .filter((bar) => bar.time >= dayStart.getTime() && bar.time <= dayEnd.getTime())
        .sort((a, b) => a.time - b.time)
      setBars(normalized)
    }).catch(() => setBars([])).finally(() => setLoading(false))
    return () => controller.abort()
  }, [entry.dateTime, entry.symbol, sourceResolution])

  if (loading) return <div className={`flex h-80 items-center justify-center rounded-lg border text-xs ${isDark ? 'border-[#27272A] bg-[#09090B] text-[#71717A]' : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]'}`}>Loading {entry.symbol} candles…</div>
  if (!bars.length) return <div className={`flex h-80 flex-col items-center justify-center rounded-lg border px-6 text-center ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className={isDark ? 'text-sm font-medium text-[#FAFAFA]' : 'text-sm font-medium text-[#09090B]'}>Historical candles unavailable</p><p className="mt-1 text-xs text-[#71717A]">Import {entry.symbol} data for this date in Replay Data Management to render the setup chart.</p></div>

  const minuteKey = (value: string) => {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i)
    if (!match) return ''
    let hour = Number(match[1]) % 12
    if (match[4].toUpperCase() === 'PM') hour += 12
    return `${hour}:${match[2]}:${match[3] || '00'}`
  }
  const barMinuteKey = (bar: { time: number }) => {
    const date = new Date(bar.time)
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
  }
  const timeForClock = (clock: string) => {
    const key = minuteKey(clock)
    if (!key) return Number.NaN
    const [hour, minute, second] = key.split(':').map(Number)
    const target = new Date(entry.dateTime)
    target.setHours(hour, minute, second, 0)
    return target.getTime()
  }
  const indexForClockIn = (clock: string, sourceBars: Bar[]) => {
    const targetTime = timeForClock(clock)
    if (!Number.isFinite(targetTime) || !sourceBars.length) return -1
    return sourceBars.reduce((best, bar, index) => Math.abs(bar.time - targetTime) < Math.abs(sourceBars[best]?.time - targetTime) ? index : best, 0)
  }
  const indexForClock = (clock: string) => indexForClockIn(clock, bars)
  const indexForDateTime = (value: string) => {
    const target = new Date(value).getTime()
    if (!Number.isFinite(target)) return -1
    return bars.reduce((best, bar, index) => Math.abs(bar.time - target) < Math.abs(bars[best]?.time - target) ? index : best, 0)
  }

  const sweepRows = parseLiquiditySweeps(entry.conditionResponses?.['Liquidity sweep'])
  const sweepConfluenceLabels = String(entry.conditionResponses?.['Sweep confluence'] || '')
    .split(';')
    .map((label) => label.replace(/\s*@\s*[\d,.]+\s*$/, '').trim())
  const sweepLabel = (row: LiquiditySweepRow, index: number) => {
    const confluence = sweepConfluenceLabels[index]
    if (confluence) return confluence.replace(/\s*\+\s*/g, ' · ')
    if (row.sourceLabel) return row.sourceLabel
    const level = row.level === 'high' ? 'High' : 'Low'
    return [row.referenceTime, level].filter(Boolean).join(' · ')
  }
  const pdaRows = parsePdaDeliveries(
    entry.conditionResponses?.['HTF PDA delivery'],
    entry.conditionResponses?.['HTF PDA candles'],
  ).filter((row) => row.time || row.timeframe || row.pda || row.candles.length)
  const ifvgParts = String(entry.conditionResponses?.IFVG || '').split(/\s*@\s*/, 2)
  const ifvgTime = ifvgParts[1] || ''
  const entryIndex = indexForDateTime(entry.dateTime)
  const exitIndex = entry.exitDateTime ? indexForDateTime(entry.exitDateTime) : -1
  const pdaIndexes = pdaRows.map((row) => indexForClock(row.time))
  const ifvgIndex = indexForClock(ifvgTime)
  const sweepValidation = sweepRows.length > 0 && sweepRows.every((row) => {
    const index = indexForClock(row.sweepTime)
    const price = Number(row.price)
    if (index < 0 || !row.referenceTime || !Number.isFinite(price)) return false
    return row.level === 'high' ? bars[index].high >= price : bars[index].low <= price
  })
  const pdaValidation = pdaRows.length > 0 && pdaRows.every((row, index) => Boolean(row.time && row.timeframe && row.pda && pdaIndexes[index] >= 0))
  const ifvgValidation = Boolean(ifvgParts[0] && ifvgTime && ifvgIndex >= 0)

  const imbalanceZone = (eventIndex: number, label: string, color: string) => {
    if (eventIndex < 0) return null
    const candidateIndexes = [eventIndex, eventIndex - 1, eventIndex + 1, eventIndex - 2, eventIndex + 2]
      .filter((index) => index >= 2 && index < bars.length)
    for (const index of candidateIndexes) {
      const first = bars[index - 2]
      const third = bars[index]
      if (third.low > first.high) {
        return { startIndex: index - 2, endIndex: Math.min(bars.length - 1, index + 7), low: first.high, high: third.low, label, color, measured: true }
      }
      if (third.high < first.low) {
        return { startIndex: index - 2, endIndex: Math.min(bars.length - 1, index + 7), low: third.high, high: first.low, label, color, measured: true }
      }
    }
    const eventBar = bars[eventIndex]
    return eventBar ? {
      startIndex: Math.max(0, eventIndex - 1),
      endIndex: Math.min(bars.length - 1, eventIndex + 7),
      low: eventBar.low,
      high: eventBar.high,
      label: `${label} · journaled zone`,
      color,
      measured: false,
    } : null
  }

  const clocksFrom = extractClockValues
  const resolutionFromLabel = (value: string): JournalChartResolution => {
    const match = value.match(/\b(\d+)\s*(s|m|h)\b/i)
    if (!match) return '1'
    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    return unit === 's' ? `${amount}S` : unit === 'h' ? String(amount * 60) : String(amount)
  }
  const measuredZoneFromClocks = (
    candleClocks: string[],
    calculationResolution: JournalChartResolution,
    endClock: string,
    label: string,
    color: string,
  ) => {
    if (candleClocks.length < 3) return null
    const calculationBars = aggregateJournalBars(bars, calculationResolution)
    const first = calculationBars[indexForClockIn(candleClocks[0], calculationBars)]
    const third = calculationBars[indexForClockIn(candleClocks[2], calculationBars)]
    const startIndex = indexForClock(candleClocks[0])
    const endIndex = indexForClock(endClock || candleClocks[2])
    if (!first || !third || startIndex < 0 || endIndex < 0) return null
    if (third.low > first.high) {
      return { startIndex, endIndex, low: first.high, high: third.low, label, color, measured: true }
    }
    if (third.high < first.low) {
      return { startIndex, endIndex, low: third.high, high: first.low, label, color, measured: true }
    }
    return null
  }

  const ifvgLabel = `IFVG · ${ifvgParts[0] || 'timeframe not set'}`
  const ifvgCandleClocks = clocksFrom(entry.conditionResponses?.['IFVG zone candles'])
  const ifvgInversionClock = clocksFrom(entry.conditionResponses?.['IFVG inversed'])[0] || ifvgTime
  const pdaZones = pdaRows.map((row, index) => {
    const label = `HTF PDA ${pdaRows.length > 1 ? index + 1 : ''} · ${[row.timeframe, row.pda].filter(Boolean).join(' · ')}`.replace(/\s+·/, ' ·')
    return measuredZoneFromClocks(row.candles, resolutionFromLabel(row.timeframe || '15m'), row.time, label, '#3B82F6')
      || imbalanceZone(pdaIndexes[index], label, '#3B82F6')
  }).filter((zone): zone is NonNullable<typeof zone> => Boolean(zone))
  const measuredIfvgZone = measuredZoneFromClocks(ifvgCandleClocks, resolutionFromLabel(ifvgParts[0] || '1m'), ifvgInversionClock, ifvgLabel, '#10B981')
  const setupZones = [
    ...pdaZones,
    measuredIfvgZone || imbalanceZone(ifvgIndex, ifvgLabel, '#10B981'),
  ].filter((zone): zone is NonNullable<typeof zone> => Boolean(zone))

  const entryPrice = Number(entry.entryPrice)
  const exitPrice = Number(entry.closePrice)
  const annotatedPrices = [
    ...bars.flatMap((bar) => [bar.high, bar.low]),
    ...sweepRows.map((row) => Number(row.price)),
    entryPrice,
    exitPrice,
  ].filter(Number.isFinite)
  const rawLow = Math.min(...annotatedPrices)
  const rawHigh = Math.max(...annotatedPrices)
  const padding = Math.max((rawHigh - rawLow) * 0.06, 1)
  const low = rawLow - padding
  const high = rawHigh + padding
  const range = Math.max(high - low, 0.01)
  const left = 54
  const right = 986
  const top = 24
  const bottom = 330
  const plotWidth = right - left
  const plotHeight = bottom - top
  const x = (index: number) => left + (index / Math.max(bars.length - 1, 1)) * plotWidth
  const y = (price: number) => bottom - ((price - low) / range) * plotHeight
  const bodyW = Math.max(1, Math.min(5, plotWidth / Math.max(bars.length, 1) * 0.68))
  const markedMinutes = new Set([...sweepRows.map((row) => minuteKey(row.sweepTime)), ...pdaRows.map((row) => minuteKey(row.time)), minuteKey(ifvgTime)].filter(Boolean))
  const exitColor = entry.outcome === 'loss' ? '#EF4444' : entry.outcome === 'win' ? '#10B981' : '#A1A1AA'
  const priceText = (price: number) => price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const verticalMarkers = [
    { index: entryIndex, label: `Entry ${new Date(entry.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, color: '#2563EB', labelY: 42 },
    { index: exitIndex, label: entry.exitDateTime ? `Exit ${new Date(entry.exitDateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '', color: exitColor, labelY: 58 },
  ].filter((marker) => marker.index >= 0 && marker.label)
  const resolutionMs = journalResolutionMs(resolution)
  const chartTime = (time: number) => Math.floor(time / resolutionMs) * resolutionMs

  const handleWidgetReady = (value: unknown) => {
    const widget = value as BwcWidget
    if (typeof widget.drawShape !== 'function') return
    widget.settings?.merge?.({
      canvas: {
        marginTop: 18,
        marginBottom: 8,
      },
      scales: {
        symbolLabelValue: false,
        symbolLabelLine: false,
        symbolLabelName: false,
        countdownToBarClose: false,
      },
    }, { skipHistory: true })

    setupZones.forEach((zone) => {
      if (zone.color === '#10B981' && resolutionMs > 60_000) return
      const isHtfPda = zone.color === '#3B82F6'
      const start = bars[zone.startIndex]
      const end = bars[zone.endIndex]
      if (!start || !end) return
      const startTime = chartTime(start.time)
      const endTime = Math.max(chartTime(end.time), startTime + resolutionMs)
      widget.drawShape?.('rectangle', [
        { time: Math.floor(startTime / 1000), price: zone.high },
        { time: Math.floor(endTime / 1000), price: zone.low },
      ], {
        locked: true,
        props: {
          color: zone.color,
          colorOpacity: 90,
          lineWidth: 1,
          lineStyle: zone.measured ? 0 : 2,
          extendRight: isHtfPda,
          showShapeBackground: true,
          shapeBackgroundColor: zone.color,
          shapeBackgroundOpacity: 12,
          label: zone.label,
          textColor: zone.color,
          textColorOpacity: 100,
          textAlignH: 'center',
          textAlignV: 'middle',
          fontSize: 11,
        },
      })
    })

    sweepRows.forEach((row, index) => {
      const sweepBarIndex = indexForClock(row.sweepTime)
      const referenceBarIndex = indexForClock(row.referenceTime)
      const price = Number(row.price)
      const sweepBar = bars[sweepBarIndex]
      const referenceBar = bars[referenceBarIndex]
      if (!sweepBar || !referenceBar || !Number.isFinite(price)) return
      const sourceTime = chartTime(referenceBar.time)
      let sweptTime = chartTime(sweepBar.time)
      if (sweptTime === sourceTime) sweptTime = sourceTime + resolutionMs
      const sweepColor = isDark ? '#A1A1AA' : '#52525B'
      widget.drawShape?.('trend-line', [
        { time: Math.floor(sourceTime / 1000), price },
        { time: Math.floor(sweptTime / 1000), price },
      ], {
        locked: true,
        props: {
          color: sweepColor,
          colorOpacity: 80,
          lineWidth: 1,
          lineStyle: 0,
          extendLeft: false,
          extendRight: false,
          leftEnd: 'normal',
          rightEnd: 'normal',
          showMiddlePoint: false,
          showPriceLabels: false,
          alwaysShowStats: false,
          label: sweepLabel(row, index),
          textColor: sweepColor,
          textColorOpacity: 100,
          textAlignH: 'center',
          textAlignV: 'top',
          fontSize: 10,
        },
      })
    })

    const entryBar = bars[entryIndex]
    if (entryBar && Number.isFinite(entryPrice) && resolutionMs <= 15 * 60_000) {
      widget.drawShape?.(entry.side === 'short' ? 'arrow-mark-down' : 'arrow-mark-up', [
        { time: Math.floor(chartTime(entryBar.time) / 1000), price: entryPrice },
      ], {
        locked: true,
        props: {
          color: '#3B82F6',
          colorOpacity: 100,
        },
      })
    }

    const exitBar = bars[exitIndex]
    if (exitBar && Number.isFinite(exitPrice) && resolutionMs <= 15 * 60_000) {
      widget.drawShape?.(entry.side === 'short' ? 'arrow-mark-up' : 'arrow-mark-down', [
        { time: Math.floor(chartTime(exitBar.time) / 1000), price: exitPrice },
      ], {
        locked: true,
        props: {
          color: exitColor,
          colorOpacity: 100,
        },
      })
    }

    const eventIndexes = [
      ...sweepRows.map((row) => indexForClock(row.sweepTime)),
      ...pdaIndexes,
      ifvgIndex,
      entryIndex,
      exitIndex,
    ].filter((index) => index >= 0)
    const firstEvent = Math.min(...eventIndexes)
    const lastEvent = Math.max(...eventIndexes)
    const firstEventTime = bars[firstEvent]?.time ?? entryBar?.time
    const lastEventTime = bars[lastEvent]?.time ?? exitBar?.time ?? firstEventTime
    const rangeFromTarget = Number(firstEventTime) - resolutionMs * 6
    const rangeToTarget = Number(lastEventTime) + resolutionMs * 6
    const fromBar = chartBars.reduce((best, bar) => Math.abs(bar.time - rangeFromTarget) < Math.abs(best.time - rangeFromTarget) ? bar : best, chartBars[0])
    const toBar = chartBars.reduce((best, bar) => Math.abs(bar.time - rangeToTarget) < Math.abs(best.time - rangeToTarget) ? bar : best, chartBars[chartBars.length - 1])
    const activePane = widget.getAllChartPanes?.()[0]
    const hideLivePrice = () => activePane?.series?.applyOptions?.({ priceLineVisible: false, lastValueVisible: false })
    hideLivePrice()
    const timeScale = activePane?.chart?.timeScale?.()
    if (fromBar && toBar && timeScale?.setVisibleRange) {
      const range = { from: Math.floor(fromBar.time / 1000), to: Math.floor(toBar.time / 1000) }
      timeScale.setVisibleRange(range)
      window.setTimeout(() => {
        timeScale.setVisibleRange?.(range)
        activePane?.series?.priceScale?.().applyOptions?.({
          autoScale: true,
          scaleMargins: { top: 0.18, bottom: 0.08 },
        })
        hideLivePrice()
      }, 250)
    }
  }

  return <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
    <div className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
      <div>
        <p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{entry.symbol} · {JOURNAL_REVIEW_RESOLUTIONS.find((item) => item.value === resolution)?.label} · setup review</p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {favoriteResolutions.map((favorite) => {
            const item = JOURNAL_REVIEW_RESOLUTIONS.find((option) => option.value === favorite)
            return item ? <button key={item.value} type="button" aria-label={`Use ${item.label} timeframe`} onClick={() => { setResolution(item.value); setTimeframeMenuOpen(false) }} className={`h-8 min-w-9 rounded-md border px-2 text-[10px] font-semibold ${resolution === item.value ? (isDark ? 'border-[#FAFAFA] bg-[#FAFAFA] text-[#09090B]' : 'border-[#18181B] bg-[#18181B] text-white') : (isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#D4D4D8]' : 'border-[#D4D4D8] bg-white text-[#52525B]')}`}>{item.label}</button> : null
          })}
          <div className="relative inline-block">
          <button type="button" aria-label="Chart timeframe" aria-haspopup="menu" aria-expanded={timeframeMenuOpen} onClick={() => setTimeframeMenuOpen((open) => !open)} className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px] font-semibold ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}>
            {JOURNAL_REVIEW_RESOLUTIONS.find((item) => item.value === resolution)?.label}
            <ChevronDown className={`h-3.5 w-3.5 text-[#71717A] transition-transform ${timeframeMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {timeframeMenuOpen && <div role="menu" aria-label="Available chart timeframes" className={`absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border p-2 shadow-xl ${isDark ? 'border-[#3F3F46] bg-[#18181B]' : 'border-[#D4D4D8] bg-white'}`}>
            <p className="px-1 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">Timeframe</p>
            <div className="grid grid-cols-3 gap-1">
              {JOURNAL_REVIEW_RESOLUTIONS.map((item) => {
                const setupTimeframe = mentionedResolutions.some((mentioned) => mentioned.value === item.value)
                const favorite = favoriteResolutions.includes(item.value)
                return <div key={item.value} className="relative">
                  <button role="menuitem" type="button" onClick={() => { setResolution(item.value); setTimeframeMenuOpen(false) }} className={`h-10 w-full rounded-md pr-6 text-[11px] font-semibold ${resolution === item.value ? (isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white') : (isDark ? 'text-[#D4D4D8] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]')}`}>
                    {item.label}
                    {setupTimeframe && <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-label="Used by setup" />}
                  </button>
                  <button type="button" aria-label={`${favorite ? 'Remove' : 'Add'} ${item.label} ${favorite ? 'from' : 'to'} favorites`} onClick={() => setFavoriteResolutions((items) => favorite ? items.filter((value) => value !== item.value) : [...items, item.value])} className={`absolute right-1 top-1/2 flex h-7 w-6 -translate-y-1/2 items-center justify-center rounded ${resolution === item.value ? (isDark ? 'text-[#09090B]' : 'text-white') : 'text-[#71717A] hover:text-[#F59E0B]'}`}>
                    <Star className="h-3.5 w-3.5" fill={favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              })}
            </div>
            <p className="px-1 pt-2 text-[9px] text-[#71717A]">Blue dots match this setup. Star timeframes to pin them beside the menu.</p>
          </div>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{[
        ['Liquidity sweep', sweepValidation],
        ['HTF PDA', pdaValidation],
        ['IFVG', ifvgValidation],
      ].map(([label, valid]) => <span key={String(label)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${valid ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>{valid && <Check className="h-3 w-3" />}{label} {valid ? 'verified' : 'incomplete'}</span>)}</div>
    </div>
    <div className="h-[26rem] min-h-0 sm:h-[32rem]">
      <AurenChart
        symbol={entry.symbol}
        timeframe={resolution}
        isDark={isDark}
        practiceAccountId={`journal-${entry.id}`}
        tradeseaServices={chartServices}
        chrome={false}
        drawings
        persistDrawings={false}
        compact
        onWidgetReady={handleWidgetReady}
        className="journal-bwc-review"
      />
    </div>
    <div className={`flex flex-wrap gap-2 border-t px-3 py-3 text-[10px] ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-white'}`}>
      {sweepRows.map((row, index) => <span key={`${row.sweepTime}-${index}`} className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}>S{index + 1} · {sweepLabel(row, index)} · {priceText(Number(row.price))}</span>)}
      {pdaRows.map((row, index) => <span key={`${row.time}-${row.timeframe}-${index}`} className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-blue-500/25 text-blue-400' : 'border-blue-500/30 text-blue-700'}`}>PDA {pdaRows.length > 1 ? index + 1 : ''} · {row.time} · {row.timeframe} {row.pda}</span>)}
      <span className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-emerald-500/25 text-emerald-400' : 'border-emerald-500/30 text-emerald-700'}`}>IFVG · {ifvgTime} · {ifvgParts[0]}</span>
      <span className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-blue-500/25 text-blue-400' : 'border-blue-500/30 text-blue-700'}`}>Entry · {new Date(entry.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {priceText(entryPrice)}</span>
      <span className={`rounded-md border px-2 py-1.5 ${isDark ? 'border-emerald-500/25 text-emerald-400' : 'border-emerald-500/30 text-emerald-700'}`}>Exit · {entry.exitDateTime ? new Date(entry.exitDateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'} · {priceText(exitPrice)}</span>
    </div>
  </div>

  return <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-[#27272A] bg-[#09090B]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
    <div className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
      <div><p className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{entry.symbol} · 1 minute · setup review</p><p className="mt-1 text-[10px] text-[#71717A]">Real candles with journal annotations</p></div>
      <div className="flex flex-wrap gap-2">{[
        ['Liquidity sweep', sweepValidation],
        ['HTF PDA', pdaValidation],
        ['IFVG', ifvgValidation],
      ].map(([label, valid]) => <span key={String(label)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${valid ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>{valid && <Check className="h-3 w-3" />}{label} {valid ? 'verified' : 'incomplete'}</span>)}</div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pt-3 text-[10px] text-[#71717A]"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-amber-500" />Swept level</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm border border-blue-500 bg-blue-500/10" />HTF PDA zone</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm border border-emerald-500 bg-emerald-500/10" />IFVG zone</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-blue-500" />Entry</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-emerald-500" />Exit</span></div>
    <svg viewBox="0 0 1000 360" className="h-[22rem] w-full" preserveAspectRatio="none" aria-label={`${entry.symbol} annotated setup candles`}>
      {[0,1,2,3,4].map((grid) => { const gridY = top + (grid / 4) * plotHeight; const gridPrice = high - (grid / 4) * range; return <g key={grid}><line x1={left} x2={right} y1={gridY} y2={gridY} stroke={isDark ? '#27272A' : '#E4E4E7'} strokeWidth="1" /><text x="4" y={gridY + 4} fill="#71717A" fontSize="10">{priceText(gridPrice)}</text></g> })}
      {setupZones.map((zone) => { const zoneX = x(zone.startIndex); const zoneRight = x(zone.endIndex); const zoneTop = y(zone.high); const zoneBottom = y(zone.low); const zoneHeight = Math.max(10, zoneBottom - zoneTop); const labelWidth = Math.min(180, Math.max(96, zone.label.length * 5.4)); return <g key={`${zone.label}-${zone.startIndex}`}><rect x={zoneX} y={zoneTop} width={Math.max(24, zoneRight - zoneX)} height={zoneHeight} fill={zone.color} fillOpacity="0.12" stroke={zone.color} strokeWidth="1.25" strokeDasharray={zone.measured ? undefined : '5 4'} /><rect x={zoneX + 4} y={zoneTop + 4} width={labelWidth} height="16" rx="3" fill={isDark ? '#09090B' : '#FFFFFF'} fillOpacity="0.92" /><text x={zoneX + 9} y={zoneTop + 15} fill={zone.color} fontSize="9" fontWeight="600">{zone.label}</text></g> })}
      {bars.map((bar, index) => { const up = bar.close >= bar.open; const marked = markedMinutes.has(barMinuteKey(bar)); const color = marked ? '#F59E0B' : up ? '#10B981' : '#EF4444'; const candleX = x(index); return <g key={`${bar.time}-${index}`}><line x1={candleX} x2={candleX} y1={y(bar.high)} y2={y(bar.low)} stroke={color} strokeWidth={marked ? 2 : 1} /><rect x={candleX - bodyW / 2} y={Math.min(y(bar.open), y(bar.close))} width={bodyW} height={Math.max(1, Math.abs(y(bar.open) - y(bar.close)))} fill={color} />{marked && <circle cx={candleX} cy={y(bar.low)} r="4" fill="none" stroke="#F59E0B" strokeWidth="2" />}</g> })}
      {sweepRows.map((row, index) => { const price = Number(row.price); if (!Number.isFinite(price)) return null; const lineY = y(price); const sweepColor = isDark ? '#A1A1AA' : '#52525B'; return <g key={`sweep-${index}`}><line x1={left} x2={right} y1={lineY} y2={lineY} stroke={sweepColor} strokeWidth="1" /><text x={(left + right) / 2} y={Math.max(top + 11, lineY - 5)} textAnchor="middle" fill={sweepColor} stroke={isDark ? '#09090B' : '#FAFAFA'} strokeWidth="3" paintOrder="stroke" fontSize="10">{sweepLabel(row, index)}</text></g> })}
      {Number.isFinite(entryPrice) && <g><line x1={left} x2={right} y1={y(entryPrice)} y2={y(entryPrice)} stroke="#2563EB" strokeWidth="2" /><text x={right - 4} y={y(entryPrice) - 5} textAnchor="end" fill="#3B82F6" stroke={isDark ? '#09090B' : '#FAFAFA'} strokeWidth="3" paintOrder="stroke" fontSize="10">{`Entry $${priceText(entryPrice)}`}</text></g>}
      {Number.isFinite(exitPrice) && <g><line x1={left} x2={right} y1={y(exitPrice)} y2={y(exitPrice)} stroke={exitColor} strokeWidth="2" /><text x={right - 4} y={y(exitPrice) - 5} textAnchor="end" fill={exitColor} stroke={isDark ? '#09090B' : '#FAFAFA'} strokeWidth="3" paintOrder="stroke" fontSize="10">{`Exit $${priceText(exitPrice)}`}</text></g>}
      {verticalMarkers.map((marker) => <g key={`${marker.label}-${marker.index}`}><line x1={x(marker.index)} x2={x(marker.index)} y1={top} y2={bottom} stroke={marker.color} strokeWidth="1.25" strokeDasharray="4 5" /><text x={Math.min(right - 80, x(marker.index) + 4)} y={marker.labelY} fill={marker.color} stroke={isDark ? '#09090B' : '#FAFAFA'} strokeWidth="3" paintOrder="stroke" fontSize="10">{marker.label}</text></g>)}
    </svg>
  </div>
}

export function JournalPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const inputClass = `h-11 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`
  const [entries, setEntries] = useState<ManualJournalEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [entryError, setEntryError] = useState('')
  const [entrySaving, setEntrySaving] = useState(false)
  const [draft, setDraft] = useState<ManualJournalEntry>(() => entries[0] || EXAMPLE_MANUAL_JOURNAL)
  const [symbolFilter, setSymbolFilter] = useState('all')
  const [strategyFilter, setStrategyFilter] = useState('all')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [detailEntry, setDetailEntryState] = useState<ManualJournalEntry | null>(null)
  const setDetailEntry = (entry: ManualJournalEntry | null) => entry ? navigate(`/journal/${entry.id}`) : setDetailEntryState(null)
  const [journalPlaybooks, setJournalPlaybooks] = useState<Playbook[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('auren-playbooks') || '[]')
      const parsed = Array.isArray(saved) ? saved.map((item, index) => typeof item === 'string' ? { id: `legacy-${index}`, name: item, conditions: [] } : { id: String(item.id), name: String(item.name), conditions: Array.isArray(item.conditions) ? item.conditions.map(normalizePlaybookCondition) : [] }) : []
      return parsed
    } catch {
      return []
    }
  })
  useEffect(() => {
    let cancelled = false
    void journalAPI.listEntries().then((records) => {
      if (!cancelled) setEntries(records)
    }).catch(() => {
      if (!cancelled) setEntryError('Journal entries could not be loaded from the server.')
    }).finally(() => {
      if (!cancelled) setEntriesLoading(false)
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    void journalAPI.listStrategies().then((records) => {
      const playbooks = records.map((strategy) => {
        let parsed: unknown[] = []
        try { parsed = typeof strategy.entry_conditions === 'string' ? JSON.parse(strategy.entry_conditions) : strategy.entry_conditions } catch { parsed = [] }
        return { id: String(strategy.id), name: String(strategy.name), conditions: Array.isArray(parsed) ? parsed.map(normalizePlaybookCondition) : [] }
      })
      setJournalPlaybooks(playbooks)
      localStorage.setItem('auren-playbooks', JSON.stringify(playbooks))
    }).catch(() => {})
  }, [])
  const playbookNames = journalPlaybooks.map((item) => item.name)
  const selectedPlaybook = journalPlaybooks.find((item) => item.name === draft.playbook) ?? journalPlaybooks[0]
  const updateDraft = (patch: Partial<ManualJournalEntry>) => setDraft((item) => ({ ...item, ...patch }))
  const startNew = () => { setDraft({
    ...EXAMPLE_MANUAL_JOURNAL,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `journal-${Date.now()}`,
    dateTime: new Date().toISOString().slice(0, 16),
    exitDateTime: '',
    entryPrice: '',
    closePrice: '',
    size: '1',
    pnl: '',
    outcome: 'planned',
    playbook: journalPlaybooks[0]?.name || '',
    conditionResponses: {},
    notes: '',
  }); setIsEditorOpen(true) }
  const saveEntry = async () => {
    if (!draft.dateTime || !draft.symbol.trim() || !draft.playbook) return
    setEntrySaving(true)
    setEntryError('')
    try {
      const exists = entries.some((item) => item.id === draft.id)
      const saved = exists ? await journalAPI.updateEntry(draft) : await journalAPI.createEntry(draft)
      setEntries((items) => exists ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items])
      setDraft(saved)
      setIsEditorOpen(false)
    } catch {
      setEntryError('The journal entry could not be saved. Check the server connection and try again.')
    } finally {
      setEntrySaving(false)
    }
  }
  const deleteEntry = async (entry: ManualJournalEntry) => {
    setEntryError('')
    try {
      await journalAPI.deleteEntry(entry.id)
      setEntries((items) => items.filter((item) => item.id !== entry.id))
      if (draft.id === entry.id) setIsEditorOpen(false)
      if (detailEntry?.id === entry.id) setDetailEntry(null)
    } catch {
      setEntryError('The journal entry could not be deleted. Check the server connection and try again.')
    }
  }
  const symbols = Array.from(new Set(entries.map((entry) => entry.symbol)))
  const filteredEntries = entries.filter((entry) => (symbolFilter === 'all' || entry.symbol === symbolFilter) && (strategyFilter === 'all' || entry.playbook === strategyFilter))

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading eyebrow="Journal and trade log" title="Every setup, one searchable record" description="Record planned, taken, or missed setups manually. A replay or realized trade is not required." />
        {entryError && <div role="alert" className={`mb-4 rounded-lg border px-4 py-3 text-xs ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>{entryError}</div>}
        <div className="mb-4 flex items-center justify-between gap-3">{!playbookNames.length && <p className="text-xs text-[#71717A]">Create a playbook before adding journal entries.</p>}<button type="button" onClick={startNew} disabled={!playbookNames.length} className={`ml-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}><Plus className="h-3.5 w-3.5" />Add entry</button></div>

        {isEditorOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Journal entry editor">
          <div className={`flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border sm:rounded-xl ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{entries.some((item) => item.id === draft.id) ? 'Edit journal entry' : 'Add journal entry'}</h2><p className="mt-1 text-xs text-[#71717A]">Fields are generated from the selected playbook.</p></div><button type="button" onClick={() => setIsEditorOpen(false)} aria-label="Close journal editor" className={`rounded-md px-2 py-1 text-lg ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}>×</button></div>
            <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
              <label className="text-xs text-[#71717A]">Entry date and time<input aria-label="Journal entry date and time" type="datetime-local" value={draft.dateTime} onChange={(event) => updateDraft({ dateTime: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Exit date and time<input aria-label="Journal exit date and time" type="datetime-local" value={draft.exitDateTime || ''} onChange={(event) => updateDraft({ exitDateTime: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Symbol<input aria-label="Journal symbol" value={draft.symbol} onChange={(event) => updateDraft({ symbol: event.target.value.toUpperCase() })} placeholder="NQ" className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Side<select aria-label="Journal side" value={draft.side} onChange={(event) => updateDraft({ side: event.target.value as 'long' | 'short' })} className={`${inputClass} mt-1.5 w-full`}><option value="long">Long</option><option value="short">Short</option></select></label>
              <label className="text-xs text-[#71717A]">Playbook<select aria-label="Journal playbook" value={draft.playbook} onChange={(event) => updateDraft({ playbook: event.target.value, conditionResponses: {} })} className={`${inputClass} mt-1.5 w-full`}>{playbookNames.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs text-[#71717A]">Entry price<input aria-label="Journal entry price" inputMode="decimal" value={draft.entryPrice} onChange={(event) => updateDraft({ entryPrice: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Close price<input aria-label="Journal close price" inputMode="decimal" value={draft.closePrice} onChange={(event) => updateDraft({ closePrice: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Size<input aria-label="Journal position size" inputMode="numeric" value={draft.size} onChange={(event) => updateDraft({ size: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Net P&amp;L<input aria-label="Journal net P and L" inputMode="decimal" value={draft.pnl} onChange={(event) => { const pnl = event.target.value; const numeric = Number(pnl); updateDraft({ pnl, outcome: pnl.trim() === '' ? draft.outcome : numeric > 0 ? 'win' : numeric < 0 ? 'loss' : 'breakeven' }) }} placeholder="285.00" className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A] sm:col-span-2">Outcome<select aria-label="Journal outcome" value={draft.outcome} onChange={(event) => updateDraft({ outcome: event.target.value as ManualJournalEntry['outcome'] })} className={`${inputClass} mt-1.5 w-full`}><option value="planned">Planned / missed</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven (BE)</option></select></label>
              <div className={`sm:col-span-2 rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className={`mb-3 text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Setup conditions</p><div className="grid gap-3 sm:grid-cols-2">{(selectedPlaybook?.conditions ?? []).map((condition) => {
                const value = draft.conditionResponses[condition.label]
                const setValue = (next: string | boolean) => updateDraft({ conditionResponses: { ...draft.conditionResponses, [condition.label]: next } })
                if (condition.type === 'boolean') return <label key={condition.id} className="text-xs text-[#71717A]">{condition.label}<select aria-label={condition.label} value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(event) => setValue(event.target.value === 'yes')} className={`${inputClass} mt-1.5 w-full`}><option value="">Not reviewed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
                if (condition.type === 'timeframe') return <label key={condition.id} className="text-xs text-[#71717A]">{condition.label}<select aria-label={condition.label} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} mt-1.5 w-full`}><option value="">Select timeframe</option>{['30s','1m','2m','3m','5m','15m','30m','1h','4h','1D'].map((timeframe) => <option key={timeframe}>{timeframe}</option>)}</select></label>
                if (condition.type === 'liquidity_sweep') {
                  const sweepRows = parseLiquiditySweeps(value)
                  const updateSweep = (index: number, patch: Partial<LiquiditySweepRow>) => setValue(serializeLiquiditySweeps(sweepRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)))
                  const removeSweep = (index: number) => setValue(serializeLiquiditySweeps(sweepRows.filter((_, rowIndex) => rowIndex !== index)))
                  return <fieldset key={condition.id} className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}><legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend><p className="mb-3 text-[10px] text-[#71717A]">Example: 9:10 AM swept 10:00 AM high at $20,322.75</p><div className="space-y-3">{sweepRows.map((row, index) => <div key={`${condition.id}-${index}`} className={`grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_.8fr_1fr_auto] ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><label className="text-[10px] text-[#71717A]">Sweep time<input aria-label={`${condition.label} ${index + 1} sweep time`} type="time" value={toTimeInputValue(row.sweepTime)} onChange={(event) => updateSweep(index, { sweepTime: fromTimeInputValue(event.target.value) })} className={`${inputClass} mt-1 w-full min-w-0 px-2`} /></label><label className="text-[10px] text-[#71717A]">Reference time<input aria-label={`${condition.label} ${index + 1} reference time`} type="time" value={toTimeInputValue(row.referenceTime)} onChange={(event) => updateSweep(index, { referenceTime: fromTimeInputValue(event.target.value) })} className={`${inputClass} mt-1 w-full min-w-0 px-2`} /></label><label className="text-[10px] text-[#71717A]">Level<select aria-label={`${condition.label} ${index + 1} level`} value={row.level} onChange={(event) => updateSweep(index, { level: event.target.value as 'high' | 'low' })} className={`${inputClass} mt-1 w-full min-w-0 px-2`}><option value="high">High</option><option value="low">Low</option></select></label><label className="text-[10px] text-[#71717A]">Price<input aria-label={`${condition.label} ${index + 1} price`} inputMode="decimal" value={row.price} onChange={(event) => updateSweep(index, { price: event.target.value.replace(/^\$/, '') })} placeholder="20322.75" className={`${inputClass} mt-1 w-full min-w-0 px-2`} /></label><button type="button" aria-label={`Remove ${condition.label} ${index + 1}`} onClick={() => removeSweep(index)} className={`mt-5 h-9 rounded-lg border px-2 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div><button type="button" onClick={() => setValue(serializeLiquiditySweeps([...sweepRows, { sweepTime: '', referenceTime: '', level: 'high', price: '' }]))} className={`mt-3 inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[11px] font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}><Plus className="h-3 w-3" />Add sweep</button></fieldset>
                }
                if (condition.type === 'pda_delivery') {
                  const pdaRows = parsePdaDeliveries(value, draft.conditionResponses['HTF PDA candles'])
                  const updatePda = (index: number, patch: Partial<PdaDeliveryRow>) => setValue(serializePdaDeliveries(pdaRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)))
                  const removePda = (index: number) => setValue(serializePdaDeliveries(pdaRows.filter((_, rowIndex) => rowIndex !== index)))
                  return <fieldset key={condition.id} className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}><legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend><p className="mb-3 text-[10px] text-[#71717A]">Add every PDA tap separately. Three source candles let the chart measure and draw each zone.</p><div className="space-y-3">{pdaRows.map((row, index) => <div key={`${condition.id}-${index}`} className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]"><label className="text-[10px] text-[#71717A]">Tap time<input aria-label={`${condition.label} ${index + 1} tap time`} type="time" value={toTimeInputValue(row.time)} onChange={(event) => updatePda(index, { time: fromTimeInputValue(event.target.value) })} className={`${inputClass} mt-1 w-full`} /></label><label className="text-[10px] text-[#71717A]">Timeframe<select aria-label={`${condition.label} ${index + 1} timeframe`} value={row.timeframe} onChange={(event) => updatePda(index, { timeframe: event.target.value })} className={`${inputClass} mt-1 w-full`}><option value="">Select timeframe</option>{['1m','2m','3m','5m','15m','30m','1h','4h','1D'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-[10px] text-[#71717A]">PDA<select aria-label={`${condition.label} ${index + 1} PDA`} value={row.pda} onChange={(event) => updatePda(index, { pda: event.target.value })} className={`${inputClass} mt-1 w-full`}><option value="">Select PDA</option>{['FVG','Inversion FVG','Order Block','Breaker Block','Mitigation Block','Rejection Block','Balanced Price Range','Liquidity Void','Opening Gap','Other PDA'].map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" aria-label={`Remove ${condition.label} ${index + 1}`} onClick={() => removePda(index)} className={`mt-5 h-9 rounded-lg border px-2 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#D4D4D8] text-[#52525B]'}`}><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-3 grid grid-cols-3 gap-2">{[0, 1, 2].map((candleIndex) => <label key={candleIndex} className="text-[10px] text-[#71717A]">Candle {candleIndex + 1}<input aria-label={`${condition.label} ${index + 1} candle ${candleIndex + 1}`} type="time" value={toTimeInputValue(row.candles[candleIndex] || '')} onChange={(event) => { const candles = [...row.candles]; candles[candleIndex] = fromTimeInputValue(event.target.value); updatePda(index, { candles }) }} className={`${inputClass} mt-1 w-full min-w-0 px-2`} /></label>)}</div></div>)}</div><button type="button" onClick={() => setValue(serializePdaDeliveries([...pdaRows, { time: '', timeframe: '', pda: '', candles: [] }]))} className={`mt-3 inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[11px] font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#D4D4D8] text-[#3F3F46]'}`}><Plus className="h-3 w-3" />Add PDA tap</button></fieldset>
                }
                if (condition.type === 'timeframe_time') {
                  const [timeframe = '', savedTime = ''] = String(value ?? '').split(/\s*@\s*/, 2)
                  const setCombinedValue = (nextTimeframe: string, nextTime: string) => setValue([nextTimeframe, nextTime].filter(Boolean).join(' @ '))
                  return <fieldset key={condition.id} className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? 'border-[#3F3F46]' : 'border-[#D4D4D8]'}`}><legend className="px-1 text-xs text-[#71717A]">{condition.label}</legend><div className="grid gap-3 sm:grid-cols-2"><label className="text-[11px] text-[#71717A]">Timeframe<select aria-label={`${condition.label} timeframe`} value={timeframe} onChange={(event) => setCombinedValue(event.target.value, savedTime)} className={`${inputClass} mt-1.5 w-full`}><option value="">Select timeframe</option>{['30s','1m','2m','3m','5m','15m','30m','1h','4h','1D'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-[11px] text-[#71717A]">Time<input aria-label={`${condition.label} time`} type="time" value={toTimeInputValue(savedTime)} onChange={(event) => setCombinedValue(timeframe, fromTimeInputValue(event.target.value))} className={`${inputClass} mt-1.5 w-full`} /></label></div></fieldset>
                }
                if (condition.type === 'time') return <label key={condition.id} className="text-xs text-[#71717A] sm:col-span-2">{condition.label}<textarea aria-label={condition.label} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} rows={3} placeholder="9:13 AM — 15m sweep" className={`${inputClass} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
                return <label key={condition.id} className="text-xs text-[#71717A]">{condition.label}<input aria-label={condition.label} type={condition.type === 'number' ? 'number' : 'text'} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} mt-1.5 w-full`} /></label>
              })}</div></div>
              <label className="text-xs text-[#71717A] sm:col-span-2">Execution notes<textarea aria-label="Journal execution notes" value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} rows={3} className={`${inputClass} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
            </div>
            <div className={`flex justify-end gap-2 border-t p-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><button type="button" onClick={() => setIsEditorOpen(false)} className={`h-10 rounded-lg border px-4 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#E4E4E7] text-[#52525B]'}`}>Cancel</button><button type="button" onClick={() => void saveEntry()} disabled={entrySaving || !draft.dateTime || !draft.symbol.trim() || !draft.playbook} className={`h-10 rounded-lg px-4 text-xs font-semibold disabled:opacity-50 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>{entrySaving ? 'Saving…' : 'Save entry'}</button></div>
          </div>
        </div>}

        {detailEntry && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Setup review">
          <div className={`flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl border sm:rounded-xl ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div><div className="flex items-center gap-2"><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{detailEntry.symbol} setup review</h2><span className={`text-xs font-semibold capitalize ${detailEntry.outcome === 'win' ? 'text-emerald-500' : detailEntry.outcome === 'loss' ? 'text-red-500' : 'text-[#71717A]'}`}>{detailEntry.outcome}</span></div><p className="mt-1 text-xs text-[#71717A]">{detailEntry.playbook} · {new Date(detailEntry.dateTime).toLocaleString()}</p></div><button type="button" onClick={() => setDetailEntry(null)} aria-label="Close setup review" className={`rounded-md px-2 py-1 text-lg ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}>×</button></div>
            <div className="overflow-y-auto p-4 sm:p-5"><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Entry', detailEntry.entryPrice], ['Close', detailEntry.closePrice], ['Size', detailEntry.size], ['Net P&L', detailEntry.pnl ? `$${Number(detailEntry.pnl).toLocaleString()}` : '—'], ['Side', detailEntry.side]].map(([label, value]) => <div key={label} className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className="text-[10px] uppercase tracking-wide text-[#71717A]">{label}</p><p className={`mt-1 text-sm font-semibold capitalize ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{value || '—'}</p></div>)}</div><JournalDayChart entry={detailEntry} isDark={isDark} /><div className="mt-4 grid gap-4 md:grid-cols-2"><div className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><h3 className={isDark ? 'text-xs font-semibold text-[#FAFAFA]' : 'text-xs font-semibold text-[#09090B]'}>Setup details</h3><div className="mt-3 space-y-3">{Object.entries(detailEntry.conditionResponses || {}).map(([label, value]) => <div key={label}><p className="text-[10px] uppercase tracking-wide text-[#71717A]">{label}</p><p className={`mt-1 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{formatConditionResponse(label, value)}</p></div>)}</div></div><div className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><h3 className={isDark ? 'text-xs font-semibold text-[#FAFAFA]' : 'text-xs font-semibold text-[#09090B]'}>Notes</h3><p className={`mt-3 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{detailEntry.notes || 'No notes recorded.'}</p></div></div></div>
          </div>
        </div>}

        <Surface className="overflow-hidden">
          <div className={`flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div className="mr-auto flex items-center gap-2 text-xs text-[#71717A]"><Filter className="h-4 w-4" />Trades</div><select aria-label="Filter journal symbol" value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value)} className={inputClass}><option value="all">All symbols</option>{symbols.map((symbol) => <option key={symbol}>{symbol}</option>)}</select><select aria-label="Filter journal strategy" value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} className={inputClass}><option value="all">All strategies</option>{playbookNames.map((name) => <option key={name}>{name}</option>)}</select></div>
          <div className={`flex flex-wrap gap-2 border-b p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>{filteredEntries.map((entry) => <button key={entry.id} type="button" onClick={() => setDetailEntry(entry)} className={`rounded-lg border px-3 py-2 text-left text-xs transition ${isDark ? 'border-[#3F3F46] bg-[#121215] text-[#D4D4D8] hover:border-blue-500' : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#3F3F46] hover:border-blue-600'}`}><span className="font-semibold">{entry.symbol} setup details</span><span className="ml-2 text-[#71717A]">{new Date(entry.dateTime).toLocaleDateString()}</span></button>)}</div>
          <div className="grid gap-3 p-3 lg:hidden">{filteredEntries.map((entry) => <article key={entry.id} className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{entry.symbol}</span><span className={`text-xs capitalize ${entry.side === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{entry.side}</span><span className={`text-xs font-semibold capitalize ${entry.outcome === 'win' ? 'text-emerald-500' : entry.outcome === 'loss' ? 'text-red-500' : 'text-[#71717A]'}`}>{entry.outcome}</span></div><p className="mt-1 text-[11px] text-[#71717A]">{new Date(entry.dateTime).toLocaleString()}</p></div><span className={`text-sm font-semibold tabular-nums ${Number(entry.pnl) > 0 ? 'text-emerald-500' : Number(entry.pnl) < 0 ? 'text-red-500' : 'text-[#71717A]'}`}>{entry.pnl ? `$${Number(entry.pnl).toLocaleString()}` : '—'}</span></div><p className={`mt-3 text-xs font-medium ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{entry.playbook}</p><div className="mt-3 grid grid-cols-3 gap-2 text-[11px]"><div><span className="text-[#71717A]">Entry</span><p className="mt-0.5 font-mono">{entry.entryPrice || '—'}</p></div><div><span className="text-[#71717A]">Close</span><p className="mt-0.5 font-mono">{entry.closePrice || '—'}</p></div><div><span className="text-[#71717A]">Size</span><p className="mt-0.5">{entry.size || '—'}</p></div></div><div className="mt-3 flex justify-end gap-1"><button type="button" onClick={() => setDetailEntry(entry)} className={`rounded-md border px-3 py-1.5 text-xs ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#E4E4E7] text-[#3F3F46]'}`}>Review</button><button type="button" onClick={() => { setDraft(entry); setIsEditorOpen(true) }} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500">Edit</button><button type="button" aria-label={`Delete ${entry.symbol} journal entry`} onClick={() => void deleteEntry(entry)} className={`rounded-md border p-1.5 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:text-red-400' : 'border-[#E4E4E7] text-[#52525B] hover:text-red-600'}`}><Trash2 className="h-3.5 w-3.5" /></button></div></article>)}</div>
          <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[980px] text-left text-xs"><thead className={isDark ? 'bg-[#121215] text-[#A1A1AA]' : 'bg-[#FAFAFA] text-[#52525B]'}><tr>{['Date / Time','Symbol','Side','Playbook','Entry','Close','Size','Net P&L','Outcome','Actions'].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{filteredEntries.map((entry) => <tr key={entry.id} className={isDark ? 'border-t border-[#27272A] text-[#D4D4D8]' : 'border-t border-[#E4E4E7] text-[#3F3F46]'}><td className="whitespace-nowrap px-3 py-3">{new Date(entry.dateTime).toLocaleString()}</td><td className="px-3 py-3 font-semibold">{entry.symbol}</td><td className={`px-3 py-3 capitalize ${entry.side === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{entry.side}</td><td className="max-w-48 px-3 py-3">{entry.playbook}</td><td className="px-3 py-3 font-mono">{entry.entryPrice || '—'}</td><td className="px-3 py-3 font-mono">{entry.closePrice || '—'}</td><td className="px-3 py-3">{entry.size || '—'}</td><td className={`px-3 py-3 font-semibold tabular-nums ${Number(entry.pnl) > 0 ? 'text-emerald-500' : Number(entry.pnl) < 0 ? 'text-red-500' : ''}`}>{entry.pnl ? `$${Number(entry.pnl).toLocaleString()}` : '—'}</td><td className={`px-3 py-3 capitalize ${entry.outcome === 'win' ? 'text-emerald-500' : entry.outcome === 'loss' ? 'text-red-500' : ''}`}>{entry.outcome}</td><td className="px-3 py-3"><div className="flex gap-1"><button type="button" onClick={() => setDetailEntry(entry)} className={`rounded-md border px-2 py-1 ${isDark ? 'border-[#3F3F46] text-[#D4D4D8]' : 'border-[#E4E4E7] text-[#3F3F46]'}`}>Review</button><button type="button" onClick={() => { setDraft(entry); setIsEditorOpen(true) }} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-500">Edit</button><button type="button" aria-label={`Delete ${entry.symbol} journal entry`} onClick={() => void deleteEntry(entry)} className={`rounded-md border p-1.5 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:text-red-400' : 'border-[#E4E4E7] text-[#52525B] hover:text-red-600'}`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table></div>
          {entriesLoading && <div className="px-4 py-14 text-center text-sm text-[#71717A]">Loading saved trades…</div>}
          {!entriesLoading && !filteredEntries.length && <div className="px-4 py-14 text-center text-sm text-[#71717A]">No journal trades match these filters.</div>}
        </Surface>
      </main>
    </WorkspaceShell>
  )
}

export function JournalTradeDetailPage() {
  const { tradeId } = useParams<{ tradeId: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [entry, setEntry] = useState<ManualJournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!tradeId) {
      setError('This journal trade link is incomplete.')
      setLoading(false)
      return () => { cancelled = true }
    }
    setLoading(true)
    setError('')
    void journalAPI.getEntry(tradeId).then((record) => {
      if (!cancelled) setEntry(record)
    }).catch(() => {
      if (!cancelled) setError('This journal trade could not be found or you do not have access to it.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [tradeId])

  const outcomeColor = entry?.outcome === 'win'
    ? 'text-emerald-500'
    : entry?.outcome === 'loss'
      ? 'text-red-500'
      : 'text-[#A1A1AA]'

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-8">
        <button type="button" onClick={() => navigate('/journal')} className={`mb-5 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8] hover:bg-[#27272A]' : 'border-[#E4E4E7] text-[#3F3F46] hover:bg-[#F4F4F5]'}`}><ChevronLeft className="h-3.5 w-3.5" />Back to journal</button>

        {loading && <Surface className="flex min-h-72 items-center justify-center p-8 text-sm text-[#71717A]">Loading trade review…</Surface>}
        {!loading && error && <Surface className="p-8 text-center"><p className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Trade review unavailable</p><p className="mt-2 text-xs text-[#71717A]">{error}</p><button type="button" onClick={() => navigate('/journal')} className={`mt-5 h-9 rounded-lg px-4 text-xs font-semibold ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Return to journal</button></Surface>}

        {!loading && entry && <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <PageHeading eyebrow="Journal trade review" title={`${entry.symbol} setup evidence`} description={`${entry.playbook} · ${new Date(entry.dateTime).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`} />
            <div className="flex flex-wrap items-center gap-2">
              {entry.source === 'replay' && <span className="inline-flex rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-500">Replay capture</span>}
              {entry.sourceSessionId && <button type="button" onClick={() => navigate(`${ROUTES.BACKTESTER_CHART}?sessionId=${encodeURIComponent(entry.sourceSessionId || '')}`)} className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#D4D4D8] hover:bg-[#27272A]' : 'border-[#E4E4E7] text-[#3F3F46] hover:bg-[#F4F4F5]'}`}>Open replay</button>}
              <div className={`inline-flex w-fit rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${entry.outcome === 'win' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : entry.outcome === 'loss' ? 'border-red-500/30 bg-red-500/10 text-red-500' : isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#E4E4E7] text-[#52525B]'}`}>{entry.outcome === 'breakeven' ? 'Breakeven' : entry.outcome}</div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Entry', entry.entryPrice ? `$${Number(entry.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'],
              ['Close', entry.closePrice ? `$${Number(entry.closePrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'],
              ['Net P&L', entry.pnl ? `${Number(entry.pnl) >= 0 ? '+' : '-'}$${Math.abs(Number(entry.pnl)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'],
              ['Size', entry.size || '—'],
              ['Side', entry.side],
              ['Duration', entry.exitDateTime ? `${Math.max(0, Math.round((new Date(entry.exitDateTime).getTime() - new Date(entry.dateTime).getTime()) / 60000))} min` : '—'],
            ].map(([label, value]) => <Surface key={label} className="p-3 sm:p-4"><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#71717A]">{label}</p><p className={`mt-1.5 truncate text-sm font-semibold capitalize ${label === 'Net P&L' ? outcomeColor : isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{value}</p></Surface>)}
          </div>

          <Surface className="p-2 sm:p-4">
            <JournalDayChart entry={entry} isDark={isDark} />
            <p className="px-2 pb-1 pt-3 text-[10px] leading-4 text-[#71717A]">Drag to pan and scroll to zoom. BWC-native boxes mark the saved HTF PDA and IFVG zones; bounded level segments connect each source high or low to its sweep.</p>
          </Surface>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
            <Surface className="p-4 sm:p-5">
              <div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-blue-500" /><h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Setup details</h2></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(entry.conditionResponses || {}).map(([label, value]) => <div key={label} className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#71717A]">{label}</p><p className={`mt-2 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{formatConditionResponse(label, value)}</p></div>)}</div>
            </Surface>
            <Surface className="p-4 sm:p-5">
              <div className="flex items-center gap-2"><LineChart className="h-4 w-4 text-blue-500" /><h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Execution notes</h2></div>
              <p className={`mt-4 whitespace-pre-line text-xs leading-6 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{entry.notes || 'No notes recorded.'}</p>
              {entry.riskPlan && <div className={`mt-5 border-t pt-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
                <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-blue-500" /><h3 className={`text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Risk and exit plan</h3></div>
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-3"><span className="text-[#71717A]">Stop loss</span><span className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{formatRiskLeg(entry.riskPlan.stopLoss)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#71717A]">Breakeven</span><span className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{entry.riskPlan.breakEven?.enabled ? formatRiskLeg(entry.riskPlan.breakEven) : 'Not used'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#71717A]">Take profit</span><span className={`text-right ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{formatRiskLeg(entry.riskPlan.takeProfit)}</span></div>
                </div>
              </div>}
              {entry.source === 'replay' && <div className={`mt-5 border-t pt-4 text-[11px] ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div className="flex justify-between gap-3"><span className="text-[#71717A]">Captured from</span><span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>{entry.sourceContext?.sessionName || 'Replay session'}</span></div><div className="mt-2 flex justify-between gap-3"><span className="text-[#71717A]">Chart context</span><span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>{entry.sourceContext?.chartResolution || '—'} · {entry.sourceContext?.snapshotKind?.replace('_', ' ') || 'cursor'}</span></div></div>}
              <div className={`mt-5 border-t pt-4 text-[11px] ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div className="flex justify-between gap-3"><span className="text-[#71717A]">Entry time</span><span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>{new Date(entry.dateTime).toLocaleString()}</span></div><div className="mt-2 flex justify-between gap-3"><span className="text-[#71717A]">Exit time</span><span className={isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}>{entry.exitDateTime ? new Date(entry.exitDateTime).toLocaleString() : 'Not recorded'}</span></div></div>
            </Surface>
          </div>
        </>}
      </main>
    </WorkspaceShell>
  )
}

export function NewsWorkspacePage() {
  const { isDark } = useTheme()
  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading eyebrow="Economic news" title="USD economic schedule" description="Filter low, medium, and high-impact releases. High-impact events use a restrained amber treatment for fast risk recognition." />
        <Surface className="overflow-hidden p-2 sm:p-4">
          <EconomicNewsView isDark={isDark} />
        </Surface>
      </main>
    </WorkspaceShell>
  )
}
