/** @typedef {'exclusive' | 'concurrent'} PracticeMarketDataSlotPolicy */

/** @type {readonly { id: string, displayName: string, marketDataSlotPolicy: PracticeMarketDataSlotPolicy }[]} */
export const PRACTICE_PROP_FIRM_CONFIGS = [
  {
    id: 'tradesea',
    displayName: 'Tradesea',
    marketDataSlotPolicy: 'exclusive',
  },
]

const CONFIG_BY_ID = new Map(PRACTICE_PROP_FIRM_CONFIGS.map((c) => [c.id, c]))

export function normalizePracticePropFirmId(propFirmId) {
  const id = String(propFirmId || '').trim()
  if (!id) return 'tradesea'
  return CONFIG_BY_ID.has(id) ? id : 'tradesea'
}

export function getPracticePropFirmConfig(propFirmId) {
  return CONFIG_BY_ID.get(normalizePracticePropFirmId(propFirmId)) || PRACTICE_PROP_FIRM_CONFIGS[0]
}

export function practiceFirmHasExclusiveMdsSlot(propFirmId) {
  return getPracticePropFirmConfig(propFirmId).marketDataSlotPolicy === 'exclusive'
}

function parseFirmSelections(raw) {
  if (!raw || typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function resolveMarketDataFromDb(row) {
  if (!row) {
    return {
      propFirmId: 'tradesea',
      accountId: '',
      accountLabel: '',
    }
  }
  const propFirmId = normalizePracticePropFirmId(row.prop_firm_id)
  const byFirm = parseFirmSelections(row.firm_selections)

  return {
    propFirmId,
    accountId: row.account_id || '',
    accountLabel: row.account_label || '',
    ...(Object.keys(byFirm).length > 0 ? { byFirm } : {}),
  }
}
