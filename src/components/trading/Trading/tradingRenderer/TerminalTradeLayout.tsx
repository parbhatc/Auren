import TradePanel from '../../shared/pad/TradePanel'
import { renderPracticeTradeLayout } from '../../../../utils/layoutRenderer'
import { MobileScalpBar } from '../../shared/mobile/MobileScalpBar'
import { MobileOrderSheet } from '../../shared/mobile/MobileOrderSheet'
import { DetachedTradePanel } from '../../shared/mobile/DetachedTradePanel'
import { getMobileTradePrefs, setMobileFloatingPad } from '../../../../utils/mobileTradePrefs'
import { isPracticePadDetached } from './buildTradePadProps'
import type { TradePanelProps } from '../../../../types/tradePanel'

type TerminalTradeLayoutProps = {
  padSessionId: string
  chartElement: JSX.Element
  padProps: TradePanelProps
  practiceMaxQty: number
  isDark: boolean
  mobileOrderOpen: boolean
  onCloseMobileOrder: () => void
  onForceUpdate: () => void
}

export function TerminalTradeLayout({
  padSessionId,
  chartElement,
  padProps,
  practiceMaxQty,
  isDark,
  mobileOrderOpen,
  onCloseMobileOrder,
  onForceUpdate,
}: TerminalTradeLayoutProps) {
  const padDetached = isPracticePadDetached(padSessionId)
  const mobileTradePrefs = getMobileTradePrefs(padSessionId)
  const chartSymbolLabel = padProps.chartSymbol ?? ''

  return (
    <div className="relative flex flex-1 flex-col min-h-0 min-w-0 w-full h-full">
      {renderPracticeTradeLayout(
        chartElement,
        padDetached ? null : <TradePanel {...padProps} />,
        {
          mobileScalpBar: (
            <MobileScalpBar
              accountId={padSessionId}
              props={padProps}
              maxQty={practiceMaxQty}
              isDark={isDark}
            />
          ),
        }
      )}
      <MobileOrderSheet
        open={mobileOrderOpen}
        onClose={onCloseMobileOrder}
        isDark={isDark}
        padProps={padProps}
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
      {mobileTradePrefs.floatingPad && (
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
