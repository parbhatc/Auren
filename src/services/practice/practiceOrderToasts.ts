import type { PracticeChartDatafeed } from './practiceDatafeed'
import { resolvePracticeProductSymbol } from './practiceSymbol'

export type PracticeBracketLevels = {
  stopLoss?: number | null
  takeProfit?: number | null
}

export type PracticeOrderSide = 'buy' | 'sell'

function fmtUsd(price: number): string {
  return `$${price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function practiceOrderProductSymbol(
  chartSymbol: string,
  datafeed?: PracticeChartDatafeed | null
): string {
  return resolvePracticeProductSymbol(chartSymbol, datafeed).toUpperCase()
}

/** e.g. BUY 1 @MNQ $23,933.50 */
export function practiceOrderLine(
  side: PracticeOrderSide,
  qty: number,
  productSymbol: string,
  price: number,
  opts?: { limitWorking?: boolean }
): string {
  const verb = side.toUpperCase()
  const sym = productSymbol.toUpperCase()
  if (opts?.limitWorking) {
    return `${verb} LIMIT ${qty} @${sym} ${fmtUsd(price)}`
  }
  return `${verb} ${qty} @${sym} ${fmtUsd(price)}`
}

export function practiceOrderBracketDetail(levels: PracticeBracketLevels): string | undefined {
  const parts: string[] = []
  if (levels.stopLoss != null && Number.isFinite(levels.stopLoss)) {
    parts.push(`SL ${fmtUsd(levels.stopLoss)}`)
  }
  if (levels.takeProfit != null && Number.isFinite(levels.takeProfit)) {
    parts.push(`TP ${fmtUsd(levels.takeProfit)}`)
  }
  return parts.length ? parts.join(' · ') : undefined
}

/** Closing a long → sell; closing a short → buy. */
export function practiceExitSide(
  positionContracts: number,
  positionType?: string
): PracticeOrderSide {
  if (positionType === 'long') return 'sell'
  if (positionType === 'short') return 'buy'
  return positionContracts > 0 ? 'sell' : 'buy'
}
