import { normalizePracticePropFirmId } from './practicePropFirms'
import type {
  PracticeFirmMarketDataSelection,
  PracticeMarketDataSettings,
} from './practiceMarketDataTypes'

export type { PracticeFirmMarketDataSelection, PracticeMarketDataSettings }

export function normalizeMarketDataByFirm(
  byFirm?: Record<string, PracticeFirmMarketDataSelection> | null
): Record<string, PracticeFirmMarketDataSelection> {
  const out: Record<string, PracticeFirmMarketDataSelection> = {}
  if (!byFirm || typeof byFirm !== 'object') return out
  for (const [key, value] of Object.entries(byFirm)) {
    if (!value || typeof value !== 'object') continue
    const id = normalizePracticePropFirmId(key)
    out[id] = {
      accountId: String(value.accountId ?? ''),
      accountLabel: String(value.accountLabel ?? ''),
    }
  }
  return out
}

/** Ensure legacy single-firm accountId is captured in byFirm. */
export function migratePracticeMarketDataSettings(
  settings: PracticeMarketDataSettings
): PracticeMarketDataSettings {
  const byFirm = normalizeMarketDataByFirm(settings.byFirm)
  const activeId = normalizePracticePropFirmId(settings.propFirmId)

  if (settings.accountId && !byFirm[activeId]?.accountId) {
    byFirm[activeId] = {
      accountId: settings.accountId,
      accountLabel: settings.accountLabel || '',
    }
  }

  return Object.keys(byFirm).length > 0 ? { ...settings, byFirm } : settings
}

export function getFirmMarketDataSelection(
  settings: PracticeMarketDataSettings,
  firmId: string
): PracticeFirmMarketDataSelection {
  const id = normalizePracticePropFirmId(firmId)
  const migrated = migratePracticeMarketDataSettings(settings)
  const saved = normalizeMarketDataByFirm(migrated.byFirm)[id]
  if (saved) return saved

  if (normalizePracticePropFirmId(migrated.propFirmId) === id) {
    return {
      accountId: migrated.accountId || '',
      accountLabel: migrated.accountLabel || '',
    }
  }

  return { accountId: '', accountLabel: '' }
}

export function applyActiveFirmToMarketDataSettings(
  settings: PracticeMarketDataSettings,
  nextFirmId: string
): PracticeMarketDataSettings {
  const md = migratePracticeMarketDataSettings(settings)
  const currentFirmId = normalizePracticePropFirmId(md.propFirmId)
  const nextId = normalizePracticePropFirmId(nextFirmId)
  const byFirm = normalizeMarketDataByFirm(md.byFirm)

  byFirm[currentFirmId] = {
    accountId: md.accountId || '',
    accountLabel: md.accountLabel || '',
  }

  const nextSelection = byFirm[nextId] ?? { accountId: '', accountLabel: '' }

  return {
    propFirmId: nextId,
    accountId: nextSelection.accountId || '',
    accountLabel: nextSelection.accountLabel || '',
    byFirm,
  }
}

export function updateFirmMarketDataSelection(
  settings: PracticeMarketDataSettings,
  firmId: string,
  patch: Partial<PracticeFirmMarketDataSelection>
): PracticeMarketDataSettings {
  const md = migratePracticeMarketDataSettings(settings)
  const id = normalizePracticePropFirmId(firmId)
  const byFirm = normalizeMarketDataByFirm(md.byFirm)
  const prev = getFirmMarketDataSelection(md, id)
  byFirm[id] = { ...prev, ...patch }

  const activeId = normalizePracticePropFirmId(md.propFirmId)
  if (id !== activeId) {
    return { ...md, byFirm }
  }

  return {
    ...md,
    byFirm,
    accountId: byFirm[id].accountId,
    accountLabel: byFirm[id].accountLabel,
  }
}
