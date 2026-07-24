import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  FlipHorizontal2,
  Layers,
  LogOut,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TradeSideButton } from '../../../common/TradeSideButton'
import {
  PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT,
  PRACTICE_CONTRACT_QTY_PRESETS,
} from '../../../../constants/practice'
import {
  getTradePanelSettings,
  type TradePanelSettings,
} from '../../../../constants/tradePanelSettings'
import type { TradePanelProps } from '../pad/TradePanel'
import { isTradePanelTradingEnabled, TRADE_OFFLINE_DISABLED_CLASS } from '../../../../utils/tradePanelTrading'
import { PadTradeSymbolPicker } from '../pad/TradeContractPicker'
import { MobileMarketLabel, MOBILE_MARKET_BTN } from './mobileQuickTradeUi'

const MOBILE_FLUSH_SHELL =
  'max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:border-t max-lg:shadow-none'

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#18181B]'

export function QuickTradeCard({
  props,
  maxQty,
  isDark,
  className = '',
  headerActions,
  mobileDockClass = 'auren-quick-trade-mobile-dock',
}: {
  props: TradePanelProps
  maxQty: number
  isDark: boolean
  className?: string
  headerActions?: ReactNode
  mobileDockClass?: string
}) {
  const [ui, setUi] = useState<TradePanelSettings>(() => getTradePanelSettings())
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const qty = Number(props.quantity) || 1
  const presets = useMemo(
    () =>
      PRACTICE_CONTRACT_QTY_PRESETS.filter((p) => p <= maxQty).slice(
        0,
        PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT
      ),
    [maxQty]
  )

  useEffect(() => {
    const onUiChange = () => setUi(getTradePanelSettings())
    window.addEventListener('practiceTradePanelSettingsChanged', onUiChange)
    return () => window.removeEventListener('practiceTradePanelSettingsChanged', onUiChange)
  }, [])

  const showPositionActions = !ui.hideClosePosition || !ui.hideReverse || !ui.hideFlattenAll
  const positionActionCount =
    (ui.hideClosePosition ? 0 : 1) + (ui.hideReverse ? 0 : 1) + (ui.hideFlattenAll ? 0 : 1)

  const shell = isDark
    ? 'border-[#27272A] bg-[#18181B]'
    : 'border-[#E4E4E7] bg-white'
  const presetShell = isDark
    ? 'border-[#3F3F46] bg-[#121215]'
    : 'border-[#E4E4E7] bg-[#FAFAFA]'
  const presetActive = isDark ? 'bg-[#3b82f6] text-white' : 'bg-blue-600 text-white'
  const presetIdle = isDark
    ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]'
    : 'text-slate-600 hover:bg-white hover:text-slate-900'
  const offline = isDark ? 'text-[#7d8590]' : 'text-slate-400'

  const presetQtyStrip = presets.length > 0 ? (
    <PresetQtyStrip
      props={props}
      presets={presets}
      qty={qty}
      isDark={isDark}
      disabled={tradeDisabled}
      compact
    />
  ) : (
    <QtyStepper {...props} variant={isDark ? 'dark' : 'light'} disabled={tradeDisabled} compact />
  )

  const mobilePositionActions =
    showPositionActions && positionActionCount > 0 ? (
      <div
        className="grid w-full min-w-0 gap-1"
        style={{ gridTemplateColumns: `repeat(${positionActionCount}, minmax(0, 1fr))` }}
      >
        {!ui.hideClosePosition && (
          <DomStyleAction
            compact
            onClick={props.onClose}
            disabled={tradeDisabled}
            title="Close position"
            isDark={isDark}
            tone="close"
          >
            <LogOut className="h-3 w-3 shrink-0 opacity-75" aria-hidden />
            Close
          </DomStyleAction>
        )}
        {!ui.hideReverse && (
          <DomStyleAction
            compact
            onClick={props.onReverse}
            disabled={tradeDisabled}
            title="Reverse position"
            isDark={isDark}
            tone="reverse"
          >
            <FlipHorizontal2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            Reverse
          </DomStyleAction>
        )}
        {!ui.hideFlattenAll && (
          <DomStyleAction
            compact
            onClick={props.onFlatten}
            disabled={tradeDisabled}
            title="Flatten all positions"
            isDark={isDark}
            tone="flatten"
          >
            <Layers className="h-3 w-3 shrink-0 opacity-85" aria-hidden />
            Flatten
          </DomStyleAction>
        )}
      </div>
    ) : null

  const desktopPositionActions =
    showPositionActions && positionActionCount > 0 ? (
      <div className="flex flex-wrap items-center justify-center gap-1">
        {!ui.hideClosePosition && (
          <DomStyleAction
            onClick={props.onClose}
            disabled={tradeDisabled}
            title="Close position"
            isDark={isDark}
            tone="close"
          >
            <LogOut className="h-3 w-3 shrink-0 opacity-75" aria-hidden />
            Close
          </DomStyleAction>
        )}
        {!ui.hideReverse && (
          <DomStyleAction
            onClick={props.onReverse}
            disabled={tradeDisabled}
            title="Reverse position"
            isDark={isDark}
            tone="reverse"
          >
            <FlipHorizontal2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            Reverse
          </DomStyleAction>
        )}
        {!ui.hideFlattenAll && (
          <DomStyleAction
            onClick={props.onFlatten}
            disabled={tradeDisabled}
            title="Flatten all positions"
            isDark={isDark}
            tone="flatten"
          >
            <Layers className="h-3 w-3 shrink-0 opacity-85" aria-hidden />
            Flatten
          </DomStyleAction>
        )}
      </div>
    ) : null

  const mobileToolbarDivider = isDark ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'

  const mobileToolbarRow = (
    <div className="flex min-w-0 items-center gap-1">
      {headerActions ? (
        <div
          className={`mr-0.5 flex shrink-0 items-center gap-0.5 border-r pr-1 ${mobileToolbarDivider}`}
        >
          {headerActions}
        </div>
      ) : null}
      <div className="shrink-0">
        <PadTradeSymbolPicker props={props} disabled={tradeDisabled} placement="above" dockCompact />
      </div>
      <div className="min-w-0 flex-1">{presetQtyStrip}</div>
    </div>
  )

  return (
    <div
      className={['overflow-hidden rounded-2xl border', shell, MOBILE_FLUSH_SHELL, mobileDockClass, className]
        .filter(Boolean)
        .join(' ')}
      aria-label="Quick trade"
    >
      <div className="relative px-2 py-1.5 max-lg:px-2 max-lg:py-1.5">
        {headerActions ? (
          <div className="absolute right-0 top-0 z-10 hidden shrink-0 items-center gap-0.5 lg:flex">
            {headerActions}
          </div>
        ) : null}

        {tradeDisabled ? (
          <p className={`mb-1 pr-16 text-[9px] ${offline}`}>Market data offline</p>
        ) : null}

        {!ui.hideBuySell && (
          <>
            <div className="flex flex-col gap-1.5 lg:hidden">
              {mobileToolbarRow}

              <div className="grid grid-cols-2 gap-1.5">
                <TradeSideButton
                  side="buy"
                  variant="market"
                  disabled={tradeDisabled}
                  onClick={props.onBuy}
                  title={`Market buy ${qty} contract${qty === 1 ? '' : 's'}`}
                  className={`${MOBILE_MARKET_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
                >
                  <MobileMarketLabel side="buy" qty={qty} />
                </TradeSideButton>

                <TradeSideButton
                  side="sell"
                  variant="market"
                  disabled={tradeDisabled}
                  onClick={props.onSell}
                  title={`Market sell ${qty} contract${qty === 1 ? '' : 's'}`}
                  className={`${MOBILE_MARKET_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
                >
                  <MobileMarketLabel side="sell" qty={qty} />
                </TradeSideButton>
              </div>

              {mobilePositionActions}
            </div>

            <div className="hidden flex-col gap-1 lg:flex">
              <div className="flex items-stretch gap-1.5 pr-14">
                <TradeSideButton
                  side="buy"
                  variant="market"
                  disabled={tradeDisabled}
                  onClick={props.onBuy}
                  title="Market buy"
                  className={`min-w-0 flex-1 !h-10 gap-1.5 text-xs font-semibold ${TRADE_OFFLINE_DISABLED_CLASS}`}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                  Buy
                </TradeSideButton>

                <div className="flex min-w-0 shrink flex-col items-center justify-center gap-0.5 px-0.5">
                  <PadTradeSymbolPicker props={props} disabled={tradeDisabled} placement="above" />
                  <QtyStepper
                    {...props}
                    variant={isDark ? 'dark' : 'light'}
                    disabled={tradeDisabled}
                    compact
                  />
                </div>

                <TradeSideButton
                  side="sell"
                  variant="market"
                  disabled={tradeDisabled}
                  onClick={props.onSell}
                  title="Market sell"
                  className={`min-w-0 flex-1 !h-10 gap-1.5 text-xs font-semibold ${TRADE_OFFLINE_DISABLED_CLASS}`}
                >
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                  Sell
                </TradeSideButton>
              </div>

              {presets.length > 0 && (
                <div className="flex justify-center overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div className={`flex w-fit max-w-full gap-0.5 rounded-lg border p-0.5 ${presetShell}`}>
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={tradeDisabled}
                        onClick={() => props.onQuantityUpdate(p)}
                        className={`h-6 min-w-[1.75rem] shrink-0 rounded-md px-1.5 font-mono text-[11px] font-semibold tabular-nums transition ${TRADE_OFFLINE_DISABLED_CLASS} ${
                          qty === p ? presetActive : presetIdle
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {desktopPositionActions}
            </div>
          </>
        )}

        {ui.hideBuySell && (presetQtyStrip || mobilePositionActions) ? (
          <div className="flex flex-col gap-1.5 lg:hidden">
            {mobileToolbarRow}
            {mobilePositionActions}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PresetQtyStrip({
  props,
  presets,
  qty,
  isDark,
  disabled,
  compact = false,
}: {
  props: TradePanelProps
  presets: number[]
  qty: number
  isDark: boolean
  disabled?: boolean
  compact?: boolean
}) {
  const circle = compact
    ? 'flex h-6 w-full min-w-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition active:scale-95'
    : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition active:scale-95'
  const stepBtn = isDark
    ? 'bg-[#27272A] text-[#A1A1AA] hover:bg-[#3F3F46]'
    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
  const presetIdle = isDark
    ? 'bg-[#27272A] text-[#A1A1AA] hover:bg-[#3F3F46]'
    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
  const presetActive = isDark
    ? 'bg-[#e8eaed] font-bold text-[#14181f] shadow-sm'
    : 'bg-slate-900 font-bold text-white shadow-sm'
  const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'

  const stepDown = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => props.onQuantityChange(-1)}
      className={`${circle} ${stepBtn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
      aria-label="Decrease quantity"
    >
      <Minus className={iconClass} aria-hidden />
    </button>
  )

  const stepUp = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => props.onQuantityChange(1)}
      className={`${circle} ${stepBtn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
      aria-label="Increase quantity"
    >
      <Plus className={iconClass} aria-hidden />
    </button>
  )

  const presetButtons = presets.map((p) => (
    <button
      key={p}
      type="button"
      disabled={disabled}
      onClick={() => props.onQuantityUpdate(p)}
      className={`${circle} ${TRADE_OFFLINE_DISABLED_CLASS} ${qty === p ? presetActive : presetIdle}`}
    >
      {p}
    </button>
  ))

  if (compact) {
    return (
      <div
        className="grid min-w-0 flex-1 items-center gap-0.5"
        style={{ gridTemplateColumns: `repeat(${presets.length + 2}, minmax(0, 1fr))` }}
        aria-label="Quantity"
      >
        {stepDown}
        {presetButtons}
        {stepUp}
      </div>
    )
  }

  return (
    <div
      className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]"
      aria-label="Quantity"
    >
      {stepDown}
      {presetButtons}
      {stepUp}
    </div>
  )
}

function QtyStepper({
  quantity,
  onQuantityChange,
  onQuantityInputChange,
  onQuantityBlur,
  variant,
  disabled,
  compact = false,
}: Pick<
  TradePanelProps,
  'quantity' | 'onQuantityChange' | 'onQuantityInputChange' | 'onQuantityBlur'
> & { variant: 'dark' | 'light'; disabled?: boolean; compact?: boolean }) {
  const shell =
    variant === 'dark'
      ? 'border-[#3F3F46] bg-[#121215]'
      : 'border-[#E4E4E7] bg-white'
  const btn =
    variant === 'dark'
      ? 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#FAFAFA]'
      : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]'
  const input = variant === 'dark' ? 'text-[#FAFAFA]' : 'text-[#09090B]'
  const divider = variant === 'dark' ? 'border-[#3F3F46]' : 'border-[#E4E4E7]'
  const radius = compact ? 'rounded-md' : 'rounded-xl'
  const btnPad = compact ? 'px-1.5' : 'px-2.5'
  const inputW = compact ? 'w-7 text-xs' : 'w-9 text-sm'

  return (
    <div className={`flex items-stretch overflow-hidden border ${radius} ${shell}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantityChange(-1)}
        className={`flex items-center justify-center ${btnPad} ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Decrease quantity"
      >
        <Minus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={quantity}
        disabled={disabled}
        onChange={(e) => onQuantityInputChange(e.target.value)}
        onBlur={onQuantityBlur}
        className={`no-spinner bg-transparent text-center font-bold font-mono tabular-nums outline-none border-x ${divider} ${input} ${inputW}`}
        aria-label="Contract quantity"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantityChange(1)}
        className={`flex items-center justify-center ${btnPad} ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Increase quantity"
      >
        <Plus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      </button>
    </div>
  )
}

function DomStyleAction({
  onClick,
  disabled,
  title,
  isDark,
  tone,
  compact = false,
  className = '',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  isDark: boolean
  tone: 'close' | 'reverse' | 'flatten'
  compact?: boolean
  className?: string
  children: ReactNode
}) {
  const toneClass = isDark
    ? {
        close: 'border border-[#3F3F46] bg-[#27272A] text-[#D4D4D8] hover:border-[#52525B] hover:bg-[#3F3F46]',
        reverse:
          'border border-blue-500/35 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15',
        flatten:
          'border border-amber-500/40 bg-amber-500/12 text-amber-200 hover:bg-amber-500/20',
      }[tone]
    : {
        close: 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
        reverse: 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
        flatten: 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
      }[tone]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${FOCUS_RING} ${toneClass} ${TRADE_OFFLINE_DISABLED_CLASS} ${
        compact
          ? 'h-7 min-w-0 w-full gap-0.5 rounded-lg px-1 text-[9px] font-semibold'
          : 'h-7 w-auto shrink-0 gap-1 rounded-lg px-2.5 text-[10px] font-semibold'
      } ${className}`}
    >
      {children}
    </button>
  )
}
