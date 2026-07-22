import { t } from '../../../../utils/translator'
import type { HubHomeMode } from '../../../../types/practiceHub'

function activeTabClass(id: HubHomeMode, isDark: boolean): string {
  void id
  return isDark
    ? 'bg-blue-500 text-white'
    : 'bg-white text-blue-700'
}

function tabLabel(labelKey: string, fallback: string): string {
  const translated = t(labelKey)
  return translated === labelKey ? fallback : translated
}

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
    ? 'bg-[#18181B] ring-1 ring-[#27272A]'
    : 'bg-[#F4F4F5] ring-1 ring-[#E4E4E7]'

  const items: { id: HubHomeMode; labelKey: string; fallback: string }[] = [
    { id: 'practice', labelKey: 'live.hub.modePractice', fallback: 'Practice' },
    { id: 'live', labelKey: 'live.hub.modeLive', fallback: 'Live trading' },
    { id: 'replay', labelKey: 'replay.hub.mode', fallback: 'Replay' },
  ]

  return (
    <div className={`inline-flex w-full sm:w-auto p-1 rounded-xl gap-0.5 ${shell}`} role="tablist" aria-label="Trading mode">
      {items.map(({ id, labelKey, fallback }) => {
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
                ? activeTabClass(id, isDark)
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tabLabel(labelKey, fallback)}
          </button>
        )
      })}
    </div>
  )
}
