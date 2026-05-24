/** @typedef {'exclusive' | 'concurrent'} PracticeMarketDataSlotPolicy */

/** @type {readonly { id: string, displayName: string, marketDataSlotPolicy: PracticeMarketDataSlotPolicy, supportsOfflineBracketWatcher: boolean, defaultOfflineModePositions: boolean }[]} */
export const PRACTICE_PROP_FIRM_CONFIGS = [
  {
    id: 'tradesea',
    displayName: 'Tradesea',
    marketDataSlotPolicy: 'exclusive',
    supportsOfflineBracketWatcher: true,
    defaultOfflineModePositions: true,
  },
]

const REMOVED_PROP_FIRM_IDS = new Set(['topstep'])

const CONFIG_BY_ID = new Map(PRACTICE_PROP_FIRM_CONFIGS.map((c) => [c.id, c]))

export function normalizePracticePropFirmId(propFirmId) {
  const id = String(propFirmId || '').trim()
  if (!id || REMOVED_PROP_FIRM_IDS.has(id)) return 'tradesea'
  return CONFIG_BY_ID.has(id) ? id : 'tradesea'
}

export function getPracticePropFirmConfig(propFirmId) {
  return CONFIG_BY_ID.get(normalizePracticePropFirmId(propFirmId)) || PRACTICE_PROP_FIRM_CONFIGS[0]
}

export function practiceFirmHasExclusiveMdsSlot(propFirmId) {
  return getPracticePropFirmConfig(propFirmId).marketDataSlotPolicy === 'exclusive'
}

export function practiceFirmSupportsOfflineBracketWatcher(propFirmId) {
  return getPracticePropFirmConfig(propFirmId).supportsOfflineBracketWatcher
}

export function resolveOfflineModePositionsFromDb(row) {
  if (!row) {
    const firm = getPracticePropFirmConfig('tradesea')
    return {
      propFirmId: 'tradesea',
      accountId: '',
      accountLabel: '',
      offlineModePositions: firm.defaultOfflineModePositions,
    }
  }
  const propFirmId = normalizePracticePropFirmId(row.prop_firm_id)
  const firm = getPracticePropFirmConfig(propFirmId)
  let saved = null
  if (row.offline_mode_positions === 1) saved = true
  else if (row.offline_mode_positions === 0) saved = false

  let offlineModePositions = firm.defaultOfflineModePositions
  if (!firm.supportsOfflineBracketWatcher) {
    offlineModePositions = false
  } else if (saved === true) {
    offlineModePositions = true
  } else if (saved === false) {
    offlineModePositions = false
  }

  return {
    propFirmId,
    accountId: row.account_id || '',
    accountLabel: row.account_label || '',
    offlineModePositions,
  }
}

export function offlineModeToDbValue(propFirmId, offlineModePositions) {
  const firm = getPracticePropFirmConfig(propFirmId)
  if (!firm.supportsOfflineBracketWatcher) return 0
  return offlineModePositions === false ? 0 : 1
}
