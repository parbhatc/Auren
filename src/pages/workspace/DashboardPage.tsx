import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, LineChart, ShieldCheck } from 'lucide-react'
import type { PracticeTradeRecord } from '../../api/practice.api'
import { evaluatePracticeRules } from '../../constants/practice'
import { useDisplayUnit } from '../../contexts/DisplayUnitContext'
import { useTheme } from '../../hooks/useTheme'
import { useDashboardAccountData } from '../../hooks/useDashboardAccountData'
import { WorkspaceShell, PageHeading, Surface, MetricCard, ProgressRow } from '../../components/layout/WorkspacePrimitives'

export default function DashboardPage() {
  const { isDark } = useTheme()
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const {
    selection,
    practiceAccount: account,
    tradeseaAccount,
    practiceStats: stats,
    tradeseaDashboard,
    days,
    loading,
    refreshing,
    error,
  } = useDashboardAccountData(calendarMonth)
  const { format } = useDisplayUnit()
  const isTradesea = selection?.source === 'tradesea'
  const pnl = isTradesea
    ? Number(tradeseaDashboard?.totalPnl?.value) || 0
    : stats.totalPnl ?? (account ? account.balance - account.rules.startingBalance : 0)
  const rules = account ? evaluatePracticeRules(account) : null
  const trades = stats.trades ?? []
  const netTradePnl = (trade: PracticeTradeRecord) =>
    Number(trade.pnl || 0) - Number(trade.fees || 0)
  const grossProfit = trades
    .map(netTradePnl)
    .filter((tradePnl) => tradePnl > 0)
    .reduce((sum, tradePnl) => sum + tradePnl, 0)
  const grossLoss = Math.abs(
    trades
      .map(netTradePnl)
      .filter((tradePnl) => tradePnl < 0)
      .reduce((sum, tradePnl) => sum + tradePnl, 0)
  )
  const practiceProfitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0
  const profitFactor = isTradesea
    ? Number(tradeseaDashboard?.profitFactor?.value) || 0
    : practiceProfitFactor
  const winRate = isTradesea
    ? Number(tradeseaDashboard?.tradeWinPer?.value) || 0
    : stats.winRate ??
      (trades.length ? (trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100 : 0)
  const totalTrades = isTradesea
    ? Number(tradeseaDashboard?.totalNumberOfTrades) || 0
    : stats.totalTrades ?? trades.length
  const avgWinLossRatio = Number(tradeseaDashboard?.avgWinAndLoss?.avgWinLossRatio) || 0
  const riskUnit = account ? Math.max(1, account.rules.maxLoss / 10) : 100
  const formatPnl = (value: number) => isTradesea
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: value === 0 ? 'auto' : 'always',
      }).format(value)
    : format(value, account?.rules.startingBalance, riskUnit)
  const calendarYear = calendarMonth.getFullYear()
  const calendarMonthIndex = calendarMonth.getMonth()
  const calendarLabel = calendarMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const calendarDayMap = new Map(days.map((day) => [String(day.date).slice(0, 10), day.pnl]))
  const calendarCellCount =
    Math.ceil(
      (new Date(calendarYear, calendarMonthIndex, 1).getDay() +
        new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()) /
        7
    ) * 7
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const date = new Date(
      calendarYear,
      calendarMonthIndex,
      index - new Date(calendarYear, calendarMonthIndex, 1).getDay() + 1
    )
    const inMonth = date.getMonth() === calendarMonthIndex
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { date, inMonth, pnl: inMonth ? calendarDayMap.get(key) : undefined }
  })
  const calendarWeeks = Array.from({ length: calendarCellCount / 7 }, (_, index) =>
    calendarCells.slice(index * 7, index * 7 + 7)
  )
  const calendarMonthPnl = calendarCells.reduce((total, cell) => total + (cell.pnl ?? 0), 0)
  const profitTargetProgress = account?.rules.profitTarget
    ? (Math.max(0, pnl) / account.rules.profitTarget) * 100
    : 0
  const drawdownUsed =
    account && rules ? Math.max(0, account.rules.startingBalance - account.balance) : 0
  const drawdownProgress = account ? (drawdownUsed / Math.max(account.rules.maxLoss, 1)) * 100 : 0
  const points = useMemo(() => {
    const tradeseaValues = tradeseaDashboard?.dailyNetCumulativePnl
    const values = isTradesea && Array.isArray(tradeseaValues) && tradeseaValues.length
      ? tradeseaValues.slice(-20).map((point) => Number(point.value) || 0)
      : days.length
        ? days.slice(-20).map((day) => day.pnl)
        : [0]
    let running = 0
    const cumulative = isTradesea ? values : values.map((value) => (running += value))
    const min = Math.min(...cumulative, 0)
    const max = Math.max(...cumulative, 1)
    return cumulative
      .map(
        (value, index) =>
          `${(index / Math.max(cumulative.length - 1, 1)) * 100},${88 - ((value - min) / Math.max(max - min, 1)) * 72}`
      )
      .join(' ')
  }, [days, isTradesea, tradeseaDashboard])

  if (loading) {
    return (
      <WorkspaceShell>
        <main className="mx-auto flex min-h-[60vh] max-w-[1600px] items-center justify-center px-4">
          <p className={`text-sm ${isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>Loading account statistics…</p>
        </main>
      </WorkspaceShell>
    )
  }

  return (
    <WorkspaceShell>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <PageHeading
          eyebrow={isTradesea ? 'Tradesea dashboard' : 'Evaluation dashboard'}
          title={isTradesea ? 'Live account performance' : 'Performance and guardrails'}
          description={isTradesea
            ? 'TradeLens statistics for the connected Tradesea account, including net results, consistency, and daily performance.'
            : 'A high-density view of account performance, drawdown exposure, consistency, and daily execution discipline.'}
        />

        {refreshing ? <p role="status" className="mb-3 text-xs text-zinc-500">Updating account statistics…</p> : null}

        {error ? (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Net P&L"
            value={formatPnl(pnl)}
            hint={`${totalTrades} realized trades`}
            tone={pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral'}
          />
          <MetricCard
            label="Win rate"
            value={`${winRate.toFixed(1)}%`}
            hint="Realized trades only"
            tone={winRate >= 50 ? 'positive' : 'neutral'}
          />
          <MetricCard
            label="Profit factor"
            value={profitFactor.toFixed(2)}
            hint={`Avg realized ${totalTrades ? formatPnl(pnl / totalTrades) : '—'}`}
          />
          <MetricCard
            label={isTradesea ? 'Avg win/loss ratio' : 'Discipline score'}
            value={isTradesea ? avgWinLossRatio.toFixed(2) : '100%'}
            hint={isTradesea ? 'Average winning trade ÷ average losing trade' : 'No rule violations recorded'}
            tone={isTradesea ? (avgWinLossRatio >= 1 ? 'positive' : 'neutral') : 'positive'}
          />
        </div>

        {isTradesea ? (
          <Surface className="mt-4 p-4 sm:p-5">
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                Connected Tradesea account
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Account', tradeseaAccount?.name || tradeseaAccount?.label || '—'],
                ['Prop firm', tradeseaAccount?.propFirmDisplayName || tradeseaAccount?.propFirm || 'Tradesea'],
                ['Account type', tradeseaAccount?.accountType || 'Live'],
                ['Statistics source', 'Tradesea TradeLens'],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-lg border px-4 py-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#71717A]">{label}</p>
                  <p className={`mt-1 truncate text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>{value}</p>
                </div>
              ))}
            </div>
          </Surface>
        ) : (
          <Surface className="mt-4 p-4 sm:p-5">
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <h2 className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}>
                Evaluation and prop-firm guardrails
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <ProgressRow
                label="Profit target"
                value={profitTargetProgress}
                detail={account?.rules.profitTarget ? `${formatPnl(Math.max(0, pnl))} / ${formatPnl(account.rules.profitTarget)}` : 'Funded'}
              />
              <ProgressRow
                label={`${account?.rules.drawdownType === 'intraday' ? 'Trailing' : 'Static'} drawdown`}
                value={drawdownProgress}
                detail={`${formatPnl(drawdownUsed)} used`}
                tone={drawdownProgress > 70 ? 'red' : 'amber'}
              />
              <ProgressRow
                label="Daily loss limit"
                value={0}
                detail={account?.rules.lockoutEnabled ? formatPnl(account.rules.sessionDailyLossLimit ?? account.rules.dailyLossLimit ?? 0) : 'Not enabled'}
                tone="amber"
              />
              <ProgressRow
                label="Consistency"
                value={Math.min(100, account?.rules.consistencyPct ?? 100)}
                detail={account?.rules.consistencyPct ? `${account.rules.consistencyPct}% max day` : 'No limit'}
                tone="emerald"
              />
            </div>
          </Surface>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="grid gap-4 xl:col-span-2">
            <Surface className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    Cumulative P&L
                  </h2>
                  <p className={`mt-1 text-xs ${isDark ? 'text-[#71717A]' : 'text-[#71717A]'}`}>
                    Last 20 recorded sessions
                  </p>
                </div>
                <LineChart className="h-4 w-4 text-blue-500" />
              </div>
              <div
                className={`h-52 rounded-lg border p-3 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                  aria-label="Cumulative profit and loss chart"
                >
                  <line
                    x1="0"
                    y1="88"
                    x2="100"
                    y2="88"
                    stroke={isDark ? '#27272A' : '#E4E4E7'}
                    strokeWidth="0.7"
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={isDark ? '#3B82F6' : '#2563EB'}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            </Surface>

            <Surface className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2
                  className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                >
                  Daily P&L
                </h2>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex h-28 items-end gap-1.5 overflow-hidden">
                {(days.length ? days.slice(-20) : [{ date: '', pnl: 0 }]).map((day, index) => {
                  const max = Math.max(...days.map((item) => Math.abs(item.pnl)), 1)
                  return (
                    <div
                      key={`${day.date}-${index}`}
                      title={`${day.date}: ${day.pnl}`}
                      className={`min-w-2 flex-1 rounded-t ${day.pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ height: `${Math.max(4, (Math.abs(day.pnl) / max) * 100)}%` }}
                    />
                  )
                })}
              </div>
            </Surface>
          </div>

          <Surface className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <div>
                  <h2
                    className={`text-sm font-semibold ${isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'}`}
                  >
                    P&amp;L calendar
                  </h2>
                  <p className="mt-0.5 text-[10px] text-[#71717A]">
                    {calendarLabel} total{' '}
                    <span
                      className={`font-semibold tabular-nums ${calendarMonthPnl > 0 ? 'text-emerald-500' : calendarMonthPnl < 0 ? 'text-red-500' : isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}
                    >
                      {formatPnl(calendarMonthPnl)}
                    </span>
                  </p>
                </div>
              </div>
              <div
                className={`flex items-center rounded-lg border ${isDark ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'}`}
              >
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))
                  }
                  className={`flex h-8 w-8 items-center justify-center ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span
                  className={`min-w-28 border-x px-2 text-center text-xs font-semibold ${isDark ? 'border-[#3F3F46] text-[#FAFAFA]' : 'border-[#E4E4E7] text-[#09090B]'}`}
                >
                  {calendarLabel}
                </span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))
                  }
                  className={`flex h-8 w-8 items-center justify-center ${isDark ? 'text-[#A1A1AA] hover:bg-[#27272A]' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_3.6rem] gap-1 text-center text-[10px]">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <span key={`${day}-${index}`} className="py-1 text-[#71717A]">
                  {day}
                </span>
              ))}
              <span className="py-1 text-[#71717A]">Week</span>
              {calendarWeeks.flatMap((week, weekIndex) => {
                const weekPnl = week.reduce((total, cell) => total + (cell.pnl ?? 0), 0)
                return [
                  ...week.map((cell) => (
                    <div
                      key={cell.date.toISOString()}
                      className={`min-h-12 rounded-md border p-1 text-left ${!cell.inMonth ? 'border-transparent opacity-30' : cell.pnl != null ? (cell.pnl >= 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10') : isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]'}`}
                    >
                      <span className="block text-[10px] text-[#71717A]">
                        {cell.date.getDate()}
                      </span>
                      {cell.pnl != null && (
                        <span
                          className={`mt-1 block truncate text-[10px] font-semibold tabular-nums ${cell.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                          {formatPnl(cell.pnl)}
                        </span>
                      )}
                    </div>
                  )),
                  <div
                    key={`week-${weekIndex}`}
                    className={`flex min-h-12 flex-col justify-center rounded-md border px-1 ${isDark ? 'border-[#27272A] bg-[#121215]' : 'border-[#E4E4E7] bg-[#FAFAFA]'}`}
                  >
                    <span className="text-[9px] text-[#71717A]">W{weekIndex + 1}</span>
                    <span
                      className={`mt-1 truncate text-[10px] font-semibold tabular-nums ${weekPnl > 0 ? 'text-emerald-500' : weekPnl < 0 ? 'text-red-500' : isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}
                    >
                      {formatPnl(weekPnl)}
                    </span>
                  </div>,
                ]
              })}
            </div>
          </Surface>
        </div>
      </main>
    </WorkspaceShell>
  )
}
