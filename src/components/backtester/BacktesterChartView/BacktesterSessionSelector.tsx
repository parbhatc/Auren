import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BacktestSession } from '../../../types/backtester'
import { ROUTES } from '../../../constants/routes'
import { resolveSessionDisplaySymbol } from '../../../backtester/constants'
import { t } from '../../../utils/translator'

export default function BacktesterSessionSelector({
  isDark,
  sessions,
  currentSessionId,
  navigate,
}: {
  isDark: boolean
  sessions: BacktestSession[]
  currentSessionId?: string
  navigate: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = sessions.find((s) => s.id === currentSessionId)
  const currentLabel = current?.name ?? t('backtester.sessionNotFound')
  const currentSymbol = current ? resolveSessionDisplaySymbol(current.symbol) : 'NQ'

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selectSession = (session: BacktestSession) => {
    setOpen(false)
    if (session.id === currentSessionId) return
    navigate(`${ROUTES.BACKTESTER_CHART}?sessionId=${encodeURIComponent(session.id)}`)
  }

  return (
    <div ref={ref} className="relative shrink-0 w-[min(5.5rem,22vw)] lg:w-[168px] xl:w-[188px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={currentLabel}
        className={`w-full flex items-center border text-left transition-all h-7 lg:h-8 px-1.5 lg:px-2 py-0 rounded text-[10px] leading-tight lg:text-xs lg:rounded-md gap-0.5 lg:gap-1.5 ${
          isDark
            ? 'bg-[#0f172a] text-slate-200 hover:border-slate-500 border-emerald-500/50'
            : 'bg-white text-slate-800 hover:border-slate-400 border-emerald-500/40'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className={`font-semibold truncate block lg:hidden ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {currentLabel}
          </span>
          <span className={`font-semibold truncate hidden lg:block ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {currentSymbol} · {currentLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 top-full z-[200] mt-1 w-[min(18rem,calc(100vw-1rem))] max-h-72 overflow-y-auto rounded-lg border shadow-xl ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          {sessions.length === 0 ? (
            <p className={`px-3 py-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('backtester.noSessions', {}, 'No sessions')}
            </p>
          ) : (
            sessions.map((s) => {
              const sym = resolveSessionDisplaySymbol(s.symbol)
              const active = s.id === currentSessionId
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => selectSession(s)}
                  className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 ${
                    isDark ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'
                  } ${active ? (isDark ? 'bg-violet-500/10 text-violet-200' : 'bg-violet-50 text-violet-800') : ''}`}
                >
                  <span className="font-semibold block truncate">{s.name}</span>
                  <span className={`block truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {sym} · {s.startDate}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
