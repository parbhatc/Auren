import { useCallback, useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import {
  getPracticeAccountById,
  type PracticeAccount,
} from '../../../constants/practice'
import { getPracticePlanFromAccount } from '../../../services/practice/practicePlans'
import {
  evaluatePracticeRules,
  formatPracticeDollars,
  practiceBestDaySharePct,
} from '../../../services/practice/practiceRules'
import { t } from '../../../utils/translator'

function pctInRange(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

function formatMoney(amount: number, signed = false): string {
  const prefix = signed && amount > 0 ? '+' : signed && amount < 0 ? '' : ''
  return `${prefix}$${formatPracticeDollars(amount)}`
}

export function EvalStatsPanel({
  practiceAccountId,
  isDark,
}: {
  practiceAccountId: string
  isDark: boolean
}) {
  const [account, setAccount] = useState<PracticeAccount | undefined>(() =>
    getPracticeAccountById(practiceAccountId)
  )

  const sync = useCallback(() => {
    setAccount(getPracticeAccountById(practiceAccountId))
  }, [practiceAccountId])

  useEffect(() => {
    sync()
    const onChange = () => sync()
    window.addEventListener('practiceAccountsChanged', onChange)
    return () => window.removeEventListener('practiceAccountsChanged', onChange)
  }, [sync])

  if (!account || account.mode !== 'eval') return null

  const plan = getPracticePlanFromAccount(account)
  const rules = evaluatePracticeRules(account)
  const tradingDays = account.dayPnL.length

  const startBalance = plan.startingBalance
  const profitTarget = rules.profitTarget ?? plan.profitTarget
  const effectiveTarget = rules.effectiveProfitTarget ?? profitTarget
  const passBalance =
    effectiveTarget != null ? startBalance + effectiveTarget : startBalance
  const targetRaised =
    rules.effectiveProfitTarget != null &&
    rules.profitTarget != null &&
    rules.effectiveProfitTarget > rules.profitTarget
  const floor = rules.drawdownFloor
  const maxLoss = plan.maxLoss
  const balance = account.balance
  const balancePct = pctInRange(balance, floor, passBalance)

  const consistencyLimit = plan.consistencyPct ?? rules.consistencyRequired
  const bestDaySharePct = practiceBestDaySharePct(rules)
  const consistencyDisplay =
    bestDaySharePct != null ? `${bestDaySharePct.toFixed(1)}%` : '—'
  const consistencySub =
    consistencyLimit != null
      ? rules.profitableDaysCount < rules.minProfitableDaysRequired
        ? t('practice.evalStats.consistencyPending', {
            days: rules.profitableDaysCount,
            min: rules.minProfitableDaysRequired,
          })
        : `${consistencyLimit}% limit${!rules.consistencyOk && bestDaySharePct != null ? ' · over' : ''}`
      : undefined

  const statusLabel =
    account.status === 'passed'
      ? t('practice.hub.passed')
      : account.status === 'blown'
        ? t('practice.hub.blown')
        : rules.passed
          ? t('practice.rules.passed')
          : t('practice.hub.active')

  const statusClass =
    account.status === 'passed' || rules.passed
      ? isDark
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : account.status === 'blown' || rules.blown
        ? isDark
          ? 'text-red-400'
          : 'text-red-700'
        : isDark
          ? 'text-violet-300'
          : 'text-violet-700'

  const card = isDark
    ? 'bg-slate-900/80 border-slate-700/80'
    : 'bg-white/90 border-slate-200'

  const plClass =
    rules.totalProfit >= 0
      ? isDark
        ? 'text-emerald-400'
        : 'text-emerald-700'
      : isDark
        ? 'text-red-400'
        : 'text-red-700'

  return (
    <section
      className={`mb-4 rounded-xl border p-3 sm:p-4 space-y-4 ${card}`}
      aria-label={t('practice.evalStats.title')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target className={`w-4 h-4 shrink-0 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
          <h2 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('practice.evalStats.title')}
          </h2>
        </div>
        <span className={`text-xs font-semibold capitalize shrink-0 ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <MetricCell
          label={t('practice.evalStats.accountBalance')}
          value={formatMoney(balance)}
          isDark={isDark}
        />
        <MetricCell
          label={t('practice.evalStats.minimumBalance')}
          value={formatMoney(floor)}
          isDark={isDark}
        />
        <MetricCell
          label={t('practice.evalStats.totalPnl')}
          value={formatMoney(rules.totalProfit, true)}
          valueClassName={plClass}
          isDark={isDark}
        />
        <MetricCell
          label={t('practice.evalStats.tradingDays')}
          value={String(tradingDays)}
          isDark={isDark}
        />
        {consistencyLimit != null && (
          <MetricCell
            label={t('practice.rules.consistency')}
            value={consistencyDisplay}
            sub={consistencySub}
            valueClassName={
              !rules.consistencyOk && bestDaySharePct != null
                ? isDark
                  ? 'text-amber-400'
                  : 'text-amber-700'
                : undefined
            }
            isDark={isDark}
            className="col-span-2 sm:col-span-1"
          />
        )}
      </div>

      {effectiveTarget != null && passBalance > floor && (
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-end gap-1 sm:gap-2 text-[10px] uppercase tracking-wide font-semibold min-w-0">
            <div className={`min-w-0 shrink ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <span className="block">{t('practice.evalStats.start')}</span>
              <span className={`text-sm normal-case tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {formatMoney(startBalance)}
              </span>
            </div>
            <div className={`min-w-0 shrink text-center ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <span className="block">{t('practice.evalStats.mll')}</span>
              <span className={`text-sm normal-case tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {formatMoney(floor)}
              </span>
            </div>
            <div className={`min-w-0 shrink text-right ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              <span className="block">{t('practice.evalStats.target')}</span>
              <span
                className={`text-sm normal-case tabular-nums ${isDark ? 'text-violet-300' : 'text-violet-700'}`}
                title={
                  targetRaised && profitTarget != null
                    ? `Base target ${formatMoney(startBalance + profitTarget)}`
                    : undefined
                }
              >
                {formatMoney(passBalance)}
              </span>
            </div>
          </div>

          <div className="relative pt-1 pb-1">
            <div
              className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  rules.blown
                    ? 'bg-red-500'
                    : effectiveTarget != null && rules.totalProfit >= effectiveTarget
                      ? 'bg-emerald-500'
                      : isDark
                        ? 'bg-violet-500'
                        : 'bg-violet-600'
                }`}
                style={{ width: `${balancePct}%` }}
              />
            </div>
            <div
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${balancePct}%` }}
            >
              <span
                className={`w-0.5 h-3.5 rounded-full ${isDark ? 'bg-white' : 'bg-slate-900'}`}
                aria-hidden
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] sm:text-xs">
            <div>
              <p className={`uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.evalStats.drawdown')}
              </p>
              <p className={`font-semibold tabular-nums mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {formatMoney(floor)}
              </p>
            </div>
            <div>
              <p className={`uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.evalStats.balance')}
              </p>
              <p className={`font-semibold tabular-nums mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {formatMoney(balance)}
              </p>
            </div>
            <div>
              <p className={`uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {t('practice.evalStats.remaining')}
              </p>
              <p className={`font-semibold tabular-nums mt-0.5 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                {rules.profitRemaining != null
                  ? formatMoney(Math.max(0, rules.profitRemaining))
                  : '—'}
              </p>
            </div>
          </div>

          <p className={`text-[10px] text-center tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {t('practice.evalStats.startingLine', { amount: formatMoney(startBalance) })}
            {' · '}
            {t('practice.evalStats.cushionLine', {
              amount: formatMoney(rules.cushion),
              max: formatMoney(maxLoss),
            })}
          </p>
        </div>
      )}

      {rules.consistencyMessage && account.status === 'active' && (
        <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
          {rules.consistencyMessage}
        </p>
      )}

      {rules.blown && (
        <p className={`text-xs font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
          {t('practice.rules.blown')}
        </p>
      )}
      {rules.passed && (
        <p className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
          {t('practice.rules.passed')}
        </p>
      )}
    </section>
  )
}

function MetricCell({
  label,
  value,
  sub,
  isDark,
  valueClassName,
  className = '',
}: {
  label: string
  value: string
  sub?: string
  isDark: boolean
  valueClassName?: string
  className?: string
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-2 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'} ${className}`}
    >
      <p className={`text-[10px] uppercase tracking-wide leading-tight ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {label}
      </p>
      <p
        className={`text-sm sm:text-base font-semibold tabular-nums mt-0.5 ${
          valueClassName ?? (isDark ? 'text-slate-100' : 'text-slate-900')
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className={`text-[10px] mt-0.5 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}
