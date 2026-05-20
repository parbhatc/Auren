import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react'
import type { PracticeAccountMode, PracticeAccountRules } from '../../../../constants/practice'
import {
  commitPracticeRulesFromForm,
  validatePracticeFormTexts,
} from '../../../../services/practice/validatePracticeRules'
import { resolvePracticePlanLimits, type PracticeAccountSize } from '../../../../services/practice/practicePlans'
import { settingsInsetClass } from '../../../../styles/aurenTheme'
import { t } from '../../../../utils/translator'
import PracticeSwitch from '../PracticeSwitch'

const CONTROL_W = 'w-[8.5rem]'

export type PracticeInlineRulesFormHandle = {
  commitPending: () => PracticeAccountRules
  validate: () => string | null
}

function RuleRow({
  label,
  hint,
  children,
  isDark,
}: {
  label: string
  hint?: string
  children: ReactNode
  isDark: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-2.5 border-b last:border-b-0 border-dashed border-slate-500/20">
      <div className="min-w-0">
        <span className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          {label}
        </span>
        {hint ? (
          <span className={`block text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex justify-end items-center shrink-0">{children}</div>
    </div>
  )
}

function fieldClass(isDark: boolean, invalid?: boolean): string {
  return `no-spinner h-10 min-h-[2.5rem] px-2.5 rounded-lg border text-sm leading-normal tabular-nums ${
    invalid
      ? 'border-red-500/70 focus:ring-red-500/40'
      : isDark
        ? 'border-slate-700/90 focus:ring-violet-500/35'
        : 'border-slate-300 focus:ring-violet-500/40'
  } ${
    isDark
      ? 'bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2'
      : 'bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2'
  }`
}

function readonlyValueClass(isDark: boolean): string {
  return `text-sm font-semibold tabular-nums text-right ${isDark ? 'text-slate-100' : 'text-slate-900'}`
}

function numText(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? String(value) : ''
}

const PracticeInlineRulesForm = forwardRef<
  PracticeInlineRulesFormHandle,
  {
    isDark: boolean
    mode: PracticeAccountMode
    size: PracticeAccountSize
    rules: PracticeAccountRules
    defaults: PracticeAccountRules
    onChange: (r: PracticeAccountRules) => void
    onReset?: () => void
    validationError?: string | null
  }
>(function PracticeInlineRulesForm(
  { isDark, mode, size, rules, defaults, onChange, onReset, validationError },
  ref
) {
  const planLimits = resolvePracticePlanLimits(size, defaults)
  const limits = resolvePracticePlanLimits(size, rules)

  const [profitTargetText, setProfitTargetText] = useState(() => numText(rules.profitTarget))
  const [maxLossText, setMaxLossText] = useState(() => numText(rules.maxLoss))
  const [consistencyText, setConsistencyText] = useState(() => numText(rules.consistencyPct))
  const [maxMinisText, setMaxMinisText] = useState(() => String(limits.maxMinis))
  const [maxMicrosText, setMaxMicrosText] = useState(() => String(limits.maxMicros))
  const [dailyLossLimitText, setDailyLossLimitText] = useState(() =>
    rules.dailyLossLimit != null ? String(rules.dailyLossLimit) : ''
  )
  const [maxTradesText, setMaxTradesText] = useState(() =>
    rules.maxTradesPerDay != null ? String(rules.maxTradesPerDay) : ''
  )

  useEffect(() => {
    setProfitTargetText(numText(rules.profitTarget))
    setMaxLossText(numText(rules.maxLoss))
    setConsistencyText(numText(rules.consistencyPct))
    const lim = resolvePracticePlanLimits(size, rules)
    setMaxMinisText(String(lim.maxMinis))
    setMaxMicrosText(String(lim.maxMicros))
    setDailyLossLimitText(rules.dailyLossLimit != null ? String(rules.dailyLossLimit) : '')
    setMaxTradesText(rules.maxTradesPerDay != null ? String(rules.maxTradesPerDay) : '')
  }, [rules, size, mode, defaults])

  const formTexts = () => ({
    profitTarget: profitTargetText,
    maxLoss: maxLossText,
    consistencyPct: consistencyText,
    maxMinis: maxMinisText,
    maxMicros: maxMicrosText,
    dailyLossLimit: dailyLossLimitText,
    maxTradesPerDay: maxTradesText,
  })

  const commitPending = (): PracticeAccountRules =>
    commitPracticeRulesFromForm(rules, formTexts(), mode, size, defaults)

  useImperativeHandle(ref, () => ({
    commitPending,
    validate: () => validatePracticeFormTexts(formTexts(), mode),
  }))

  const inputClass = (invalid?: boolean) => `${fieldClass(isDark, invalid)} text-right ${CONTROL_W}`
  const selectClass = `${fieldClass(isDark)} ${CONTROL_W} py-0`

  const showInvalid = Boolean(validationError)

  return (
    <div className={settingsInsetClass(isDark)}>
      <p
        className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
          isDark ? 'text-slate-500' : 'text-slate-500'
        }`}
      >
        {t('practice.hub.confirmCreateRules')}
      </p>

      {validationError ? (
        <p
          className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            isDark
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role="alert"
        >
          {validationError}
        </p>
      ) : null}

      <RuleRow label={t('practice.rules.profitTarget')} isDark={isDark}>
        {mode === 'eval' ? (
          <input
            type="text"
            inputMode="numeric"
            value={profitTargetText}
            onChange={(e) => setProfitTargetText(e.target.value.replace(/[^\d.]/g, ''))}
            className={inputClass(showInvalid && !profitTargetText.trim())}
            placeholder={numText(defaults.profitTarget) || 'Required'}
          />
        ) : (
          <span className={readonlyValueClass(isDark)}>N/A</span>
        )}
      </RuleRow>

      <RuleRow label={t('practice.hub.maxLoss')} hint="Trailing · End of day" isDark={isDark}>
        <input
          type="text"
          inputMode="numeric"
          value={maxLossText}
          onChange={(e) => setMaxLossText(e.target.value.replace(/[^\d.]/g, ''))}
          className={inputClass(showInvalid && !maxLossText.trim())}
          placeholder={numText(defaults.maxLoss) || 'Required'}
        />
      </RuleRow>

      <RuleRow
        label={t('practice.rules.consistency')}
        hint={
          mode === 'funded'
            ? 'Optional for funded'
            : t('practice.rules.consistencyHint')
        }
        isDark={isDark}
      >
        <div className={`flex items-center justify-end gap-1 ${CONTROL_W}`}>
          <input
            type="text"
            inputMode="numeric"
            value={consistencyText}
            onChange={(e) => setConsistencyText(e.target.value.replace(/[^\d.]/g, ''))}
            className={`${fieldClass(isDark, showInvalid && mode === 'eval' && !consistencyText.trim())} flex-1 min-w-0 text-right`}
            placeholder={
              mode === 'eval' ? numText(defaults.consistencyPct) || 'Required' : 'None'
            }
          />
          <span className={`text-sm font-medium shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            %
          </span>
        </div>
      </RuleRow>

      <RuleRow label="Max Size" hint="Minis / Micros" isDark={isDark}>
        <div className={`flex items-center gap-1 ${CONTROL_W}`}>
          <input
            type="text"
            inputMode="numeric"
            title="Max minis"
            value={maxMinisText}
            onChange={(e) => setMaxMinisText(e.target.value.replace(/\D/g, ''))}
            className={`${fieldClass(isDark)} w-12 flex-1 min-w-0 text-center text-xs`}
          />
          <span className={`text-[10px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>m</span>
          <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
          <input
            type="text"
            inputMode="numeric"
            title="Max micros"
            value={maxMicrosText}
            onChange={(e) => setMaxMicrosText(e.target.value.replace(/\D/g, ''))}
            className={`${fieldClass(isDark)} w-12 flex-1 min-w-0 text-center text-xs`}
          />
          <span className={`text-[10px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>mc</span>
        </div>
      </RuleRow>

      <RuleRow label="Drawdown" isDark={isDark}>
        <select
          value={rules.drawdownType}
          onChange={(e) => onChange({ ...rules, drawdownType: e.target.value as 'eod' | 'intraday' })}
          className={selectClass}
        >
          <option value="eod">End of Day</option>
          <option value="intraday">Intraday</option>
        </select>
      </RuleRow>

      <RuleRow
        label={t('practice.lockout.dailyLossLimitLabel')}
        hint={t('practice.lockout.dailyLossLimitHint')}
        isDark={isDark}
      >
        <div className={`flex flex-col items-end gap-2 ${CONTROL_W}`}>
          <PracticeSwitch
            checked={rules.lockoutEnabled === true}
            onChange={(on) => onChange({ ...rules, lockoutEnabled: on })}
            isDark={isDark}
            label={t('practice.lockout.enableLockouts')}
          />
          <input
            type="text"
            inputMode="numeric"
            disabled={rules.lockoutEnabled !== true}
            value={dailyLossLimitText}
            onChange={(e) => setDailyLossLimitText(e.target.value.replace(/[^\d.]/g, ''))}
            className={`${fieldClass(isDark)} w-full text-right disabled:opacity-40`}
            placeholder="—"
          />
        </div>
      </RuleRow>

      <RuleRow
        label={t('practice.lockout.maxTradesLabel')}
        hint={t('practice.lockout.maxTradesHint')}
        isDark={isDark}
      >
        <input
          type="text"
          inputMode="numeric"
          value={maxTradesText}
          onChange={(e) => setMaxTradesText(e.target.value.replace(/\D/g, ''))}
          className={inputClass()}
          placeholder={t('practice.lockout.maxTradesPlaceholder')}
        />
      </RuleRow>

      {onReset && (
        <div className="flex justify-end pt-3 mt-1">
          <button
            type="button"
            onClick={() => onReset()}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              isDark
                ? 'border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                : 'border-slate-300 text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {t('practice.hub.resetRules')}
          </button>
        </div>
      )}
    </div>
  )
})

export default PracticeInlineRulesForm
