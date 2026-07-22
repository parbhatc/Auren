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
  saveMobileTradePrefs,
} from '../../../../utils/mobileTradePrefs'
import { isPwaPinnedNav } from '../../../../utils/pwa'

function CompactQuickTrade({
  props,
  isDark,
  onExpand,
  mobileDockClass = 'auren-quick-trade-mobile-dock',
}: {
  props: TradePanelProps
  isDark: boolean
  onExpand: () => void
  mobileDockClass?: string
}) {
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const qty = Number(props.quantity) || 1
  const shell = isDark
    ? 'border-[#27272A] bg-[#18181B]'
    : 'border-[#E4E4E7] bg-white'
  const iconBtn = isDark
    ? 'text-[#71717A] hover:bg-[#27272A] hover:text-[#FAFAFA]'
    : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'

  return (
    <div
      className={[
        'relative rounded-2xl border px-2 py-1.5 max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:border-t max-lg:px-2 max-lg:py-1.5',
        mobileDockClass,
        shell,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        onClick={onExpand}
        className={`absolute right-0.5 top-0.5 z-10 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md p-1.5 touch-manipulation ${iconBtn}`}
        aria-label="Expand quick trade"
        title="Expand quick trade"
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex items-center gap-1 pr-10">
        <PadTradeSymbolPicker props={props} disabled={tradeDisabled} placement="above" dockCompact />

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
  onPrefsChange,
}: {
  accountId: string
  props: TradePanelProps
  maxQty: number
  isDark: boolean
  showMobileNav?: boolean
  /** Parent re-render when prefs change (e.g. inline bar ↔ floating pad). */
  onPrefsChange?: () => void
}) {
  const [prefs, setPrefs] = useState(() => getMobileTradePrefs(accountId))

  const applyPrefs = (next: typeof prefs) => {
    setPrefs(next)
    saveMobileTradePrefs(accountId, next)
    onPrefsChange?.()
  }

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
    ? 'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md p-1.5 text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#27272A] active:bg-[#27272A] touch-manipulation'
    : 'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md p-1.5 text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] active:bg-[#F4F4F5] touch-manipulation'

  const headerActions = (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        title="Compact trade pad"
        aria-label="Show compact draggable trade pad"
        className={iconBtn}
        onClick={() => applyPrefs({ floatingPad: true, quickTradeMinimized: false })}
      >
        <FloatingTradePadIcon />
      </button>
      <button
        type="button"
        title={prefs.quickTradeMinimized ? 'Expand quick trade' : 'Minimize quick trade'}
        aria-label={prefs.quickTradeMinimized ? 'Expand quick trade' : 'Minimize quick trade'}
        className={iconBtn}
        onClick={() =>
          applyPrefs({ floatingPad: false, quickTradeMinimized: !prefs.quickTradeMinimized })
        }
      >
        {prefs.quickTradeMinimized ? (
          <ChevronUp className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )

  const navDocked = showMobileNav || isPwaPinnedNav()
  /** Parent column reserves nav height; card only needs safe-area when nav is hidden. */
  const mobileDockClass = navDocked ? '' : 'auren-quick-trade-mobile-dock'

  if (prefs.quickTradeMinimized) {
    return (
      <div className="max-lg:w-full max-lg:overflow-hidden">
        <CompactQuickTrade
          props={props}
          isDark={isDark}
          mobileDockClass={mobileDockClass}
          onExpand={() => applyPrefs({ floatingPad: false, quickTradeMinimized: false })}
        />
      </div>
    )
  }

  return (
    <div className="max-lg:w-full max-lg:overflow-hidden">
      <QuickTradeCard
        props={props}
        maxQty={maxQty}
        isDark={isDark}
        headerActions={headerActions}
        mobileDockClass={mobileDockClass}
      />
    </div>
  )
}
