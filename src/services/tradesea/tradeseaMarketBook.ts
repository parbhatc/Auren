/** MDS order book snapshot (f:1 / f:4 / f:6 / f:2 / f:7). */

export type BookLevel = { price: number; size: number }

export type TradeseaMarketBook = {
  streamId: string
  last: number | null
  bestBid: number | null
  bestAsk: number | null
  bestBidSize: number | null
  bestAskSize: number | null
  bids: BookLevel[]
  asks: BookLevel[]
  /** Session volume at price (f:7 TTV / DOM vol column). */
  volumeByPrice: Map<number, number>
  updatedAt: number
}

function emptyBook(streamId: string): TradeseaMarketBook {
  return {
    streamId,
    last: null,
    bestBid: null,
    bestAsk: null,
    bestBidSize: null,
    bestAskSize: null,
    bids: [],
    asks: [],
    volumeByPrice: new Map(),
    updatedAt: 0,
  }
}

function parseLevelRows(rows: unknown): BookLevel[] {
  if (!Array.isArray(rows)) return []
  const out: BookLevel[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 1) continue
    const price = Number(row[0])
    const size = Number(row[1] ?? 0)
    if (!Number.isFinite(price)) continue
    out.push({ price, size: Number.isFinite(size) ? size : 0 })
  }
  return out
}

/** Merge depth delta into one side (f:4 `b` / `a` arrays). Size 0 removes the level. */
export function mergeBookSide(existing: BookLevel[], delta: BookLevel[], side: 'bid' | 'ask'): BookLevel[] {
  const map = new Map<number, number>()
  for (const l of existing) {
    if (l.size > 0) map.set(l.price, l.size)
  }
  for (const l of delta) {
    if (l.size <= 0) map.delete(l.price)
    else map.set(l.price, l.size)
  }
  const merged = [...map.entries()].map(([price, size]) => ({ price, size }))
  merged.sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price))
  return merged
}

function syncBestFromLevels(book: TradeseaMarketBook): void {
  if (book.bids.length) {
    book.bestBid = book.bids[0].price
    book.bestBidSize = book.bids[0].size
  }
  if (book.asks.length) {
    book.bestAsk = book.asks[0].price
    book.bestAskSize = book.asks[0].size
  }
}

export class TradeseaMarketBookStore {
  private books = new Map<string, TradeseaMarketBook>()
  private listeners = new Set<(streamId: string) => void>()

  get(streamId: string): TradeseaMarketBook | null {
    const id = String(streamId || '').trim()
    if (!id) return null
    return this.books.get(id) ?? null
  }

  subscribe(listener: (streamId: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(streamId: string): void {
    for (const fn of this.listeners) {
      try {
        fn(streamId)
      } catch {
        /* ignore */
      }
    }
  }

  private touch(streamId: string): TradeseaMarketBook {
    const id = String(streamId || '').trim()
    let book = this.books.get(id)
    if (!book) {
      book = emptyBook(id)
      this.books.set(id, book)
    }
    return book
  }

  applyLtp(streamId: string, price: number): void {
    if (!Number.isFinite(price)) return
    const book = this.touch(streamId)
    book.last = price
    book.updatedAt = Date.now()
    this.notify(streamId)
  }

  /** f:1 — best bid/ask panel update */
  applyBestBidAsk(
    streamId: string,
    fields: { bp?: number; ap?: number; bs?: number; as?: number }
  ): void {
    const book = this.touch(streamId)
    if (fields.bp != null && Number.isFinite(Number(fields.bp))) {
      book.bestBid = Number(fields.bp)
    }
    if (fields.ap != null && Number.isFinite(Number(fields.ap))) {
      book.bestAsk = Number(fields.ap)
    }
    if (fields.bs != null && Number.isFinite(Number(fields.bs))) {
      book.bestBidSize = Number(fields.bs)
    }
    if (fields.as != null && Number.isFinite(Number(fields.as))) {
      book.bestAskSize = Number(fields.as)
    }
    if (book.bestBid != null && book.bestBidSize != null && book.bestBidSize > 0) {
      book.bids = mergeBookSide(book.bids, [{ price: book.bestBid, size: book.bestBidSize }], 'bid')
    }
    if (book.bestAsk != null && book.bestAskSize != null && book.bestAskSize > 0) {
      book.asks = mergeBookSide(book.asks, [{ price: book.bestAsk, size: book.bestAskSize }], 'ask')
    }
    book.updatedAt = Date.now()
    this.notify(streamId)
  }

  /** f:6 — quote snapshot (ap/bp/as/bs + last `p`) */
  applyQuotes(
    streamId: string,
    fields: { p?: number; ap?: number; bp?: number; as?: number; bs?: number }
  ): void {
    const book = this.touch(streamId)
    if (fields.p != null && Number.isFinite(Number(fields.p))) {
      book.last = Number(fields.p)
    }
    if (fields.bp != null && Number.isFinite(Number(fields.bp))) book.bestBid = Number(fields.bp)
    if (fields.ap != null && Number.isFinite(Number(fields.ap))) book.bestAsk = Number(fields.ap)
    if (fields.bs != null && Number.isFinite(Number(fields.bs))) book.bestBidSize = Number(fields.bs)
    if (fields.as != null && Number.isFinite(Number(fields.as))) book.bestAskSize = Number(fields.as)
    if (book.bestBid != null && book.bestBidSize != null && book.bestBidSize > 0) {
      book.bids = mergeBookSide(book.bids, [{ price: book.bestBid, size: book.bestBidSize }], 'bid')
    }
    if (book.bestAsk != null && book.bestAskSize != null && book.bestAskSize > 0) {
      book.asks = mergeBookSide(book.asks, [{ price: book.bestAsk, size: book.bestAskSize }], 'ask')
    }
    book.updatedAt = Date.now()
    this.notify(streamId)
  }

  /**
   * f:4 — depth ladder (`b` bids, `a` asks).
   * u:3 = clear both sides.
   * u:1 / u:2+ = merge batch into stored book: prices omitted from the batch are unchanged.
   * Only an explicit size of 0 in the batch removes that price level.
   */
  applyDepth(
    streamId: string,
    fields: { b?: unknown; a?: unknown; u?: number }
  ): void {
    const book = this.touch(streamId)
    const hasBidField = fields.b !== undefined
    const hasAskField = fields.a !== undefined
    const bidDelta = hasBidField ? parseLevelRows(fields.b) : null
    const askDelta = hasAskField ? parseLevelRows(fields.a) : null
    const updateType = Number(fields.u)

    if (updateType === 3) {
      book.bids = []
      book.asks = []
    } else {
      if (bidDelta !== null && bidDelta.length > 0) {
        book.bids = mergeBookSide(book.bids, bidDelta, 'bid')
      }
      if (askDelta !== null && askDelta.length > 0) {
        book.asks = mergeBookSide(book.asks, askDelta, 'ask')
      }
    }

    syncBestFromLevels(book)
    book.updatedAt = Date.now()
    this.notify(streamId)
  }

  /** f:7 — traded volume at price (`v`: [[price, volume], …]). */
  applyVolumeAtPrice(
    streamId: string,
    fields: { v?: unknown; u?: number }
  ): void {
    const book = this.touch(streamId)
    const rows = parseLevelRows(fields.v)
    const updateType = Number(fields.u)

    if (updateType === 1) {
      book.volumeByPrice = new Map()
    }

    for (const row of rows) {
      if (row.size <= 0) book.volumeByPrice.delete(row.price)
      else book.volumeByPrice.set(row.price, row.size)
    }

    book.updatedAt = Date.now()
    this.notify(streamId)
  }
}

/** Trade panel BBO; uses last trade when f:1/f:6 have not arrived yet (chart may only stream f:5). */
export function resolveTradePanelBidAsk(book: TradeseaMarketBook | null): {
  bid: number | null
  ask: number | null
} {
  if (!book) return { bid: null, ask: null }
  const last = book.last
  return {
    bid: book.bestBid ?? last ?? null,
    ask: book.bestAsk ?? last ?? null,
  }
}
