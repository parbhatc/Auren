/**
 * Futures-style daily session reset — 5:59 PM America/New_York on weekdays only.
 * Fri 5:59 PM reset carries through Sat/Sun until Mon 5:59 PM.
 */

export const PRACTICE_SESSION_TZ = 'America/New_York'
export const SESSION_RESET_HOUR = 17
export const SESSION_RESET_MINUTE = 59

const RESET_WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

function formatEtParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PRACTICE_SESSION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '0'
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    weekday: pick('weekday'),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
    second: Number(pick('second')),
  }
}

function isResetWeekday(weekday) {
  return RESET_WEEKDAYS.has(weekday)
}

/** UTC ms for an ET wall-clock instant (DST-safe via binary search). */
export function etLocalToUtcMs(year, month, day, hour, minute, second = 0) {
  const target =
    year * 1e10 +
    month * 1e8 +
    day * 1e6 +
    hour * 1e4 +
    minute * 100 +
    second
  let lo = Date.UTC(year, month - 1, day, hour + 5, minute, second) - 2 * 3600000
  let hi = lo + 6 * 3600000

  for (let i = 0; i < 64; i++) {
    const mid = Math.floor((lo + hi) / 2)
    const p = formatEtParts(new Date(mid))
    const actual =
      p.year * 1e10 +
      p.month * 1e8 +
      p.day * 1e6 +
      p.hour * 1e4 +
      p.minute * 100 +
      p.second
    if (actual < target) lo = mid + 1
    else hi = mid
  }
  return hi
}

function resetBoundaryUtcMs(year, month, day) {
  return etLocalToUtcMs(year, month, day, SESSION_RESET_HOUR, SESSION_RESET_MINUTE, 0)
}

function addEtDays(year, month, day, deltaDays) {
  let anchor = etLocalToUtcMs(year, month, day, 12, 0, 0)
  const step = deltaDays >= 0 ? 86400000 : -86400000
  const steps = Math.abs(deltaDays)
  for (let i = 0; i < steps; i++) {
    anchor += step
  }
  const p = formatEtParts(new Date(anchor))
  return { year: p.year, month: p.month, day: p.day, weekday: p.weekday }
}

/** Most recent weekday 5:59 PM ET boundary at or before `nowMs`. */
export function getLastResetBoundaryMs(nowMs = Date.now()) {
  const et = formatEtParts(new Date(nowMs))
  let { year, month, day, weekday } = et

  if (isResetWeekday(weekday)) {
    const boundaryMs = resetBoundaryUtcMs(year, month, day)
    if (nowMs >= boundaryMs) return boundaryMs
  }

  let cy = year
  let cm = month
  let cd = day
  for (let i = 0; i < 12; i++) {
    const prev = addEtDays(cy, cm, cd, -1)
    cy = prev.year
    cm = prev.month
    cd = prev.day
    if (isResetWeekday(prev.weekday)) {
      return resetBoundaryUtcMs(cy, cm, cd)
    }
  }
  throw new Error('[practiceSessionReset] could not resolve last reset boundary')
}

/** Next weekday 5:59 PM ET boundary strictly after `nowMs`. */
export function getNextResetBoundaryMs(nowMs = Date.now()) {
  const et = formatEtParts(new Date(nowMs))
  let { year, month, day, weekday } = et

  if (isResetWeekday(weekday)) {
    const boundaryMs = resetBoundaryUtcMs(year, month, day)
    if (nowMs < boundaryMs) return boundaryMs
  }

  let cy = year
  let cm = month
  let cd = day
  for (let i = 0; i < 12; i++) {
    const next = addEtDays(cy, cm, cd, 1)
    cy = next.year
    cm = next.month
    cd = next.day
    if (isResetWeekday(next.weekday)) {
      return resetBoundaryUtcMs(cy, cm, cd)
    }
  }
  throw new Error('[practiceSessionReset] could not resolve next reset boundary')
}

export function sessionKeyFromBoundaryMs(boundaryMs) {
  const p = formatEtParts(new Date(boundaryMs))
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Session id for the current trading day (last reset boundary date in ET). */
export function getPracticeSessionDayKey(nowMs = Date.now()) {
  return sessionKeyFromBoundaryMs(getLastResetBoundaryMs(nowMs))
}

export function getSessionDayPnl(dayPnL, sessionKey) {
  if (!Array.isArray(dayPnL)) return 0
  const row = dayPnL.find((d) => d.date === sessionKey)
  return row ? Number(row.pnl) || 0 : 0
}

export function getNextSessionResetDate(nowMs = Date.now()) {
  const nextMs = getNextResetBoundaryMs(nowMs)
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: PRACTICE_SESSION_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(nextMs))
  return { iso: new Date(nextMs).toISOString(), label: `${label} ET` }
}

/** Daily loss cap for this session — fixed rule or % of current balance. */
export function computeSessionDailyLossLimit(rules, balance) {
  if (rules?.lockoutEnabled !== true) return null
  const fixed = Number(rules?.dailyLossLimit)
  if (Number.isFinite(fixed) && fixed > 0) return fixed

  const bal = Number(balance)
  if (!Number.isFinite(bal) || bal <= 0) return null

  const maxLoss = Number(rules?.maxLoss)
  const pctLimit = bal * 0.02
  const cap = Number.isFinite(maxLoss) && maxLoss > 0 ? maxLoss * 0.5 : pctLimit
  return Math.round(Math.min(pctLimit, cap) * 100) / 100
}

/**
 * Compare current time to last_reset_at; returns reset actions when a boundary was crossed.
 * day_pnl_json history is preserved — prior session rows stay as the audit log.
 */
export function evaluateDailySessionReset(account, nowMs = Date.now()) {
  const currentBoundaryMs = getLastResetBoundaryMs(nowMs)
  const sessionKey = sessionKeyFromBoundaryMs(currentBoundaryMs)
  const dailyRealizedPl = getSessionDayPnl(account?.dayPnL, sessionKey)

  const lastResetRaw = account?.lastResetAt
  const lastResetMs = lastResetRaw ? Date.parse(lastResetRaw) : NaN

  if (!Number.isFinite(lastResetMs)) {
    return {
      shouldReset: false,
      shouldInit: true,
      lastResetAt: new Date(currentBoundaryMs).toISOString(),
      sessionKey,
      dailyRealizedPl,
    }
  }

  const storedBoundaryMs = getLastResetBoundaryMs(lastResetMs)
  if (currentBoundaryMs <= storedBoundaryMs) {
    return {
      shouldReset: false,
      shouldInit: false,
      sessionKey,
      dailyRealizedPl,
    }
  }

  const previousSessionKey = sessionKeyFromBoundaryMs(storedBoundaryMs)
  const archivedDailyPl = getSessionDayPnl(account?.dayPnL, previousSessionKey)

  return {
    shouldReset: true,
    shouldInit: false,
    lastResetAt: new Date(currentBoundaryMs).toISOString(),
    previousSessionKey,
    archivedDailyPl,
    sessionKey,
    dailyRealizedPl: 0,
    clearSessionLockout: true,
  }
}
