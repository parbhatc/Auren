import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT,
  PRACTICE_CONTRACT_QTY_PRESETS,
} from '../../../../../constants/practice'
import { tradeSideMeta } from '../../../../../constants/tradingSide'
import type { TradePanelSettings } from '../../../../../constants/tradePanelSettings'
import type { TradePanelProps, OrderSide } from '../types'
import { DOM_LADDER_LEVELS } from '../../dom/LadderData'
import {
  buildDomLadder,
  calcDomRowPnl,
  formatDomPrice,
  formatDomRowPnl,
  resolveDomLtpPrice,
} from '../../dom/LadderData'
import { resolveTradePanelBidAsk } from '../../../../../services/tradesea/tradeseaMarketBook'
import LadderRow from '../../dom/LadderRow'
import { DomLtpLockButton } from '../../dom/DomLtpLockButton'
import { formatStatMoney } from '../../account/AccountStatsBar'
import { DomActionButtons } from '../DomActionButtons'
import type { TradeseaMarketBook } from '../../../../../services/tradesea/tradeseaMarketBook'
import { isTradePanelTradingEnabled } from '../../../../../utils/tradePanelTrading'
import { PadTradeSymbolPicker } from '../TradeContractPicker'

/** Must match LadderRow minHeight (22px row + 1px separator). */
const DOM_ROW_HEIGHT_PX = 23

export function DomTab({
  props,
  book,
  bookTick,
  tickSize,
  maxQty,
  chartSymbol,
  fallbackLast,
  panelUi,
}: {
  props: TradePanelProps
  book: TradeseaMarketBook | null
  bookTick: number
  tickSize: number
  maxQty: number
  chartSymbol: string
  fallbackLast?: number | null
  panelUi: TradePanelSettings
}) {
  const qty = Number(props.quantity) || 1
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const chartSymbolKeyRef = useRef(chartSymbol)
  const lastResolvedLtpRef = useRef<number | null>(null)

  useEffect(() => {
    if (chartSymbolKeyRef.current !== chartSymbol) {
      chartSymbolKeyRef.current = chartSymbol
      lastResolvedLtpRef.current = null
    }
  }, [chartSymbol])

  const effectiveFallbackLast = useMemo(() => {
    if (fallbackLast != null && Number.isFinite(fallbackLast)) return fallbackLast
    return lastResolvedLtpRef.current
  }, [fallbackLast])

  const ltpPrice = useMemo(() => {
    const resolved = resolveDomLtpPrice(book, tickSize, effectiveFallbackLast)
    if (resolved != null && Number.isFinite(resolved)) {
      lastResolvedLtpRef.current = resolved
    }
    return resolved ?? lastResolvedLtpRef.current
  }, [book, tickSize, effectiveFallbackLast, bookTick])

  const rows = useMemo(() => {
    const built = buildDomLadder(book, tickSize, DOM_LADDER_LEVELS, effectiveFallbackLast)
    if (built.length > 0) return built
    if (ltpPrice != null && Number.isFinite(ltpPrice)) {
      return buildDomLadder(null, tickSize, DOM_LADDER_LEVELS, ltpPrice)
    }
    return []
  }, [book, tickSize, effectiveFallbackLast, ltpPrice, bookTick])

  const maxVol = useMemo(() => Math.max(1, ...rows.map((r) => r.tradeVolume)), [rows])
  const ladderRef = useRef<HTMLDivElement>(null)
  const [ltpCenterLocked, setLtpCenterLocked] = useState(true)
  const programmaticScrollRef = useRef(false)
  const pendingCenterRef = useRef(true)
  const lastFollowedLtpRef = useRef<number | null>(null)

  useEffect(() => {
    setLtpCenterLocked(true)
    pendingCenterRef.current = true
    lastFollowedLtpRef.current = null
  }, [chartSymbol])

  const centerLtpInView = useCallback(() => {
    const el = ladderRef.current
    if (!el || !rows.length) return false

    const ltpRow = el.querySelector('[data-dom-ltp="true"]') as HTMLElement | null
    if (ltpRow) {
      programmaticScrollRef.current = true
      ltpRow.scrollIntoView({ block: 'center', inline: 'nearest' })
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false
      })
      return true
    }

    const ltp = ltpPrice ?? resolveDomLtpPrice(book, tickSize, effectiveFallbackLast)
    const ltpIdx =
      ltp != null
        ? rows.findIndex((r) => Math.abs(r.price - ltp) < tickSize / 1000)
        : rows.findIndex((r) => r.kind === 'last')
    if (ltpIdx < 0) return false

    programmaticScrollRef.current = true
    el.scrollTop = Math.max(
      0,
      ltpIdx * DOM_ROW_HEIGHT_PX - el.clientHeight / 2 + DOM_ROW_HEIGHT_PX / 2
    )
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false
    })
    return true
  }, [rows, book, tickSize, effectiveFallbackLast, ltpPrice])

  const toggleLtpCenterLock = useCallback(() => {
    setLtpCenterLocked((locked) => {
      if (locked) return false
      pendingCenterRef.current = true
      return true
    })
  }, [])

  useLayoutEffect(() => {
    if (!ltpCenterLocked) return

    const ltp = ltpPrice ?? resolveDomLtpPrice(book, tickSize, effectiveFallbackLast)
    const mustCenter = pendingCenterRef.current
    if (!mustCenter && ltp != null && lastFollowedLtpRef.current === ltp) return

    if (mustCenter) pendingCenterRef.current = false
    if (ltp != null) lastFollowedLtpRef.current = ltp
    centerLtpInView()
  }, [ltpCenterLocked, rows, bookTick, centerLtpInView, ltpPrice, book, tickSize, effectiveFallbackLast, chartSymbol])

  useEffect(() => {
    const el = ladderRef.current
    if (!el) return
    const onScroll = () => {
      if (!ltpCenterLocked || programmaticScrollRef.current) return
      setLtpCenterLocked(false)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ltpCenterLocked])

  const placeDomOrder = useCallback(
    (side: OrderSide, price: number) => {
      if (tradeDisabled) return
      if (props.onSubmitOrder) {
        props.onSubmitOrder(
          side,
          { stopLoss: null, takeProfit: null },
          { orderType: 'limit', entryPrice: price }
        )
        return
      }
      if (side === 'buy') props.onBuy()
      else props.onSell()
    },
    [tradeDisabled, props.onSubmitOrder, props.onBuy, props.onSell]
  )

  const domPosition = useMemo(() => {
    void bookTick
    return props.getDomPositionContext?.() ?? null
  }, [props.getDomPositionContext, bookTick])
  const positionUpl = useMemo(() => {
    void bookTick
    return props.getChartPositionUpl?.() ?? null
  }, [props.getChartPositionUpl, bookTick])

  if (!rows.length && ltpPrice == null) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#7d8590]">
        Waiting for market data…
      </div>
    )
  }

  const { bid, ask } = resolveTradePanelBidAsk(book)
  const fmt = (p: number) => formatDomPrice(p, tickSize)
  const eps = tickSize / 1000
  const ltpLabel = ltpPrice != null ? formatDomPrice(ltpPrice, tickSize) : '—'
  const bidLabel = bid != null ? formatDomPrice(bid, tickSize) : '—'
  const askLabel = ask != null ? formatDomPrice(ask, tickSize) : '—'
  const positionUplFmt =
    positionUpl != null ? formatStatMoney(positionUpl, { decimals: 2 }) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 border-b border-[#475569]/40 py-2">
        <div className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[#0f172a] to-[#0f172a] px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <PadTradeSymbolPicker props={props} disabled={tradeDisabled} />
            <p
              className="mt-1 text-2xl font-bold tabular-nums leading-none tracking-tight text-[#f0c040]"
              aria-live="polite"
              aria-atomic="true"
            >
              {ltpLabel}
            </p>
            <p className="mt-1 text-[10px] font-medium text-[#94a3b8]">Last traded price</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
              <span className={tradeSideMeta('buy').textClass}>
                Bid <span className="font-semibold">{bidLabel}</span>
              </span>
              <span className="text-[#475569]">·</span>
              <span className={tradeSideMeta('sell').textClass}>
                Ask <span className="font-semibold">{askLabel}</span>
              </span>
            </div>
          </div>
          <DomLtpLockButton locked={ltpCenterLocked} onToggle={toggleLtpCenterLock} />
        </div>
        {positionUplFmt != null && (
          <div className="flex justify-end">
            <span className={`text-xs font-semibold tabular-nums ${positionUplFmt.cls}`}>
              {'P&L'} {positionUplFmt.text}
            </span>
          </div>
        )}
      </div>

      <div
        className={`grid shrink-0 border-y border-[#475569]/50 text-[10px] text-dom-header ${
          domPosition ? 'min-w-[280px] grid-cols-8' : 'min-w-[260px] grid-cols-7'
        }`}
      >
        <span className="py-1 text-center">My Bid</span>
        <span className="border-l border-[#475569]/50 py-1 text-center">Bid</span>
        <span className="col-span-2 border-l border-[#475569]/50 py-1 text-center">Price</span>
        <span className="border-l border-[#475569]/50 py-1 text-center">Ask</span>
        <span className="border-l border-[#475569]/50 py-1 text-center">My Ask</span>
        {domPosition ? (
          <span className="border-l border-[#475569]/50 py-1 text-center">P&L</span>
        ) : null}
        <span className="border-l border-[#475569]/50 py-1 text-center">Vol</span>
      </div>

      <div
        ref={ladderRef}
        className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain scrollbar-hide ${
          domPosition ? 'min-w-[280px]' : 'min-w-[260px]'
        }`}
      >
        {rows.map((row) => {
          const isLtp = ltpPrice != null && Math.abs(row.price - ltpPrice) < eps
          const isAboveLtp = ltpPrice != null && row.price > ltpPrice + eps
          const isBelowLtp = ltpPrice != null && row.price < ltpPrice - eps
          const bidZone = isBelowLtp || isLtp
          const askZone = isAboveLtp
          const showPnlColumn = domPosition != null
          const pnlFmt = showPnlColumn
            ? formatDomRowPnl(
                calcDomRowPnl(row.price, domPosition),
                row.price,
                domPosition.entry,
                tickSize
              )
            : { text: '', cls: 'text-[#7d8590]', isEntry: false }
          return (
            <div key={row.price} data-dom-ltp={isLtp ? 'true' : undefined}>
              <LadderRow
                price={row.price}
                bidDepth={row.bidDepth}
                askDepth={row.askDepth}
                tradeVolume={row.tradeVolume}
                isLtp={isLtp}
                isEntryRow={pnlFmt.isEntry}
                buyDisabled={isAboveLtp || tradeDisabled}
                sellDisabled={isBelowLtp || isLtp || tradeDisabled}
                bidZone={bidZone}
                askZone={askZone}
                qty={qty}
                maxVol={maxVol}
                priceLabel={fmt(row.price)}
                showPnlColumn={showPnlColumn}
                pnlText={pnlFmt.text}
                pnlCls={pnlFmt.cls}
                onPlaceOrder={placeDomOrder}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-[#475569] pb-2 pt-2">
        <fieldset
          disabled={tradeDisabled}
          className="m-0 min-w-0 space-y-2 border-0 p-0 disabled:opacity-90"
        >
        <div className="flex h-9 items-center gap-1">
          <div className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-teal-500/50 px-1">
            <button type="button" onClick={() => props.onQuantityChange(-1)} className="p-1">
              <Minus className="w-3.5 h-3.5 text-[#7d8590]" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={props.quantity}
              onChange={(e) => props.onQuantityInputChange(e.target.value)}
              onBlur={props.onQuantityBlur}
              className="no-spinner w-8 bg-transparent text-center text-sm font-semibold tabular-nums text-[#e6edf3] outline-none"
            />
            <span className="text-xs text-[#7d8590]">lots</span>
            <button type="button" onClick={() => props.onQuantityChange(1)} className="p-1">
              <Plus className="w-3.5 h-3.5 text-[#7d8590]" />
            </button>
          </div>
          {PRACTICE_CONTRACT_QTY_PRESETS.filter((p) => p <= maxQty)
            .slice(0, PRACTICE_CONTRACT_QTY_PRESET_CHIP_LIMIT)
            .map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => props.onQuantityUpdate(p)}
              className={`h-9 w-8 rounded-lg border text-sm font-semibold ${
                qty === p ? 'border-teal-500 text-teal-400' : 'border-[#475569] text-[#7d8590]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <DomActionButtons props={props} ui={panelUi} />
        </fieldset>
      </div>
    </div>
  )
}
