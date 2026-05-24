import { RotateCcw } from 'lucide-react'
import {
  getPracticeAccountById,
  resetPracticeAccount,
  type PracticeAccount,
} from '../../../constants/practice'
import { getPracticePlanFromAccount } from '../../../services/practice/practicePlans'
import { evaluatePracticeRules, practiceBestDaySharePct } from '../../../services/practice/practiceRules'
import { t } from '../../../utils/translator'

export function RulesPanel({
  practiceAccountId,
  isDark,
  onReset,
}: {
  practiceAccountId: string
  isDark: boolean
  onReset?: () => void
}) {
  const account = getPracticeAccountById(practiceAccountId)
  if (!account) return null

  const plan = getPracticePlanFromAccount(account)
  const rules = evaluatePracticeRules(account)

  const statusColor =
    account.status === 'passed'
      ? 'text-emerald-500'
      : account.status === 'blown'
        ? 'text-red-500'
        : isDark
          ? 'text-blue-400'
          : 'text-blue-600'

  return (
    <div className={`p-3 sm:p-4 space-y-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-semibold capitalize ${statusColor}`}>{account.status}</span>
        <button
          type="button"
          onClick={() => {
            void resetPracticeAccount(practiceAccountId).then(() => onReset?.())
          }}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
            isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'
          }`}
        >
          <RotateCcw className="w-3 h-3" />
          {t('practice.hub.reset')}
        </button>
      </div>

      <dl className="space-y-1.5 text-xs">
        <Row label={t('practice.hub.mode')} value={account.mode === 'eval' ? t('practice.hub.eval') : t('practice.hub.funded')} isDark={isDark} />
        <Row label={t('practice.hub.size')} value={plan.label.split(' ')[0]} isDark={isDark} />
        <Row
          label={t('practice.hub.balance')}
          value={`$${account.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          isDark={isDark}
        />
        <Row
          label="P/L"
          value={`${rules.totalProfit >= 0 ? '+' : ''}$${rules.totalProfit.toFixed(0)}`}
          isDark={isDark}
        />
        {plan.profitTarget != null && (
          <Row
            label={t('practice.rules.profitTarget')}
            value={`$${plan.profitTarget.toLocaleString()}`}
            isDark={isDark}
          />
        )}
        <Row
          label={t('practice.rules.drawdownFloor')}
          value={`$${rules.drawdownFloor.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          isDark={isDark}
        />
        <Row
          label={t('practice.rules.cushion')}
          value={`$${rules.cushion.toFixed(0)}`}
          isDark={isDark}
        />
        {rules.consistencyRequired != null && (
          <Row
            label={t('practice.rules.consistency')}
            value={(() => {
              const share = practiceBestDaySharePct(rules)
              const limit = rules.consistencyRequired
              const head = share != null ? `${share.toFixed(1)}%` : '—'
              return limit != null ? `${head} · ${limit}% limit` : head
            })()}
            isDark={isDark}
          />
        )}
      </dl>

      {rules.consistencyMessage && account.status === 'active' && (
        <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{rules.consistencyMessage}</p>
      )}

      {rules.passed && (
        <p className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
          {t('practice.rules.passed')}
        </p>
      )}
      {rules.blown && (
        <p className={`text-xs font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
          {t('practice.rules.blown')}
        </p>
      )}

      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {t('practice.rules.liveHint')}
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  isDark,
}: {
  label: string
  value: string
  isDark: boolean
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
