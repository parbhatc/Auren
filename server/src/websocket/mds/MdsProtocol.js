/**
 * MDS wire protocol — firm-agnostic client ↔ backend messages.
 * Backend translates to/from provider-specific frames (Tradesea f:1..7 today).
 *
 * Client subscribe:   { "action": "subscribe", "type": "last_traded_price", "symbols": ["CME:MNQ"] }
 * Client unsubscribe: { "action": "unsubscribe", "type": "last_traded_price", "symbols": ["CME:MNQ"] }
 * Client bars:        { "action": "subscribe", "type": "bar", "symbols": ["CME:MNQ"], "resolutions": ["5"] }
 *
 * Server tick:        { "type": "last_traded_price", "symbol": "CME:MNQ", "price": 29849.75, "time": ... }
 */

const F = {
  BEST_BID_ASK: 1,
  LTP: 2,
  DEPTH: 4,
  CANDLES: 5,
  QUOTES: 6,
  TTV: 7,
}

const BUCKETS = {
  last_traded_price: 'ltpDef',
  best_bid_ask: 'bidAskDef',
  market_depth: 'marketDepthDef',
  traded_volume_at_price: 'ttvDef',
}

const STREAM_TYPES = {
  LAST_TRADED_PRICE: 'last_traded_price',
  BEST_BID_ASK: 'best_bid_ask',
  QUOTES: 'quotes',
  TRADED_VOLUME_AT_PRICE: 'traded_volume_at_price',
  MARKET_DEPTH: 'market_depth',
  CANDLES: 'bar',
}

const LANE = 0

export function isWsPing(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : raw.toString('utf8').trim()
  if (trimmed === 'ping') return true
  if (!trimmed.startsWith('{')) return false
  try {
    const json = JSON.parse(trimmed)
    const action = String(json.action || json.op || json.type || json.event || '').toLowerCase()
    return action === 'ping'
  } catch {
    return false
  }
}

export function isWsPong(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : raw.toString('utf8').trim()
  if (trimmed === 'pong') return true
  if (!trimmed.startsWith('{')) return false
  try {
    const json = JSON.parse(trimmed)
    const action = String(json.action || json.op || json.type || json.event || '').toLowerCase()
    return action === 'pong'
  } catch {
    return false
  }
}

/** Reply in the same wire format Tradesea prod expects ({ action: pong } when ping used action). */
export function buildWsPongReply(pingRaw) {
  const text = typeof pingRaw === 'string' ? pingRaw.trim() : pingRaw.toString('utf8').trim()
  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text)
      if (json.action != null || json.op != null) {
        return JSON.stringify({ action: 'pong' })
      }
    } catch {
      /* fall through */
    }
  }
  return 'pong'
}

function isPingText(text) {
  return isWsPing(text)
}

function parseClientControl(obj) {
  if (!obj || typeof obj !== 'object') return null

  const actionRaw = String(obj.action || obj.op || '').toLowerCase()
  let subscribe = null
  if (actionRaw === 'subscribe' || actionRaw === 'sub') subscribe = true
  if (actionRaw === 'unsubscribe' || actionRaw === 'unsub') subscribe = false
  if (subscribe === null) return null

  const typeRaw = String(obj.type || obj.ch || '').trim()
  const symbols = Array.isArray(obj.symbols)
    ? obj.symbols.map(String)
    : Array.isArray(obj.sym)
      ? obj.sym.map(String)
      : []
  const resolutions = Array.isArray(obj.resolutions)
    ? obj.resolutions.map(String)
    : Array.isArray(obj.res)
      ? obj.res.map(String)
      : []

  return { subscribe, type: typeRaw, symbols, resolutions }
}

function clientControlToUpstream(control) {
  const { subscribe, type, symbols, resolutions } = control

  switch (type) {
    case STREAM_TYPES.LAST_TRADED_PRICE:
    case 'ltp':
      return {
        f: F.LTP,
        b: BUCKETS.last_traded_price,
        s: subscribe ? symbols : [],
        u: subscribe ? [] : symbols,
        l: LANE,
      }
    case STREAM_TYPES.BEST_BID_ASK:
    case 'bidAsk':
      return {
        f: F.BEST_BID_ASK,
        b: BUCKETS.best_bid_ask,
        s: subscribe ? symbols : [],
        u: subscribe ? [] : symbols,
        l: LANE,
      }
    case STREAM_TYPES.MARKET_DEPTH:
    case 'depth':
      return {
        f: F.DEPTH,
        b: BUCKETS.market_depth,
        s: subscribe ? symbols : [],
        u: subscribe ? [] : symbols,
        l: LANE,
      }
    case STREAM_TYPES.QUOTES:
    case 'quotes':
      return {
        f: F.QUOTES,
        s: subscribe ? symbols : [],
        u: subscribe ? [] : symbols,
        l: LANE,
      }
    case STREAM_TYPES.TRADED_VOLUME_AT_PRICE:
    case 'ttv':
      return {
        f: F.TTV,
        b: BUCKETS.traded_volume_at_price,
        s: subscribe ? symbols : [],
        u: subscribe ? [] : symbols,
        l: LANE,
      }
    case STREAM_TYPES.CANDLES:
    case 'bar':
    case 'candles':
      return {
        f: F.CANDLES,
        s: subscribe ? symbols : [],
        u: subscribe ? [] : symbols,
        sr: subscribe ? resolutions : [],
        ur: subscribe ? [] : resolutions,
        l: LANE,
      }
    default:
      return null
  }
}

function upstreamToClientTick(obj) {
  const f = typeof obj.f === 'number' ? obj.f : null
  const symbol = String(obj.id || obj.symbol || obj.sym || '')

  if (f === 0) {
    return { type: 'error', symbol, code: obj.c, message: obj.m }
  }
  if (f === F.LTP) {
    return {
      type: STREAM_TYPES.LAST_TRADED_PRICE,
      symbol,
      price: obj.p,
      time: obj.t,
      volume: obj.v,
      side: obj.s,
      percentChange: obj.pc,
      netChange: obj.nc,
    }
  }
  if (f === F.BEST_BID_ASK) {
    return {
      type: STREAM_TYPES.BEST_BID_ASK,
      symbol,
      bid: obj.bp,
      ask: obj.ap,
      bidSize: obj.bs,
      askSize: obj.as,
      halted: obj.h,
    }
  }
  if (f === F.CANDLES) {
    return {
      type: STREAM_TYPES.CANDLES,
      symbol,
      resolution: obj.r,
      time: obj.t,
      open: obj.o,
      high: obj.h,
      low: obj.l,
      close: obj.c,
      volume: obj.v,
    }
  }
  if (f === F.DEPTH) {
    return {
      type: STREAM_TYPES.MARKET_DEPTH,
      symbol,
      bids: obj.b,
      asks: obj.a,
      updateType: obj.u,
    }
  }
  if (f === F.TTV) {
    return {
      type: STREAM_TYPES.TRADED_VOLUME_AT_PRICE,
      symbol,
      levels: obj.v,
      updateType: obj.u,
    }
  }
  if (f === F.QUOTES || (symbol && (obj.p != null || obj.ap != null || obj.bp != null))) {
    return {
      type: STREAM_TYPES.QUOTES,
      symbol,
      price: obj.p,
      ask: obj.ap,
      bid: obj.bp,
      askSize: obj.as,
      bidSize: obj.bs,
      bidAskSpread: obj.bas,
      volume: obj.v,
      sessionHigh: obj.h,
      sessionLow: obj.l,
      open: obj.o,
      priorClose: obj.pvc,
      netChange: obj.nc,
      percentChange: obj.pc,
    }
  }
  return null
}

/**
 * Client → upstream (Tradesea). Returns string to send, or null to drop.
 */
export function translateClientToUpstream(raw, isBinary) {
  if (isBinary) return raw
  const text = raw.toString('utf8')
  if (isPingText(text)) return text

  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    return raw
  }

  const control = parseClientControl(obj)
  if (control) {
    const wire = clientControlToUpstream(control)
    return wire ? JSON.stringify(wire) : null
  }

  // Legacy provider wire from older clients — pass through unchanged.
  if (typeof obj.f === 'number') return text

  return text
}

/**
 * Upstream → client. Returns string to send, or null to drop.
 */
export function translateUpstreamToClient(raw, isBinary) {
  if (isBinary) return raw
  const text = raw.toString('utf8').trim()
  if (!text || isWsPong(text)) return text
  if (isWsPing(text)) return null

  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    return raw
  }

  const tick = upstreamToClientTick(obj)
  return tick ? JSON.stringify(tick) : text
}
