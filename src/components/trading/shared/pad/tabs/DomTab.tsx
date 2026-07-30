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
import { resolveDomBidAsk } from '../../../../../services/tradesea/tradeseaMarketBook'
import LadderRow from '../../dom/LadderRow'
import { DomLtpLockButton } from '../../dom/DomLtpLockButton'
import { formatStatMoney } from '../../account/AccountStatsBar'
import { DomActionButtons } from '../DomActionButtons'
import type { TradeseaMarketBook } from '../../../../../services/tradesea/tradeseaMarketBook'
import { isTradePanelTradingEnabled } from '../../../../../utils/tradePanelTrading'
import { PadTradeSymbolPicker } from '../TradeContractPicker'
import { useThrottledTick } from '../../../../../hooks/useThrottledTick'

/** Must match LadderRow minHeight (22px row + 1px separator). */
const DOM_ROW_HEIGHT_PX = 23
const DOM_RENDER_OVERSCAN_ROWS = 8

function domVisibleRange(
  rowCount: number,
  scrollTop: number,
  viewportHeight: number
): { start: number; end: number } {
  if (rowCount <= 0) return { start: 0, end: 0 }
  const firstVisible = Math.max(0, Math.floor(scrollTop / DOM_ROW_HEIGHT_PX))
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / DOM_ROW_HEIGHT_PX))
  return {
    start: Math.max(0, firstVisible - DOM_RENDER_OVERSCAN_ROWS),
    end: Math.min(rowCount, firstVisible + visibleCount + DOM_RENDER_OVERSCAN_ROWS),
  }
}

export function DomTab({
  props,
  book,
  ltpTick,
  bookTick,
  tickSize,
  maxQty,
  chartSymbol,
  fallbackLast,
  panelUi,
  compact = false,
}: {
  props: TradePanelProps
  book: TradeseaMarketBook | null
  ltpTick: number
  bookTick: number
  tickSize: number
  maxQty: number
  chartSymbol: string
  fallbackLast?: number | null
  panelUi: TradePanelSettings
  /** Mobile order sheet — shorter ladder so buy/sell stay visible. */
  compact?: boolean
}) {
  const qty = Number(props.quantity) || 1
  const tradeDisabled = !isTradePanelTradingEnabled(props)
  const hideDomBidAsk = panelUi.hideDomBidAsk === true
  const hideDomLadder = panelUi.hideDomLadder === true
  const hideDomLtpLock = panelUi.hideDomLtpLock === true
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
  }, [book, tickSize, effectiveFallbackLast, ltpTick])

  const { bid, ask } = useMemo(() => {
    void bookTick
    return resolveDomBidAsk(book)
  }, [book, bookTick])

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
  const visibleRangeRafRef = useRef<number | null>(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 })
  const [ltpCenterLocked, setLtpCenterLocked] = useState(true)
  const programmaticScrollRef = useRef(false)
  const pendingCenterRef = useRef(true)
  const lastFollowedLtpRef = useRef<number | null>(null)

  const updateVisibleRange = useCallback(
    (scrollTopOverride?: number) => {
      const el = ladderRef.current
      if (!el) return
      const next = domVisibleRange(
        rows.length,
        scrollTopOverride ?? el.scrollTop,
        el.clientHeight
      )
      setVisibleRange((current) =>
        current.start === next.start && current.end === next.end ? current : next
      )
    },
    [rows.length]
  )

  const scheduleVisibleRangeUpdate = useCallback(() => {
    if (visibleRangeRafRef.current != null) return
    visibleRangeRafRef.current = requestAnimationFrame(() => {
      visibleRangeRafRef.current = null
      updateVisibleRange()
    })
  }, [updateVisibleRange])

  useLayoutEffect(() => {
    updateVisibleRange()
  }, [updateVisibleRange])

  useEffect(() => {
    return () => {
      if (visibleRangeRafRef.current != null) {
        cancelAnimationFrame(visibleRangeRafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setLtpCenterLocked(true)
    pendingCenterRef.current = true
    lastFollowedLtpRef.current = null
  }, [chartSymbol])

  const centerLtpInView = useCallback(() => {
    const el = ladderRef.current
    if (!el || !rows.length) return false

    const ltp = ltpPrice ?? resolveDomLtpPrice(book, tickSize, effectiveFallbackLast)
    const ltpIdx =
      ltp != null
        ? rows.findIndex((r) => Math.abs(r.price - ltp) < tickSize / 1000)
        : rows.findIndex((r) => r.kind === 'last')
    if (ltpIdx < 0) return false

    programmaticScrollRef.current = true
    const nextScrollTop = Math.max(
      0,
      ltpIdx * DOM_ROW_HEIGHT_PX - el.clientHeight / 2 + DOM_ROW_HEIGHT_PX / 2
    )
    el.scrollTop = nextScrollTop
    updateVisibleRange(nextScrollTop)
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false
    })
    return true
  }, [rows, book, tickSize, effectiveFallbackLast, ltpPrice, updateVisibleRange])

  const toggleLtpCenterLock = useCallback(() => {
    setLtpCenterLocked((locked) => {
      if (locked) return false
      pendingCenterRef.current = true
      return true
    })
  }, [])

  useLayoutEffect(() => {
    if (hideDomLadder || hideDomLtpLock || !ltpCenterLocked) return

    const ltp = ltpPrice ?? resolveDomLtpPrice(book, tickSize, effectiveFallbackLast)
    const mustCenter = pendingCenterRef.current
    if (!mustCenter && ltp != null && lastFollowedLtpRef.current === ltp) return

    if (mustCenter) pendingCenterRef.current = false
    if (ltp != null) lastFollowedLtpRef.current = ltp
    centerLtpInView()
  }, [hideDomLadder, hideDomLtpLock, ltpCenterLocked, rows, ltpTick, centerLtpInView, ltpPrice, book, tickSize, effectiveFallbackLast, chartSymbol])

  useEffect(() => {
    if (hideDomLadder) return
    const el = ladderRef.current
    if (!el) return
    const onScroll = () => {
      scheduleVisibleRangeUpdate()
      if (!ltpCenterLocked || programmaticScrollRef.current) return
      setLtpCenterLocked(false)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [hideDomLadder, ltpCenterLocked, scheduleVisibleRangeUpdate])

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

  // Throttle position/PnL reads to ~10Hz so live PnL updates don't drive the
  // whole ladder + terminal to re-render on every ~60Hz market tick. The ladder
  // depth (rows) still updates at full rate; only the PnL-derived UI is gated.
  const pnlTick = useThrottledTick(bookTick, 100)
  const domPosition = useMemo(() => {
    void pnlTick
    return props.getDomPositionContext?.() ?? null
  }, [props.getDomPositionContext, pnlTick])
  const positionUpl = useMemo(() => {
    void pnlTick
    return props.getChartPositionUpl?.() ?? null
  }, [props.getChartPositionUpl, pnlTick])

  if (ltpPrice == null && (!hideDomLadder ? !rows.length : true)) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#7d8590]">
        Waiting for market data…
      </div>
    )
  }

  const fmt = (p: number) => formatDomPrice(p, tickSize)
  const eps = tickSize / 1000
  const ltpLabel = ltpPrice != null ? formatDomPrice(ltpPrice, tickSize) : '—'
  const bidLabel = bid != null ? formatDomPrice(bid, tickSize) : '—'
  const askLabel = ask != null ? formatDomPrice(ask, tickSize) : '—'
  const positionUplFmt =
    positionUpl != null ? formatStatMoney(positionUpl, { decimals: 2 }) : null
  const visibleRows = rows.slice(visibleRange.start, visibleRange.end)
  const topSpacerHeight = visibleRange.start * DOM_ROW_HEIGHT_PX
  const bottomSpacerHeight =
    Math.max(0, rows.length - visibleRange.end) * DOM_ROW_HEIGHT_PX

  return (
    <div
      className={`flex flex-col overflow-hidden ${hideDomLadder ? '' : 'min-h-0 flex-1'}`}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-[#475569]/40 py-2">
        <div
          className={`flex items-start justify-between gap-2 rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[#0f172a] to-[#0f172a] ${
            compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
          }`}
        >
          <div className="min-w-0 flex-1">
            <PadTradeSymbolPicker props={props} disabled={tradeDisabled} />
            <p
              className={`mt-1 font-bold tabular-nums leading-none tracking-tight text-[#f0c040] ${
                compact ? 'text-lg' : 'text-2xl'
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {ltpLabel}
            </p>
            <p className="mt-1 text-[10px] font-medium text-[#94a3b8]">Last traded price</p>
            {!hideDomBidAsk && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                <span className={tradeSideMeta('buy').textClass}>
                  Bid <span className="font-semibold">{bidLabel}</span>
                </span>
                <span className="text-[#475569]">·</span>
                <span className={tradeSideMeta('sell').textClass}>
                  Ask <span className="font-semibold">{askLabel}</span>
                </span>
              </div>
            )}
          </div>
          {!hideDomLtpLock && (
            <DomLtpLockButton locked={ltpCenterLocked} onToggle={toggleLtpCenterLock} />
          )}
        </div>
        {positionUplFmt != null && (
          <div className="flex justify-end">
            <span className={`text-xs font-semibold tabular-nums ${positionUplFmt.cls}`}>
              {'P&L'} {positionUplFmt.text}
            </span>
          </div>
        )}
      </div>

      {!hideDomLadder && (
        <>
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
          compact ? 'max-h-[36vh]' : ''
        } ${domPosition ? 'min-w-[280px]' : 'min-w-[260px]'}`}
      >
        {topSpacerHeight > 0 ? <div aria-hidden style={{ height: topSpacerHeight }} /> : null}
        {visibleRows.map((row) => {
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
        {bottomSpacerHeight > 0 ? (
          <div aria-hidden style={{ height: bottomSpacerHeight }} />
        ) : null}
      </div>
        </>
      )}

      <div
        className={`shrink-0 space-y-2 border-t border-[#475569] pb-2 pt-2 ${
          hideDomLadder ? 'mt-0' : 'mt-auto'
        }`}
      >
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
