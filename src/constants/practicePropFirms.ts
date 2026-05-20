/**
 * Practice market-data behavior per prop firm (MDS slot policy, offline brackets).
 * exclusive: one global MDS websocket (competing sessions disconnect each other).
 * concurrent: multiple market-data connections allowed at once.
 */

export type PracticeMarketDataSlotPolicy = 'exclusive' | 'concurrent'

export interface PracticePropFirmMarketDataConfig {
  id: string
  displayName: string
  /** exclusive = only one MDS connection; concurrent = multiple connections OK. */
  marketDataSlotPolicy: PracticeMarketDataSlotPolicy
  /** Server can proxy upstream MDS while the chart client is away. */
  supportsOfflineBracketWatcher: boolean
  /** Default offline-mode toggle when the user has not saved a preference. */
  defaultOfflineModePositions: boolean
}

export const PRACTICE_PROP_FIRM_CONFIGS: readonly PracticePropFirmMarketDataConfig[] = [
  {
    id: 'tradesea',
    displayName: 'Tradesea',
    marketDataSlotPolicy: 'exclusive',
    supportsOfflineBracketWatcher: true,
    defaultOfflineModePositions: true,
  },
  {
    id: 'topstep',
    displayName: 'Topstep',
    marketDataSlotPolicy: 'concurrent',
    supportsOfflineBracketWatcher: false,
    defaultOfflineModePositions: false,
  },
] as const

export type PracticePropFirmConfigId = (typeof PRACTICE_PROP_FIRM_CONFIGS)[number]['id']

const CONFIG_BY_ID = new Map(
  PRACTICE_PROP_FIRM_CONFIGS.map((c) => [c.id, c] as const)
)

export function getPracticePropFirmConfig(
  propFirmId?: string | null
): PracticePropFirmMarketDataConfig {
  return CONFIG_BY_ID.get(String(propFirmId || '').trim()) ?? PRACTICE_PROP_FIRM_CONFIGS[0]
}

export function practiceFirmHasExclusiveMdsSlot(propFirmId?: string | null): boolean {
  return getPracticePropFirmConfig(propFirmId).marketDataSlotPolicy === 'exclusive'
}

/** Show the offline-mode card (toggle or “not needed” note). */
export function practiceFirmShowsOfflineModeSection(propFirmId?: string | null): boolean {
  const firm = getPracticePropFirmConfig(propFirmId)
  return firm.supportsOfflineBracketWatcher || firm.marketDataSlotPolicy === 'concurrent'
}

/** User can enable server-side bracket tracking while away. */
export function practiceFirmSupportsOfflineBracketWatcher(propFirmId?: string | null): boolean {
  return getPracticePropFirmConfig(propFirmId).supportsOfflineBracketWatcher
}

export function resolveOfflineModePositionsForFirm(
  propFirmId?: string | null,
  saved?: boolean | null
): boolean {
  const firm = getPracticePropFirmConfig(propFirmId)
  if (!firm.supportsOfflineBracketWatcher) return false
  if (saved === true) return true
  if (saved === false) return false
  return firm.defaultOfflineModePositions
}
