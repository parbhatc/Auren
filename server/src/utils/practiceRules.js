/** Practice eval rules evaluation (server-side). */

export function getDefaultRules(size, mode) {
  const trailing = size === 25000 ? 1000 : size === 50000 ? 2000 : 3000
  const profitTarget =
    mode === 'eval'
      ? size === 25000
        ? 1250
        : size === 50000
          ? 3000
          : 6000
      : null

  return {
    startingBalance: size,
    profitTarget,
    maxLoss: trailing,
    drawdownType: 'eod',
    consistencyPct: mode === 'eval' ? 50 : null,
    minProfitableDays: 2,
  }
}

const SIZE_LIMITS = {
  25000: { maxMinis: 2, maxMicros: 20 },
  50000: { maxMinis: 4, maxMicros: 40 },
  100000: { maxMinis: 6, maxMicros: 60 },
}

export function deriveMinProfitableDays(profitTarget, consistencyPct) {
  if (profitTarget == null || profitTarget <= 0) return 2
  if (consistencyPct == null || consistencyPct <= 0) return 2
  const maxPerDay = profitTarget * (consistencyPct / 100)
  if (maxPerDay <= 0) return 2
  return Math.max(2, Math.ceil(profitTarget / maxPerDay))
}

export function effectiveMinProfitableDays(rules) {
  if (rules.consistencyPct != null && rules.profitTarget != null) {
    return deriveMinProfitableDays(rules.profitTarget, rules.consistencyPct)
  }
  return rules.minProfitableDays ?? 2
}

export function computeEffectiveProfitTarget(rules, bestDayProfit) {
  const base = rules.profitTarget
  if (base == null) return null
  const limit = rules.consistencyPct
  if (limit == null || limit <= 0 || bestDayProfit <= 0) return base
  return Math.max(base, bestDayProfit / (limit / 100))
}

export function isMicroPracticeSymbol(symbol) {
  const s = String(symbol || '')
    .toUpperCase()
    .replace(/^[A-Z]+:/, '')
  if (!s) return false
  if (/^M[A-Z]{2,}/.test(s)) return true
  return ['MNQ', 'MES', 'MGC', 'MCL', 'MYM', 'M2K'].includes(s)
}

export function getMaxContractsForSymbol(size, symbol) {
  const limits = SIZE_LIMITS[size] || SIZE_LIMITS[50000]
  return isMicroPracticeSymbol(symbol) ? limits.maxMicros : limits.maxMinis
}

/** Per-fill commission (half of published round-turn). */
export function getPracticeCommissionPerFill(symbol) {
  return isMicroPracticeSymbol(symbol) ? 0.25 : 0.5
}

export const getTopstepCommissionPerFill = getPracticeCommissionPerFill

export function getCommissionPerContract(rules, symbol) {
  const override = rules?.commissionPerContract
  if (override != null && Number.isFinite(Number(override)) && Number(override) >= 0) {
    const legacy = Number(override)
    if (legacy === 2 && symbol) return getPracticeCommissionPerFill(symbol)
    return legacy
  }
  if (symbol) return getPracticeCommissionPerFill(symbol)
  return 0.5
}

export function computeDrawdownFloor(account, rules) {
  const start = rules.startingBalance
  const high = account.highWaterMark ?? account.high_water_mark ?? start
  const locked = account.drawdownFloorLocked ?? account.drawdown_floor_locked
  if (account.mode === 'funded' && locked) {
    return Math.max(start, high - rules.maxLoss)
  }
  return high - rules.maxLoss
}

export function evaluatePracticeRules(account, rules, dayPnL = []) {
  const balance = account.balance
  const start = rules.startingBalance
  const totalProfit = balance - start
  const drawdownFloor = computeDrawdownFloor(account, rules)
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
  let consistencyPct = null
  let consistencyMessage = null
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
          effectiveProfitTarget != null &&
          profitTarget != null &&
          effectiveProfitTarget > profitTarget
        consistencyMessage = raised
          ? `Best day ($${Math.round(bestDayProfit)}) is ${consistencyPct.toFixed(0)}% of profit (limit ${consistencyLimit}%). Profit target raised to $${Math.round(effectiveProfitTarget)}.`
          : `Best day ($${Math.round(bestDayProfit)}) is ${consistencyPct.toFixed(0)}% of profit. Limit is ${consistencyLimit}%.`
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
