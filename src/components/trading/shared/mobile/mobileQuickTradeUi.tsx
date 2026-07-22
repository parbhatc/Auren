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
    ? 'border-[#3F3F46] bg-[#121215]'
    : 'border-[#E4E4E7] bg-[#FAFAFA]'
  const btn = isDark
    ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]'
    : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
  const input = isDark ? 'text-[#FAFAFA]' : 'text-[#09090B]'
  const divider = isDark ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'

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
    ? 'border-[#3F3F46] bg-[#18181B] text-[#FAFAFA] placeholder:text-[#71717A] focus:border-blue-500'
    : 'border-[#E4E4E7] bg-white text-[#09090B] focus:border-blue-600'

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
  '!h-11 !w-full !min-w-0 !flex-1 !rounded-lg px-1.5 text-[11px] font-bold uppercase tracking-wide'

export const COMPACT_MARKET_BTN =
  '!h-10 !min-w-0 !flex-1 !rounded-lg px-1 text-[10px] font-bold uppercase tracking-wide'
