/** Shared duck-typing for Tradesea practice chart datafeeds. */
export type PracticeChartDatafeed = {
  resolveProductSymbol?(chartSymbol: string): string
  resolveStreamInstrument?(chartLabel: string): string
  getTickSize?(symbol: string): number
  getLastBarForChart?(chart: unknown): { close?: number } | null
  getMarketBookForChart?(chartSymbol: string): PracticeMarketBook | null
  isMarketOpenForChart?(chartSymbol: string, now?: Date): boolean
  whenSymbolsReady?(): Promise<void>
  setTradeHandler?(handler: unknown): void
  refreshMdsSubscriptions?(): void
}

export type PracticeMarketBook = {
  last?: number | null
  bestBid?: number | null
  bestAsk?: number | null
  bid?: number | null
  ask?: number | null
}

export function practiceBookBidAsk(book: PracticeMarketBook | null | undefined): {
  bestBid: number | null
  bestAsk: number | null
  last: number | null
} {
  return {
    bestBid: book?.bestBid ?? book?.bid ?? null,
    bestAsk: book?.bestAsk ?? book?.ask ?? null,
    last: book?.last ?? null,
  }
}

/** Ignore a stale/outlier LTP when a fresh top of book is available. */
export function resolvePracticeBookMark(
  book: PracticeMarketBook | null | undefined,
  fallback: number | null = null
): number | null {
  const { bestBid, bestAsk, last } = practiceBookBidAsk(book)
  const midpoint =
    bestBid != null && bestAsk != null && Number.isFinite(bestBid) && Number.isFinite(bestAsk)
      ? (bestBid + bestAsk) / 2
      : null
  const agreesWithMidpoint = (price: number | null): price is number =>
    price != null &&
    Number.isFinite(price) &&
    (midpoint == null || Math.abs(price - midpoint) <= Math.max(1, Math.abs(midpoint) * 0.002))

  if (agreesWithMidpoint(last)) return last
  if (agreesWithMidpoint(fallback)) return fallback
  return midpoint ?? (last != null && Number.isFinite(last) ? last : fallback)
}
