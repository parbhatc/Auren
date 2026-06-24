/** Practice eval plan parameters. */

export type PracticeAccountSize = 25000 | 50000 | 100000
export type PracticeAccountMode = 'eval' | 'funded'
export type PracticeDrawdownType = 'eod' | 'intraday'

export interface PracticeAccountRules {
  startingBalance: number
  profitTarget: number | null
  maxLoss: number
  drawdownType: PracticeDrawdownType
  consistencyPct: number | null
  /** Legacy stored value; eval uses {@link deriveMinProfitableDays} when consistency is set. */
  minProfitableDays: number
  maxMinis?: number
  maxMicros?: number
  /** Per contract, per fill (open and close). Stored on account rules server-side. */
  commissionPerContract?: number
  /** Daily loss lockout ($). Null = 2% of balance (capped) when lockouts enabled. */
  dailyLossLimit?: number | null
  /** Recalculated at each 5:59 PM ET session reset when lockouts enabled. */
  sessionDailyLossLimit?: number | null
  /** Max round-trip trades per session day (5:59 PM ET reset). Null = no limit. */
  maxTradesPerDay?: number | null
  /** When false, daily loss / max-trade lockouts are disabled. */
  lockoutEnabled?: boolean
}

export interface PracticePlanRules extends PracticeAccountRules {
  size: PracticeAccountSize
  mode: PracticeAccountMode
  label: string
}

const SIZE_LABELS: Record<PracticeAccountSize, string> = {
  25000: '25K',
  50000: '50K',
  100000: '100K',
}

/** Default eval rules (profit target and max loss in dollars). */
export function getDefaultPracticeRules(
  size: PracticeAccountSize,
  mode: PracticeAccountMode
): PracticeAccountRules {
  const maxLoss = size === 25000 ? 1000 : size === 50000 ? 2000 : 3000
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
    maxLoss,
    drawdownType: 'eod',
    consistencyPct: mode === 'eval' ? 50 : null,
    minProfitableDays: 2,
    lockoutEnabled: false,
    dailyLossLimit: null,
    maxTradesPerDay: null,
  }
}

export function formatPracticeSize(size: PracticeAccountSize): string {
  return SIZE_LABELS[size]
}

export function getPracticePlan(
  size: PracticeAccountSize,
  mode: PracticeAccountMode,
  customRules?: Partial<PracticeAccountRules>
): PracticePlanRules {
  const base = getDefaultPracticeRules(size, mode)
  const rules = { ...base, ...customRules }
  return {
    size,
    mode,
    ...rules,
    label: `${formatPracticeSize(size)} ${mode === 'eval' ? 'Eval' : 'Funded'}`,
  }
}

export function getPracticePlanFromAccount(account: {
  size: PracticeAccountSize
  mode: PracticeAccountMode
  rules?: PracticeAccountRules
}): PracticePlanRules {
  if (account.rules) {
    return getPracticePlan(account.size, account.mode, account.rules)
  }
  return getPracticePlan(account.size, account.mode)
}

export const PRACTICE_ACCOUNT_SIZES: PracticeAccountSize[] = [25000, 50000, 100000]

export interface PracticePlanLimits {
  maxMinis: number
  maxMicros: number
}

const SIZE_LIMITS: Record<PracticeAccountSize, PracticePlanLimits> = {
  25000: { maxMinis: 2, maxMicros: 20 },
  50000: { maxMinis: 4, maxMicros: 40 },
  100000: { maxMinis: 6, maxMicros: 60 },
}

export function getPracticePlanLimits(size: PracticeAccountSize): PracticePlanLimits {
  return SIZE_LIMITS[size]
}

/** Apply account-specific max size overrides (defaults from account size tier). */
export function resolvePracticePlanLimits(
  size: PracticeAccountSize,
  rules?: Partial<PracticeAccountRules>
): PracticePlanLimits {
  const defaults = getPracticePlanLimits(size)
  return {
    maxMinis: rules?.maxMinis ?? defaults.maxMinis,
    maxMicros: rules?.maxMicros ?? defaults.maxMicros,
  }
}

/**
 * Min profitable days implied by consistency (e.g. 50% on $1,250 target → max $625/day → 2 days).
 */
export function deriveMinProfitableDays(
  profitTarget: number | null,
  consistencyPct: number | null
): number {
  if (profitTarget == null || profitTarget <= 0) return 2
  if (consistencyPct == null || consistencyPct <= 0) return 2
  const maxPerDay = profitTarget * (consistencyPct / 100)
  if (maxPerDay <= 0) return 2
  return Math.max(2, Math.ceil(profitTarget / maxPerDay))
}

export function effectiveMinProfitableDays(rules: PracticeAccountRules): number {
  if (rules.consistencyPct != null && rules.profitTarget != null) {
    return deriveMinProfitableDays(rules.profitTarget, rules.consistencyPct)
  }
  return rules.minProfitableDays ?? 2
}

export function getPracticePlanCardTitle(size: PracticeAccountSize, mode: PracticeAccountMode): string {
  return `${formatPracticeSize(size)} | ${mode === 'eval' ? 'EVAL' : 'FUNDED'}`
}

const EMPTY_STAT = '—'

export interface PracticePlanCardLine {
  label: string
  value: string
}

/** Compact stats for plan size picker cards (always shows labels; uses — when N/A). */
export function getPracticeSizeCardStats(
  size: PracticeAccountSize,
  mode: PracticeAccountMode,
  customRules?: Partial<PracticeAccountRules>
): PracticePlanCardLine[] {
  const rules = { ...getDefaultPracticeRules(size, mode), ...customRules }
  const limits = resolvePracticePlanLimits(size, customRules)

  const profitTarget =
    mode === 'eval' && rules.profitTarget != null
      ? `$${rules.profitTarget.toLocaleString()}`
      : EMPTY_STAT

  const consistency =
    mode === 'eval' && rules.consistencyPct != null
      ? `${rules.consistencyPct}% limit`
      : EMPTY_STAT

  return [
    { label: 'Profit Target', value: profitTarget },
    { label: 'Max Loss', value: `$${rules.maxLoss.toLocaleString()} (EOD)` },
    { label: 'Consistency', value: consistency },
    {
      label: 'Max Size',
      value: `${limits.maxMinis} Minis or ${limits.maxMicros} Micros`,
    },
  ]
}

/** Full rule list for create confirm and detail views. */
export function getPracticePlanCardLines(
  size: PracticeAccountSize,
  mode: PracticeAccountMode,
  customRules?: Partial<PracticeAccountRules>
): PracticePlanCardLine[] {
  const rules = { ...getDefaultPracticeRules(size, mode), ...customRules }
  const limits = resolvePracticePlanLimits(size, customRules)
  const lines: PracticePlanCardLine[] = []

  lines.push({
    label: 'Profit Target',
    value:
      mode === 'eval' && rules.profitTarget != null
        ? `$${rules.profitTarget.toLocaleString()}`
        : EMPTY_STAT,
  })

  lines.push({
    label: 'Max Loss',
    value: `$${rules.maxLoss.toLocaleString()} (EOD)`,
  })

  lines.push({
    label: 'Consistency',
    value:
      mode === 'eval' && rules.consistencyPct != null
        ? `${rules.consistencyPct}% limit`
        : EMPTY_STAT,
  })

  lines.push({
    label: 'Max Size',
    value: `${limits.maxMinis} Minis or ${limits.maxMicros} Micros`,
  })

  lines.push({ label: 'Drawdown', value: rules.drawdownType === 'eod' ? 'End of Day' : 'Intraday' })

  if (mode === 'funded') {
    lines.push({ label: 'Daily Loss Limit', value: 'None' })
    lines.push({ label: 'Activation Fee', value: 'Free' })
  }

  return lines
}

export function practicePlanCardBorderClass(
  mode: PracticeAccountMode,
  selected: boolean,
  isDark: boolean
): string {
  if (selected) {
    if (mode === 'eval') {
      return isDark
        ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/50'
        : 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500/40'
    }
    return isDark
      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
      : 'border-amber-500 bg-amber-50 ring-1 ring-amber-400/50'
  }
  return isDark
    ? 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
    : 'border-slate-200 bg-white/60 hover:border-slate-300'
}

export function practicePlanCardTitleClass(mode: PracticeAccountMode, isDark: boolean): string {
  if (mode === 'eval') {
    return isDark ? 'text-emerald-400' : 'text-emerald-700'
  }
  return isDark ? 'text-amber-400' : 'text-amber-700'
}
