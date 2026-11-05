export type FinancialDisplayUnit = 'usd' | 'r' | 'points' | 'percent'

/** Round only the presentation value; never change stored P&L or risk amounts. */
export function financialDisplayValue(amount: number, unit: FinancialDisplayUnit = 'usd', startingBalance = 1, riskUnit = 100): number {
  const value = unit === 'r' ? amount / Math.max(riskUnit, 1)
    : unit === 'points' ? amount / 20
      : unit === 'percent' ? amount / Math.max(startingBalance, 1) * 100 : amount
  return Number(value.toFixed(unit === 'points' ? 1 : 2)) || 0
}

export function formatFinancialDisplay(amount: number, unit: FinancialDisplayUnit = 'usd', startingBalance = 1, riskUnit = 100, fixedCents = false): string {
  const value = financialDisplayValue(amount, unit, startingBalance, riskUnit)
  if (unit === 'r') return `${value.toFixed(2)}R`
  if (unit === 'points') return `${value.toFixed(1)} pts`
  if (unit === 'percent') return `${value.toFixed(2)}%`
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
    minimumFractionDigits: fixedCents || value % 1 !== 0 ? 2 : 0,
    signDisplay: value === 0 ? 'auto' : 'always',
  }).format(value)
}
