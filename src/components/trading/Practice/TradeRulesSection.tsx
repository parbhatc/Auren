import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getPracticeAccountById,
  updatePracticeAccount,
  type PracticeAccount,
} from '../../../constants/practice'
import { evaluatePracticeRules, formatPracticeDollars } from '../../../services/practice/practiceRules'
import {
  formatPracticeSize,
  getDefaultPracticeRules,
  getPracticePlanFromAccount,
  practicePlanCardTitleClass,
} from '../../../services/practice/practicePlans'
import { t } from '../../../utils/translator'
import InlineRulesForm from './hub/InlineRulesForm'

export default function TradeRulesSection({
  practiceAccountId,
  isDark,
}: {
  practiceAccountId: string
  isDark: boolean
}) {
  const [account, setAccount] = useState<PracticeAccount | undefined>(() =>
    getPracticeAccountById(practiceAccountId)
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sync = useCallback(() => {
    setAccount(getPracticeAccountById(practiceAccountId))
  }, [practiceAccountId])

  useEffect(() => {
    sync()
    const onChange = () => sync()
    window.addEventListener('practiceAccountsChanged', onChange)
    return () => window.removeEventListener('practiceAccountsChanged', onChange)
  }, [sync])

  const plan = account ? getPracticePlanFromAccount(account) : null
  const rulesState = account?.rules ?? plan
  const defaults = useMemo(
    () => (account ? getDefaultPracticeRules(account.size, account.mode) : null),
    [account]
  )

  const status = account ? evaluatePracticeRules(account) : null
  const profitTarget = plan?.profitTarget ?? rulesState.profitTarget

  const persistRules = useCallback(
    (next: NonNullable<typeof rulesState>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void updatePracticeAccount(practiceAccountId, { rules: next }).then(() => sync())
      }, 400)
    },
    [practiceAccountId, sync]
  )

  if (!account || !rulesState || !defaults) return null

  const title = `${formatPracticeSize(account.size)} | ${account.mode === 'eval' ? 'EVAL' : 'FUNDED'}`

  return (
    <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className={`p-3 sm:p-4 space-y-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        <div className="flex items-center justify-between gap-2">
          <h4 className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Account rules
          </h4>
          <span className={`text-[10px] font-bold uppercase ${practicePlanCardTitleClass(account.mode, isDark)}`}>
            {account.status}
          </span>
        </div>

        <p className={`text-sm font-bold ${practicePlanCardTitleClass(account.mode, isDark)}`}>{title}</p>
        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          {account.mode === 'eval' ? t('practice.hub.eval') : t('practice.hub.funded')}
          {' · '}
          {formatPracticeSize(account.size)}
        </p>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div>
            <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.hub.balance')}</dt>
            <dd className="font-semibold tabular-nums">${formatPracticeDollars(account.balance)}</dd>
          </div>
          <div>
            <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>Realized P/L</dt>
            <dd className="font-semibold tabular-nums">
              {status && status.totalProfit >= 0 ? '+' : ''}${formatPracticeDollars(status?.totalProfit ?? 0)}
            </dd>
          </div>
          {profitTarget != null && account.mode === 'eval' && (
            <div>
              <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.rules.profitTarget')}</dt>
              <dd className="font-semibold tabular-nums">${formatPracticeDollars(profitTarget)}</dd>
            </div>
          )}
          {account.mode === 'eval' && status?.profitRemaining != null && account.status === 'active' && (
            <div>
              <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.hub.toTarget')}</dt>
              <dd className="font-semibold tabular-nums text-emerald-500">
                ${formatPracticeDollars(status.profitRemaining)}
              </dd>
            </div>
          )}
          <div>
            <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.rules.cushion')}</dt>
            <dd className="font-semibold tabular-nums">${formatPracticeDollars(status?.cushion ?? 0)}</dd>
          </div>
          <div>
            <dt className={isDark ? 'text-slate-500' : 'text-slate-500'}>{t('practice.rules.drawdownFloor')}</dt>
            <dd className="font-semibold tabular-nums">${formatPracticeDollars(status?.drawdownFloor ?? 0)}</dd>
          </div>
        </dl>

        <InlineRulesForm
          isDark={isDark}
          mode={account.mode}
          size={account.size}
          rules={rulesState}
          defaults={defaults}
          compact
          onChange={(next) => {
            setAccount({ ...account, rules: next })
            persistRules(next)
          }}
          onReset={() => {
            const reset = getDefaultPracticeRules(account.size, account.mode)
            setAccount({ ...account, rules: reset })
            persistRules(reset)
          }}
        />

        {status?.consistencyMessage && account.status === 'active' && (
          <p className={`text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            {status.consistencyMessage}
          </p>
        )}
      </div>
    </div>
  )
}
