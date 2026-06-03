/** Shared duck-typing for Tradesea + Rithmic practice chart datafeeds. */
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
