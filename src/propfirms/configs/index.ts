import type { PropFirmDefinition } from '../types/definition'
import {
  PRACTICE_PROP_FIRM_CONFIGS,
} from '../../constants/practicePropFirms'

export type { PracticePropFirmMarketDataConfig } from '../../constants/practicePropFirms'
export {
  PRACTICE_PROP_FIRM_CONFIGS,
  getPracticePropFirmConfig,
  normalizePracticePropFirmId,
  practiceFirmHasExclusiveMdsSlot,
} from '../../constants/practicePropFirms'

/** Build registry entries from practice MDS configs; extend with live flags per firm. */
export const PROP_FIRM_DEFINITIONS: PropFirmDefinition[] = PRACTICE_PROP_FIRM_CONFIGS.map(
  (marketData) => ({
    id: marketData.id,
    displayName: marketData.displayName,
    modes: {
      practice: { enabled: true, marketData },
      live: { enabled: false },
      backtest: { enabled: true },
    },
  })
)

const DEFINITION_BY_ID = new Map(PROP_FIRM_DEFINITIONS.map((d) => [d.id, d] as const))

export function getPropFirmDefinition(firmId?: string | null): PropFirmDefinition | undefined {
  const id = String(firmId || '').trim()
  if (!id) return PROP_FIRM_DEFINITIONS[0]
  return DEFINITION_BY_ID.get(id) ?? PROP_FIRM_DEFINITIONS[0]
}

export function listPropFirmDefinitions(): readonly PropFirmDefinition[] {
  return PROP_FIRM_DEFINITIONS
}
