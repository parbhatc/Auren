import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
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
  conditions: string[]
}

const DEFAULT_PLAYBOOK: Playbook = {
  id: 'liquidity-sweep-fvg',
  name: 'Liquidity Sweep + FVG Tap',
  conditions: ['HTF bias aligned', 'Liquidity sweep confirmed', 'R:R ≥ 2:1'],
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
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>P&L calendar</h2>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[#71717A]">{day}</span>)}
              {Array.from({ length: 35 }, (_, index) => {
                const day = days[index]
                return (
                  <button key={index} type="button" className={`min-h-12 rounded-md border p-1 text-left ${day ? day.pnl >= 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10' : isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}>
                    <span className={`block text-[10px] ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>{index + 1}</span>
                    {day ? <span className={`mt-1 block truncate text-[10px] font-semibold tabular-nums ${day.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{format(day.pnl, account?.rules.startingBalance, riskUnit)}</span> : null}
                  </button>
                )
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
      if (!Array.isArray(saved) || !saved.length) return [DEFAULT_PLAYBOOK]
      return saved.map((item, index) =>
        typeof item === 'string'
          ? { id: `saved-${index}-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: item, conditions: [] }
          : {
              id: String(item.id || `saved-${index}`),
              name: String(item.name || 'Untitled playbook'),
              conditions: Array.isArray(item.conditions) ? item.conditions.map(String) : [],
            }
      )
    } catch {
      return [DEFAULT_PLAYBOOK]
    }
  })
  const [draft, setDraft] = useState('')
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, string>>({})
  useEffect(() => {
    localStorage.setItem('auren-playbooks', JSON.stringify(playbooks))
  }, [playbooks])
  const addPlaybook = () => {
    const name = draft.trim()
    if (!name || playbooks.some((item) => item.name.toLowerCase() === name.toLowerCase())) return
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `playbook-${Date.now()}`
    setPlaybooks((items) => [...items, { id, name, conditions: [] }])
    setDraft('')
  }
  const addCondition = (playbookId: string) => {
    const condition = (conditionDrafts[playbookId] || '').trim()
    if (!condition) return
    setPlaybooks((items) => items.map((item) => item.id === playbookId && !item.conditions.some((entry) => entry.toLowerCase() === condition.toLowerCase()) ? { ...item, conditions: [...item.conditions, condition] } : item))
    setConditionDrafts((items) => ({ ...items, [playbookId]: '' }))
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
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); addPlaybook() }}>
                <input aria-label="New playbook name" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="New setup name" className={`h-11 min-w-0 flex-1 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:w-56 sm:text-sm ${isDark ? 'border-[#27272A] bg-[#18181B] text-[#FAFAFA]' : 'border-[#E4E4E7] bg-white text-[#09090B]'}`} />
                <button type="submit" disabled={!draft.trim()} className={`${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'} inline-flex h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9`}><Plus className="h-3.5 w-3.5" />Add</button>
              </form>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {playbooks.map((playbook) => (
                <article key={playbook.id} className={`rounded-lg border p-4 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                  <div className="flex items-start justify-between gap-3"><div><h3 className={isDark ? 'text-sm font-semibold text-[#FAFAFA]' : 'text-sm font-semibold text-[#09090B]'}>{playbook.name}</h3><p className="mt-1 text-xs text-[#71717A]">{playbook.conditions.length} entry {playbook.conditions.length === 1 ? 'condition' : 'conditions'}</p></div><div className="flex items-center gap-1"><BookOpenCheck className="h-4 w-4 text-blue-500" /><button type="button" onClick={() => setPlaybooks((items) => items.filter((item) => item.id !== playbook.id))} aria-label={`Delete ${playbook.name}`} className={`rounded-md p-1.5 ${isDark ? 'text-[#71717A] hover:bg-red-500/10 hover:text-red-400' : 'text-[#A1A1AA] hover:bg-red-50 hover:text-red-600'}`}><Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /></button></div></div>
                  {playbook.conditions.length ? <ul className="mt-4 space-y-2">{playbook.conditions.map((condition) => <li key={condition} className={`flex items-center gap-2 text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10"><Check className="h-2.5 w-2.5 text-emerald-500" /></span><span className="min-w-0 flex-1">{condition}</span><button type="button" onClick={() => setPlaybooks((items) => items.map((item) => item.id === playbook.id ? { ...item, conditions: item.conditions.filter((entry) => entry !== condition) } : item))} aria-label={`Remove condition ${condition}`} className={`rounded p-1 ${isDark ? 'text-[#71717A] hover:text-red-400' : 'text-[#A1A1AA] hover:text-red-600'}`}><Trash2 className="h-3 w-3" strokeWidth={1.75} /></button></li>)}</ul> : <p className="mt-4 text-xs text-[#71717A]">Add the first condition that must be true before entering.</p>}
                  <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); addCondition(playbook.id) }}><input aria-label={`New condition for ${playbook.name}`} value={conditionDrafts[playbook.id] || ''} onChange={(event) => setConditionDrafts((items) => ({ ...items, [playbook.id]: event.target.value }))} placeholder="e.g. Price above VWAP" className={`h-11 min-w-0 flex-1 appearance-none rounded-lg border px-3 text-base outline-none focus:border-blue-500 sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA]' : 'border-[#D4D4D8] bg-white text-[#09090B]'}`} /><button type="submit" disabled={!(conditionDrafts[playbook.id] || '').trim()} className={`h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 sm:h-9 ${isDark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#18181B] text-white'}`}>Add condition</button></form>
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

export function JournalPage() {
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
  const trades = (stats.trades ?? []).filter((trade) => {
    if (symbol !== 'all' && trade.symbol !== symbol) return false
    if (date && new Date(trade.entryTime).toISOString().slice(0, 10) !== date) return false
    if (accountType !== 'all' && account?.mode !== accountType) return false
    if (setup !== 'all' && setup !== 'untagged') return false
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
        <Surface className="mb-4 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-xs text-[#71717A]"><Filter className="h-4 w-4" />Filters</div>
            <input aria-label="Trade date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={journalInput} />
            <select aria-label="Symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} className={journalInput}><option value="all">All symbols</option>{symbols.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Account type" value={accountType} onChange={(event) => setAccountType(event.target.value)} className={journalInput}><option value="all">All account types</option><option value="eval">Evaluation</option><option value="funded">Funded</option></select>
            <select aria-label="Strategy tag" value={setup} onChange={(event) => setSetup(event.target.value)} className={journalInput}><option value="all">All strategies</option><option value="untagged">Untagged</option></select>
            <select aria-label="Mistake tag" value={mistake} onChange={(event) => setMistake(event.target.value)} className={journalInput}><option value="all">All mistake tags</option><option value="none">No mistake tag</option></select>
            <select aria-label="Result" value={result} onChange={(event) => setResult(event.target.value)} className={journalInput}><option value="all">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="scratch">Scratch</option></select>
            {(date || symbol !== 'all' || accountType !== 'all' || setup !== 'all' || mistake !== 'all' || result !== 'all') ? <button type="button" onClick={() => { setDate(''); setSymbol('all'); setAccountType('all'); setSetup('all'); setMistake('all'); setResult('all') }} className={`h-11 rounded-lg border px-3 text-sm font-medium sm:h-9 sm:text-xs ${isDark ? 'border-[#3F3F46] text-[#A1A1AA] hover:bg-[#27272A]' : 'border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5]'}`}>Clear filters</button> : null}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead className={isDark ? 'bg-[#121215] text-[#A1A1AA]' : 'bg-[#FAFAFA] text-[#52525B]'}><tr>{['Date / Time', 'Symbol', 'Side', 'Setup tag', 'Entry', 'Exit', 'Size', 'Net P&L', 'R-Multiple', 'Grade', 'Replay'].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody>{trades.length ? trades.map((trade, index) => <tr key={`${trade.entryTime}-${index}`} className={isDark ? 'border-t border-[#27272A] text-[#D4D4D8]' : 'border-t border-[#E4E4E7] text-[#3F3F46]'}><td className="whitespace-nowrap px-3 py-2.5">{new Date(trade.entryTime).toLocaleString()}</td><td className="px-3 py-2.5 font-semibold">{trade.symbol}</td><td className={`px-3 py-2.5 capitalize ${trade.direction === 'long' ? 'text-emerald-500' : 'text-red-500'}`}>{trade.direction}</td><td className="px-3 py-2.5"><span className="rounded border border-[#3F3F46] px-2 py-1 text-[10px]">Untagged</span></td><td className="px-3 py-2.5 font-mono">{trade.entryPrice}</td><td className="px-3 py-2.5 font-mono">{trade.exitPrice}</td><td className="px-3 py-2.5">{trade.contracts}</td><td className={`px-3 py-2.5 font-semibold tabular-nums ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{format(trade.pnl, account?.rules.startingBalance)}</td><td className="px-3 py-2.5 tabular-nums">{(trade.pnl / Math.max(account?.rules.maxLoss ? account.rules.maxLoss / 10 : 100, 1)).toFixed(2)}R</td><td className="px-3 py-2.5">—</td><td className="px-3 py-2.5"><button type="button" onClick={() => account && navigate(practiceSessionPath(account.id))} className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-500">Open <ChevronRight className="h-3 w-3" /></button></td></tr>) : <tr><td colSpan={11} className="px-4 py-16 text-center text-sm text-[#71717A]">No realized trades match these filters.</td></tr>}</tbody>
            </table>
          </div>
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
