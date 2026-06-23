import type { ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  FlipHorizontal2,
  Layers,
  LogOut,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TradeSideButton } from '../../../common/TradeSideButton'
import type { TradePanelSettings } from '../../../../constants/tradePanelSettings'
import type { TradePanelProps } from './types'
import { isTradePanelTradingEnabled } from '../../../../utils/tradePanelTrading'

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f172a]'

type ActionBtnProps = {
  onClick?: () => void
  disabled?: boolean
  className: string
  children: ReactNode
  title?: string
}

function ActionBtn({ onClick, disabled, className, children, title }: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${focusRing} ${className}`}
    >
      {children}
    </button>
  )
}

export function DomActionButtons({
  props,
  ui,
}: {
  props: TradePanelProps
  ui: TradePanelSettings
}) {
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const showMarket = !ui.hideBuySell
  const showJoin = !ui.hideJoinBidAsk
  const showPosition = !ui.hideClosePosition || !ui.hideReverse
  const showOrders = !ui.hideCancelAll || !ui.hideFlattenAll

  if (!showMarket && !showJoin && !showPosition && !showOrders) return null

  return (
    <div className="space-y-2" aria-label="DOM trade actions">
      {showMarket ? (
        <div className="grid grid-cols-2 gap-2">
          <TradeSideButton side="buy" variant="market" onClick={props.onBuy} disabled={tradeDisabled} title="Market buy">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            Buy
          </TradeSideButton>
          <TradeSideButton side="sell" variant="market" onClick={props.onSell} disabled={tradeDisabled} title="Market sell">
            <TrendingDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            Sell
          </TradeSideButton>
        </div>
      ) : null}

      {showJoin ? (
        <div className="grid grid-cols-2 gap-2">
          <TradeSideButton side="buy" variant="join" onClick={props.onJoinBid} disabled={tradeDisabled} title="Join best bid">
            <ArrowDownToLine className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Join bid
          </TradeSideButton>
          <TradeSideButton side="sell" variant="join" onClick={props.onJoinAsk} disabled={tradeDisabled} title="Join best ask">
            <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Join ask
          </TradeSideButton>
        </div>
      ) : null}

      {showPosition ? (
        <div
          className={`grid gap-2 ${!ui.hideClosePosition && !ui.hideReverse ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {!ui.hideClosePosition ? (
            <ActionBtn
              onClick={props.onClose}
              disabled={tradeDisabled}
              title="Close position"
              className="border border-slate-600/80 bg-slate-800/70 text-slate-200 hover:border-slate-500 hover:bg-slate-700/80"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden />
              Close
            </ActionBtn>
          ) : null}
          {!ui.hideReverse ? (
            <ActionBtn
              onClick={props.onReverse}
              disabled={tradeDisabled}
              title="Reverse position"
              className="border border-violet-500/35 bg-violet-500/10 text-violet-200 hover:bg-violet-500/16"
            >
              <FlipHorizontal2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Reverse
            </ActionBtn>
          ) : null}
        </div>
      ) : null}

      {showOrders ? (
        <div className="grid grid-cols-2 gap-2">
          {!ui.hideCancelAll ? (
            <ActionBtn
              disabled
              title="Cancel all orders (coming soon)"
              className="border border-slate-700/80 bg-slate-900/50 text-slate-500"
            >
              <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Cancel all
            </ActionBtn>
          ) : null}
          {!ui.hideFlattenAll ? (
            <ActionBtn
              onClick={props.onFlatten}
              disabled={tradeDisabled}
              title="Flatten all positions"
              className="border border-amber-500/40 bg-amber-500/12 text-amber-200 hover:bg-amber-500/20"
            >
              <Layers className="h-3.5 w-3.5 shrink-0 opacity-85" aria-hidden />
              Flatten all
            </ActionBtn>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
