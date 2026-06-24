/**
 * MDS wire protocol — client-side encode/decode.
 * Frontend speaks this on /tradesea-mds-ws; backend translates to provider frames.
 */

export const MDS_STREAM_TYPES = {
  LAST_TRADED_PRICE: 'last_traded_price',
  BEST_BID_ASK: 'best_bid_ask',
  QUOTES: 'quotes',
  TRADED_VOLUME_AT_PRICE: 'traded_volume_at_price',
  MARKET_DEPTH: 'market_depth',
  BAR: 'bar',
} as const

export type MdsStreamType = (typeof MDS_STREAM_TYPES)[keyof typeof MDS_STREAM_TYPES]

export type MdsSubscriptionPayload =
  | { kind: 'candles'; symbols: string[]; resolutions: string[] }
  | { kind: 'ltp'; symbols: string[]; bucket: string }
  | { kind: 'bestBidAsk'; symbols: string[]; bucket: string }
  | { kind: 'depth'; symbols: string[]; bucket: string }
  | { kind: 'quotes'; symbols: string[] }
  | { kind: 'ttv'; symbols: string[]; bucket: string }

export type MdsClientMessage =
  | { action: 'subscribe'; type: MdsStreamType; symbols: string[]; resolutions?: string[] }
  | { action: 'unsubscribe'; type: MdsStreamType; symbols: string[]; resolutions?: string[] }

export type MdsTickMessage = {
  type: string
  symbol: string
  [key: string]: unknown
}

export const MDS_PING_FRAME = JSON.stringify({ action: 'ping' })

export function isMdsPing(raw: string): boolean {
  const text = raw.trim()
  if (text === 'ping') return true
  if (!text.startsWith('{')) return false
  try {
    const json = JSON.parse(text) as { action?: string; op?: string; type?: string; event?: string }
    const action = String(json.action || json.op || json.type || json.event || '').toLowerCase()
    return action === 'ping'
  } catch {
    return false
  }
}

export function isMdsPong(raw: string): boolean {
  const text = raw.trim()
  if (text === 'pong') return true
  if (!text.startsWith('{')) return false
  try {
    const json = JSON.parse(text) as { action?: string; op?: string; type?: string; event?: string }
    const action = String(json.action || json.op || json.type || json.event || '').toLowerCase()
    return action === 'pong'
  } catch {
    return false
  }
}

function payloadStreamType(payload: MdsSubscriptionPayload): MdsStreamType {
  switch (payload.kind) {
    case 'bestBidAsk':
      return MDS_STREAM_TYPES.BEST_BID_ASK
    case 'candles':
      return MDS_STREAM_TYPES.BAR
    case 'depth':
      return MDS_STREAM_TYPES.MARKET_DEPTH
    case 'ltp':
      return MDS_STREAM_TYPES.LAST_TRADED_PRICE
    case 'quotes':
      return MDS_STREAM_TYPES.QUOTES
    case 'ttv':
      return MDS_STREAM_TYPES.TRADED_VOLUME_AT_PRICE
    default:
      return MDS_STREAM_TYPES.LAST_TRADED_PRICE
  }
}

export function encodeMdsSubscribe(payload: MdsSubscriptionPayload): MdsClientMessage {
  const type = payloadStreamType(payload)
  if (payload.kind === 'candles') {
    return { action: 'subscribe', type, symbols: payload.symbols, resolutions: payload.resolutions }
  }
  return { action: 'subscribe', type, symbols: payload.symbols }
}

export function encodeMdsUnsubscribe(payload: MdsSubscriptionPayload): MdsClientMessage {
  const type = payloadStreamType(payload)
  if (payload.kind === 'candles') {
    return { action: 'unsubscribe', type, symbols: payload.symbols, resolutions: payload.resolutions }
  }
  return { action: 'unsubscribe', type, symbols: payload.symbols }
}

export function isMdsTick(value: unknown): value is MdsTickMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MdsTickMessage).type === 'string' &&
    typeof (value as MdsTickMessage).symbol === 'string'
  )
}

/** Map readable tick → legacy f:id frame for existing book/chart consumers. */
export function mdsTickToFrame(msg: MdsTickMessage): Record<string, unknown> | null {
  const sym = String(msg.symbol || '')
  switch (msg.type) {
    case 'error':
      return { f: 0, c: String(msg.code ?? ''), m: String(msg.message ?? '') }
    case MDS_STREAM_TYPES.LAST_TRADED_PRICE:
      return {
        f: 2,
        id: sym,
        p: Number(msg.price),
        t: Number(msg.time),
        v: msg.volume != null ? Number(msg.volume) : undefined,
        s: msg.side != null ? Number(msg.side) : undefined,
        pc: msg.percentChange != null ? Number(msg.percentChange) : undefined,
        nc: msg.netChange != null ? Number(msg.netChange) : undefined,
      }
    case MDS_STREAM_TYPES.BEST_BID_ASK:
      return {
        f: 1,
        id: sym,
        bp: msg.bid != null ? Number(msg.bid) : undefined,
        ap: msg.ask != null ? Number(msg.ask) : undefined,
        bs: msg.bidSize != null ? Number(msg.bidSize) : undefined,
        as: msg.askSize != null ? Number(msg.askSize) : undefined,
        h: typeof msg.halted === 'boolean' ? msg.halted : undefined,
      }
    case MDS_STREAM_TYPES.BAR:
      return {
        f: 5,
        id: sym,
        r: String(msg.resolution ?? ''),
        t: Number(msg.time),
        o: Number(msg.open),
        h: Number(msg.high),
        l: Number(msg.low),
        c: Number(msg.close),
        v: msg.volume != null ? Number(msg.volume) : undefined,
      }
    case MDS_STREAM_TYPES.MARKET_DEPTH:
      return {
        f: 4,
        id: sym,
        b: msg.bids as [number, number][] | undefined,
        a: msg.asks as [number, number][] | undefined,
        u: msg.updateType != null ? Number(msg.updateType) : undefined,
      }
    case MDS_STREAM_TYPES.TRADED_VOLUME_AT_PRICE:
      return {
        f: 7,
        id: sym,
        v: msg.levels as [number, number][] | undefined,
        u: msg.updateType != null ? Number(msg.updateType) : undefined,
      }
    case MDS_STREAM_TYPES.QUOTES:
      return {
        f: 6,
        id: sym,
        p: msg.price != null ? Number(msg.price) : undefined,
        ap: msg.ask != null ? Number(msg.ask) : undefined,
        bp: msg.bid != null ? Number(msg.bid) : undefined,
        as: msg.askSize != null ? Number(msg.askSize) : undefined,
        bs: msg.bidSize != null ? Number(msg.bidSize) : undefined,
        bas: msg.bidAskSpread,
        v: msg.volume,
        h: msg.sessionHigh,
        l: msg.sessionLow,
        o: msg.open,
        pvc: msg.priorClose,
        nc: msg.netChange,
        pc: msg.percentChange,
      }
    default:
      return null
  }
}
