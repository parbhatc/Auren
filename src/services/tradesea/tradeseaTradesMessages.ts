export interface TradeseaTradeOrder {
  id: string
  basketId?: string
  accountId: string
  instrument: string
  qty: number
  side: string
  type: string
  status: string
  filledQty?: number
  avgPrice?: number
  limitPrice?: number
  stopPrice?: number
  parentId?: string
  parentType?: string
  duration?: { type?: string }
  lastModified?: number
  commission?: number
}

export interface TradeseaAccountState {
  balance?: number
  realizedPl?: number
  unrealizedPl?: number
  commission?: number
}

export interface TradeseaUserFullStates {
  aggregated?: TradeseaAccountState
  accounts?: Record<string, TradeseaAccountState>
}

export interface TradeseaFullStateRow {
  accountId?: string
  balance?: number
  realizedPl?: number
  unrealizedPl?: number
  commission?: number
}

export interface TradeseaUnifiedSnapshotData {
  eventTime?: number
  orders?: TradeseaTradeOrder[]
  positions?: unknown[]
  userFullStates?: TradeseaUserFullStates
  fullStates?: TradeseaFullStateRow[]
}

export interface TradeseaTradesWsMessage {
  event: string
  data?: TradeseaUnifiedSnapshotData & {
    orders?: TradeseaTradeOrder[]
    positions?: unknown[]
    fullStates?: TradeseaFullStateRow[]
  }
}

export function encodeTradesPing(): string {
  return JSON.stringify({ action: 'ping' })
}

export function isTradesPong(raw: string): boolean {
  const text = raw.trim()
  if (text === 'pong') return true
  if (!text.startsWith('{')) return false
  try {
    const json = JSON.parse(text) as { action?: string; type?: string; event?: string }
    const type = String(json.action || json.type || json.event || '').toLowerCase()
    return type === 'pong'
  } catch {
    return false
  }
}

export function isUnifiedSnapshotMessage(msg: TradeseaTradesWsMessage | null): boolean {
  return msg?.event?.toLowerCase() === 'unifiedsnapshot'
}

export function isTradesPing(raw: string): boolean {
  const text = raw.trim()
  if (text === 'ping') return true
  if (!text.startsWith('{')) return false
  try {
    const json = JSON.parse(text) as { action?: string; type?: string; event?: string }
    const type = String(json.action || json.type || json.event || '').toLowerCase()
    return type === 'ping'
  } catch {
    return false
  }
}

export function parseTradeseaTradesMessage(raw: unknown): TradeseaTradesWsMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const msg = raw as Record<string, unknown>
  const event = String(msg.event || msg.type || '').trim()
  if (!event) return null
  const data = (msg.data ?? msg.payload) as TradeseaUnifiedSnapshotData | undefined
  return { event, data }
}

export function resolveAccountState(
  userFullStates: TradeseaUserFullStates | undefined,
  accountKeys: string[]
): TradeseaAccountState | null {
  if (!userFullStates) return null

  for (const key of accountKeys) {
    const k = String(key || '').trim()
    if (!k) continue
    const state = userFullStates.accounts?.[k]
    if (state) return state
  }

  return userFullStates.aggregated ?? null
}

export function sumUnrealizedPl(positions: unknown[] | undefined): number {
  if (!Array.isArray(positions)) return 0
  return positions.reduce<number>((sum, p) => {
    if (!p || typeof p !== 'object') return sum
    const row = p as Record<string, unknown>
    const upl = row.unrealizedPl ?? row.unrealized_pl ?? row.upl
    return sum + (typeof upl === 'number' && Number.isFinite(upl) ? upl : 0)
  }, 0)
}
