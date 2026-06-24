import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { usePracticeLockout } from '../../../../hooks/usePracticeLockout'
import { t } from '../../../../utils/translator'
import { TradingLimitsSettingsPanel } from './TradingLimitsSettingsPanel'

export default function HeaderTradingSettings({
  practiceAccountId,
  isDark,
}: {
  practiceAccountId: string
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { status, isActiveAccount } = usePracticeLockout(practiceAccountId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!isActiveAccount || !status) return null

  const locked = status.locked

  const btnClass = isDark
    ? 'border-slate-600/80 text-slate-400 hover:border-violet-500/40 hover:bg-violet-950/30 hover:text-violet-200'
    : 'border-slate-300 text-slate-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'

  const menuClass = isDark
    ? 'border-slate-700 bg-slate-900 shadow-xl shadow-black/40'
    : 'border-slate-200 bg-white shadow-xl shadow-slate-200/80'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={t('practice.lockout.settingsButton')}
        aria-label={t('practice.lockout.settingsButton')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center h-7 w-7 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${btnClass} ${
          open ? (isDark ? 'border-violet-500/50 bg-violet-950/40 text-violet-200' : 'border-violet-300 bg-violet-50 text-violet-700') : ''
        }`}
      >
        <Settings2 className="w-4 h-4" />
        {locked ? (
          <span
            className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ${
              isDark ? 'bg-red-500 ring-slate-950' : 'bg-red-500 ring-white'
            }`}
            aria-hidden
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('practice.lockout.settingsTitle')}
          className={`absolute right-0 top-full mt-1.5 z-[200] w-[min(20rem,calc(100vw-1rem))] rounded-xl border overflow-hidden ${menuClass}`}
        >
          <TradingLimitsSettingsPanel
            practiceAccountId={practiceAccountId}
            isDark={isDark}
            onDismiss={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
