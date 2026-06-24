import { t } from '../../../../utils/translator'
import type { HubHomeMode } from '../../../../types/practiceHub'

export default function HubModeSwitch({
  mode,
  onModeChange,
  isDark,
}: {
  mode: HubHomeMode
  onModeChange: (mode: HubHomeMode) => void
  isDark: boolean
}) {
  const shell = isDark
    ? 'bg-slate-900/90 ring-1 ring-slate-800'
    : 'bg-slate-100/90 ring-1 ring-slate-200/80'

  const items: { id: HubHomeMode; labelKey: string }[] = [
    { id: 'practice', labelKey: 'live.hub.modePractice' },
    { id: 'live', labelKey: 'live.hub.modeLive' },
  ]

  return (
    <div className={`inline-flex w-full sm:w-auto p-1 rounded-xl gap-0.5 ${shell}`} role="tablist" aria-label="Trading mode">
      {items.map(({ id, labelKey }) => {
        const active = mode === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onModeChange(id)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              active
                ? id === 'live'
                  ? isDark
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                    : 'bg-white text-violet-700 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}
