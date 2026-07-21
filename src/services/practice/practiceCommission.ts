import type { PracticeAccountRules } from './practicePlans'
import { isMicroPracticeSymbol } from './practiceLimits'

/** Default simulated commission per contract, per fill (one side). */
export const PRACTICE_COMMISSION_MICRO_PER_FILL = 0.25
export const PRACTICE_COMMISSION_MINI_PER_FILL = 0.5

/** @deprecated Use the symbol-aware rate when rules omit an override. */
export const DEFAULT_PRACTICE_COMMISSION_PER_CONTRACT = PRACTICE_COMMISSION_MINI_PER_FILL

export function getDefaultCommissionPerFill(symbol: string): number {
  return isMicroPracticeSymbol(symbol)
    ? PRACTICE_COMMISSION_MICRO_PER_FILL
    : PRACTICE_COMMISSION_MINI_PER_FILL
}

export function getPracticeCommissionPerContract(
  rules?: Partial<PracticeAccountRules> | null,
  symbol?: string
): number {
  const override = rules?.commissionPerContract
  if (override != null && Number.isFinite(Number(override)) && Number(override) >= 0) {
    const legacy = Number(override)
    if (legacy === 2 && symbol) return getDefaultCommissionPerFill(symbol)
    return legacy
  }
  if (symbol) return getDefaultCommissionPerFill(symbol)
  return PRACTICE_COMMISSION_MINI_PER_FILL
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
  if (trade.fees != null && Number.isFinite(Number(trade.fees))) return Number(trade.fees)
  const fromOriginal = trade.originalTrade?.fees
  if (fromOriginal != null && Number.isFinite(Number(fromOriginal))) return Number(fromOriginal)
  return 0
}
