import { chartSymbolToProductRoot } from '../tradesea/tradeseaSymbolInfo'
import type { PracticeChartDatafeed } from './practiceDatafeed'

/** Resolve chart ticker to product root (NQ, MNQ, GC) for practice DB rows. */
export function resolvePracticeProductSymbol(
  chartSymbol: string,
  datafeed?: PracticeChartDatafeed | null
): string {
  const fromDf = datafeed?.resolveProductSymbol?.(chartSymbol)
  if (fromDf) return fromDf
  return chartSymbolToProductRoot(chartSymbol)
}
