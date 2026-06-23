import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import type { TradePanelProps } from '../pad/TradePanel'
import { isTradePanelTradingEnabled, TRADE_OFFLINE_DISABLED_CLASS } from '../../../../utils/tradePanelTrading'
import { QuickTradeCard } from './QuickTradeCard'
import { FloatingTradePadIcon } from './MobileTradeIcons'
import {
  getMobileTradePrefs,
  PRACTICE_MOBILE_TRADE_PREFS_EVENT,
  setMobileFloatingPad,
  setMobileQuickTradeMinimized,
} from '../../../../utils/mobileTradePrefs'

function CompactQuickTrade({
  props,
  isDark,
  onExpand,
}: {
  props: TradePanelProps
  isDark: boolean
  onExpand: () => void
}) {
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const shell = isDark
    ? 'border-[#475569] bg-[#0f172a]'
    : 'border-slate-200 bg-white'
  const btn = isDark
    ? 'text-[#7d8590] hover:bg-[#1e293b] hover:text-[#e6edf3]'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
  const input = isDark ? 'text-[#e6edf3]' : 'text-slate-900'
  const divider = isDark ? 'border-[#334155]' : 'border-slate-200'

  return (
    <div className={`rounded-2xl border px-2 py-2 ${shell}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExpand}
          className={`shrink-0 p-1.5 rounded-lg ${btn}`}
          aria-label="Expand quick trade"
          title="Expand quick trade"
        >
          <ChevronUp className="w-4 h-4" aria-hidden />
        </button>
        <span
          className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider ${
            isDark ? 'text-[#64748b]' : 'text-slate-500'
          }`}
        >
          Quick
        </span>
        <div
          className={`flex shrink-0 items-stretch rounded-lg border overflow-hidden ${
            isDark ? 'border-[#475569] bg-[#020617]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <button
            type="button"
            disabled={tradeDisabled}
            onClick={() => props.onQuantityChange(-1)}
            className={`px-2 flex items-center justify-center ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={props.quantity}
            disabled={tradeDisabled}
            onChange={(e) => props.onQuantityInputChange(e.target.value)}
            onBlur={props.onQuantityBlur}
            className={`no-spinner w-8 bg-transparent text-center text-sm font-bold font-mono tabular-nums outline-none border-x ${divider} ${input}`}
            aria-label="Contract quantity"
          />
          <button
            type="button"
            disabled={tradeDisabled}
            onClick={() => props.onQuantityChange(1)}
            className={`px-2 flex items-center justify-center ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          disabled={tradeDisabled}
          onClick={props.onBuy}
          className={`flex-1 min-w-0 h-9 rounded-xl border border-[#3fb950]/35 bg-[#238636] text-xs font-bold text-white active:scale-[0.98] ${TRADE_OFFLINE_DISABLED_CLASS}`}
        >
          Buy
        </button>
        <button
          type="button"
          disabled={tradeDisabled}
          onClick={props.onSell}
          className={`flex-1 min-w-0 h-9 rounded-xl border border-[#f85149]/35 bg-[#da3633] text-xs font-bold text-white active:scale-[0.98] ${TRADE_OFFLINE_DISABLED_CLASS}`}
        >
          Sell
        </button>
      </div>
    </div>
  )
}

/** Mobile quick-trade strip below the chart (practice mode). */
export function MobileScalpBar({
  accountId,
  props,
  maxQty,
  isDark,
}: {
  accountId: string
  props: TradePanelProps
  maxQty: number
  isDark: boolean
}) {
  const [prefs, setPrefs] = useState(() => getMobileTradePrefs(accountId))

  useEffect(() => {
    setPrefs(getMobileTradePrefs(accountId))
  }, [accountId])

  useEffect(() => {
    const onChange = () => setPrefs(getMobileTradePrefs(accountId))
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
        onClick={() => setMobileFloatingPad(accountId, true)}
      >
        <FloatingTradePadIcon />
      </button>
      <button
        type="button"
        title={prefs.quickTradeMinimized ? 'Expand quick trade' : 'Minimize quick trade'}
        aria-label={prefs.quickTradeMinimized ? 'Expand quick trade' : 'Minimize quick trade'}
        className={iconBtn}
        onClick={() =>
          setMobileQuickTradeMinimized(accountId, !prefs.quickTradeMinimized)
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
        <CompactQuickTrade
          props={props}
          isDark={isDark}
          onExpand={() => setMobileQuickTradeMinimized(accountId, false)}
        />
      </div>
    )
  }

  return (
    <div className="lg:hidden shrink-0 w-full px-1 pb-0 pt-0.5 max-h-[min(42dvh,360px)] overflow-y-auto overscroll-y-contain">
      <QuickTradeCard
        props={props}
        maxQty={maxQty}
        isDark={isDark}
        headerActions={headerActions}
      />
    </div>
  )
}
