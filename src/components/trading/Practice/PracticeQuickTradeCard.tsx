import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { PRACTICE_CONTRACT_QTY_PRESETS } from '../../../constants/practice'
import {
  getPracticeTradePanelSettings,
  type PracticeTradePanelSettings,
} from '../../../constants/practiceTradePanelSettings'
import type { PracticeTradePanelProps } from './PracticeTradePanel'

const QTY_CHIP_LIMIT = 6

export function PracticeQuickTradeCard({
  props,
  maxQty,
  isDark,
  className = '',
}: {
  props: PracticeTradePanelProps
  maxQty: number
  isDark: boolean
  className?: string
}) {
  const [ui, setUi] = useState<PracticeTradePanelSettings>(() => getPracticeTradePanelSettings())
  const qty = Number(props.quantity) || 1
  const presets = useMemo(
    () => PRACTICE_CONTRACT_QTY_PRESETS.filter((p) => p <= maxQty).slice(0, QTY_CHIP_LIMIT),
    [maxQty]
  )

  useEffect(() => {
    const onUiChange = () => setUi(getPracticeTradePanelSettings())
    window.addEventListener('practiceTradePanelSettingsChanged', onUiChange)
    return () => window.removeEventListener('practiceTradePanelSettingsChanged', onUiChange)
  }, [])

  const showPositionActions = !ui.hideClosePosition || !ui.hideReverse || !ui.hideFlattenAll
  const positionActionCount =
    (ui.hideClosePosition ? 0 : 1) + (ui.hideReverse ? 0 : 1) + (ui.hideFlattenAll ? 0 : 1)

  if (isDark) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-[#475569] bg-[#0f172a] shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${className}`}
        aria-label="Quick trade"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#334155] bg-[#020617]/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              Quick trade
            </p>
            <p className="text-[10px] text-[#7d8590]">Tap size, then side</p>
          </div>
          <QtyStepper {...props} variant="dark" />
        </header>

        {presets.length > 0 && (
          <div className="flex justify-center px-3 pt-2.5 pb-1">
            <div className="flex w-fit max-w-full justify-center rounded-xl border border-[#334155] bg-[#020617] p-1 gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => props.onQuantityUpdate(p)}
                  className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-lg font-mono text-sm font-semibold tabular-nums transition ${
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

        <div className="p-3 pt-2 space-y-2.5">
          {!ui.hideBuySell && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={props.onBuy}
                className="h-11 rounded-xl border border-[#3fb950]/35 bg-[#238636] text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-[0.98] transition-transform hover:bg-[#2ea043]"
              >
                Buy
              </button>
              <button
                type="button"
                onClick={props.onSell}
                className="h-11 rounded-xl border border-[#f85149]/35 bg-[#da3633] text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] active:scale-[0.98] transition-transform hover:bg-[#f03e3e]"
              >
                Sell
              </button>
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
                <SecondaryAction label="Close" onClick={props.onClose} />
              )}
              {!ui.hideReverse && (
                <SecondaryAction label="Reverse" onClick={props.onReverse} />
              )}
              {!ui.hideFlattenAll && (
                <SecondaryAction label="Flatten" onClick={props.onFlatten} />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/40 ${className}`}
      aria-label="Quick trade"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Quick trade
          </p>
          <p className="text-[10px] text-slate-400">Tap size, then side</p>
        </div>
        <QtyStepper {...props} variant="light" />
      </header>

      {presets.length > 0 && (
        <div className="flex justify-center px-3 pt-2.5 pb-1">
          <div className="flex w-fit max-w-full justify-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1 overflow-x-auto">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => props.onQuantityUpdate(p)}
                className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-lg font-mono text-sm font-semibold tabular-nums transition ${
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

      <div className="p-3 pt-2 space-y-2.5">
        {!ui.hideBuySell && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={props.onBuy}
              className="h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md shadow-emerald-900/20 active:scale-[0.98] transition-transform hover:bg-emerald-500"
            >
              Buy
            </button>
            <button
              type="button"
              onClick={props.onSell}
              className="h-11 rounded-xl bg-red-600 text-sm font-bold text-white shadow-md shadow-red-900/20 active:scale-[0.98] transition-transform hover:bg-red-500"
            >
              Sell
            </button>
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
              <SecondaryAction label="Close" onClick={props.onClose} light />
            )}
            {!ui.hideReverse && <SecondaryAction label="Reverse" onClick={props.onReverse} light />}
            {!ui.hideFlattenAll && (
              <SecondaryAction label="Flatten" onClick={props.onFlatten} light />
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
}: Pick<
  PracticeTradePanelProps,
  'quantity' | 'onQuantityChange' | 'onQuantityInputChange' | 'onQuantityBlur'
> & { variant: 'dark' | 'light' }) {
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
        onClick={() => onQuantityChange(-1)}
        className={`px-2.5 flex items-center justify-center ${btn}`}
        aria-label="Decrease quantity"
      >
        <Minus className="w-3.5 h-3.5" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={quantity}
        onChange={(e) => onQuantityInputChange(e.target.value)}
        onBlur={onQuantityBlur}
        className={`no-spinner w-9 bg-transparent text-center text-sm font-bold font-mono tabular-nums outline-none border-x ${divider} ${input}`}
        aria-label="Contract quantity"
      />
      <button
        type="button"
        onClick={() => onQuantityChange(1)}
        className={`px-2.5 flex items-center justify-center ${btn}`}
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
}: {
  label: string
  onClick: () => void
  light?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] ${
        light
          ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          : 'border border-[#475569] bg-[#1e293b]/80 text-[#adbac7] hover:bg-[#334155] hover:text-[#e6edf3]'
      }`}
    >
      {label}
    </button>
  )
}
