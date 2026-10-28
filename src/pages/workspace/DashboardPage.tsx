import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Layers3,
  LineChart,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import type { PracticeTradeRecord } from '../../api/practice.api'
import {
  evaluatePracticeRules,
  getPracticeAccountDisplayTitle,
} from '../../constants/practice'
import { ROUTES, practiceSessionPath } from '../../constants/routes'
import { useDisplayUnit } from '../../contexts/DisplayUnitContext'
import { useTheme } from '../../hooks/useTheme'
import { useDashboardAccountData } from '../../hooks/useDashboardAccountData'
import { DASHBOARD_ACCOUNT_CHANGED_EVENT } from '../../services/dashboard/dashboardAccountSelection'
import {
  WorkspaceShell,
  PageHeading,
  Surface,
  MetricCard,
  ProgressRow,
} from '../../components/layout/WorkspacePrimitives'

const CalendarDayDetailsDialog = lazy(() => import('../../components/dashboard/CalendarDayDetailsDialog'))

const finiteNumber = (value: unknown, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export default function DashboardPage() {
  const { isDark } = useTheme()
  const [selectedDay, setSelectedDay] = useState<{ date: string; pnl?: number } | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const {
    selection,
    practiceAccount: account,
    tradeseaAccount,
    practiceStats,
    replaySession,
    replayStats,
    replayBalance,
    replayInitialBalance,
    tradeseaDashboard,
    days,
    loading,
    refreshing,
    error,
  } = useDashboardAccountData(calendarMonth)
  useEffect(() => {
    setSelectedDay(null)
  }, [selection?.source, selection?.accountId, calendarMonth])
  useEffect(() => {
    const closeDay = () => setSelectedDay(null)
    window.addEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, closeDay)
    return () => window.removeEventListener(DASHBOARD_ACCOUNT_CHANGED_EVENT, closeDay)
  }, [])
  const { format } = useDisplayUnit()
  const isTradesea = selection?.source === 'tradesea'
  const isReplay = selection?.source === 'replay'
  const stats = isReplay ? replayStats : practiceStats
  const hasAccount = isReplay ? Boolean(replaySession) : isTradesea ? Boolean(tradeseaAccount) : Boolean(account)
  const pnlKnown = !isReplay || stats.totalPnl != null
  const tradeCountsKnown = !isReplay || stats.totalTrades != null
  const tradeResultsKnown = !isReplay || stats.winRate != null
  const replayCalendarDate = isReplay ? days[days.length - 1]?.date || replaySession?.startDate : undefined
  useEffect(() => {
    if (!replayCalendarDate) return
    const date = new Date(`${replayCalendarDate.slice(0, 10)}T12:00:00`)
    if (!Number.isFinite(date.getTime())) return
    setCalendarMonth((current) => current.getFullYear() === date.getFullYear() && current.getMonth() === date.getMonth()
      ? current : new Date(date.getFullYear(), date.getMonth(), 1))
  }, [selection?.accountId, replayCalendarDate])
  const pnl = isTradesea
    ? finiteNumber(tradeseaDashboard?.totalPnl?.value)
    : isReplay ? finiteNumber(stats.totalPnl) : finiteNumber(
        stats.totalPnl ??
          (account ? account.balance - account.rules.startingBalance : 0)
      )
  const rules = account ? evaluatePracticeRules(account) : null
  const minProfitableDays =
    account?.mode === 'eval' ? (rules?.minProfitableDaysRequired ?? 0) : 0
  const trades = stats.trades ?? []
  const netTradePnl = (trade: PracticeTradeRecord) =>
    finiteNumber(trade.pnl) - finiteNumber(trade.fees)
  const grossProfit = trades
    .map(netTradePnl)
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0)
  const grossLoss = Math.abs(
    trades
      .map(netTradePnl)
      .filter((value) => value < 0)
      .reduce((sum, value) => sum + value, 0)
  )
  const profitFactor = isTradesea
    ? finiteNumber(tradeseaDashboard?.profitFactor?.value)
    : !tradeResultsKnown ? null : grossLoss > 0
      ? grossProfit / grossLoss
      : null
  const winRate = isTradesea
    ? finiteNumber(tradeseaDashboard?.tradeWinPer?.value)
    : finiteNumber(
        stats.winRate ??
          (trades.length
            ? (trades.filter((trade) => trade.pnl > 0).length / trades.length) *
              100
            : 0)
      )
  const totalTrades = isTradesea
    ? finiteNumber(tradeseaDashboard?.totalNumberOfTrades)
    : finiteNumber(stats.totalTrades ?? trades.length)
  const riskUnit = account ? Math.max(1, account.rules.maxLoss / 10) : 100
  const formatPnl = (value: number) =>
    isTradesea || isReplay
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          signDisplay: value === 0 ? 'auto' : 'always',
        }).format(value)
      : format(value, account?.rules.startingBalance, riskUnit)
  const dollars = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  const calendarYear = calendarMonth.getFullYear()
  const calendarMonthIndex = calendarMonth.getMonth()
  const calendarLabel = calendarMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const calendarDayMap = new Map(
    days.map((day) => [String(day.date).slice(0, 10), finiteNumber(day.pnl)])
  )
  const calendarCellCount =
    Math.ceil(
      (new Date(calendarYear, calendarMonthIndex, 1).getDay() +
        new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()) /
        7
    ) * 7
  const calendarCells = Array.from(
    { length: calendarCellCount },
    (_, index) => {
      const date = new Date(
        calendarYear,
        calendarMonthIndex,
        index - new Date(calendarYear, calendarMonthIndex, 1).getDay() + 1
      )
      const inMonth = date.getMonth() === calendarMonthIndex
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return {
        key,
        date,
        inMonth,
        pnl: inMonth ? calendarDayMap.get(key) : undefined,
      }
    }
  )
  const calendarWeeks = Array.from(
    { length: calendarCellCount / 7 },
    (_, index) => calendarCells.slice(index * 7, index * 7 + 7)
  )
  const calendarMonthPnl = calendarCells.reduce(
    (total, cell) => total + (cell.pnl ?? 0),
    0
  )
  const effectiveTarget = rules?.effectiveProfitTarget
  const profitTargetProgress = effectiveTarget
    ? (Math.max(0, pnl) / effectiveTarget) * 100
    : 0
  const drawdownUsed =
    account && rules ? Math.max(0, account.rules.maxLoss - rules.cushion) : 0
  const drawdownProgress = account
    ? (drawdownUsed / Math.max(account.rules.maxLoss, 1)) * 100
    : 0
  const points = useMemo(() => {
    if (!tradeResultsKnown) return ''
    const tradeseaValues = tradeseaDashboard?.dailyNetCumulativePnl
    const values =
      isTradesea && Array.isArray(tradeseaValues) && tradeseaValues.length
        ? tradeseaValues.slice(-20).map((point) => finiteNumber(point.value))
        : days.length
          ? days.slice(-20).map((day) => finiteNumber(day.pnl))
          : []
    let running = 0
    const cumulative = isTradesea
      ? values
      : values.map((value) => (running += value))
    const min = Math.min(...cumulative, 0)
    const max = Math.max(...cumulative, 1)
    return cumulative
      .map(
        (value, index) =>
          `${(index / Math.max(cumulative.length - 1, 1)) * 100},${finiteNumber(88 - ((value - min) / Math.max(max - min, 1)) * 72, 88)}`
      )
      .join(' ')
  }, [days, isTradesea, tradeseaDashboard, tradeResultsKnown])
  const title = isReplay ? replaySession?.name || 'Replay session' : isTradesea
    ? tradeseaAccount?.name || tradeseaAccount?.label
    : account
      ? getPracticeAccountDisplayTitle(account)
      : ''
  const terminalPath = isReplay && replaySession
    ? `${ROUTES.BACKTESTER_CHART}?sessionId=${encodeURIComponent(replaySession.id)}` : isTradesea
    ? ROUTES.TRADE
    : account
      ? practiceSessionPath(account.id)
      : ROUTES.PRACTICE
  const scopeLabel = isTradesea ? calendarLabel : 'All recorded trades'
  const text = isDark ? 'text-[#F7F7F8]' : 'text-[#18181B]'
  const muted = isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'
  const border = 'border-[var(--app-border)]'
  const inset = 'bg-[var(--app-inset)]'
  const primaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--app-button)] px-4 text-xs font-semibold text-[var(--app-button-text)] transition-opacity hover:opacity-90'
  const secondaryButton = `inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-medium transition-colors ${isDark ? 'border-[var(--app-border)] bg-[var(--app-panel)] text-[#D4D4D8] hover:bg-[var(--app-hover)]' : 'border-[var(--app-border)] bg-white text-[#52525B] hover:bg-[var(--app-inset)]'}`
  const headingActions = (
    <>
      <Link to={ROUTES.PRACTICE_ACCOUNTS} className={secondaryButton}>
        Account manager
      </Link>
      {hasAccount ? (
        <Link to={terminalPath} className={primaryButton}>
          Trade <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </>
  )

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 xl:px-9">
        <PageHeading
          eyebrow="Your workspace"
          title="Overview"
          description="Your performance, progress, and next session. All in one place."
          actions={headingActions}
        />

        {error ? (
          <div
            role="alert"
            className={`mb-5 rounded-xl border px-4 py-3 text-xs leading-5 ${isDark ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-800'}`}
          >
            {error}
          </div>
        ) : null}
        {loading ? (
          <Surface className="flex min-h-[360px] items-center justify-center p-8">
            <p role="status" className={`text-sm ${muted}`}>
              Loading your account overview…
            </p>
          </Surface>
        ) : !hasAccount ? (
          <Surface className="flex min-h-[420px] flex-col items-center justify-center px-6 py-14 text-center">
            <div
              className={`mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] ${isDark ? 'bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]' : 'bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]'}`}
            >
              <Layers3 className="h-7 w-7" strokeWidth={1.4} />
            </div>
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${muted}`}
            >
              A fresh start
            </p>
            <h2
              className={`mt-3 text-2xl font-semibold tracking-tight ${text}`}
            >
              Make room for your next session.
            </h2>
            <p className={`mt-3 max-w-md text-sm leading-6 ${muted}`}>
              Create a practice account or connect your trading platform to
              bring your performance into view.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to={ROUTES.PRACTICE_ACCOUNTS} className={primaryButton}>
                <Plus className="h-3.5 w-3.5" /> Create practice account
              </Link>
              <Link to={ROUTES.PROPS_SETTINGS} className={secondaryButton}>
                Connect a platform <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Surface>
        ) : (
          <>
            <Surface className="mb-5 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-6 px-5 py-6 sm:px-7">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isDark ? 'bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]' : 'bg-[var(--workspace-accent-soft)] text-[var(--workspace-accent)]'}`}
                  >
                    <Layers3 className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}
                      >
                        {isReplay ? 'Replay account' : isTradesea ? 'Connected account' : 'Practice account'}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-medium ${isTradesea || account?.status === 'active' || account?.status === 'passed' ? 'bg-emerald-500/10 text-[var(--workspace-success)]' : account?.status === 'blown' ? 'bg-red-500/10 text-[var(--workspace-danger)]' : 'bg-zinc-500/10 text-zinc-500'}`}
                      >
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {isReplay ? 'Replay' : isTradesea
                          ? 'Connected'
                          : account?.status === 'passed'
                            ? 'Passed'
                            : account?.status === 'blown'
                              ? 'Limit reached'
                              : 'Active'}
                      </span>
                    </div>
                    <h2
                      className={`mt-1.5 break-all text-lg font-semibold tracking-tight sm:text-xl ${text}`}
                    >
                      {title}
                    </h2>
                    <p className={`mt-1 text-[11px] ${muted}`}>
                      {isReplay
                        ? `${replaySession?.symbol || 'Replay'} · ${replayInitialBalance != null ? `${dollars(replayInitialBalance)} starting balance` : 'Historical simulation'}`
                        : isTradesea
                        ? `Tradesea · ${tradeseaAccount?.accountType || 'Trading account'}`
                        : `${account?.mode === 'funded' ? 'Funded simulation' : 'Evaluation simulation'} · ${dollars(account?.rules.startingBalance ?? 0)} starting balance`}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-7 sm:gap-10 ${text}`}>
                  <div>
                    <p className={`text-[10px] ${muted}`}>
                      {isTradesea ? 'Results for' : 'Account balance'}
                    </p>
                    <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight">
                      {isTradesea
                        ? calendarLabel
                        : isReplay ? replayBalance != null ? dollars(replayBalance) : '—'
                        : dollars(account?.balance ?? 0)}
                    </p>
                  </div>
                  <Link
                    to={
                      isReplay ? ROUTES.BACKTESTER : isTradesea
                        ? ROUTES.PROPS_SETTINGS
                        : ROUTES.PRACTICE_ACCOUNTS
                    }
                    aria-label="Manage selected account"
                    className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${border} ${isDark ? 'hover:bg-[var(--app-hover)]' : 'hover:bg-[var(--app-hover)]'}`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div
                className={`flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2.5 text-[10px] sm:px-7 ${border} ${inset} ${muted}`}
              >
                <span className="flex items-center gap-2">
                  <CircleDot className="h-3 w-3" />
                  {isReplay ? 'Replay results · Historical simulation' : isTradesea
                    ? 'Statistics from Tradesea TradeLens'
                    : 'Practice results · Simulated execution'}
                </span>
                <span role={refreshing ? 'status' : undefined}>
                  {refreshing
                    ? 'Updating account statistics…'
                    : 'Switch accounts using the selector above'}
                </span>
              </div>
            </Surface>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Net P&L"
                value={pnlKnown ? formatPnl(pnl) : '—'}
                hint={scopeLabel}
                tone={pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral'}
              />
              <MetricCard
                label="Win rate"
                accent={totalTrades > 0}
                tone={totalTrades && winRate >= 50 ? 'positive' : 'neutral'}
                value={totalTrades && tradeResultsKnown ? `${winRate.toFixed(1)}%` : '—'}
                hint={
                  !tradeResultsKnown ? 'Trade results unavailable' : totalTrades ? 'Of realized trades' : 'No realized trades yet'
                }
              />
              <MetricCard
                label="Profit factor"
                accent={totalTrades > 0}
                tone={
                  totalTrades && profitFactor != null
                    ? profitFactor > 1
                      ? 'positive'
                      : profitFactor < 1
                        ? 'negative'
                        : 'neutral'
                    : 'neutral'
                }
                value={
                  totalTrades && profitFactor != null
                    ? profitFactor.toFixed(2)
                    : '—'
                }
                hint={
                  !isTradesea && totalTrades && grossLoss === 0
                    ? 'No realized losses to compare'
                    : 'Gross profit / gross loss'
                }
              />
              <MetricCard
                label="Total trades"
                accent={totalTrades > 0}
                value={tradeCountsKnown ? totalTrades.toLocaleString() : '—'}
                hint={
                  totalTrades && pnlKnown
                    ? `Average result ${formatPnl(pnl / totalTrades)}`
                    : !tradeCountsKnown ? 'Trade count unavailable' : 'Your next session starts here'
                }
              />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_350px]">
              <Surface className="min-w-0 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className={`text-sm font-semibold ${text}`}>
                      Performance over time
                    </h2>
                    <p className={`mt-1.5 text-[11px] ${muted}`}>
                      Cumulative P&amp;L · Last 20 recorded sessions
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-[10px] ${inset} ${muted}`}
                  >
                    {scopeLabel}
                  </span>
                </div>
                {points ? (
                  <>
                    <p
                      className={`mt-6 text-[26px] font-semibold tabular-nums tracking-[-0.04em] ${pnl > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : pnl < 0 ? (isDark ? 'text-red-400' : 'text-[#DC2626]') : text}`}
                    >
                      {pnlKnown ? formatPnl(pnl) : '—'}
                    </p>
                    <div className="mt-5 h-36 sm:h-40">
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="h-full w-full overflow-visible"
                        role="img"
                        aria-label="Cumulative profit and loss for the last 20 recorded sessions"
                      >
                        {[16, 40, 64, 88].map((y) => (
                          <line
                            key={y}
                            x1="0"
                            y1={y}
                            x2="100"
                            y2={y}
                            stroke={isDark ? '#2B2B2D' : '#E4E4E7'}
                            strokeWidth="0.6"
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                        <polyline
                          points={points}
                          fill="none"
                          stroke={
                            pnl > 0
                              ? isDark
                                ? '#34D399'
                                : '#059669'
                              : pnl < 0
                                ? isDark
                                  ? '#F87171'
                                  : '#DC2626'
                                : isDark
                                  ? '#D4D4D8'
                                  : '#71717A'
                          }
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                    {days.length ? (
                      <div className={`mt-4 border-t pt-4 ${border}`}>
                        <div
                          className={`flex items-center justify-between text-[10px] ${muted}`}
                        >
                          <span>Daily results</span>
                          <BarChart3
                            className="h-3.5 w-3.5"
                            strokeWidth={1.5}
                          />
                        </div>
                        <div className="mt-3 flex h-12 items-end gap-2">
                          {days.slice(-20).map((day, index) => {
                            const max = Math.max(
                              ...days.map((item) =>
                                Math.abs(finiteNumber(item.pnl))
                              ),
                              1
                            )
                            return (
                              <div
                                key={`${day.date}-${index}`}
                                title={`${day.date}: ${formatPnl(day.pnl)}`}
                                className={`min-w-2 flex-1 rounded-t ${day.pnl > 0 ? 'bg-emerald-500/70' : day.pnl < 0 ? 'bg-red-500/70' : 'bg-zinc-400/60'}`}
                                style={{
                                  height: `${Math.max(4, (Math.abs(finiteNumber(day.pnl)) / max) * 100)}%`,
                                }}
                              />
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div
                    className={`flex h-64 flex-col items-center justify-center text-center ${muted}`}
                  >
                    <LineChart
                      className="mb-3 h-8 w-8 opacity-40"
                      strokeWidth={1.2}
                    />
                    <p className={`text-sm font-medium ${text}`}>
                      {tradeResultsKnown ? 'Your story starts with a session.' : 'Performance details unavailable.'}
                    </p>
                    <p className="mt-2 text-xs">
                      {tradeResultsKnown ? 'Recorded results will build your performance curve.' : 'Complete trade results are needed to build this curve.'}
                    </p>
                  </div>
                )}
                <div
                  className={`mt-5 flex items-center justify-between border-t pt-4 text-[10px] ${border} ${muted}`}
                >
                  <span>Session results after fees</span>
                  <Link
                    to={isReplay ? ROUTES.BACKTESTER : ROUTES.ANALYTICS}
                    className={`inline-flex items-center gap-1.5 font-medium ${text}`}
                  >
                    {isReplay ? 'View replay accounts' : 'View analytics'} <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Surface>

              <Surface className="flex flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className={`text-sm font-semibold ${text}`}>
                    {isReplay ? 'Replay details' : isTradesea
                      ? 'Account details'
                      : account?.mode === 'funded'
                        ? 'Account guardrails'
                        : 'Evaluation progress'}
                  </h2>
                  <ShieldCheck
                    className={`h-4 w-4 ${isDark ? 'text-[#A1A1AA]' : 'text-[#A1A1AA]'}`}
                    strokeWidth={1.6}
                  />
                </div>
                <p className={`mt-1.5 text-[11px] leading-5 ${muted}`}>
                  {isReplay ? 'Your selected historical simulation.' : isTradesea
                    ? 'Your selected trading connection.'
                    : 'Keep your next milestone in sight.'}
                </p>
                {isReplay ? (
                  <dl className="mt-7 space-y-5">
                    {[
                      ['Session', replaySession?.name || '—'],
                      ['Symbol', replaySession?.symbol || '—'],
                      ['Replay date', replaySession?.startDate || '—'],
                      ['Starting balance', replayInitialBalance != null ? dollars(replayInitialBalance) : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className={`flex items-start justify-between gap-4 border-b pb-4 text-[11px] last:border-0 ${border}`}>
                        <dt className={muted}>{label}</dt>
                        <dd className={`max-w-[60%] break-words text-right font-medium ${text}`}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : isTradesea ? (
                  <dl className="mt-7 space-y-5">
                    {[
                      [
                        'Account provider',
                        tradeseaAccount?.propFirmDisplayName ||
                          tradeseaAccount?.propFirm ||
                          '—',
                      ],
                      ['Platform', 'Tradesea'],
                      ['Account type', tradeseaAccount?.accountType || '—'],
                      ['Statistics source', 'TradeLens'],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className={`flex items-start justify-between gap-4 border-b pb-4 text-[11px] last:border-0 ${border}`}
                      >
                        <dt className={muted}>{label}</dt>
                        <dd
                          className={`max-w-[60%] break-words text-right font-medium ${text}`}
                        >
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="mt-7 space-y-6">
                    <ProgressRow
                      label="Profit target"
                      tone={pnl > 0 ? 'emerald' : 'blue'}
                      value={profitTargetProgress}
                      detail={
                        effectiveTarget
                          ? `${formatPnl(Math.max(0, pnl))} / ${formatPnl(effectiveTarget)}`
                          : 'No target'
                      }
                    />
                    <ProgressRow
                      label="Drawdown used"
                      value={drawdownProgress}
                      detail={`${formatPnl(drawdownUsed)} / ${formatPnl(account?.rules.maxLoss ?? 0)}`}
                      tone={
                        drawdownProgress > 90
                          ? 'red'
                          : drawdownProgress > 70
                            ? 'amber'
                            : 'blue'
                      }
                    />
                    <ProgressRow
                      label="Profitable days"
                      value={
                        minProfitableDays
                          ? ((rules?.profitableDaysCount ?? 0) /
                              minProfitableDays) *
                            100
                          : 0
                      }
                      detail={
                        minProfitableDays
                          ? `${rules?.profitableDaysCount ?? 0} / ${minProfitableDays} days`
                          : `${rules?.profitableDaysCount ?? 0} days · No minimum`
                      }
                      tone="emerald"
                    />
                    <div className={`rounded-xl px-4 py-3.5 ${inset}`}>
                      <p className={`text-[10px] ${muted}`}>
                        Drawdown headroom
                      </p>
                      <p
                        className={`mt-1.5 text-lg font-semibold tabular-nums ${text}`}
                      >
                        {formatPnl(Math.max(0, rules?.cushion ?? 0))}
                      </p>
                      <p className={`mt-1 text-[10px] leading-5 ${muted}`}>
                        {account?.rules.lockoutEnabled
                          ? `Daily loss limit ${formatPnl(account.rules.sessionDailyLossLimit ?? account.rules.dailyLossLimit ?? 0)}`
                          : 'Daily loss lockout is not enabled'}
                      </p>
                    </div>
                  </div>
                )}
                <Link
                  to={
                    isReplay ? ROUTES.BACKTESTER : isTradesea
                      ? ROUTES.PROPS_SETTINGS
                      : ROUTES.PRACTICE_ACCOUNTS
                  }
                  className={`mt-auto flex items-center justify-between gap-3 pt-6 text-[11px] font-medium ${text}`}
                >
                  {isReplay ? 'Manage replay accounts' : isTradesea ? 'Manage connection' : 'View accounts & rules'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Surface>
            </div>

            <Surface className="mt-5 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-7 sm:py-6">
                <div>
                  <h2
                    className={`flex items-center gap-2 text-sm font-semibold ${text}`}
                  >
                    <CalendarDays
                      className={`h-4 w-4 ${muted}`}
                      strokeWidth={1.6}
                    />
                    Trading calendar
                  </h2>
                  <p className={`mt-1.5 text-[11px] ${muted}`}>
                    Select a day to explore its results and trades.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <div className="text-right">
                    <p
                      className={`text-[9px] uppercase tracking-wider ${muted}`}
                    >
                      Month total
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold tabular-nums ${calendarMonthPnl > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : calendarMonthPnl < 0 ? (isDark ? 'text-red-400' : 'text-[#DC2626]') : text}`}
                    >
                      {tradeResultsKnown ? formatPnl(calendarMonthPnl) : '—'}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1 rounded-xl border p-1 ${border}`}
                  >
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(calendarYear, calendarMonthIndex - 1, 1)
                        )
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-[var(--app-hover)]' : 'hover:bg-[var(--app-hover)]'} ${muted}`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className={`min-w-28 px-1 text-center text-[11px] font-medium ${text}`}
                    >
                      {calendarLabel}
                    </span>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(calendarYear, calendarMonthIndex + 1, 1)
                        )
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-[var(--app-hover)]' : 'hover:bg-[var(--app-hover)]'} ${muted}`}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto px-3 pb-4 sm:px-6 sm:pb-6">
                <div className="grid min-w-[560px] grid-cols-[repeat(7,minmax(0,1fr))_5rem] gap-1.5 lg:gap-2">
                  {[
                    'Sun',
                    'Mon',
                    'Tue',
                    'Wed',
                    'Thu',
                    'Fri',
                    'Sat',
                    'Week',
                  ].map((day) => (
                    <span
                      key={day}
                      className={`pb-3 text-center text-[10px] ${muted}`}
                    >
                      {day}
                    </span>
                  ))}
                  {calendarWeeks.flatMap((week, weekIndex) => {
                    const weekPnl = week.reduce(
                      (total, cell) => total + (cell.pnl ?? 0),
                      0
                    )
                    return [
                      ...week.map((cell) => (
                        <button
                          key={cell.key}
                          type="button"
                          disabled={!cell.inMonth || loading || !selection}
                          aria-label={`View statistics for ${cell.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}${cell.pnl != null ? `, ${formatPnl(cell.pnl)}` : ''}`}
                          aria-haspopup="dialog"
                          onClick={() => setSelectedDay({ date: cell.key, pnl: cell.pnl })}
                          className={`min-h-[76px] rounded-xl border p-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] enabled:hover:border-[var(--app-accent)] sm:min-h-[86px] sm:p-3 ${!cell.inMonth ? `border-transparent bg-[var(--app-inset)] opacity-35` : cell.pnl != null && cell.pnl !== 0 ? (cell.pnl > 0 ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-red-500/20 bg-red-500/[0.06]') : border}`}
                        >
                          <span className={`block text-[10px] ${muted}`}>
                            {cell.date.getDate()}
                          </span>
                          {cell.pnl != null ? (
                            <span
                              className={`mt-3 flex items-center gap-1 text-[10px] font-semibold tabular-nums sm:text-[11px] ${cell.pnl > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : cell.pnl < 0 ? (isDark ? 'text-red-400' : 'text-[#DC2626]') : muted}`}
                            >
                              {cell.pnl > 0 ? (
                                <ArrowUpRight className="hidden h-3 w-3 shrink-0 lg:block" />
                              ) : cell.pnl < 0 ? (
                                <ArrowDownRight className="hidden h-3 w-3 shrink-0 lg:block" />
                              ) : null}
                              <span
                                className="truncate"
                                title={formatPnl(cell.pnl)}
                              >
                                {formatPnl(cell.pnl)}
                              </span>
                            </span>
                          ) : null}
                        </button>
                      )),
                      <div
                        key={`week-${weekIndex}`}
                        className={`flex flex-col justify-center rounded-xl px-2 text-center ${inset}`}
                      >
                        <span className={`text-[9px] ${muted}`}>
                          Week {weekIndex + 1}
                        </span>
                        <span
                          className={`mt-2 truncate text-[10px] font-semibold tabular-nums ${weekPnl > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : weekPnl < 0 ? (isDark ? 'text-red-400' : 'text-[#DC2626]') : muted}`}
                          title={formatPnl(weekPnl)}
                        >
                          {tradeResultsKnown ? formatPnl(weekPnl) : '—'}
                        </span>
                      </div>,
                    ]
                  })}
                </div>
              </div>
            </Surface>
          </>
        )}
      </main>
      {selectedDay && selection ? (
        <Suspense fallback={null}>
          <CalendarDayDetailsDialog
            key={`${selection.source}:${selection.accountId}:${selectedDay.date}`}
            selection={selection}
            date={selectedDay.date}
            accountName={title || 'Trading account'}
            calendarPnl={selectedDay.pnl}
            formatPnl={formatPnl}
            onClose={() => setSelectedDay(null)}
          />
        </Suspense>
      ) : null}
    </WorkspaceShell>
  )
}
