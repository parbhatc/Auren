import type { PracticeAccountRules } from './practicePlans'
import { isMicroPracticeSymbol } from './practiceLimits'

/**
 * Topstep simulated commission (per contract, per fill / one side).
 * Published round-turn: micro $0.50, mini $1.00 → half per fill.
 * @see https://help.topstep.com/en/articles/8284213
 */
export const TOPSTEP_COMMISSION_MICRO_PER_FILL = 0.25
export const TOPSTEP_COMMISSION_MINI_PER_FILL = 0.5

/** @deprecated Legacy default; use symbol-aware Topstep rates when rules omit override. */
export const DEFAULT_PRACTICE_COMMISSION_PER_CONTRACT = TOPSTEP_COMMISSION_MINI_PER_FILL

export function getTopstepStyleCommissionPerFill(symbol: string): number {
  return isMicroPracticeSymbol(symbol)
    ? TOPSTEP_COMMISSION_MICRO_PER_FILL
    : TOPSTEP_COMMISSION_MINI_PER_FILL
}

export function getPracticeCommissionPerContract(
  rules?: Partial<PracticeAccountRules> | null,
  symbol?: string
): number {
  const override = rules?.commissionPerContract
  if (override != null && Number.isFinite(Number(override)) && Number(override) >= 0) {
    const legacy = Number(override)
    // Treat old $2 default as "use Topstep" for existing saved accounts.
    if (legacy === 2 && symbol) return getTopstepStyleCommissionPerFill(symbol)
    return legacy
  }
  if (symbol) return getTopstepStyleCommissionPerFill(symbol)
  return TOPSTEP_COMMISSION_MINI_PER_FILL
}

export function practiceFillCommission(
  rules: PracticeAccountRules | undefined,
  contracts: number,
  symbol?: string
): number {
  return Math.abs(contracts) * getPracticeCommissionPerContract(rules, symbol)
}

/** Fees stored on practice trades (exit fill commission). */
export function resolvePracticeTradeFees(trade: {
  fees?: number
  contracts?: number
  symbol?: string
  originalTrade?: { fees?: number }
}): number {
  if (trade.fees != null && Number.isFinite(Number(trade.fees))) {
    return Number(trade.fees)
  }
  const fromOriginal = trade.originalTrade?.fees
  if (fromOriginal != null && Number.isFinite(Number(fromOriginal))) {
    return Number(fromOriginal)
  }
  return 0
}
