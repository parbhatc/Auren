import {
  getPracticePlanCardTitle,
  getPracticeSizeCardStats,
  practicePlanCardBorderClass,
  practicePlanCardTitleClass,
  type PracticeAccountMode,
  type PracticeAccountRules,
  type PracticeAccountSize,
} from '../../../services/practice/practicePlans'

export default function PlanSizeCard({
  size,
  mode,
  selected,
  isDark,
  onSelect,
  customRules,
}: {
  size: PracticeAccountSize
  mode: PracticeAccountMode
  selected: boolean
  isDark: boolean
  onSelect: () => void
  customRules?: Partial<PracticeAccountRules>
}) {
  const stats = getPracticeSizeCardStats(size, mode, customRules)
  const title = getPracticePlanCardTitle(size, mode)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl border p-4 transition-all w-full ${practicePlanCardBorderClass(mode, selected, isDark)}`}
    >
      <p
        className={`text-lg font-bold tracking-wide ${practicePlanCardTitleClass(mode, isDark)} ${
          selected ? '' : isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </p>
      <ul className={`mt-3 space-y-1.5 text-[11px] leading-snug`}>
        {stats.map((row) => (
          <li key={row.label} className="flex justify-between gap-2">
            <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>{row.label}</span>
            <span
              className={`font-medium text-right tabular-nums ${
                row.value === '—'
                  ? isDark
                    ? 'text-slate-600'
                    : 'text-slate-400'
                  : isDark
                    ? 'text-slate-200'
                    : 'text-slate-800'
              }`}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </button>
  )
}
