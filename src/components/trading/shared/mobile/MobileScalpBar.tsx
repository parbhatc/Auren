import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TradeSideButton } from '../../../common/TradeSideButton'
import type { TradePanelProps } from '../pad/TradePanel'
import { isTradePanelTradingEnabled, TRADE_OFFLINE_DISABLED_CLASS } from '../../../../utils/tradePanelTrading'
import { PadTradeSymbolPicker } from '../pad/TradeContractPicker'
import { QuickTradeCard } from './QuickTradeCard'
import { FloatingTradePadIcon } from './MobileTradeIcons'
import {
  COMPACT_MARKET_BTN,
  MobileQtyStepper,
} from './mobileQuickTradeUi'
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
  dockBottom = false,
}: {
  props: TradePanelProps
  isDark: boolean
  onExpand: () => void
  dockBottom?: boolean
}) {
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const qty = Number(props.quantity) || 1
  const shell = isDark
    ? 'border-[#475569] bg-[#0f172a]'
    : 'border-slate-200 bg-white'
  const iconBtn = isDark
    ? 'text-[#7d8590] hover:bg-[#1e293b] hover:text-[#e6edf3]'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'

  return (
    <div
      className={`relative rounded-2xl border px-2 py-1.5 max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:border-t max-lg:px-2 max-lg:py-1.5 ${
        dockBottom ? 'max-lg:pb-[max(0.25rem,env(safe-area-inset-bottom))]' : ''
      } ${shell}`}
    >
      <button
        type="button"
        onClick={onExpand}
        className={`absolute right-1 top-1 z-10 rounded p-0.5 ${iconBtn}`}
        aria-label="Expand quick trade"
        title="Expand quick trade"
      >
        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
      </button>

      <div className="flex items-center gap-1 pr-6">
        <PadTradeSymbolPicker props={props} disabled={tradeDisabled} placement="above" />

        <MobileQtyStepper props={props} isDark={isDark} disabled={tradeDisabled} />

        <TradeSideButton
          side="buy"
          variant="market"
          disabled={tradeDisabled}
          onClick={props.onBuy}
          title={`Market buy ${qty} contract${qty === 1 ? '' : 's'}`}
          className={`${COMPACT_MARKET_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        >
          Buy
        </TradeSideButton>

        <TradeSideButton
          side="sell"
          variant="market"
          disabled={tradeDisabled}
          onClick={props.onSell}
          title={`Market sell ${qty} contract${qty === 1 ? '' : 's'}`}
          className={`${COMPACT_MARKET_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        >
          Sell
        </TradeSideButton>
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
  showMobileNav = true,
}: {
  accountId: string
  props: TradePanelProps
  maxQty: number
  isDark: boolean
  showMobileNav?: boolean
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

  const dockBottom = !showMobileNav

  if (prefs.quickTradeMinimized) {
    return (
      <CompactQuickTrade
        props={props}
        isDark={isDark}
        dockBottom={dockBottom}
        onExpand={() => setMobileQuickTradeMinimized(accountId, false)}
      />
    )
  }

  return (
    <div className="max-lg:overflow-hidden">
      <QuickTradeCard
        props={props}
        maxQty={maxQty}
        isDark={isDark}
        headerActions={headerActions}
      />
    </div>
  )
}
