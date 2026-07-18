import PracticeService from '../PracticeService.js'
import {
  isRithmicChartLiveOpen,
  subscribeRithmicChartLive,
  unsubscribeRithmicChartLive,
  setChartLiveMarketHandler,
} from '../liveData/rithmicChartLive.js'
import {
  normalizeBarTimeSec,
  resolveBracketCrossHit,
  lastLtpByWatchId,
} from '../../utils/practiceBracketMath.js'

const BRACKET_EXCHANGE = 'CME'
const BRACKET_RESOLUTION = '1'

/** @type {Map<string, { id: string, userId: string, accountId: string, symbol: string, contracts: number, entry: number, stopLoss: number | null, takeProfit: number | null, entryTime: number, type: string }>} */
const watchesById = new Map()

/** Symbol-indexed buckets keep tick dispatch O(positions for symbol), not O(all positions). */
/** @type {Map<string, Map<string, object>>} */
const watchesBySymbol = new Map()

/** Open position count per product root (MNQ, NQ, …) — one Rithmic sub per symbol while count > 0. */
/** @type {Map<string, number>} */
const symbolRefCounts = new Map()

/** @type {Set<string>} */
const subscribedSymbols = new Set()

/** @type {Set<string>} */
const closingIds = new Set()

/** Latest executable mark per normalized product, retained across watch reloads. */
/** @type {Map<string, { price: number, time: number | string | undefined }>} */
const latestMarketBySymbol = new Map()

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
  return watchesBySymbol.get(key)?.values() ?? []
}

function setWatch(watch) {
  const previous = watchesById.get(watch.id)
  if (previous && previous.symbol !== watch.symbol) removeWatch(watch.id)
  watchesById.set(watch.id, watch)
  let bucket = watchesBySymbol.get(watch.symbol)
  if (!bucket) {
    bucket = new Map()
    watchesBySymbol.set(watch.symbol, bucket)
  }
  bucket.set(watch.id, watch)
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
  const nextCounts = new Map()
  for (const { symbol, count } of counts) {
    const key = normalizeSymbol(symbol)
    if (key && count > 0) nextCounts.set(key, count)
  }

  // Reconciliation must also unsubscribe products removed by resets, account
  // deletion, or status changes; otherwise the shared live feed grows forever.
  if (isRithmicChartLiveOpen()) {
    for (const key of subscribedSymbols) {
      if (nextCounts.has(key)) continue
      try {
        await unsubscribeRithmicChartLive(key, BRACKET_EXCHANGE)
      } catch {
        /* a disconnected feed will be rebuilt on its next bootstrap */
      }
      subscribedSymbols.delete(key)
    }
  } else {
    // Subscription flags belong to the old ChartLive instance. Keeping them
    // would cause a reopened feed to skip every required resubscription.
    subscribedSymbols.clear()
  }
  symbolRefCounts.clear()
  for (const [key, count] of nextCounts) symbolRefCounts.set(key, count)
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
  const watch = watchesById.get(positionId)
  watchesById.delete(positionId)
  if (watch) {
    const bucket = watchesBySymbol.get(watch.symbol)
    bucket?.delete(positionId)
    if (bucket?.size === 0) watchesBySymbol.delete(watch.symbol)
  }
  lastLtpByWatchId.delete(positionId)
}

function ltpFromPayload(payload) {
  const bar = payload?.bar
  const close =
    payload?.last ??
    payload?.price ??
    payload?.close ??
    bar?.last ??
    bar?.close ??
    bar?.c
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

function evaluateWatchAtMark(watch, ltp, time) {
  const prev = lastLtpByWatchId.get(watch.id)
  const hit = resolveBracketCrossHit(watch, prev, ltp)
  lastLtpByWatchId.set(watch.id, ltp)
  if (hit) void closeByBracket(watch, hit.reason, hit.exitPrice, time)
}

function handleChartMarketEvent(_kind, payload) {
  const symbol = normalizeSymbol(payload?.symbol)
  if (!symbol) return
  const ltp = ltpFromPayload(payload)
  if (ltp == null) return
  const time = payload.marker ?? payload?.bar?.marker ?? payload?.bar?.time
  latestMarketBySymbol.set(symbol, { price: ltp, time })

  for (const watch of watchesForSymbol(symbol)) {
    evaluateWatchAtMark(watch, ltp, time)
  }
}

export async function startPracticeBracketEngine() {
  if (started) {
    await refreshAllWatches()
    await refreshSymbolSubscriptionsFromDb()
    return
  }
  started = true
  setChartLiveMarketHandler(handleChartMarketEvent)
  // Restore watches before subscribing so the first market event cannot race
  // ahead of the positions it is supposed to protect.
  await refreshAllWatches()
  await refreshSymbolSubscriptionsFromDb()
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
    setWatch(watch)
    const latest = latestMarketBySymbol.get(watch.symbol)
    if (latest) evaluateWatchAtMark(watch, latest.price, latest.time)
  }

  for (const id of watchesById.keys()) {
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

  setWatch({
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

  const watch = watchesById.get(position.id)
  const latest = latestMarketBySymbol.get(normalizeSymbol(position.symbol))
  if (watch && latest) evaluateWatchAtMark(watch, latest.price, latest.time)
}

export async function clearAccountWatches(accountId) {
  for (const [id, watch] of watchesById.entries()) {
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
