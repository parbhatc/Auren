/** Practice trading lockouts (daily loss, max trades, self-lock). */

const ET = 'America/New_York'
const SESSION_RESET_HOUR = 18

export function getPracticeSessionDayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '0'
  let y = Number(pick('year'))
  let m = Number(pick('month'))
  let d = Number(pick('day'))
  const hour = Number(pick('hour'))

  if (hour < SESSION_RESET_HOUR) {
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() - 1)
    y = dt.getUTCFullYear()
    m = dt.getUTCMonth() + 1
    d = dt.getUTCDate()
  }

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Next futures session reset (6:00 PM ET). */
export function getNextSessionResetDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '0'
  const y = Number(pick('year'))
  const m = Number(pick('month'))
  const d = Number(pick('day'))
  const hour = Number(pick('hour'))

  let targetY = y
  let targetM = m
  let targetD = d
  if (hour >= SESSION_RESET_HOUR) {
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 1)
    targetY = dt.getUTCFullYear()
    targetM = dt.getUTCMonth() + 1
    targetD = dt.getUTCDate()
  }

  const guessUtc = Date.UTC(targetY, targetM - 1, targetD, SESSION_RESET_HOUR + 5, 0, 0)
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(guessUtc))

  return {
    iso: new Date(guessUtc).toISOString(),
    label: `${label} ET`,
  }
}

export function defaultDailyLossLimit(rules) {
  if (rules?.lockoutEnabled !== true) return null
  const dll = Number(rules?.dailyLossLimit)
  if (Number.isFinite(dll) && dll > 0) return dll
  return null
}

export function getSessionDayPnl(dayPnL, sessionKey) {
  if (!Array.isArray(dayPnL)) return 0
  const row = dayPnL.find((d) => d.date === sessionKey)
  return row ? Number(row.pnl) || 0 : 0
}

export function countTradesInSession(trades, sessionKey) {
  if (!Array.isArray(trades)) return 0
  let n = 0
  for (const t of trades) {
    const exitMs = Number(t.exit_time ?? t.exitTime) * (Number(t.exit_time ?? t.exitTime) < 1e12 ? 1000 : 1)
    if (!Number.isFinite(exitMs)) continue
    if (getPracticeSessionDayKey(new Date(exitMs)) === sessionKey) n += 1
  }
  return n
}

function lockoutExpired(until) {
  if (!until) return true
  const t = Date.parse(until)
  return !Number.isFinite(t) || Date.now() >= t
}

export function evaluatePracticeLockout(account, options = {}) {
  const rules = account?.rules || {}
  const sessionKey = getPracticeSessionDayKey()
  const dailyLossLimit = defaultDailyLossLimit(rules)
  const maxTradesPerDay =
    rules.maxTradesPerDay != null && Number.isFinite(Number(rules.maxTradesPerDay))
      ? Number(rules.maxTradesPerDay)
      : null
  const dailyNetPnl = getSessionDayPnl(account?.dayPnL, sessionKey)
  const tradesToday =
    options.tradesToday != null
      ? options.tradesToday
      : countTradesInSession(options.trades, sessionKey)
  const dailyLossUsed = dailyNetPnl < 0 ? Math.abs(dailyNetPnl) : 0

  const reset = getNextSessionResetDate()

  if (account?.status === 'blown') {
    return {
      locked: true,
      reason: 'blown',
      message: 'Account blown — max drawdown reached.',
      until: null,
      untilLabel: null,
      canUnlockManually: false,
      sessionKey,
      dailyNetPnl,
      dailyLossLimit,
      dailyLossUsed,
      tradesToday,
      maxTradesPerDay,
      nextSessionResetIso: reset.iso,
      nextSessionResetLabel: reset.label,
    }
  }

  if (account?.status === 'passed') {
    return {
      locked: true,
      reason: 'passed',
      message: 'Evaluation passed — trading disabled on this account.',
      until: null,
      untilLabel: null,
      canUnlockManually: false,
      sessionKey,
      dailyNetPnl,
      dailyLossLimit,
      dailyLossUsed,
      tradesToday,
      maxTradesPerDay,
      nextSessionResetIso: reset.iso,
      nextSessionResetLabel: reset.label,
    }
  }

  const storedUntil = account?.lockoutUntil
  const storedReason = account?.lockoutReason

  if (storedUntil && !lockoutExpired(storedUntil)) {
    const canUnlockManually = storedReason === 'manual'
    const messages = {
      daily_loss: `Daily loss limit reached. Locked until ${reset.label}.`,
      max_trades: `Max trades for this session (${maxTradesPerDay}). Locked until ${reset.label}.`,
      manual: 'Self-imposed trading lockout is active.',
      outside_hours: 'Outside allowed trading hours.',
    }
    return {
      locked: true,
      reason: storedReason || 'manual',
      message: messages[storedReason] || 'Trading is locked.',
      until: storedUntil,
      untilLabel: reset.label,
      canUnlockManually,
      sessionKey,
      dailyNetPnl,
      dailyLossLimit,
      dailyLossUsed,
      tradesToday,
      maxTradesPerDay,
      nextSessionResetIso: reset.iso,
      nextSessionResetLabel: reset.label,
    }
  }

  if (dailyLossLimit != null && dailyLossLimit > 0 && dailyLossUsed >= dailyLossLimit) {
    return {
      locked: true,
      shouldPersist: true,
      reason: 'daily_loss',
      message: `Daily loss limit ($${dailyLossLimit}) hit. Locked until ${reset.label}.`,
      until: reset.iso,
      untilLabel: reset.label,
      canUnlockManually: false,
      sessionKey,
      dailyNetPnl,
      dailyLossLimit,
      dailyLossUsed,
      tradesToday,
      maxTradesPerDay,
      nextSessionResetIso: reset.iso,
      nextSessionResetLabel: reset.label,
    }
  }

  if (maxTradesPerDay != null && maxTradesPerDay > 0 && tradesToday >= maxTradesPerDay) {
    return {
      locked: true,
      shouldPersist: true,
      reason: 'max_trades',
      message: `Max ${maxTradesPerDay} trades this session. Locked until ${reset.label}.`,
      until: reset.iso,
      untilLabel: reset.label,
      canUnlockManually: false,
      sessionKey,
      dailyNetPnl,
      dailyLossLimit,
      dailyLossUsed,
      tradesToday,
      maxTradesPerDay,
      nextSessionResetIso: reset.iso,
      nextSessionResetLabel: reset.label,
    }
  }

  return {
    locked: false,
    reason: null,
    message: null,
    until: null,
    untilLabel: reset.label,
    canUnlockManually: false,
    sessionKey,
    dailyNetPnl,
    dailyLossLimit,
    dailyLossUsed,
    tradesToday,
    maxTradesPerDay,
    nextSessionResetIso: reset.iso,
    nextSessionResetLabel: reset.label,
  }
}
