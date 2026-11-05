import type { MobileEntryMode } from '../../../../types/mobileTrade'

const choices = [
  { mode: 'auto', label: 'Auto only' },
  { mode: 'market', label: 'Market only' },
  { mode: 'both', label: 'Both' },
] as const

export function MobileEntryModeSelector({ mode, onChange, isDark }: {
  mode: MobileEntryMode
  onChange: (mode: MobileEntryMode) => void
  isDark: boolean
}) {
  return (
    <div className={`border-t px-3 py-2 ${isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-300' : 'border-zinc-200 bg-white text-zinc-600'}`}>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider">Trading mode</div>
      <div role="group" aria-label="Mobile trading controls" className={`grid grid-cols-3 gap-1 rounded-xl p-1 ${isDark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
        {choices.map(choice => (
          <button key={choice.mode} type="button" aria-pressed={mode === choice.mode}
            onClick={() => onChange(choice.mode)}
            className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition-colors ${mode === choice.mode ? isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-zinc-950 shadow-sm' : ''}`}>
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
