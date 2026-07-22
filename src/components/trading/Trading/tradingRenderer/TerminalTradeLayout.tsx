import { useEffect, useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import TradePanel from '../../shared/pad/TradePanel'
import { renderPracticeTradeLayout } from '../../../../utils/layoutRenderer'
import { MobileScalpBar } from '../../shared/mobile/MobileScalpBar'
import { MobileOrderSheet } from '../../shared/mobile/MobileOrderSheet'
import { MobileTradingSettingsSheet } from '../../shared/mobile/MobileTradingSettingsSheet'
import { DetachedTradePanel } from '../../shared/mobile/DetachedTradePanel'
import { MOBILE_TRADE_OVERLAY_BODY_CLASS } from '../../../../constants/mobileTrade'
import { getMobileTradePrefs, setMobileFloatingPad } from '../../../../utils/mobileTradePrefs'
import { isPracticePadDetached } from './buildTradePadProps'
import type { TradePanelProps } from '../../../../types/tradePanel'

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
  const padDetached = isPracticePadDetached(padSessionId)
  const [orderPaneCollapsed, setOrderPaneCollapsed] = useState(() => {
    try {
      return localStorage.getItem(`auren-order-pane-collapsed:${padSessionId}`) === '1'
    } catch {
      return false
    }
  })
  const mobileTradePrefs = getMobileTradePrefs(padSessionId)
  const chartSymbolLabel = padProps.chartSymbol ?? ''
  const mobileOverlayOpen = mobileOrderOpen || mobileSettingsOpen

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
        padDetached || orderPaneCollapsed ? null : <TradePanel {...padProps} />,
        {
          panelWidth: 312,
          panelFrame: false,
          mobileScalpBar:
            mobileOverlayOpen || mobileTradePrefs.floatingPad ? null : (
            <MobileScalpBar
              accountId={padSessionId}
              props={padProps}
              maxQty={practiceMaxQty}
              isDark={isDark}
              showMobileNav={showMobileNav}
              onPrefsChange={onForceUpdate}
            />
          ),
          showMobileNav,
        }
      )}
      {!padDetached ? (
        <button
          type="button"
          onClick={toggleOrderPane}
          aria-label={orderPaneCollapsed ? 'Show order ticket' : 'Hide order ticket'}
          title={orderPaneCollapsed ? 'Show order ticket' : 'Hide order ticket'}
          className={`absolute top-12 z-[200] hidden h-8 w-8 items-center justify-center rounded-md border lg:inline-flex ${
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
      <MobileOrderSheet
        open={mobileOrderOpen}
        onClose={onCloseMobileOrder}
        isDark={isDark}
        padProps={padProps}
      />
      <MobileTradingSettingsSheet
        open={mobileSettingsOpen}
        onClose={onCloseMobileSettings}
        practiceAccountId={padSessionId}
        isDark={isDark}
      />
      {padDetached && (
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
      {mobileTradePrefs.floatingPad && !mobileOverlayOpen && (
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
