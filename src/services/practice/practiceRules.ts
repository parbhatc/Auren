import type { PracticeAccount, PracticeDayPnL } from '../../constants/practice'
import {
  effectiveMinProfitableDays,
  getPracticePlanFromAccount,
  type PracticeAccountRules,
} from './practicePlans'

export interface PracticeRuleStatus {
  blown: boolean
  passed: boolean
  profitTarget: number | null
  /** Base profit target from plan; use {@link effectiveProfitTarget} for pass checks. */
  effectiveProfitTarget: number | null
  totalProfit: number
  profitRemaining: number | null
  drawdownFloor: number
  cushion: number
  consistencyOk: boolean
  /** Best profitable day ÷ total profit (percent). */
  consistencyPct: number | null
  consistencyRequired: number | null
  bestDayProfit: number
  profitableDaysCount: number
  minProfitableDaysRequired: number
  consistencyMessage: string | null
}

function resolveRules(account: PracticeAccount): PracticeAccountRules {
  if (account.rules) return account.rules
  return getPracticePlanFromAccount(account)
}

/** USD display for practice hub / cards (e.g. $1,250). */
/** Best profitable day as % of total profit; null when not yet measurable. */
export function practiceBestDaySharePct(
  status: Pick<PracticeRuleStatus, 'totalProfit' | 'bestDayProfit'>
): number | null {
  if (status.totalProfit <= 0 || status.bestDayProfit <= 0) return null
  return (status.bestDayProfit / status.totalProfit) * 100
}

/**
 * When best day exceeds the consistency limit, required total profit increases:
 * bestDay ÷ (limit/100). Pass uses max(base target, that amount).
 */
export function computeEffectiveProfitTarget(
  rules: PracticeAccountRules,
  bestDayProfit: number
): number | null {
  const base = rules.profitTarget
  if (base == null) return null
  const limit = rules.consistencyPct
  if (limit == null || limit <= 0 || bestDayProfit <= 0) return base
  const requiredFromBestDay = bestDayProfit / (limit / 100)
  return Math.max(base, requiredFromBestDay)
}

export function formatPracticeDollars(
  amount: number,
  options?: { maximumFractionDigits?: number }
): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  })
}

export function computeDrawdownFloor(account: PracticeAccount): number {
  const rules = resolveRules(account)
  const start = rules.startingBalance
  const high = account.highWaterMark
  if (account.mode === 'funded' && account.drawdownFloorLocked) {
    return Math.max(start, high - rules.maxLoss)
  }
  return high - rules.maxLoss
}

export function evaluatePracticeRules(
  account: PracticeAccount,
  dayPnL: PracticeDayPnL[] = account.dayPnL
): PracticeRuleStatus {
  const rules = resolveRules(account)
  const balance = account.balance
  const start = rules.startingBalance
  const totalProfit = balance - start
  const drawdownFloor = computeDrawdownFloor(account)
  const cushion = balance - drawdownFloor

  const blown = balance <= drawdownFloor
  const profitTarget = rules.profitTarget
  const minProfitableDaysRequired = effectiveMinProfitableDays(rules)

  const profitableDays = dayPnL.filter((d) => d.pnl > 0)
  const profitableDaysCount = profitableDays.length
  const bestDayProfit =
    profitableDays.length > 0 ? profitableDays.reduce((m, d) => Math.max(m, d.pnl), 0) : 0

  const effectiveProfitTarget = computeEffectiveProfitTarget(rules, bestDayProfit)
  const profitRemaining =
    effectiveProfitTarget != null ? Math.max(0, effectiveProfitTarget - totalProfit) : null

  let consistencyOk = true
  let consistencyPct: number | null = null
  let consistencyMessage: string | null = null
  const consistencyLimit =
    rules.consistencyPct != null && rules.consistencyPct > 0 ? rules.consistencyPct : null

  if (consistencyLimit != null && account.mode === 'eval') {
    if (totalProfit <= 0) {
      consistencyOk = false
    } else if (profitableDaysCount < minProfitableDaysRequired) {
      consistencyOk = false
      consistencyMessage = `Need at least ${minProfitableDaysRequired} profitable days (${profitableDaysCount} so far).`
    } else if (bestDayProfit > 0) {
      consistencyPct = (bestDayProfit / totalProfit) * 100
      consistencyOk = consistencyPct <= consistencyLimit + 1e-6
      if (!consistencyOk) {
        const raised =
          effectiveProfitTarget != null && profitTarget != null && effectiveProfitTarget > profitTarget
        consistencyMessage = raised
          ? `Best day ($${formatPracticeDollars(bestDayProfit)}) is ${consistencyPct.toFixed(0)}% of profit (limit ${consistencyLimit}%). Profit target raised to $${formatPracticeDollars(effectiveProfitTarget)}.`
          : `Best day ($${formatPracticeDollars(bestDayProfit)}) is ${consistencyPct.toFixed(0)}% of profit. Limit is ${consistencyLimit}%.`
      }
    }
  }

  const hitProfit = effectiveProfitTarget == null || totalProfit >= effectiveProfitTarget
  const passed =
    account.status === 'active' &&
    !blown &&
    account.mode === 'eval' &&
    hitProfit &&
    consistencyOk

  return {
    blown,
    passed,
    profitTarget,
    effectiveProfitTarget,
    totalProfit,
    profitRemaining,
    drawdownFloor,
    cushion,
    consistencyOk,
    consistencyPct,
    consistencyRequired: consistencyLimit,
    bestDayProfit,
    profitableDaysCount,
    minProfitableDaysRequired,
    consistencyMessage,
  }
}
