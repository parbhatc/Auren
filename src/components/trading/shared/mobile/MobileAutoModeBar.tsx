import { ArrowDownRight, ArrowUpDown, ArrowUpRight, Crosshair, X } from 'lucide-react'

export type MobileAutoState = {
  mode: 'buy' | 'sell' | 'auto' | null
  message: string | null
  cancel: () => void
}

const modes = [
  { id: 'buy', label: 'Buy', Icon: ArrowUpRight, color: 'border-emerald-500 bg-emerald-500/15 text-emerald-500' },
  { id: 'sell', label: 'Sell', Icon: ArrowDownRight, color: 'border-rose-500 bg-rose-500/15 text-rose-500' },
  { id: 'auto', label: 'Auto', Icon: ArrowUpDown, color: 'border-violet-500 bg-violet-500/15 text-violet-500' },
] as const

/** Chart selection modes only; activating a mode never places a market order. */
export function MobileAutoModeBar({ state, onArm, disabled, isDark }: {
  state: MobileAutoState | null
  onArm: (mode: 'buy' | 'sell' | 'auto') => void
  disabled: boolean
  isDark: boolean
}) {
  const active = modes.find(mode => mode.id === state?.mode)
  return (
    <section aria-label="Auto chart entry" className={`lg:hidden shrink-0 border-t px-3 py-2 ${isDark ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-zinc-200 bg-white text-zinc-900'}`}>
      <div className="flex items-center gap-3">
        <div className="mr-auto flex items-center gap-1.5 text-xs font-semibold"><Crosshair size={15} aria-hidden />Auto entry</div>
        <div className="flex gap-1.5" role="group" aria-label="Auto direction">
          {modes.map(({ id, label, Icon, color }) => (
            <button key={id} type="button" disabled={disabled} aria-pressed={state?.mode === id}
              onClick={() => onArm(id)}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-40 ${state?.mode === id ? color : isDark ? 'border-zinc-700 text-zinc-300' : 'border-zinc-300 text-zinc-600'}`}>
              <Icon size={15} aria-hidden />{label}
            </button>
          ))}
        </div>
      </div>
      {active ? (
        <div className={`mt-2 flex items-center gap-3 rounded-xl border px-3 py-2 ${active.color}`}>
          <div role="status" className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 shrink-0 rounded-full bg-current" />{active.label} active</div>
            <p className="mt-0.5 text-xs leading-relaxed">{state?.message || 'Tap a chart price to submit your risk-sized order.'}</p>
          </div>
          <button type="button" onClick={state?.cancel} className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-current px-3 text-xs font-semibold"><X size={15} aria-hidden />Cancel</button>
        </div>
      ) : state?.message ? <p role="status" className="mt-2 text-xs leading-relaxed">{state.message}</p> : null}
    </section>
  )
}
