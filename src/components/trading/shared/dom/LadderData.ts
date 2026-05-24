import type { TradeseaMarketBook } from '../../../../services/tradesea/tradeseaMarketBook'
import {
  calcTradeseaTickPnL,
  type DomPositionContext,
} from '../../../../services/tradesea/tradeseaPnL'
import { DOM_LADDER_LEVELS, DOM_MAX_ROWS } from '../../../../constants/dom'
import { pnlTextClass } from '../../../../constants/tradingSide'
import type { LadderRow } from '../../../../types/dom'

export type { DomPositionContext } from '../../../../services/tradesea/tradeseaPnL'
export type { LadderRow } from '../../../../types/dom'
export { DOM_LADDER_LEVELS, DOM_MAX_ROWS } from '../../../../constants/dom'
/** Hypothetical UP&L if the position were closed at `rowPrice`. */
export function calcDomRowPnl(rowPrice: number, ctx: DomPositionContext): number {
  return calcTradeseaTickPnL(
    ctx.entry,
    rowPrice,
    ctx.signedContracts,
    ctx.tickSize,
    ctx.tickValue
  )
}

export function isDomEntryPrice(rowPrice: number, entry: number, tickSize: number): boolean {
  if (!Number.isFinite(rowPrice) || !Number.isFinite(entry) || !Number.isFinite(tickSize)) return false
  return Math.abs(rowPrice - entry) < tickSize / 1000
}

/** Tradesea DOM P&L cell: whole dollars, color by sign ($0 at entry). */
export function formatDomRowPnl(
  pnl: number,
  rowPrice: number,
  entry: number,
  tickSize: number
): { text: string; cls: string; isEntry: boolean } {
  const isEntry = isDomEntryPrice(rowPrice, entry, tickSize)
  if (isEntry) {
    return { text: '$0', cls: 'text-trade-muted', isEntry: true }
  }
  const rounded = Math.round(pnl)
  if (Math.abs(rounded) < 1) {
    return { text: '$0', cls: 'text-trade-muted', isEntry: false }
  }
  const text = `$${Math.abs(rounded)}`
  return { text, cls: pnlTextClass(rounded), isEntry: false }
}

function tickKey(price: number, tickSize: number): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return price
  return Math.round(price / tickSize) * tickSize
}

export function formatDomPrice(price: number, tickSize: number): string {
  if (!Number.isFinite(price)) return '—'
  if (tickSize >= 1) return price.toFixed(0)
  if (tickSize >= 0.1) return price.toFixed(2)
  return price.toFixed(4)
}

/** Rounded LTP for DOM highlight (f:2 `p`, f:6 `p`, or bid/ask mid). */
export function resolveDomLtpPrice(
  book: TradeseaMarketBook | null,
  tickSize: number,
  fallbackLast?: number | null
): number | null {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return null

  const last =
    book?.last ??
    (book?.bestBid != null && book?.bestAsk != null
      ? (book.bestBid + book.bestAsk) / 2
      : book?.bestBid ?? book?.bestAsk) ??
    (fallbackLast != null && Number.isFinite(fallbackLast) ? fallbackLast : null)
  if (last == null) return null
  return tickKey(last, tickSize)
}

function volumeAtPrice(book: TradeseaMarketBook, price: number, tickSize: number): number {
  const k = tickKey(price, tickSize)
  return book.volumeByPrice.get(k) ?? book.volumeByPrice.get(price) ?? 0
}

/** Tick ladder around LTP; bid/ask from f:4 (delayed) or f:1 top-of-book; vol + range from f:7 TTV. */
export function buildDomLadder(
  book: TradeseaMarketBook | null,
  tickSize: number,
  levels = DOM_LADDER_LEVELS,
  fallbackLast?: number | null
): LadderRow[] {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return []

  const anchor = resolveDomLtpPrice(book, tickSize, fallbackLast)
  if (anchor == null) return []

  const bids = book?.bids ?? []
  const asks = book?.asks ?? []
  const bestBid = book?.bestBid ?? null
  const bestAsk = book?.bestAsk ?? null
  const bestBidSize = book?.bestBidSize ?? null
  const bestAskSize = book?.bestAskSize ?? null

  const depthByTick = new Map<number, { bid: number; ask: number }>()

  for (const l of asks) {
    if (l.size <= 0) continue
    const k = tickKey(l.price, tickSize)
    const cur = depthByTick.get(k) ?? { bid: 0, ask: 0 }
    cur.ask += l.size
    depthByTick.set(k, cur)
  }
  for (const l of bids) {
    if (l.size <= 0) continue
    const k = tickKey(l.price, tickSize)
    const cur = depthByTick.get(k) ?? { bid: 0, ask: 0 }
    cur.bid += l.size
    depthByTick.set(k, cur)
  }

  if (bestBid != null && bestBidSize != null && bestBidSize > 0) {
    const k = tickKey(bestBid, tickSize)
    const cur = depthByTick.get(k) ?? { bid: 0, ask: 0 }
    cur.bid = Math.max(cur.bid, bestBidSize)
    depthByTick.set(k, cur)
  }
  if (bestAsk != null && bestAskSize != null && bestAskSize > 0) {
    const k = tickKey(bestAsk, tickSize)
    const cur = depthByTick.get(k) ?? { bid: 0, ask: 0 }
    cur.ask = Math.max(cur.ask, bestAskSize)
    depthByTick.set(k, cur)
  }

  let minP = anchor - levels * tickSize
  let maxP = anchor + levels * tickSize
  for (const k of depthByTick.keys()) {
    minP = Math.min(minP, k)
    maxP = Math.max(maxP, k)
  }
  if (book) {
    for (const k of book.volumeByPrice.keys()) {
      const tk = tickKey(k, tickSize)
      minP = Math.min(minP, tk)
      maxP = Math.max(maxP, tk)
    }
  }

  const rows: LadderRow[] = []
  const epsilon = tickSize / 1000
  const bidTop = bestBid != null ? tickKey(bestBid, tickSize) : null
  const askTop = bestAsk != null ? tickKey(bestAsk, tickSize) : null

  for (let p = maxP; p >= minP - epsilon && rows.length < DOM_MAX_ROWS; p -= tickSize) {
    const price = tickKey(p, tickSize)
    const d = depthByTick.get(price) ?? { bid: 0, ask: 0 }
    const tradeVolume = book ? volumeAtPrice(book, price, tickSize) : 0

    let bidDepth = 0
    let askDepth = 0
    if (d.bid > 0 && (bidTop == null || price <= bidTop + epsilon)) bidDepth = d.bid
    if (d.ask > 0 && (askTop == null || price >= askTop - epsilon)) askDepth = d.ask

    let kind: LadderRow['kind'] = 'bid'
    if (askDepth > 0) kind = 'ask'
    else if (bidDepth > 0) kind = 'bid'
    else if (Math.abs(price - anchor) < epsilon) kind = 'last'
    else if (askTop != null && price >= askTop - epsilon) kind = 'ask'
    else if (bidTop != null && price <= bidTop + epsilon) kind = 'bid'

    if (Math.abs(price - anchor) < epsilon) kind = 'last'

    rows.push({ kind, price, bidDepth, askDepth, tradeVolume })
  }

  return rows
}
