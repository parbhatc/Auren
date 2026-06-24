import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react'
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

const QTY_CHIP_LIMIT = 6

const MOBILE_FLUSH_SHELL =
  'max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:border-t max-lg:shadow-none'
const MOBILE_HEADER_PAD = 'px-3 py-2.5 max-lg:px-2 max-lg:py-1.5'
const MOBILE_BODY_PAD = 'p-3 pt-2 space-y-2.5 max-lg:px-2 max-lg:pt-1.5 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]'
const MOBILE_PRESET_PAD = 'flex justify-center px-3 pt-2.5 pb-1 max-lg:px-2 max-lg:pt-0 max-lg:pb-0'
const MOBILE_BUY_SELL_GRID = 'grid grid-cols-2 gap-2'
const MOBILE_BUY_SELL_BTN = 'max-lg:h-12 text-sm'

export function QuickTradeCard({
  props,
  maxQty,
  isDark,
  className = '',
  headerActions,
}: {
  props: TradePanelProps
  maxQty: number
  isDark: boolean
  className?: string
  /** Shown in the quick-trade header (e.g. mobile float / minimize). */
  headerActions?: ReactNode
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

  if (isDark) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-[#475569] bg-[#0f172a] shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${MOBILE_FLUSH_SHELL} ${className}`}
        aria-label="Quick trade"
      >
        <header className={`flex items-center justify-between gap-2 border-b border-[#334155] bg-[#020617]/60 ${MOBILE_HEADER_PAD}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              Quick trade
            </p>
            <div className="mt-0.5">
              <PadTradeSymbolPicker props={props} disabled={tradeDisabled} placement="above" />
            </div>
            {tradeDisabled ? (
              <p className="mt-1 text-[10px] text-[#7d8590]">Market data offline</p>
            ) : null}
          </div>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-0.5">{headerActions}</div>
          ) : null}
          <QtyStepper {...props} variant="dark" disabled={tradeDisabled} />
        </header>

        {presets.length > 0 && (
          <div className={MOBILE_PRESET_PAD}>
            <div className="flex w-fit max-w-full justify-center rounded-xl border border-[#334155] bg-[#020617] p-1 gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={tradeDisabled}
                  onClick={() => props.onQuantityUpdate(p)}
                  className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-lg font-mono text-sm font-semibold tabular-nums transition ${TRADE_OFFLINE_DISABLED_CLASS} ${
                    qty === p
                      ? 'bg-[#8b5cf6] text-white shadow-sm'
                      : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-[#e6edf3]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={MOBILE_BODY_PAD}>
          {!ui.hideBuySell && (
            <div className={MOBILE_BUY_SELL_GRID}>
              <TradeSideButton
                side="buy"
                variant="market"
                disabled={tradeDisabled}
                onClick={props.onBuy}
                title="Market buy"
                className={`${MOBILE_BUY_SELL_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
              >
                <TrendingUp className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Buy
              </TradeSideButton>
              <TradeSideButton
                side="sell"
                variant="market"
                disabled={tradeDisabled}
                onClick={props.onSell}
                title="Market sell"
                className={`${MOBILE_BUY_SELL_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
              >
                <TrendingDown className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Sell
              </TradeSideButton>
            </div>
          )}

          {showPositionActions && positionActionCount > 0 && (
            <div
              className={`grid gap-1.5 ${
                positionActionCount === 1
                  ? 'grid-cols-1'
                  : positionActionCount === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
              }`}
            >
              {!ui.hideClosePosition && (
                <SecondaryAction label="Close" onClick={props.onClose} disabled={tradeDisabled} />
              )}
              {!ui.hideReverse && (
                <SecondaryAction label="Reverse" onClick={props.onReverse} disabled={tradeDisabled} />
              )}
              {!ui.hideFlattenAll && (
                <SecondaryAction label="Flatten" onClick={props.onFlatten} disabled={tradeDisabled} />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/40 ${MOBILE_FLUSH_SHELL} ${className}`}
      aria-label="Quick trade"
    >
      <header className={`flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 ${MOBILE_HEADER_PAD}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Quick trade
          </p>
          <div className="mt-0.5">
            <PadTradeSymbolPicker props={props} disabled={tradeDisabled} placement="above" />
          </div>
          {tradeDisabled ? (
            <p className="mt-1 text-[10px] text-slate-400">Market data offline</p>
          ) : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-0.5">{headerActions}</div>
        ) : null}
        <QtyStepper {...props} variant="light" disabled={tradeDisabled} />
      </header>

      {presets.length > 0 && (
        <div className={MOBILE_PRESET_PAD}>
          <div className="flex w-fit max-w-full justify-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1 overflow-x-auto">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                disabled={tradeDisabled}
                onClick={() => props.onQuantityUpdate(p)}
                className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-lg font-mono text-sm font-semibold tabular-nums transition ${TRADE_OFFLINE_DISABLED_CLASS} ${
                  qty === p
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={MOBILE_BODY_PAD}>
        {!ui.hideBuySell && (
          <div className={MOBILE_BUY_SELL_GRID}>
            <TradeSideButton
              side="buy"
              variant="market"
              disabled={tradeDisabled}
              onClick={props.onBuy}
              title="Market buy"
              className={`${MOBILE_BUY_SELL_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              <TrendingUp className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Buy
            </TradeSideButton>
            <TradeSideButton
              side="sell"
              variant="market"
              disabled={tradeDisabled}
              onClick={props.onSell}
              title="Market sell"
              className={`${MOBILE_BUY_SELL_BTN} ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              <TrendingDown className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Sell
            </TradeSideButton>
          </div>
        )}

        {showPositionActions && positionActionCount > 0 && (
          <div
            className={`grid gap-1.5 ${
              positionActionCount === 1
                ? 'grid-cols-1'
                : positionActionCount === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
            }`}
          >
            {!ui.hideClosePosition && (
              <SecondaryAction label="Close" onClick={props.onClose} light disabled={tradeDisabled} />
            )}
            {!ui.hideReverse && (
              <SecondaryAction label="Reverse" onClick={props.onReverse} light disabled={tradeDisabled} />
            )}
            {!ui.hideFlattenAll && (
              <SecondaryAction label="Flatten" onClick={props.onFlatten} light disabled={tradeDisabled} />
            )}
          </div>
        )}
      </div>
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
}: Pick<
  TradePanelProps,
  'quantity' | 'onQuantityChange' | 'onQuantityInputChange' | 'onQuantityBlur'
> & { variant: 'dark' | 'light'; disabled?: boolean }) {
  const shell =
    variant === 'dark'
      ? 'border-[#475569] bg-[#020617]'
      : 'border-slate-200 bg-white'
  const btn =
    variant === 'dark'
      ? 'text-[#7d8590] hover:bg-[#1e293b] hover:text-[#e6edf3]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
  const input = variant === 'dark' ? 'text-[#e6edf3]' : 'text-slate-900'
  const divider = variant === 'dark' ? 'border-[#334155]' : 'border-slate-200'

  return (
    <div className={`flex items-stretch rounded-xl border overflow-hidden ${shell}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantityChange(-1)}
        className={`px-2.5 flex items-center justify-center ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Decrease quantity"
      >
        <Minus className="w-3.5 h-3.5" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={quantity}
        disabled={disabled}
        onChange={(e) => onQuantityInputChange(e.target.value)}
        onBlur={onQuantityBlur}
        className={`no-spinner w-9 bg-transparent text-center text-sm font-bold font-mono tabular-nums outline-none border-x ${divider} ${input}`}
        aria-label="Contract quantity"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantityChange(1)}
        className={`px-2.5 flex items-center justify-center ${btn} ${TRADE_OFFLINE_DISABLED_CLASS}`}
        aria-label="Increase quantity"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  )
}

function SecondaryAction({
  label,
  onClick,
  light = false,
  disabled = false,
}: {
  label: string
  onClick: () => void
  light?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] ${TRADE_OFFLINE_DISABLED_CLASS} ${
        light
          ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          : 'border border-[#475569] bg-[#1e293b]/80 text-[#adbac7] hover:bg-[#334155] hover:text-[#e6edf3]'
      }`}
    >
      {label}
    </button>
  )
}
