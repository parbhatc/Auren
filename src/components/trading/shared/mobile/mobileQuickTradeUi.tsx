import { Minus, Plus } from 'lucide-react'
import type { TradePanelProps } from '../pad/TradePanel'
import { TRADE_OFFLINE_DISABLED_CLASS } from '../../../../utils/tradePanelTrading'

export function MobileQtyStepper({
  props,
  isDark,
  disabled,
  className = '',
}: {
  props: TradePanelProps
  isDark: boolean
  disabled?: boolean
  className?: string
}) {
  const shell = isDark
    ? 'border-[#475569] bg-[#020617]'
    : 'border-slate-200 bg-slate-50'
  const btn = isDark
    ? 'text-[#7d8590] hover:bg-[#1e293b] hover:text-[#e6edf3]'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
  const input = isDark ? 'text-[#e6edf3]' : 'text-slate-900'
  const divider = isDark ? 'border-[#334155]' : 'border-slate-200'

  return (
    <div
      className={`flex shrink-0 items-stretch overflow-hidden rounded-md border ${shell} ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => props.onQuantityChange(-1)}
        className={`flex items-center justify-center px-1.5 ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Decrease quantity"
      >
        <Minus className="h-3 w-3" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={props.quantity}
        disabled={disabled}
        onChange={(e) => props.onQuantityInputChange(e.target.value)}
        onBlur={props.onQuantityBlur}
        className={`no-spinner w-7 bg-transparent text-center text-xs font-bold font-mono tabular-nums outline-none border-x ${divider} ${input} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Contract quantity"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => props.onQuantityChange(1)}
        className={`flex items-center justify-center px-1.5 ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Increase quantity"
      >
        <Plus className="h-3 w-3" aria-hidden />
      </button>
    </div>
  )
}

export function MobileQtyInput({  props,
  isDark,
  disabled,
  className = '',
}: {
  props: TradePanelProps
  isDark: boolean
  disabled?: boolean
  className?: string
}) {
  const shell = isDark
    ? 'border-[#475569]/60 bg-[#0f172a]/80 text-[#e6edf3] placeholder:text-[#64748b] focus:border-violet-500/40'
    : 'border-slate-200 bg-white text-slate-900 focus:border-violet-400'

  return (
    <input
      type="text"
      inputMode="numeric"
      value={props.quantity}
      disabled={disabled}
      onChange={(e) => props.onQuantityInputChange(e.target.value)}
      onBlur={props.onQuantityBlur}
      className={`no-spinner w-9 shrink-0 rounded-md border px-1 py-0.5 text-center text-[11px] font-bold font-mono tabular-nums outline-none ${shell} ${TRADE_OFFLINE_DISABLED_CLASS} ${className}`}
      aria-label="Contract quantity"
    />
  )
}

export function MobileMarketLabel({ side, qty }: { side: 'buy' | 'sell'; qty: number }) {
  const sign = side === 'buy' ? '+' : '-'
  const verb = side === 'buy' ? 'Buy' : 'Sell'
  return (
    <span className="text-center leading-tight">
      {verb} {sign}
      {qty} Market
    </span>
  )
}

export const MOBILE_MARKET_BTN =
  '!w-full !min-w-0 !flex-1 !h-10 !rounded-lg px-1.5 text-[10px] font-bold uppercase tracking-wide !shadow-[0_2px_8px_rgba(0,0,0,0.2)]'

export const COMPACT_MARKET_BTN =
  '!h-9 !min-w-0 !flex-1 !rounded-lg px-1 text-[9px] font-bold uppercase tracking-wide !shadow-[0_2px_6px_rgba(0,0,0,0.2)]'
