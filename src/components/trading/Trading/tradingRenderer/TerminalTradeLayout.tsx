import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import TradePanel from '../../shared/pad/TradePanel'
import { renderPracticeTradeLayout } from '../../../../utils/layoutRenderer'
import { MobileScalpBar } from '../../shared/mobile/MobileScalpBar'
import { MobileOrderSheet } from '../../shared/mobile/MobileOrderSheet'
import { MobileTradingSettingsSheet } from '../../shared/mobile/MobileTradingSettingsSheet'
import { DetachedTradePanel } from '../../shared/mobile/DetachedTradePanel'
import { MOBILE_TRADE_OVERLAY_BODY_CLASS } from '../../../../constants/mobileTrade'
import { getMobileTradePrefs, setMobileFloatingPad, setMobileEntryMode } from '../../../../utils/mobileTradePrefs'
import { isPracticePadDetached } from './buildTradePadProps'
import type { TradePanelProps } from '../../../../types/tradePanel'
import { LiveTradeViewActive } from '../../../../contexts/LiveTradeViewContext'
import { MobileAutoModeBar, type MobileAutoState } from '../../shared/mobile/MobileAutoModeBar'
import { requestChartAutoTrade } from '../../../common/aurenTradeContextMenu'
import { isTradePanelTradingEnabled } from '../../../../utils/tradePanelTrading'
import type { MobileEntryMode } from '../../../../types/mobileTrade'

type TerminalTradeLayoutProps = {
  padSessionId: string
  chartElement: JSX.Element
  padProps: TradePanelProps
  practiceMaxQty: number
  isDark: boolean
  showMobileNav?: boolean
  mobileOrderOpen: boolean
  mobileSettingsOpen: boolean
  onCloseMobileOrder: () => void
  onCloseMobileSettings: () => void
  onForceUpdate: () => void
}

export function TerminalTradeLayout({
  padSessionId,
  chartElement,
  padProps,
  practiceMaxQty,
  isDark,
  showMobileNav = true,
  mobileOrderOpen,
  mobileSettingsOpen,
  onCloseMobileOrder,
  onCloseMobileSettings,
  onForceUpdate,
}: TerminalTradeLayoutProps) {
  const viewActive = useContext(LiveTradeViewActive)
  const [autoState, setAutoState] = useState<MobileAutoState | null>(null)
  const forceUpdateRef = useRef(onForceUpdate)
  forceUpdateRef.current = onForceUpdate
  const handleAutoModeChange = useCallback((state: MobileAutoState) => {
    // An explicit Auto request from the order sheet/context menu must remain
    // visible even when this account previously showed only market controls.
    if (state.mode && window.matchMedia('(max-width: 1023px)').matches &&
        getMobileTradePrefs(padSessionId).entryMode === 'market') {
      setMobileEntryMode(padSessionId, 'auto')
      forceUpdateRef.current()
    }
    setAutoState(state)
  }, [padSessionId])
  const armAuto = useCallback((mode: 'buy' | 'sell' | 'auto') => {
    requestChartAutoTrade(mode, padProps.accountId)
  }, [padProps.accountId])
  const armAutoFromSheet = useCallback((mode: 'buy' | 'sell' | 'auto') => {
    armAuto(mode)
    onCloseMobileOrder()
  }, [armAuto, onCloseMobileOrder])
  const padDetached = isPracticePadDetached(padSessionId)
  const [orderPaneCollapsed, setOrderPaneCollapsed] = useState(() => {
    try {
      return localStorage.getItem(`auren-order-pane-collapsed:${padSessionId}`) === '1'
    } catch {
      return false
    }
  })
  const mobileTradePrefs = getMobileTradePrefs(padSessionId)
  const entryMode = padProps.hideTicketTab ? 'market' : mobileTradePrefs.entryMode
  const changeEntryMode = (mode: MobileEntryMode) => {
    if (mode === 'market') autoState?.cancel()
    setMobileEntryMode(padSessionId, mode)
    onForceUpdate()
  }
  const chartSymbolLabel = padProps.chartSymbol ?? ''
  const mobileOverlayOpen = viewActive && (mobileOrderOpen || mobileSettingsOpen)

  useEffect(() => {
    if (!mobileOverlayOpen) return
    document.body.classList.add(MOBILE_TRADE_OVERLAY_BODY_CLASS)
    return () => document.body.classList.remove(MOBILE_TRADE_OVERLAY_BODY_CLASS)
  }, [mobileOverlayOpen])

  const toggleOrderPane = () => {
    setOrderPaneCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(`auren-order-pane-collapsed:${padSessionId}`, next ? '1' : '0')
      } catch {
        // Storage is optional.
      }
      return next
    })
  }

  return (
    <div className="relative flex flex-1 flex-col min-h-0 min-w-0 w-full h-full">
      {renderPracticeTradeLayout(
        chartElement,
        viewActive ? <TradePanel key={padProps.accountId} {...padProps} onAutoModeChange={handleAutoModeChange} /> : <div />,
        {
          panelWidth: 312,
          panelFrame: false,
          panelHidden: padDetached || orderPaneCollapsed,
          mobileScalpBar:
            !viewActive || mobileOverlayOpen ? null : (
            <>
              {entryMode !== 'market' && <MobileAutoModeBar state={autoState} onArm={armAuto} isDark={isDark}
                disabled={!isTradePanelTradingEnabled(padProps) || !padProps.pickChartPriceOnce} />}
              {entryMode !== 'auto' && !mobileTradePrefs.floatingPad && <MobileScalpBar
              accountId={padSessionId}
              props={padProps}
              maxQty={practiceMaxQty}
              isDark={isDark}
              showMobileNav={showMobileNav}
              onPrefsChange={onForceUpdate}
            />}
            </>
          ),
          showMobileNav,
        }
      )}
      {viewActive && !padDetached ? (
        <button
          type="button"
          onClick={toggleOrderPane}
          aria-label={orderPaneCollapsed ? 'Show order ticket' : 'Hide order ticket'}
          title={orderPaneCollapsed ? 'Show order ticket' : 'Hide order ticket'}
          className={`absolute top-12 z-[100] hidden h-8 w-8 items-center justify-center rounded-md border lg:inline-flex ${
            isDark
              ? 'border-[#3F3F46] bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]'
              : 'border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
          }`}
          style={{ right: orderPaneCollapsed ? 8 : 324 }}
        >
          {orderPaneCollapsed ? (
            <PanelRightOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <PanelRightClose className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      ) : null}
      {viewActive && <MobileOrderSheet
        open={mobileOrderOpen}
        onClose={onCloseMobileOrder}
        isDark={isDark}
        padProps={{ ...padProps, onRequestAutoMode: armAutoFromSheet }}
      />}
      {viewActive && <MobileTradingSettingsSheet
        open={mobileSettingsOpen}
        onClose={onCloseMobileSettings}
        entryMode={padProps.hideTicketTab ? undefined : entryMode}
        onEntryModeChange={changeEntryMode}
        practiceAccountId={padSessionId}
        isDark={isDark}
      />}
      {viewActive && padDetached && (
        <div className="hidden lg:block">
          <DetachedTradePanel
            accountId={padSessionId}
            isDark={isDark}
            padProps={padProps}
            chartSymbol={chartSymbolLabel}
            maxQty={practiceMaxQty}
            onDock={onForceUpdate}
          />
        </div>
      )}
      {viewActive && entryMode !== 'auto' && mobileTradePrefs.floatingPad && !mobileOverlayOpen && (
        <div className="lg:hidden">
          <DetachedTradePanel
            accountId={padSessionId}
            isDark={isDark}
            padProps={padProps}
            chartSymbol={chartSymbolLabel}
            maxQty={practiceMaxQty}
            dockMode="mobile-float"
            dockTitle="Pin quick trade"
            onDock={() => {
              setMobileFloatingPad(padSessionId, false)
              onForceUpdate()
            }}
          />
        </div>
      )}
    </div>
  )
}
