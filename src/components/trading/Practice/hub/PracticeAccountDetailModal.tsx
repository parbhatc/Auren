import { useEffect, useState, type ReactNode } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import {
  evaluatePracticeRules,
  getPracticeAccountDisplayTitle,
  getPracticeMarketDataSettings,
  type PracticeAccount,
} from '../../../../constants/practice'
import { practiceAPI } from '../../../../api/practice.api'
import { getPracticePlanFromAccount, formatPracticeSize } from '../../../../services/practice/practicePlans'
import {
  formatPracticeDollars,
  practiceBestDaySharePct,
} from '../../../../services/practice/practiceRules'
import { t } from '../../../../utils/translator'
import { ghostButtonClass, primaryButtonClass } from '../../../../styles/aurenTheme'
import Modal from '../../../ui/Modal'

function StatCard({
  label,
  value,
  sub,
  isDark,
  accent,
}: {
  label: string
  value: string
  sub?: string
  isDark: boolean
  accent?: 'profit' | 'loss' | 'neutral'
}) {
  const valueClass =
    accent === 'profit'
      ? 'text-emerald-400'
      : accent === 'loss'
        ? 'text-red-400'
        : isDark
          ? 'text-slate-100'
          : 'text-slate-900'

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {sub ? (
        <p className={`mt-0.5 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{sub}</p>
      ) : null}
    </div>
  )
}

function DetailSection({
  title,
  isDark,
  children,
}: {
  title: string
  isDark: boolean
  children: ReactNode
}) {
  return (
    <section>
      <h3
        className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${
          isDark ? 'text-slate-500' : 'text-slate-500'
        }`}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function PracticeAccountDetailModal({
  account,
  isDark,
  onClose,
  onTrade,
  onGoToStats,
}: {
  account: PracticeAccount
  isDark: boolean
  onClose: () => void
  onTrade: () => void
  onGoToStats: (accountId: string) => void
}) {
  const [winRate, setWinRate] = useState<string | null>(null)
  const [totalTrades, setTotalTrades] = useState<number | null>(null)

  const plan = getPracticePlanFromAccount(account)
  const rules = evaluatePracticeRules(account)
  const title = getPracticeAccountDisplayTitle(account)
  const chartLabel =
    getPracticeMarketDataSettings().accountLabel || account.marketDataAccountLabel || 'â€”'
  const isTerminal = account.status === 'blown' || account.status === 'passed'

  const statusBadgeClass =
    account.status === 'passed'
      ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
      : account.status === 'blown'
        ? 'bg-red-500/15 text-red-400 ring-red-500/30'
        : isDark
          ? 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
          : 'bg-violet-100 text-violet-700 ring-violet-200'

  const pnlAccent = rules.totalProfit > 0 ? 'profit' : rules.totalProfit < 0 ? 'loss' : 'neutral'

  useEffect(() => {
    let cancelled = false
    void practiceAPI.getStats(account.id).then((res) => {
      if (cancelled || !res) return
      const stats = 'stats' in res && res.stats ? res.stats : res
      if (stats && typeof stats === 'object') {
        if ('winRate' in stats && stats.winRate != null) setWinRate(`${Number(stats.winRate).toFixed(1)}%`)
        if ('totalTrades' in stats && stats.totalTrades != null) setTotalTrades(stats.totalTrades as number)
      }
    })
    return () => {
      cancelled = true
    }
  }, [account.id])

  const consistencyLimit = rules.consistencyRequired
  const consistencyShare = practiceBestDaySharePct(rules)
  const consistencyValue =
    consistencyLimit == null
      ? 'Off'
      : consistencyShare != null
        ? `${consistencyShare.toFixed(1)}%`
        : '—'
  const consistencySub =
    consistencyLimit != null ? `${consistencyLimit}% limit` : undefined
  const displayProfitTarget =
    rules.effectiveProfitTarget != null &&
    rules.profitTarget != null &&
    rules.effectiveProfitTarget > rules.profitTarget
      ? rules.effectiveProfitTarget
      : plan.profitTarget
  const profitTargetSub =
    displayProfitTarget != null &&
    plan.profitTarget != null &&
    displayProfitTarget > plan.profitTarget
      ? `Base $${formatPracticeDollars(plan.profitTarget)}`
      : undefined

  return (
    <Modal
      isOpen
      isDark={isDark}
      onClose={onClose}
      title={title}
      subtitle={
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClass}`}>
          {account.status}
        </span>
      }
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className={`flex-1 ${ghostButtonClass(isDark)}`}>
            {t('common.cancel')}
          </button>
          {isTerminal ? (
            <button
              type="button"
              onClick={() => onGoToStats(account.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 ${primaryButtonClass()}`}
            >
              <BarChart3 className="w-4 h-4" />
              {t('practice.trade.statsPage')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onTrade}
              className={`flex-1 flex items-center justify-center gap-1.5 ${primaryButtonClass()}`}
            >
              <TrendingUp className="w-4 h-4" />
              {t('practice.hub.trade')}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <DetailSection title="Performance" isDark={isDark}>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label={t('practice.hub.balance')}
              value={`$${formatPracticeDollars(account.balance)}`}
              isDark={isDark}
            />
            <StatCard
              label="Total P/L"
              value={`${rules.totalProfit >= 0 ? '+' : ''}$${formatPracticeDollars(rules.totalProfit)}`}
              isDark={isDark}
              accent={pnlAccent}
            />
            <StatCard label="Trades" value={totalTrades != null ? String(totalTrades) : 'â€¦'} isDark={isDark} />
            <StatCard label="Win rate" value={winRate ?? 'â€¦'} isDark={isDark} />
          </div>
        </DetailSection>

        <DetailSection title="Rules" isDark={isDark}>
          <div className="grid grid-cols-2 gap-2">
            {displayProfitTarget != null ? (
              <StatCard
                label={t('practice.rules.profitTarget')}
                value={`$${formatPracticeDollars(displayProfitTarget)}`}
                sub={profitTargetSub}
                isDark={isDark}
              />
            ) : null}
            <StatCard
              label={t('practice.hub.maxLoss')}
              value={`$${formatPracticeDollars(plan.maxLoss)}`}
              isDark={isDark}
            />
            <StatCard
              label={t('practice.rules.drawdownFloor')}
              value={`$${formatPracticeDollars(rules.drawdownFloor)}`}
              isDark={isDark}
            />
            <StatCard
              label={t('practice.rules.cushion')}
              value={`$${formatPracticeDollars(rules.cushion)}`}
              isDark={isDark}
            />
            {account.mode === 'eval' ? (
              <StatCard
                label={t('practice.rules.consistency')}
                value={consistencyValue}
                sub={consistencySub}
                isDark={isDark}
              />
            ) : null}
          </div>
        </DetailSection>

        <DetailSection title="Account" isDark={isDark}>
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm space-y-2 ${
              isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex justify-between gap-3">
              <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.hub.mode')}</span>
              <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {account.mode === 'eval' ? t('practice.hub.eval') : t('practice.hub.funded')}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.hub.size')}</span>
              <span className={`font-medium tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {formatPracticeSize(account.size)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Chart data</span>
              <span
                className={`font-medium text-right text-xs leading-snug max-w-[65%] truncate ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
                title={chartLabel}
              >
                {chartLabel}
              </span>
            </div>
          </div>
        </DetailSection>

        {rules.consistencyMessage && account.status === 'active' ? (
          <p
            className={`text-xs rounded-lg px-3 py-2 ${
              isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {rules.consistencyMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

