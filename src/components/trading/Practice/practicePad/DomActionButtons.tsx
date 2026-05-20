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
import type { PracticeTradePanelSettings } from '../../../../constants/practiceTradePanelSettings'
import type { PracticeTradePanelProps } from '../PracticeTradePanel'

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
  props: PracticeTradePanelProps
  ui: PracticeTradePanelSettings
}) {
  const showMarket = !ui.hideBuySell
  const showJoin = !ui.hideJoinBidAsk
  const showPosition = !ui.hideClosePosition || !ui.hideReverse
  const showOrders = !ui.hideCancelAll || !ui.hideFlattenAll

  if (!showMarket && !showJoin && !showPosition && !showOrders) return null

  return (
    <div className="space-y-2" aria-label="DOM trade actions">
      {showMarket ? (
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn
            onClick={props.onBuy}
            title="Market buy"
            className="border border-emerald-500/40 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[0_4px_14px_rgba(35,134,54,0.35)] hover:from-emerald-500 hover:to-emerald-600"
          >
            <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            Buy
          </ActionBtn>
          <ActionBtn
            onClick={props.onSell}
            title="Market sell"
            className="border border-red-500/40 bg-gradient-to-b from-red-600 to-red-700 text-white shadow-[0_4px_14px_rgba(218,54,51,0.3)] hover:from-red-500 hover:to-red-600"
          >
            <TrendingDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            Sell
          </ActionBtn>
        </div>
      ) : null}

      {showJoin ? (
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn
            onClick={props.onJoinBid}
            title="Join best bid"
            className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/18"
          >
            <ArrowDownToLine className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Join bid
          </ActionBtn>
          <ActionBtn
            onClick={props.onJoinAsk}
            title="Join best ask"
            className="border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/18"
          >
            <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Join ask
          </ActionBtn>
        </div>
      ) : null}

      {showPosition ? (
        <div
          className={`grid gap-2 ${!ui.hideClosePosition && !ui.hideReverse ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {!ui.hideClosePosition ? (
            <ActionBtn
              onClick={props.onClose}
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
