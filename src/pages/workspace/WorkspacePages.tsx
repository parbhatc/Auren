import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  LineChart,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingDown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { practiceAPI, type PracticeTradeRecord } from '../../api/practice.api'
import { journalAPI, type JournalStrategyRecord } from '../../api/journal.api'
import { backtesterAPI } from '../../api/backtester.api'
import ProductHeader from '../../components/layout/ProductHeader'
import { EconomicNewsView } from '../../components/trading/shared/news/EconomicNewsView'
import {
  evaluatePracticeRules,
  getPracticeAccounts,
  PRACTICE_STORAGE_KEYS,
  refreshPracticeFromApi,
  type PracticeAccount,
} from '../../constants/practice'
import { practiceSessionPath } from '../../constants/routes'
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
  type: 'boolean' | 'time' | 'timeframe' | 'text' | 'number'
}

type TradeJournalDetails = {
  playbook: string
  sweep: string
  pdaDelivery: string
  ifvgTimeframe: string
  ifvgTime: string
  notes: string
}

type ManualJournalEntry = {
  id: string
  dateTime: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: string
  closePrice: string
  size: string
  pnl: string
  outcome: 'planned' | 'win' | 'loss' | 'scratch'
  playbook: string
  conditionResponses: Record<string, string | boolean>
  notes: string
}

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
  dateTime: '2026-07-21T09:22',
  symbol: 'NQ',
  side: 'short',
  entryPrice: '29249.25',
  closePrice: '29235.00',
  size: '1',
  pnl: '285.00',
  outcome: 'win',
  playbook: EXAMPLE_JOURNAL.playbook,
  conditionResponses: {
    'Liquidity sweep timeline': '9:13 AM — 15m sweep\n9:14 AM — 1h sweep\n9:15 AM — 4h + 1h high sweep',
    'HTF PDA delivery': '9:20 AM — tapped 15m FVG and 4h FVG',
    'IFVG confirmation': '9:22 AM — 1m IFVG',
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
    const validTypes: PlaybookCondition['type'][] = ['boolean', 'time', 'timeframe', 'text', 'number']
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
                  {playbook.conditions.length ? <ul className="mt-4 space-y-2">{playbook.conditions.map((condition) => <li key={condition.id} className={`flex items-center gap-2 text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10"><Check className="h-2.5 w-2.5 text-emerald-500" /></span><span className="min-w-0 flex-1">{condition.label}</span><span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${isDark ? 'border-[#3F3F46] text-[#71717A]' : 'border-[#E4E4E7] text-[#71717A]'}`}>{condition.type === 'boolean' ? 'Yes / No' : condition.type}</span><button type="button" onClick={() => void removeCondition(playbook, condition)} aria-label={`Remove condition ${condition.label}`} className={`rounded p-1 ${isDark ? 'text-[#71717A] hover:text-red-400' : 'text-[#A1A1AA] hover:text-red-600'}`}><Trash2 className="h-3 w-3" strokeWidth={1.75} /></button></li>)}</ul> : <p className="mt-4 text-xs text-[#71717A]">Add the first condition that must be true before entering.</p>}
                  <form className="mt-4 grid grid-cols-[minmax(0,1fr)_7.5rem_auto] gap-2" onSubmit={(event) => { event.preventDefault(); void addCondition(playbook.id) }}><input aria-label={`New condition for ${playbook.name}`} value={conditionDrafts[playbook.id] || ''} onChange={(event) => setConditionDrafts((items) => ({ ...items, [playbook.id]: event.target.value }))} placeholder="Condition label" className={`h-11 min-w-0 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`} /><select aria-label={`Condition type for ${playbook.name}`} value={conditionTypeDrafts[playbook.id] || 'boolean'} onChange={(event) => setConditionTypeDrafts((items) => ({ ...items, [playbook.id]: event.target.value as PlaybookCondition['type'] }))} className={`h-11 appearance-none rounded-lg border px-2 text-xs outline-none focus:border-blue-500 sm:h-9 ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`}><option value="boolean">Yes / No</option><option value="time">Time / Timeline</option><option value="timeframe">Timeframe</option><option value="text">Text</option><option value="number">Number</option></select><button type="submit" disabled={!(conditionDrafts[playbook.id] || '').trim()} className={`h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Add</button></form>
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

function JournalDayChart({ entry, isDark }: { entry: ManualJournalEntry; isDark: boolean }) {
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
      setBars(normalized)
    }).catch(() => setBars([])).finally(() => setLoading(false))
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

export function JournalPage() {
  const { isDark } = useTheme()
  const inputClass = `h-11 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`
  const [entries, setEntries] = useState<ManualJournalEntry[]>(() => {
    try {
      const raw = localStorage.getItem('auren-manual-journals')
      if (raw == null) return [EXAMPLE_MANUAL_JOURNAL]
      const saved = JSON.parse(raw)
      if (!Array.isArray(saved)) return []
      return saved.map((entry) => entry.conditionResponses ? { entryPrice: '', closePrice: '', size: '', pnl: '', outcome: 'planned', ...entry } : {
        id: entry.id,
        dateTime: entry.dateTime,
        symbol: entry.symbol,
        side: entry.side,
        entryPrice: String(entry.entryPrice || ''),
        closePrice: String(entry.closePrice || ''),
        size: String(entry.size || ''),
        pnl: String(entry.pnl || ''),
        outcome: entry.outcome || 'planned',
        playbook: entry.playbook,
        conditionResponses: {
          'Liquidity sweep timeline': entry.sweep || '',
          'HTF PDA delivery': entry.pdaDelivery || '',
          'IFVG confirmation': [entry.ifvgTime, entry.ifvgTimeframe].filter(Boolean).join(' — '),
        },
        notes: entry.notes || '',
      })
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState<ManualJournalEntry>(() => entries[0] || EXAMPLE_MANUAL_JOURNAL)
  const [symbolFilter, setSymbolFilter] = useState('all')
  const [strategyFilter, setStrategyFilter] = useState('all')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<ManualJournalEntry | null>(null)
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
  useEffect(() => {
    localStorage.setItem('auren-manual-journals', JSON.stringify(entries))
  }, [entries])
  const updateDraft = (patch: Partial<ManualJournalEntry>) => setDraft((item) => ({ ...item, ...patch }))
  const startNew = () => { setDraft({
    ...EXAMPLE_MANUAL_JOURNAL,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `journal-${Date.now()}`,
    dateTime: new Date().toISOString().slice(0, 16),
    entryPrice: '',
    closePrice: '',
    size: '1',
    pnl: '',
    outcome: 'planned',
    playbook: journalPlaybooks[0]?.name || '',
    conditionResponses: {},
    notes: '',
  }); setIsEditorOpen(true) }
  const saveEntry = () => {
    if (!draft.dateTime || !draft.symbol.trim() || !draft.playbook) return
    setEntries((items) => items.some((item) => item.id === draft.id) ? items.map((item) => item.id === draft.id ? draft : item) : [draft, ...items])
    setIsEditorOpen(false)
  }
  const symbols = Array.from(new Set(entries.map((entry) => entry.symbol)))
  const filteredEntries = entries.filter((entry) => (symbolFilter === 'all' || entry.symbol === symbolFilter) && (strategyFilter === 'all' || entry.playbook === strategyFilter))

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading eyebrow="Journal and trade log" title="Every setup, one searchable record" description="Record planned, taken, or missed setups manually. A replay or realized trade is not required." />
        <div className="mb-4 flex items-center justify-between gap-3">{!playbookNames.length && <p className="text-xs text-[#71717A]">Create a playbook before adding journal entries.</p>}<button type="button" onClick={startNew} disabled={!playbookNames.length} className={`ml-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}><Plus className="h-3.5 w-3.5" />Add entry</button></div>

        {isEditorOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Journal entry editor">
          <div className={`flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border sm:rounded-xl ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{entries.some((item) => item.id === draft.id) ? 'Edit journal entry' : 'Add journal entry'}</h2><p className="mt-1 text-xs text-[#71717A]">Fields are generated from the selected playbook.</p></div><button type="button" onClick={() => setIsEditorOpen(false)} aria-label="Close journal editor" className={`rounded-md px-2 py-1 text-lg ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}>×</button></div>
            <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
              <label className="text-xs text-[#71717A]">Date and time<input aria-label="Journal date and time" type="datetime-local" value={draft.dateTime} onChange={(event) => updateDraft({ dateTime: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Symbol<input aria-label="Journal symbol" value={draft.symbol} onChange={(event) => updateDraft({ symbol: event.target.value.toUpperCase() })} placeholder="NQ" className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Side<select aria-label="Journal side" value={draft.side} onChange={(event) => updateDraft({ side: event.target.value as 'long' | 'short' })} className={`${inputClass} mt-1.5 w-full`}><option value="long">Long</option><option value="short">Short</option></select></label>
              <label className="text-xs text-[#71717A]">Playbook<select aria-label="Journal playbook" value={draft.playbook} onChange={(event) => updateDraft({ playbook: event.target.value, conditionResponses: {} })} className={`${inputClass} mt-1.5 w-full`}>{playbookNames.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="text-xs text-[#71717A]">Entry price<input aria-label="Journal entry price" inputMode="decimal" value={draft.entryPrice} onChange={(event) => updateDraft({ entryPrice: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Close price<input aria-label="Journal close price" inputMode="decimal" value={draft.closePrice} onChange={(event) => updateDraft({ closePrice: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Size<input aria-label="Journal position size" inputMode="numeric" value={draft.size} onChange={(event) => updateDraft({ size: event.target.value })} className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A]">Net P&amp;L<input aria-label="Journal net P and L" inputMode="decimal" value={draft.pnl} onChange={(event) => { const pnl = event.target.value; const numeric = Number(pnl); updateDraft({ pnl, outcome: pnl.trim() === '' ? draft.outcome : numeric > 0 ? 'win' : numeric < 0 ? 'loss' : 'scratch' }) }} placeholder="285.00" className={`${inputClass} mt-1.5 w-full`} /></label>
              <label className="text-xs text-[#71717A] sm:col-span-2">Outcome<select aria-label="Journal outcome" value={draft.outcome} onChange={(event) => updateDraft({ outcome: event.target.value as ManualJournalEntry['outcome'] })} className={`${inputClass} mt-1.5 w-full`}><option value="planned">Planned / missed</option><option value="win">Win</option><option value="loss">Loss</option><option value="scratch">Scratch</option></select></label>
              <div className={`sm:col-span-2 rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className={`mb-3 text-xs font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>Setup conditions</p><div className="grid gap-3 sm:grid-cols-2">{(selectedPlaybook?.conditions ?? []).map((condition) => {
                const value = draft.conditionResponses[condition.label]
                const setValue = (next: string | boolean) => updateDraft({ conditionResponses: { ...draft.conditionResponses, [condition.label]: next } })
                if (condition.type === 'boolean') return <label key={condition.id} className="text-xs text-[#71717A]">{condition.label}<select aria-label={condition.label} value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(event) => setValue(event.target.value === 'yes')} className={`${inputClass} mt-1.5 w-full`}><option value="">Not reviewed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
                if (condition.type === 'timeframe') return <label key={condition.id} className="text-xs text-[#71717A]">{condition.label}<select aria-label={condition.label} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} mt-1.5 w-full`}><option value="">Select timeframe</option>{['30s','1m','2m','3m','5m','15m','30m','1h','4h','1D'].map((timeframe) => <option key={timeframe}>{timeframe}</option>)}</select></label>
                if (condition.type === 'time') return <label key={condition.id} className="text-xs text-[#71717A] sm:col-span-2">{condition.label}<textarea aria-label={condition.label} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} rows={3} placeholder="9:13 AM — 15m sweep" className={`${inputClass} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
                return <label key={condition.id} className="text-xs text-[#71717A]">{condition.label}<input aria-label={condition.label} type={condition.type === 'number' ? 'number' : 'text'} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} className={`${inputClass} mt-1.5 w-full`} /></label>
              })}</div></div>
              <label className="text-xs text-[#71717A] sm:col-span-2">Execution notes<textarea aria-label="Journal execution notes" value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} rows={3} className={`${inputClass} mt-1.5 h-auto w-full resize-y py-2 leading-5`} /></label>
            </div>
            <div className={`flex justify-end gap-2 border-t p-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><button type="button" onClick={() => setIsEditorOpen(false)} className={`h-10 rounded-lg border px-4 text-xs font-medium ${isDark ? 'border-[#3F3F46] text-[#A1A1AA]' : 'border-[#E4E4E7] text-[#52525B]'}`}>Cancel</button><button type="button" onClick={saveEntry} disabled={!draft.dateTime || !draft.symbol.trim() || !draft.playbook} className={`h-10 rounded-lg px-4 text-xs font-semibold disabled:opacity-50 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Save entry</button></div>
          </div>
        </div>}

        {detailEntry && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Setup review">
          <div className={`flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl border sm:rounded-xl ${isDark ? 'border-[#27272A] bg-[#18181B]' : 'border-[#E4E4E7] bg-white'}`}>
            <div className={`flex items-center justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div><div className="flex items-center gap-2"><h2 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{detailEntry.symbol} setup review</h2><span className={`text-xs font-semibold capitalize ${detailEntry.outcome === 'win' ? 'text-emerald-500' : detailEntry.outcome === 'loss' ? 'text-red-500' : 'text-[#71717A]'}`}>{detailEntry.outcome}</span></div><p className="mt-1 text-xs text-[#71717A]">{detailEntry.playbook} · {new Date(detailEntry.dateTime).toLocaleString()}</p></div><button type="button" onClick={() => setDetailEntry(null)} aria-label="Close setup review" className={`rounded-md px-2 py-1 text-lg ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}>×</button></div>
            <div className="overflow-y-auto p-4 sm:p-5"><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Entry', detailEntry.entryPrice], ['Close', detailEntry.closePrice], ['Size', detailEntry.size], ['Net P&L', detailEntry.pnl ? `$${Number(detailEntry.pnl).toLocaleString()}` : '—'], ['Side', detailEntry.side]].map(([label, value]) => <div key={label} className={`rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><p className="text-[10px] uppercase tracking-wide text-[#71717A]">{label}</p><p className={`mt-1 text-sm font-semibold capitalize ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{value || '—'}</p></div>)}</div><JournalDayChart entry={detailEntry} isDark={isDark} /><div className="mt-4 grid gap-4 md:grid-cols-2"><div className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><h3 className={isDark ? 'text-xs font-semibold text-[#FAFAFA]' : 'text-xs font-semibold text-[#09090B]'}>Setup details</h3><div className="mt-3 space-y-3">{Object.entries(detailEntry.conditionResponses || {}).map(([label, value]) => <div key={label}><p className="text-[10px] uppercase tracking-wide text-[#71717A]">{label}</p><p className={`mt-1 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value) || '—'}</p></div>)}</div></div><div className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><h3 className={isDark ? 'text-xs font-semibold text-[#FAFAFA]' : 'text-xs font-semibold text-[#09090B]'}>Notes</h3><p className={`mt-3 whitespace-pre-line text-xs leading-5 ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{detailEntry.notes || 'No notes recorded.'}</p></div></div></div>
          </div>
        </div>}

        <Surface className="overflow-hidden">
          <div className={`flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}><div className="mr-auto flex items-center gap-2 text-xs text-[#71717A]"><Filter className="h-4 w-4" />Trades</div><select aria-label="Filter journal symbol" value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value)} className={inputClass}><option value="all">All symbols</option>{symbols.map((symbol) => <option key={symbol}>{symbol}</option>)}</select><select aria-label="Filter journal strategy" value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)} className={inputClass}><option value="all">All strategies</option>{playbookNames.map((name) => <option key={name}>{name}</option>)}</select></div>
          <div className={`flex flex-wrap gap-2 border-b p-3 ${isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>{filteredEntries.map((entry) => <button key={entry.id} type="button" onClick={() => setDetailEntry(entry)} className={`rounded-lg border px-3 py-2 text-left text-xs transition ${isDark ? 'border-[#3F3F46] bg-[#121215] text-[#D4D4D8] hover:border-blue-500' : 'border-[#E4E4E7] bg-[#FAFAFA] text-[#3F3F46] hover:border-blue-600'}`}><span className="font-semibold">{entry.symbol} setup details</span><span className="ml-2 text-[#71717A]">{new Date(entry.dateTime).toLocaleDateString()}</span></button>)}</div>
          <div className="grid gap-3 p-3 lg:hidden">{filteredEntries.map((entry) => <article key={entry.id} className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{entry.symbol}</span><span className={`text-xs capitalize ${entry.side === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{entry.side}</span><span className={`text-xs font-semibold capitalize ${entry.outcome === 'win' ? 'text-emerald-500' : entry.outcome === 'loss' ? 'text-red-500' : 'text-[#71717A]'}`}>{entry.outcome}</span></div><p className="mt-1 text-[11px] text-[#71717A]">{new Date(entry.dateTime).toLocaleString()}</p></div><span className={`text-sm font-semibold tabular-nums ${Number(entry.pnl) > 0 ? 'text-emerald-500' : Number(entry.pnl) < 0 ? 'text-red-500' : 'text-[#71717A]'}`}>{entry.pnl ? `$${Number(entry.pnl).toLocaleString()}` : '—'}</span></div><p className={`mt-3 text-xs font-medium ${isDark ? 'text-[#D4D4D8]' : 'text-[#3F3F46]'}`}>{entry.playbook}</p><div className="mt-3 grid grid-cols-3 gap-2 text-[11px]"><div><span className="text-[#71717A]">Entry</span><p className="mt-0.5 font-mono">{entry.entryPrice || '—'}</p></div><div><span className="text-[#71717A]">Close</span><p className="mt-0.5 font-mono">{entry.closePrice || '—'}</p></div><div><span className="text-[#71717A]">Size</span><p className="mt-0.5">{entry.size || '—'}</p></div></div><div className="mt-3 space-y-1 border-t border-inherit pt-3">{Object.entries(entry.conditionResponses || {}).map(([label, value]) => <p key={label} className="text-[11px]"><span className="text-[#71717A]">{label}:</span> {typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value) || '—'}</p>)}</div><div className="mt-3 flex justify-end gap-1"><button type="button" onClick={() => { setDraft(entry); setIsEditorOpen(true) }} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500">Edit</button><button type="button" aria-label={`Delete ${entry.symbol} journal entry`} onClick={() => { setEntries((items) => items.filter((item) => item.id !== entry.id)); if (draft.id === entry.id) setIsEditorOpen(false) }} className={`rounded-md border p-1.5 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:text-red-400' : 'border-[#E4E4E7] text-[#52525B] hover:text-red-600'}`}><Trash2 className="h-3.5 w-3.5" /></button></div></article>)}</div>
          <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1280px] text-left text-xs"><thead className={isDark ? 'bg-[#121215] text-[#A1A1AA]' : 'bg-[#FAFAFA] text-[#52525B]'}><tr>{['Date / Time','Symbol','Side','Playbook','Entry','Close','Size','Net P&L','Outcome','Setup details','Notes','Actions'].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{filteredEntries.map((entry) => <tr key={entry.id} className={isDark ? 'border-t border-[#27272A] text-[#D4D4D8]' : 'border-t border-[#E4E4E7] text-[#3F3F46]'}><td className="whitespace-nowrap px-3 py-3">{new Date(entry.dateTime).toLocaleString()}</td><td className="px-3 py-3 font-semibold">{entry.symbol}</td><td className={`px-3 py-3 capitalize ${entry.side === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{entry.side}</td><td className="max-w-48 px-3 py-3">{entry.playbook}</td><td className="px-3 py-3 font-mono">{entry.entryPrice || '—'}</td><td className="px-3 py-3 font-mono">{entry.closePrice || '—'}</td><td className="px-3 py-3">{entry.size || '—'}</td><td className={`px-3 py-3 font-semibold tabular-nums ${Number(entry.pnl) > 0 ? 'text-emerald-500' : Number(entry.pnl) < 0 ? 'text-red-500' : ''}`}>{entry.pnl ? `$${Number(entry.pnl).toLocaleString()}` : '—'}</td><td className={`px-3 py-3 capitalize ${entry.outcome === 'win' ? 'text-emerald-500' : entry.outcome === 'loss' ? 'text-red-500' : ''}`}>{entry.outcome}</td><td className="max-w-80 px-3 py-3"><div className="space-y-1">{Object.entries(entry.conditionResponses || {}).map(([label, value]) => <p key={label} className="truncate"><span className="text-[#71717A]">{label}:</span> {typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value) || '—'}</p>)}</div></td><td className="max-w-64 truncate px-3 py-3">{entry.notes || '—'}</td><td className="px-3 py-3"><div className="flex gap-1"><button type="button" onClick={() => { setDraft(entry); setIsEditorOpen(true) }} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-500">Edit</button><button type="button" aria-label={`Delete ${entry.symbol} journal entry`} onClick={() => { setEntries((items) => items.filter((item) => item.id !== entry.id)); if (draft.id === entry.id) setIsEditorOpen(false) }} className={`rounded-md border p-1.5 ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:text-red-400' : 'border-[#E4E4E7] text-[#52525B] hover:text-red-600'}`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table></div>
        </Surface>
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
