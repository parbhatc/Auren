import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  resolveTradePanelBidAsk,
  type TradeseaMarketBook,
} from '../../../../services/tradesea/tradeseaMarketBook'
import type { TradePanelProps } from '../pad/TradePanel'
import { isTradePanelTradingEnabled, TRADE_OFFLINE_DISABLED_CLASS } from '../../../../utils/tradePanelTrading'
import { getTradePanelSettings } from '../../../../constants/tradePanelSettings'
import { PRACTICE_CONTRACT_SYMBOL_PRESETS } from '../../../../constants/practice'

const fmtPrice = (p: number) =>
  p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Floating scalp widget (detached from chart rail). */
export function ScalpFloat({
  chartSymbol,
  props,
  maxQty,
  onDock,
  onDragStart,
  dockTitle = 'Dock to chart',
}: {
  chartSymbol: string
  props: TradePanelProps
  maxQty: number
  onDock: () => void
  onDragStart?: (clientX: number, clientY: number) => void
  dockTitle?: string
}) {
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const [bookTick, setBookTick] = useState(0)
  const [panelUi, setPanelUi] = useState(() => getTradePanelSettings())
  useEffect(() => {
    const onUiChange = () => setPanelUi(getTradePanelSettings())
    window.addEventListener('practiceTradePanelSettingsChanged', onUiChange)
    return () => window.removeEventListener('practiceTradePanelSettingsChanged', onUiChange)
  }, [])
  useEffect(() => {
    props.ensureMarketBook?.()
  }, [props.ensureMarketBook])

  useEffect(() => {
    if (!props.subscribeMarketBook) return
    return props.subscribeMarketBook(() => setBookTick((n) => n + 1))
  }, [props.subscribeMarketBook])
  const book = useMemo(() => {
    void bookTick
    return props.getMarketBook?.() ?? null
  }, [props.getMarketBook, bookTick])
  const { bid, ask } = resolveTradePanelBidAsk(book)

  const activeRoot = useMemo(() => {
    const s = chartSymbol.trim().toUpperCase()
    const colon = s.indexOf(':')
    return colon >= 0 ? s.slice(colon + 1) : s
  }, [chartSymbol])

  const pickContract = (root: string) => {
    const sym = root.includes(':') ? root : `CME:${root}`
    props.onChartSymbolChange?.(sym)
  }

  return (
    <div
      className="pointer-events-auto select-none rounded-2xl border border-[#475569] bg-[#0f172a] p-3 shadow-2xl w-[346px]"
      style={{ touchAction: 'none' }}
    >
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center justify-between gap-2 cursor-move"
          onMouseDown={(e) => onDragStart?.(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0]
            if (t) onDragStart?.(t.clientX, t.clientY)
          }}
        >
          <span className="text-base text-[#7d8590] tabular-nums">{chartSymbol}</span>
          <button
            type="button"
            onClick={onDock}
            title={dockTitle}
            aria-label={dockTitle}
            className="p-1 hover:opacity-80"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 13 13" fill="none" width="16" height="16" aria-hidden>
              <path
                d="M12.5 12.5H9M12.5 12.5L13.5 9M12.5 12.5L8.5 8.5M9 0.5H12.5M12.5 0.5V4M12.5 0.5L8.5 4.5M4 0.5H0.5M0.5 0.5V4M0.5 0.5L4.5 4.5M0.5 9V12.5M0.5 12.5H4M0.5 12.5L4.5 8.5"
                stroke="#A4A8B2"
              />
            </svg>
          </button>
        </div>

        <div
          className={
            panelUi.hideBuySell ? 'flex justify-center' : 'grid grid-cols-3 gap-1'
          }
        >
          {!panelUi.hideBuySell && (
            <button
              type="button"
              disabled={tradeDisabled}
              onClick={props.onBuy}
              className={`h-9 rounded-2xl bg-[#238636] hover:bg-[#2ea043] text-sm font-semibold text-white ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              Buy
            </button>
          )}
          <div className="flex h-9 items-center justify-center gap-1 rounded-2xl border border-[#8b5cf6]/50 bg-[#020617] px-1">
            <button
              type="button"
              disabled={tradeDisabled}
              onClick={() => props.onQuantityChange(-1)}
              className={`p-1 text-[#7d8590] hover:text-[#e6edf3] ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={props.quantity}
              disabled={tradeDisabled}
              onChange={(e) => props.onQuantityInputChange(e.target.value)}
              onBlur={props.onQuantityBlur}
              className="no-spinner w-8 bg-transparent text-center text-sm font-semibold tabular-nums text-[#e6edf3] outline-none"
            />
            <span className="text-xs text-[#7d8590]">lots</span>
            <button
              type="button"
              disabled={tradeDisabled}
              onClick={() => props.onQuantityChange(1)}
              className={`p-1 text-[#7d8590] hover:text-[#e6edf3] ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {!panelUi.hideBuySell && (
            <button
              type="button"
              disabled={tradeDisabled}
              onClick={props.onSell}
              className={`h-9 rounded-2xl bg-[#da3633] hover:bg-[#f85149] text-sm font-semibold text-white ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              Sell
            </button>
          )}
        </div>

        {!panelUi.hideJoinBidAsk && (
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              disabled={tradeDisabled}
              onClick={props.onJoinBid ?? props.onBuy}
              className={`flex h-9 items-center justify-between rounded-2xl border border-[#1e293b] bg-[#0f172a] px-3 hover:bg-[#1c2128] ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              <span className="text-sm font-semibold text-[#adbac7]">Join Bid</span>
              <span className="text-sm font-semibold tabular-nums text-[#3fb950]">
                {bid != null ? fmtPrice(bid) : '—'}
              </span>
            </button>
            <button
              type="button"
              disabled={tradeDisabled}
              onClick={props.onJoinAsk ?? props.onSell}
              className={`flex h-9 items-center justify-between rounded-2xl border border-[#1e293b] bg-[#0f172a] px-3 hover:bg-[#1c2128] ${TRADE_OFFLINE_DISABLED_CLASS}`}
            >
              <span className="text-sm font-semibold text-[#adbac7]">Join Ask</span>
              <span className="text-sm font-semibold tabular-nums text-[#f85149]">
                {ask != null ? fmtPrice(ask) : '—'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
