import type { JournalEntryRecord } from '../api/journal.api'
import type { PracticeTradeRecord } from '../api/practice.api'
import { journalLocalDateTime } from '../../shared/journalRecap.js'

export type JournalExecution = {
  id: string
  symbol: string
  side: 'long' | 'short'
  entryPrice: string
  closePrice: string
  size: string
  dateTime: string
  exitDateTime: string
  pnl: string
  fees: string
  note: string
}
export const journalInstrument = (symbol: string) =>
  symbol.toUpperCase().split(':').pop()?.replace(/1!$/, '') || symbol
const dateTime = (value: unknown) => {
  if (value == null || value === '') return ''
  const n = Number(value)
  const date = new Date(
    value != null && Number.isFinite(n) ? (n < 10_000_000_000 ? n * 1000 : n) : String(value)
  )
  return Number.isFinite(date.getTime()) ? journalLocalDateTime(date) : ''
}

const finiteField = (value: string) => value.trim() !== '' && Number.isFinite(Number(value))
const validExecution = (execution: JournalExecution) =>
  !!execution.id &&
  [execution.entryPrice, execution.closePrice, execution.size].every(finiteField) &&
  Number(execution.size) > 0 &&
  Number.isFinite(Date.parse(execution.dateTime)) &&
  Date.parse(execution.exitDateTime) >= Date.parse(execution.dateTime) &&
  (execution.pnl === '' || finiteField(execution.pnl)) &&
  (execution.fees === '' || finiteField(execution.fees))

export function applyJournalExecution(
  entry: JournalEntryRecord,
  execution: JournalExecution
): JournalEntryRecord {
  if (
    journalInstrument(entry.symbol) !== journalInstrument(execution.symbol) ||
    execution.side !== entry.side
  )
    throw new Error('Choose a closed execution for the same instrument and side.')
  if (!validExecution(execution))
    throw new Error('This execution has incomplete or invalid details.')
  const pnl = execution.pnl === '' ? null : Number(execution.pnl)
  return {
    ...entry,
    entryPrice: execution.entryPrice,
    closePrice: execution.closePrice,
    size: execution.size,
    dateTime: execution.dateTime,
    exitDateTime: execution.exitDateTime,
    pnl: execution.pnl,
    outcome: pnl === null ? 'planned' : pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
    sourceContext: {
      ...entry.sourceContext,
      snapshotKind: 'closed_trade',
      executionId: execution.id,
      fees: execution.fees,
      pnlBasis: pnl === null ? 'recorded' : 'net',
    },
    // The original position identity and all user evidence remain intact.
  }
}

/** Practice history stores exit commission only, not authoritative round-trip net results. */
export function practiceJournalExecution(
  trade: PracticeTradeRecord & { id?: string }
): JournalExecution {
  return {
    id: trade.id || `${trade.entryTime}-${trade.exitTime}`,
    symbol: trade.symbol,
    side: trade.direction,
    entryPrice: String(trade.entryPrice),
    closePrice: String(trade.exitPrice),
    size: String(Math.abs(trade.contracts)),
    dateTime: dateTime(trade.entryTime),
    exitDateTime: dateTime(trade.exitTime),
    pnl: '',
    fees: trade.fees == null ? '' : String(trade.fees),
    note: `Practice gross P&L: ${trade.pnl}. Stored fees cover the exit fill only; historical entry fees are not supplied. Enter verified round-trip net P&L after applying.`,
  }
}

export async function loadJournalExecutions(
  entry: JournalEntryRecord
): Promise<JournalExecution[]> {
  if (!entry.sourceSessionId) return []
  let candidates: JournalExecution[] = []
  if (entry.source === 'practice') {
    const { practiceAPI } = await import('../api/practice.api')
    const data = await practiceAPI.getStats(entry.sourceSessionId)
    candidates = (('trades' in data ? data.trades : []) ?? []).map(practiceJournalExecution)
  } else if (entry.source === 'replay') {
    const { backtesterAPI } = await import('../api/backtester.api')
    const data = await backtesterAPI.getTrades({ sessionId: entry.sourceSessionId })
    candidates = data.trades
      .filter((trade) => trade.exit_price != null && trade.exit_time != null)
      .map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.direction === 'short' ? 'short' : 'long',
        entryPrice: String(trade.entry_price),
        closePrice: String(trade.exit_price),
        size: String(Math.abs(trade.contracts)),
        dateTime: dateTime(trade.entry_time),
        exitDateTime: dateTime(trade.exit_time),
        pnl: '',
        fees: '',
        note: 'Replay history supplies prices and size, not authoritative net P&L/fees. Enter net P&L and result after applying.',
      }))
  } else if (entry.source === 'live') {
    const [{ tradeseaAPI }, { normalizeTradeseaTradeInstrument }] = await Promise.all([
      import('../api/tradesea.api'),
      import('../services/tradesea/tradeseaInstrument'),
    ])
    const result = await tradeseaAPI.getExecutions(
      entry.sourceSessionId,
      normalizeTradeseaTradeInstrument(entry.symbol),
      100
    )
    if (!result.success || result.s !== 'ok')
      throw new Error('Live executions could not be loaded.')
    // Only full-size close fills are unambiguous. Partial fills need a broker reconciliation view.
    candidates = (result.d ?? [])
      .filter(
        (fill) =>
          fill.isClose === true &&
          Number(fill.qty) === Number(entry.size) &&
          String(fill.side).toLowerCase() === (entry.side === 'long' ? 'sell' : 'buy')
      )
      .map((fill) => ({
        id: fill.id,
        symbol: fill.instrument,
        side: entry.side,
        entryPrice: entry.entryPrice,
        closePrice: String(fill.price),
        size: String(fill.qty),
        dateTime: entry.dateTime,
        exitDateTime: dateTime(fill.time),
        pnl: '',
        fees: fill.commission == null ? '' : String(fill.commission),
        note: 'Full-size broker close fill; commission shown is exit-fill only. Verify the position match and enter broker net P&L. Partial fills are not automatically paired.',
      }))
  }
  return candidates
    .filter(
      (trade) =>
        journalInstrument(trade.symbol) === journalInstrument(entry.symbol) &&
        trade.side === entry.side &&
        validExecution(trade) &&
        Date.parse(trade.exitDateTime) >= Date.parse(entry.dateTime)
    )
    .sort((a, b) => Date.parse(b.exitDateTime) - Date.parse(a.exitDateTime))
}
