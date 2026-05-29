import type { PracticeAccount, PracticeDayPnL } from '../../constants/practice'
import type { PracticeAccountRules } from './practicePlans'
import { t } from '../../utils/translator'

export type PracticeLockoutReason =
  | 'daily_loss'
  | 'max_trades'
  | 'manual'
  | 'outside_hours'
  | 'blown'
  | 'passed'

export interface PracticeLockoutStatus {
  locked: boolean
  reason: PracticeLockoutReason | null
  message: string | null
  until: string | null
  untilLabel: string | null
  canUnlockManually: boolean
  sessionKey: string
  dailyNetPnl: number
  dailyLossLimit: number | null
  dailyLossUsed: number
  dailyLossRemaining: number | null
  tradesToday: number
  maxTradesPerDay: number | null
  nextSessionResetIso: string
  nextSessionResetLabel: string
}

const ET = 'America/New_York'
const SESSION_RESET_HOUR = 18

export function getPracticeSessionDayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
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

export function getNextSessionResetDate(now = new Date()): { iso: string; label: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
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

  return { iso: new Date(guessUtc).toISOString(), label: `${label} ET` }
}

export function defaultDailyLossLimit(rules: PracticeAccountRules): number | null {
  if (rules.lockoutEnabled !== true) return null
  if (rules.dailyLossLimit != null && Number.isFinite(rules.dailyLossLimit) && rules.dailyLossLimit > 0) {
    return rules.dailyLossLimit
  }
  return null
}

/** Realized P/L for the current futures session (resets 6:00 PM ET). */
export function getSessionDayPnl(
  dayPnL: PracticeDayPnL[] | undefined,
  sessionKey: string
): number {
  if (!dayPnL?.length) return 0
  const row = dayPnL.find((d) => d.date === sessionKey)
  return row ? Number(row.pnl) || 0 : 0
}

export function getPracticeSessionRealizedPnl(
  dayPnL: PracticeDayPnL[] | undefined,
  now = new Date()
): number {
  return getSessionDayPnl(dayPnL, getPracticeSessionDayKey(now))
}

export function lockoutExpired(until: string | null | undefined): boolean {
  if (!until) return true
  const t = Date.parse(until)
  return !Number.isFinite(t) || Date.now() >= t
}

export function evaluatePracticeLockout(
  account: PracticeAccount | null | undefined,
  options?: { tradesToday?: number }
): PracticeLockoutStatus {
  const rules = account?.rules
  const sessionKey = getPracticeSessionDayKey()
  const dailyLossLimit = rules ? defaultDailyLossLimit(rules) : null
  const maxTradesPerDay =
    rules?.maxTradesPerDay != null && Number.isFinite(rules.maxTradesPerDay)
      ? rules.maxTradesPerDay
      : null
  const dailyNetPnl = getSessionDayPnl(account?.dayPnL, sessionKey)
  const tradesToday = options?.tradesToday ?? 0
  const dailyLossUsed = dailyNetPnl < 0 ? Math.abs(dailyNetPnl) : 0
  const dailyLossRemaining =
    dailyLossLimit != null && dailyLossLimit > 0
      ? Math.max(0, dailyLossLimit - dailyLossUsed)
      : null
  const reset = getNextSessionResetDate()

  const base = {
    sessionKey,
    dailyNetPnl,
    dailyLossLimit,
    dailyLossUsed,
    dailyLossRemaining,
    tradesToday,
    maxTradesPerDay,
    nextSessionResetIso: reset.iso,
    nextSessionResetLabel: reset.label,
  }

  if (!account || account.status !== 'active') {
    const reason: PracticeLockoutReason =
      account?.status === 'passed' ? 'passed' : account?.status === 'blown' ? 'blown' : 'passed'
    return {
      ...base,
      locked: true,
      reason,
      message:
        account?.status === 'blown'
          ? 'Account blown — max drawdown reached.'
          : account?.status === 'passed'
            ? 'Evaluation passed — trading disabled.'
            : 'Practice account is not active.',
      until: null,
      untilLabel: null,
      canUnlockManually: false,
    }
  }

  const storedUntil = account.lockoutUntil
  const storedReason = account.lockoutReason as PracticeLockoutReason | null | undefined

  if (storedUntil && !lockoutExpired(storedUntil)) {
    const messages: Record<string, string> = {
      daily_loss: `Daily loss limit reached. Unlocks ${reset.label}.`,
      max_trades: `Max trades for this session. Unlocks ${reset.label}.`,
      manual: t('toast.lockout.manualSubtitle'),
      outside_hours: 'Outside allowed trading hours.',
    }
    return {
      ...base,
      locked: true,
      reason: storedReason || 'manual',
      message: messages[storedReason || 'manual'] || 'Trading is locked.',
      until: storedUntil,
      untilLabel: reset.label,
      canUnlockManually: storedReason === 'manual',
    }
  }

  if (dailyLossLimit != null && dailyLossLimit > 0 && dailyLossUsed >= dailyLossLimit) {
    return {
      ...base,
      locked: true,
      reason: 'daily_loss',
      message: `Daily loss limit ($${dailyLossLimit}) reached. Unlocks ${reset.label}.`,
      until: reset.iso,
      untilLabel: reset.label,
      canUnlockManually: false,
    }
  }

  if (maxTradesPerDay != null && maxTradesPerDay > 0 && tradesToday >= maxTradesPerDay) {
    return {
      ...base,
      locked: true,
      reason: 'max_trades',
      message: `Max ${maxTradesPerDay} trades this session. Unlocks ${reset.label}.`,
      until: reset.iso,
      untilLabel: reset.label,
      canUnlockManually: false,
    }
  }

  return {
    ...base,
    locked: false,
    reason: null,
    message: null,
    until: null,
    untilLabel: reset.label,
    canUnlockManually: false,
  }
}

export function formatLockoutCountdown(untilIso: string | null): string | null {
  if (!untilIso) return null
  const ms = Date.parse(untilIso) - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
