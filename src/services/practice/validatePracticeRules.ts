import type { PracticeAccountMode, PracticeAccountRules } from '../../constants/practice'
import { resolvePracticePlanLimits, type PracticeAccountSize } from './practicePlans'

function parsePositive(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Percent 0–100 (0 = no consistency rule). */
function parsePercent(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Parse form text into rules; uses fallbacks only when a required field is empty on commit. */
export function commitPracticeRulesFromForm(
  rules: PracticeAccountRules,
  texts: {
    profitTarget: string
    maxLoss: string
    consistencyPct: string
    maxMinis: string
    maxMicros: string
    dailyLossLimit: string
    maxTradesPerDay: string
  },
  mode: PracticeAccountMode,
  size: PracticeAccountSize,
  defaults: PracticeAccountRules
): PracticeAccountRules {
  const planLimits = resolvePracticePlanLimits(size, defaults)
  const maxLoss = parsePositive(texts.maxLoss) ?? defaults.maxLoss
  const maxMinis = parsePositive(texts.maxMinis) ?? planLimits.maxMinis
  const maxMicros = parsePositive(texts.maxMicros) ?? planLimits.maxMicros

  return {
    ...rules,
    profitTarget:
      mode === 'eval' ? parsePositive(texts.profitTarget) ?? defaults.profitTarget ?? null : null,
    maxLoss,
    consistencyPct:
      mode === 'eval'
        ? parsePercent(texts.consistencyPct) ?? defaults.consistencyPct ?? null
        : parsePercent(texts.consistencyPct),
    maxMinis,
    maxMicros,
    lockoutEnabled: rules.lockoutEnabled === true,
    dailyLossLimit:
      rules.lockoutEnabled === true ? parsePositive(texts.dailyLossLimit) : null,
    maxTradesPerDay: parsePositive(texts.maxTradesPerDay) ?? null,
  }
}

export type PracticeRulesFormTexts = {
  profitTarget: string
  maxLoss: string
  consistencyPct: string
  maxMinis: string
  maxMicros: string
  dailyLossLimit: string
  maxTradesPerDay: string
}

/** Validate raw form text before create (empty fields are errors, not defaults). */
export function validatePracticeFormTexts(
  texts: PracticeRulesFormTexts,
  mode: PracticeAccountMode
): string | null {
  if (!parsePositive(texts.maxLoss)) {
    return 'Enter a max loss greater than 0.'
  }

  if (mode === 'eval') {
    if (!parsePositive(texts.profitTarget)) {
      return 'Enter a profit target greater than 0.'
    }
    const consistency = parsePercent(texts.consistencyPct)
    if (consistency == null) {
      return 'Enter a consistency percentage between 0 and 100.'
    }
    if (consistency > 100) {
      return 'Consistency must be between 0 and 100%.'
    }
  } else if (texts.consistencyPct.trim() !== '') {
    const consistency = parsePercent(texts.consistencyPct)
    if (consistency == null || consistency > 100) {
      return 'Consistency must be between 0 and 100%.'
    }
  }

  if (!parsePositive(texts.maxMinis)) {
    return 'Enter max minis (at least 1).'
  }
  if (!parsePositive(texts.maxMicros)) {
    return 'Enter max micros (at least 1).'
  }

  return null
}

export function validatePracticeAccountRules(
  rules: PracticeAccountRules,
  mode: PracticeAccountMode
): string | null {
  if (!Number.isFinite(rules.maxLoss) || rules.maxLoss <= 0) {
    return 'Enter a max loss greater than 0.'
  }

  if (mode === 'eval') {
    if (rules.profitTarget == null || !Number.isFinite(rules.profitTarget) || rules.profitTarget <= 0) {
      return 'Enter a profit target greater than 0.'
    }
    if (
      rules.consistencyPct == null ||
      !Number.isFinite(rules.consistencyPct) ||
      rules.consistencyPct < 0 ||
      rules.consistencyPct > 100
    ) {
      return 'Consistency must be between 0 and 100%.'
    }
  } else if (
    rules.consistencyPct != null &&
    (!Number.isFinite(rules.consistencyPct) || rules.consistencyPct < 0 || rules.consistencyPct > 100)
  ) {
    return 'Consistency must be between 0 and 100%.'
  }

  const minis = rules.maxMinis
  const micros = rules.maxMicros
  if (minis != null && (!Number.isFinite(minis) || minis < 1)) {
    return 'Max minis must be at least 1.'
  }
  if (micros != null && (!Number.isFinite(micros) || micros < 1)) {
    return 'Max micros must be at least 1.'
  }

  return null
}
