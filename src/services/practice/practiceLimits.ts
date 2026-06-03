import type { PracticeAccount, PracticeAccountSize } from '../../constants/practice'
import { resolvePracticePlanLimits } from './practicePlans'
import { resolvePracticeProductSymbol } from './practiceSymbol'
import type { PracticeChartDatafeed } from './practiceDatafeed'

/** Micro futures (MNQ, MES, …) vs standard minis (NQ, ES, …). */
export function isMicroPracticeSymbol(symbol: string): boolean {
  const s = String(symbol || '')
    .toUpperCase()
    .replace(/^[A-Z]+:/, '')
  if (!s) return false
  if (/^M[A-Z]{2,}/.test(s)) return true
  return ['MNQ', 'MES', 'MGC', 'MCL', 'MYM', 'M2K'].includes(s)
}

export function getMaxContractsForSymbol(
  size: PracticeAccountSize,
  symbol: string,
  rules?: PracticeAccount['rules']
): number {
  const limits = resolvePracticePlanLimits(size, rules)
  return isMicroPracticeSymbol(symbol) ? limits.maxMicros : limits.maxMinis
}

export function validatePracticePositionSize(
  account: PracticeAccount,
  chartSymbol: string,
  requestedAbsContracts: number,
  datafeed?: PracticeChartDatafeed | null
): string | null {
  const product = resolvePracticeProductSymbol(chartSymbol, datafeed)
  const max = getMaxContractsForSymbol(account.size, product, account.rules)
  if (requestedAbsContracts > max) {
    const kind = isMicroPracticeSymbol(product) ? 'micro' : 'mini'
    return `Max size ${max} ${kind} contracts for ${product}`
  }
  return null
}
