/** Practice trading lockouts (daily loss, max trades, self-lock). */

import {
  computeSessionDailyLossLimit,
  getNextSessionResetDate,
  getPracticeSessionDayKey,
  getSessionDayPnl,
} from './practiceSessionReset.js'

export {
  getNextSessionResetDate,
  getPracticeSessionDayKey,
  getSessionDayPnl,
} from './practiceSessionReset.js'

export function defaultDailyLossLimit(rules) {
  if (rules?.lockoutEnabled !== true) return null
  const session = Number(rules?.sessionDailyLossLimit)
  if (Number.isFinite(session) && session > 0) return session
  const dll = Number(rules?.dailyLossLimit)
  if (Number.isFinite(dll) && dll > 0) return dll
  return null
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
  const dailyLossLimit =
    defaultDailyLossLimit(rules) ??
    (rules.lockoutEnabled === true && account?.balance != null
      ? computeSessionDailyLossLimit(rules, account.balance)
      : null)
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
