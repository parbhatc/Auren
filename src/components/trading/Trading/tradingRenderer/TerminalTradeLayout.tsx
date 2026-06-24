import { useEffect } from 'react'
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
  const mobileTradePrefs = getMobileTradePrefs(padSessionId)
  const chartSymbolLabel = padProps.chartSymbol ?? ''
  const mobileOverlayOpen = mobileOrderOpen || mobileSettingsOpen

  useEffect(() => {
    if (!mobileOverlayOpen) return
    document.body.classList.add(MOBILE_TRADE_OVERLAY_BODY_CLASS)
    return () => document.body.classList.remove(MOBILE_TRADE_OVERLAY_BODY_CLASS)
  }, [mobileOverlayOpen])

  return (
    <div className="relative flex flex-1 flex-col min-h-0 min-w-0 w-full h-full">
      {renderPracticeTradeLayout(
        chartElement,
        padDetached ? null : <TradePanel {...padProps} />,
        {
          mobileScalpBar: mobileOverlayOpen ? null : (
            <MobileScalpBar
              accountId={padSessionId}
              props={padProps}
              maxQty={practiceMaxQty}
              isDark={isDark}
              showMobileNav={showMobileNav}
            />
          ),
          showMobileNav,
        }
      )}
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
