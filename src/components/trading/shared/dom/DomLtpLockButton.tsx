import { Lock, Unlock } from 'lucide-react'

type DomLtpLockButtonProps = {
  locked: boolean
  onToggle: () => void
}

export function DomLtpLockButton({ locked, onToggle }: DomLtpLockButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      aria-label={locked ? 'Unlock DOM scroll' : 'Lock LTP in center of DOM'}
      title={
        locked
          ? 'Unlock. Scroll the ladder freely.'
          : 'Lock. Keep last price centered in the DOM.'
      }
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${
        locked
          ? 'border-amber-400/55 bg-gradient-to-b from-amber-500/20 to-amber-600/10 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]'
          : 'border-[#475569] bg-[#1e293b]/90 text-[#94a3b8] hover:border-violet-500/45 hover:bg-violet-500/10 hover:text-violet-200'
      }`}
    >
      {locked ? (
        <Lock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      ) : (
        <Unlock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      )}
      <span>{locked ? 'LTP lock' : 'Free scroll'}</span>
    </button>
  )
}
