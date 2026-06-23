import PracticeService from '../PracticeService.js'
import {
  isRithmicChartLiveOpen,
  subscribeRithmicChartLive,
  unsubscribeRithmicChartLive,
  setChartLiveMarketHandler,
} from '../liveData/rithmicChartLive.js'
import {
  normalizeBarTimeSec,
  resolveBracketLtpHit,
} from '../../utils/practiceBracketMath.js'

const BRACKET_EXCHANGE = 'CME'
const BRACKET_RESOLUTION = '1'

/** @type {Map<string, { id: string, userId: string, accountId: string, symbol: string, contracts: number, entry: number, stopLoss: number | null, takeProfit: number | null, entryTime: number, type: string }>} */
const watchesById = new Map()

/** Open position count per product root (MNQ, NQ, …) — one Rithmic sub per symbol while count > 0. */
/** @type {Map<string, number>} */
const symbolRefCounts = new Map()

/** @type {Set<string>} */
const subscribedSymbols = new Set()

/** @type {Set<string>} */
const closingIds = new Set()

let started = false

function normalizeSymbol(symbol) {
  return String(symbol || '')
    .toUpperCase()
    .replace(/^[A-Z]+:/, '')
    .replace(/[0-9!]+$/g, '')
    .trim()
}

function watchesForSymbol(symbol) {
  const key = normalizeSymbol(symbol)
  const out = []
  for (const watch of watchesById.values()) {
    if (normalizeSymbol(watch.symbol) === key) out.push(watch)
  }
  return out
}

async function subscribeSymbolKey(key) {
  if (!key || !isRithmicChartLiveOpen()) return
  if (subscribedSymbols.has(key)) return
  try {
    await subscribeRithmicChartLive(key, BRACKET_EXCHANGE, BRACKET_RESOLUTION, true)
    subscribedSymbols.add(key)
  } catch (err) {
    const msg = String(err?.message || err)
    if (/already subscribed/i.test(msg)) {
      subscribedSymbols.add(key)
      return
    }
    console.warn('[PracticeBracket] subscribe failed', key, msg)
  }
}

async function subscribeAllPendingSymbols() {
  if (!isRithmicChartLiveOpen()) return
  for (const key of symbolRefCounts.keys()) {
    await subscribeSymbolKey(key)
  }
}

/** Rebuild symbol ref counts from DB (server start / ChartLive ready). */
async function refreshSymbolSubscriptionsFromDb() {
  const counts = await PracticeService.listActivePositionSymbolCounts()
  symbolRefCounts.clear()
  for (const { symbol, count } of counts) {
    const key = normalizeSymbol(symbol)
    if (!key || count <= 0) continue
    symbolRefCounts.set(key, count)
  }
  await subscribeAllPendingSymbols()
}

async function incrementSymbolRef(symbol) {
  const key = normalizeSymbol(symbol)
  if (!key) return
  const prev = symbolRefCounts.get(key) || 0
  symbolRefCounts.set(key, prev + 1)
  if (prev === 0) {
    await subscribeSymbolKey(key)
  }
}

async function decrementSymbolRef(symbol) {
  const key = normalizeSymbol(symbol)
  if (!key) return
  const prev = symbolRefCounts.get(key) || 0
  if (prev <= 1) {
    symbolRefCounts.delete(key)
    if (subscribedSymbols.has(key) && isRithmicChartLiveOpen()) {
      try {
        await unsubscribeRithmicChartLive(key, BRACKET_EXCHANGE)
      } catch {
        /* ignore */
      }
      subscribedSymbols.delete(key)
    }
    return
  }
  symbolRefCounts.set(key, prev - 1)
}

function removeWatch(positionId) {
  watchesById.delete(positionId)
}

function ltpFromPayload(payload) {
  const bar = payload?.bar
  const close = bar?.close ?? bar?.last ?? bar?.c
  if (close == null || !Number.isFinite(Number(close))) return null
  return Number(close)
}

async function closeByBracket(watch, reason, exitPrice, time) {
  if (closingIds.has(watch.id)) return
  closingIds.add(watch.id)
  try {
    if (exitPrice == null || !Number.isFinite(exitPrice)) return

    const exitTime = normalizeBarTimeSec(time)
    const result = await PracticeService.closePositionByBracket(
      watch.userId,
      watch.accountId,
      watch.id,
      { exitPrice, exitTime, reason }
    )
    if (!result) return

    removeWatch(watch.id)
  } catch (err) {
    console.warn('[PracticeBracket] close failed', watch.id, err?.message || err)
  } finally {
    closingIds.delete(watch.id)
  }
}

function handleChartMarketEvent(_kind, payload) {
  const symbol = normalizeSymbol(payload?.symbol)
  if (!symbol) return
  const ltp = ltpFromPayload(payload)
  if (ltp == null) return
  const time = payload.marker ?? payload?.bar?.marker ?? payload?.bar?.time

  for (const watch of watchesForSymbol(symbol)) {
    const reason = resolveBracketLtpHit(watch, ltp)
    if (!reason) continue
    void closeByBracket(watch, reason, ltp, time)
  }
}

export async function startPracticeBracketEngine() {
  if (started) {
    await refreshSymbolSubscriptionsFromDb()
    return
  }
  started = true
  setChartLiveMarketHandler(handleChartMarketEvent)
  await refreshSymbolSubscriptionsFromDb()
  await refreshAllWatches()
}

/** Called when a new position row is inserted — subscribe symbol if first open on that product. */
export async function trackOpenPositionSymbol(symbol) {
  await incrementSymbolRef(symbol)
}

export async function refreshAllWatches() {
  const rows = await PracticeService.listBracketPositions()

  const nextIds = new Set()
  for (const row of rows) {
    const watch = {
      id: row.id,
      userId: row.userId,
      accountId: row.accountId,
      symbol: normalizeSymbol(row.symbol),
      contracts: row.contracts,
      entry: row.entry,
      stopLoss: row.stopLoss,
      takeProfit: row.takeProfit,
      entryTime: row.entryTime,
      type: row.type,
    }
    nextIds.add(watch.id)
    watchesById.set(watch.id, watch)
  }

  for (const [id] of [...watchesById.entries()]) {
    if (!nextIds.has(id)) removeWatch(id)
  }
}

/** Keep bracket watches in sync with practice_positions (symbol subs via trackOpenPositionSymbol). */
export async function syncPositionWatch(userId, accountId, position) {
  if (!position?.id) return

  if (!position.contracts) {
    removeWatch(position.id)
    return
  }

  const hasBracket = position.stopLoss != null || position.takeProfit != null
  if (!hasBracket) {
    removeWatch(position.id)
    return
  }

  watchesById.set(position.id, {
    id: position.id,
    userId,
    accountId,
    symbol: normalizeSymbol(position.symbol),
    contracts: position.contracts,
    entry: position.entry,
    stopLoss: position.stopLoss ?? null,
    takeProfit: position.takeProfit ?? null,
    entryTime: position.entryTime,
    type: position.type,
  })
}

export async function clearAccountWatches(accountId) {
  for (const [id, watch] of [...watchesById.entries()]) {
    if (watch.accountId === accountId) removeWatch(id)
  }
  await refreshSymbolSubscriptionsFromDb()
}

export function notifyPositionRemoved(_userId, _accountId, positionId, symbol) {
  removeWatch(positionId)
  if (symbol) {
    void decrementSymbolRef(symbol)
  }
}
