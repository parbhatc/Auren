import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings2 } from 'lucide-react'
import { usePracticeLockout } from '../../../../hooks/usePracticeLockout'
import { t } from '../../../../utils/translator'
import { TradingLimitsSettingsPanel } from './TradingLimitsSettingsPanel'
import PositionPnlDisplaySetting from './PositionPnlDisplaySetting'
import RiskPositionSizeSetting from './RiskPositionSizeSetting'
import ReplaySettingsPanel from './ReplaySettingsPanel'
import { LiveTradeViewActive } from '../../../../contexts/LiveTradeViewContext'

/**
 * Header settings gear. Always offers the global trade-panel settings
 * (bracket unit); adds trading limits / lockout when an active practice
 * account is attached (daily loss etc. are practice-account features).
 */
export default function HeaderTradingSettings({
  practiceAccountId,
  isDark,
  showReplaySettings = false,
}: {
  practiceAccountId?: string
  isDark: boolean
  showReplaySettings?: boolean
}) {
  const viewActive = useContext(LiveTradeViewActive)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => { if (!viewActive) setOpen(false) }, [viewActive])
  const [activeTab, setActiveTab] = useState<'display' | 'risk' | 'replay' | 'limits'>('display')
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const { status, isActiveAccount } = usePracticeLockout(practiceAccountId)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !dialogRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Keep the account-scoped tab visible while lockout status is loading. Hiding
  // it behind the async status response made the dialog appear to have only
  // Display and Risk & sizing for valid practice accounts.
  const showLimits = Boolean(practiceAccountId)
  const locked = Boolean(showLimits && isActiveAccount && status?.locked)

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

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20 p-3 backdrop-blur-[1px] sm:p-6"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false)
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={t('practice.lockout.settingsTitle')}
                className={`flex h-[min(42rem,calc(100vh-2rem))] w-[min(32rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border ${menuClass}`}
              >
                <div
                  className={`grid shrink-0 ${showLimits && showReplaySettings ? 'grid-cols-4' : showLimits || showReplaySettings ? 'grid-cols-3' : 'grid-cols-2'} border-b p-1.5 ${
                    isDark ? 'border-slate-700 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                  }`}
                  role="tablist"
                  aria-label="Trading settings sections"
                >
                  {([
                    ['display', 'Display'],
                    ['risk', 'Risk & sizing'],
                    ...(showReplaySettings ? ([['replay', 'Replay']] as const) : []),
                    ...(showLimits ? ([['limits', 'Limits & lockout']] as const) : []),
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === id}
                      onClick={() => setActiveTab(id)}
                      className={`h-8 rounded-lg px-2 text-[11px] font-semibold transition ${
                        activeTab === id
                          ? 'bg-violet-600 text-white shadow-sm'
                          : isDark
                            ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {activeTab === 'display' ? <PositionPnlDisplaySetting isDark={isDark} /> : null}
                  {activeTab === 'risk' ? <RiskPositionSizeSetting isDark={isDark} /> : null}
                  {activeTab === 'replay' && showReplaySettings ? (
                    <ReplaySettingsPanel isDark={isDark} />
                  ) : null}
                  {activeTab === 'limits' && showLimits && practiceAccountId ? (
                    <TradingLimitsSettingsPanel
                      practiceAccountId={practiceAccountId}
                      isDark={isDark}
                      onDismiss={() => setOpen(false)}
                    />
                  ) : null}
                </div>
              </div>
            </div>,
          document.body,
        )
        : null}
    </div>
  )
}
