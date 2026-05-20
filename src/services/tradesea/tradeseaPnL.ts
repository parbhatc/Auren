import {
  instrumentsMatch,
  parseTradeseaPosition,
  TradeseaPosition,
} from './tradeseaPositions'

/**
 * Tradesea instruments `pipValue` = dollars per 1.0 index point (MNQ = $2/point).
 * `pipSize` / `minTick` = minimum price step (MNQ = 0.25).
 * Dollars per tick = pipValue × pipSize (MNQ → $0.50/tick).
 */
export function tradeseaDollarsPerPoint(pipValue: number): number {
  return pipValue
}

export function tradeseaDollarsPerTick(tickSize: number, pipValue: number): number {
  if (!tickSize || !pipValue) return 0
  return pipValue * tickSize
}

/** Futures $ P&L using tick steps (tickValue must be $ per tick, not per point). */
export function calcTradeseaTickPnL(
  entryPrice: number,
  markPrice: number,
  signedContracts: number,
  tickSize: number,
  tickValuePerTick: number
): number {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(markPrice)) return 0
  if (!signedContracts || !tickSize || !tickValuePerTick) return 0
  return ((markPrice - entryPrice) / tickSize) * tickValuePerTick * signedContracts
}

/** Same as tick formula when pipValue is Tradesea “per point”. */
export function calcTradeseaPointPnL(
  entryPrice: number,
  markPrice: number,
  signedContracts: number,
  dollarsPerPoint: number
): number {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(markPrice)) return 0
  if (!signedContracts || !dollarsPerPoint) return 0
  return (markPrice - entryPrice) * dollarsPerPoint * signedContracts
}

/** Open position inputs for per-row DOM P&L (hypothetical exit at each ladder price). */
export type DomPositionContext = {
  entry: number
  signedContracts: number
  tickSize: number
  tickValue: number
}

export function signedContractsFromPosition(pos: TradeseaPosition): number {
  const qty = Math.abs(pos.qty ?? 0)
  if (!qty) return 0
  const side = String(pos.side || '').toLowerCase()
  return side === 'sell' || side === 'short' ? -qty : qty
}

export function calcPositionUnrealizedPl(
  pos: TradeseaPosition,
  markPrice: number,
  tickSize: number,
  tickValue: number
): number {
  if (pos.unrealizedPl != null && Number.isFinite(pos.unrealizedPl) && pos.unrealizedPl !== 0) {
    return pos.unrealizedPl
  }
  if (pos.avgPrice == null) return 0
  return calcTradeseaTickPnL(
    pos.avgPrice,
    markPrice,
    signedContractsFromPosition(pos),
    tickSize,
    tickValue
  )
}

export function calcAccountUnrealizedPl(
  positions: unknown[],
  markByInstrument: (instrument: string) => number | null,
  tickForInstrument: (instrument: string) => { tickSize: number; tickValue: number },
  options?: { chartMark?: number; chartInstrument?: string }
): { total: number; counted: boolean } {
  let total = 0
  let counted = false
  const chartMark = options?.chartMark
  const chartInstrument = options?.chartInstrument || ''

  const openRows = positions
    .map((row) => parseTradeseaPosition(row))
    .filter((p): p is TradeseaPosition => Boolean(p?.qty))

  const singleOpen = openRows.length === 1

  for (const pos of openRows) {
    const instrument = String(pos.instrument || chartInstrument || '')
    let mark = instrument ? markByInstrument(instrument) : null
    if ((mark == null || !Number.isFinite(mark)) && chartMark != null) {
      if (!instrument || instrumentsMatch(instrument, chartInstrument) || singleOpen) {
        mark = chartMark
      }
    }
    if (mark == null || !Number.isFinite(mark)) continue
    if (pos.avgPrice == null) continue

    const { tickSize, tickValue } = tickForInstrument(instrument || chartInstrument)
    total += calcPositionUnrealizedPl(pos, mark, tickSize, tickValue)
    counted = true
  }

  return { total, counted }
}
