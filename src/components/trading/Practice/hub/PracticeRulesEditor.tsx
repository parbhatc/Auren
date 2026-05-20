import type { PracticeAccountMode, PracticeAccountRules } from '../../../../constants/practice'
import { t } from '../../../../utils/translator'

export default function PracticeRulesEditor({
  isDark,
  rules,
  mode,
  defaults,
  onChange,
  onReset,
}: {
  isDark: boolean
  rules: PracticeAccountRules
  mode: PracticeAccountMode
  defaults: PracticeAccountRules
  onChange: (r: PracticeAccountRules) => void
  onReset: () => void
}) {
  const inputClass = `no-spinner w-full px-3 py-2.5 rounded-xl border text-sm ${
    isDark ? 'bg-slate-900/80 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
  }`

  return (
    <div
      className={`grid sm:grid-cols-2 gap-3 mb-4 p-4 rounded-xl border ${
        isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <label className="text-xs">
        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('practice.rules.profitTarget')}</span>
        <input
          type="number"
          disabled={mode === 'funded'}
          value={rules.profitTarget ?? ''}
          onChange={(e) =>
            onChange({ ...rules, profitTarget: e.target.value ? Number(e.target.value) : null })
          }
          className={`${inputClass} mt-1`}
          placeholder={defaults.profitTarget?.toString() ?? '—'}
        />
      </label>
      <label className="text-xs">
        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('practice.hub.maxLoss')}</span>
        <input
          type="number"
          value={rules.maxLoss}
          onChange={(e) => onChange({ ...rules, maxLoss: Number(e.target.value) || defaults.maxLoss })}
          className={`${inputClass} mt-1`}
        />
      </label>
      <label className="text-xs">
        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('practice.rules.consistency')}</span>
        <input
          type="number"
          value={rules.consistencyPct ?? ''}
          onChange={(e) =>
            onChange({
              ...rules,
              consistencyPct: e.target.value ? Number(e.target.value) : null,
            })
          }
          className={`${inputClass} mt-1`}
          placeholder={mode === 'funded' ? 'Optional' : undefined}
        />
      </label>
      <label className="text-xs">
        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('practice.hub.drawdownType')}</span>
        <select
          value={rules.drawdownType}
          onChange={(e) => onChange({ ...rules, drawdownType: e.target.value as 'eod' | 'intraday' })}
          className={`${inputClass} mt-1`}
        >
          <option value="eod">EOD trailing</option>
          <option value="intraday">Intraday</option>
        </select>
      </label>
      <div className="sm:col-span-2 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className={`text-xs px-3 py-1.5 rounded-lg border ${
            isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-600'
          }`}
        >
          {t('practice.hub.resetRules')}
        </button>
      </div>
    </div>
  )
}
