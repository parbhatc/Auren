import type { JournalEntryRecord } from '../api/journal.api'
import { journalLocalDateTime } from '../../shared/journalRecap.js'

export function createJournalDraft(patch: Partial<JournalEntryRecord> = {}): JournalEntryRecord {
  return {
    id: '',
    playbook: '',
    dateTime: journalLocalDateTime(),
    exitDateTime: '',
    symbol: 'NQ',
    side: 'long',
    entryPrice: '',
    closePrice: '',
    size: '1',
    pnl: '',
    outcome: 'planned',
    conditionResponses: {},
    notes: '',
    recap: { execution: 'taken', screenshots: [] },
    ...patch,
  }
}

type PositionSnapshot = {
  symbol?: string
  type?: string
  contracts?: number
  entry?: number
  entryTime?: number | string
  positionId?: string
  id?: string | number
  stopLoss?: number
  takeProfit?: number
}

/** Read-on-click snapshot only. Never sends orders or subscribes to quote ticks. */
export function captureOpenPosition({
  position,
  symbol,
  source,
  accountId,
  accountName,
  resolution,
  now = new Date(),
}: {
  position?: PositionSnapshot | null
  symbol: string
  source: 'practice' | 'live'
  accountId?: string
  accountName?: string
  resolution?: string
  now?: Date
}): JournalEntryRecord {
  const contracts = Number(position?.contracts)
  const isOpen = !!position && Number.isFinite(contracts) && contracts !== 0
  const value = (n: unknown) =>
    n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) ? String(n) : ''
  const rawTime = position?.entryTime
  const numericTime = Number(rawTime)
  const entryTime = rawTime
    ? new Date(
        Number.isFinite(numericTime)
          ? numericTime < 10_000_000_000
            ? numericTime * 1000
            : numericTime
          : String(rawTime)
      )
    : now
  const stopLossPrice = isOpen ? value(position?.stopLoss) : ''
  const takeProfitPrice = isOpen ? value(position?.takeProfit) : ''
  return createJournalDraft({
    dateTime: journalLocalDateTime(
      isOpen && Number.isFinite(entryTime.getTime()) ? entryTime : now
    ),
    symbol: isOpen ? position?.symbol || symbol : symbol,
    side: isOpen && (position?.type === 'short' || contracts < 0) ? 'short' : 'long',
    entryPrice: isOpen ? value(position?.entry) : '',
    size: isOpen ? String(Math.abs(contracts)) : '1',
    source,
    sourceSessionId: accountId,
    sourceTradeId:
      isOpen && (position?.positionId ?? position?.id) != null
        ? String(position?.positionId ?? position?.id)
        : undefined,
    sourceContext: {
      sessionName: accountName,
      cursorTime: journalLocalDateTime(now),
      chartResolution: resolution,
      snapshotKind: isOpen ? 'open_position' : 'cursor',
      stopLossPrice,
      takeProfitPrice,
    },
    riskPlan: {
      stopLoss: stopLossPrice ? { mode: 'fixed', price: stopLossPrice } : { mode: 'none' },
      takeProfit: takeProfitPrice ? { mode: 'fixed', price: takeProfitPrice } : { mode: 'none' },
      breakEven: { mode: 'none', enabled: false },
    },
    recap: { execution: isOpen ? 'taken' : 'observation', screenshots: [] },
  })
}

/** Reopening the same identified trade edits its recap rather than making another. */
export function isSameCapturedTrade(
  entry: JournalEntryRecord,
  snapshot: JournalEntryRecord
): boolean {
  return (
    !!snapshot.sourceTradeId &&
    !!snapshot.sourceSessionId &&
    entry.source === snapshot.source &&
    entry.sourceSessionId === snapshot.sourceSessionId &&
    entry.sourceTradeId === snapshot.sourceTradeId &&
    entry.symbol === snapshot.symbol
  )
}
