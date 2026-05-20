import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { PracticeTradePanelProps } from './PracticeTradePanel'
import { PracticeQuickTradeCard } from './PracticeQuickTradeCard'
import { FloatingTradePadIcon } from './PracticeMobileTradeIcons'
import {
  getPracticeMobileTradePrefs,
  PRACTICE_MOBILE_TRADE_PREFS_EVENT,
  setPracticeMobileFloatingPad,
  setPracticeMobileQuickTradeMinimized,
} from '../../../utils/practiceMobileTradePrefs'

/** Mobile quick-trade strip below the chart (practice mode). */
export function PracticeMobileScalpBar({
  accountId,
  props,
  maxQty,
  isDark,
}: {
  accountId: string
  props: PracticeTradePanelProps
  maxQty: number
  isDark: boolean
}) {
  const [prefs, setPrefs] = useState(() => getPracticeMobileTradePrefs(accountId))

  useEffect(() => {
    setPrefs(getPracticeMobileTradePrefs(accountId))
  }, [accountId])

  useEffect(() => {
    const onChange = () => setPrefs(getPracticeMobileTradePrefs(accountId))
    window.addEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, onChange)
    return () => window.removeEventListener(PRACTICE_MOBILE_TRADE_PREFS_EVENT, onChange)
  }, [accountId])

  if (prefs.floatingPad) return null

  const iconBtn = isDark
    ? 'p-1.5 rounded-lg text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#1e293b]'
    : 'p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100'

  const headerActions = (
    <>
      <button
        type="button"
        title="Compact trade pad"
        aria-label="Show compact draggable trade pad"
        className={iconBtn}
        onClick={() => setPracticeMobileFloatingPad(accountId, true)}
      >
        <FloatingTradePadIcon />
      </button>
      <button
        type="button"
        title={prefs.quickTradeMinimized ? 'Expand quick trade' : 'Minimize quick trade'}
        aria-label={prefs.quickTradeMinimized ? 'Expand quick trade' : 'Minimize quick trade'}
        className={iconBtn}
        onClick={() =>
          setPracticeMobileQuickTradeMinimized(accountId, !prefs.quickTradeMinimized)
        }
      >
        {prefs.quickTradeMinimized ? (
          <ChevronUp className="w-4 h-4" aria-hidden />
        ) : (
          <ChevronDown className="w-4 h-4" aria-hidden />
        )}
      </button>
    </>
  )

  if (prefs.quickTradeMinimized) {
    return (
      <div className="lg:hidden shrink-0 w-full px-1 pb-0">
        <button
          type="button"
          onClick={() => setPracticeMobileQuickTradeMinimized(accountId, false)}
          className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
            isDark
              ? 'border-[#475569] bg-[#0f172a] hover:bg-[#1c2128]'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
          aria-label="Expand quick trade"
        >
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-[#64748b]' : 'text-slate-500'
            }`}
          >
            Quick trade
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-[#8b5cf6]">
            Expand
            <ChevronUp className="w-3.5 h-3.5" aria-hidden />
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="lg:hidden shrink-0 w-full px-1 pb-0 pt-0.5">
      <PracticeQuickTradeCard
        props={props}
        maxQty={maxQty}
        isDark={isDark}
        headerActions={headerActions}
      />
    </div>
  )
}
