/**
 * Practice market-data behavior per prop firm (MDS slot policy).
 * exclusive: one global MDS websocket (competing sessions disconnect each other).
 * concurrent: multiple market-data connections allowed at once.
 */

export type PracticeMarketDataSlotPolicy = 'exclusive' | 'concurrent'

/** How practice hub resolves “market data connected” for this firm. */
export type PracticeMarketDataConnectionKind = 'broker-accounts' | 'credential-login' | 'server-managed'

export interface PracticePropFirmMarketDataConfig {
  id: string
  displayName: string
  /** Hub connection check + account field UI. */
  marketDataConnection: PracticeMarketDataConnectionKind
  /** exclusive = only one MDS connection; concurrent = multiple connections OK. */
  marketDataSlotPolicy: PracticeMarketDataSlotPolicy
}

export const PRACTICE_PROP_FIRM_CONFIGS: readonly PracticePropFirmMarketDataConfig[] = [
  {
    id: 'tradesea',
    displayName: 'Tradesea',
    marketDataConnection: 'broker-accounts',
    marketDataSlotPolicy: 'exclusive',
  },
  {
    id: 'tradingview',
    displayName: 'TradingView',
    marketDataConnection: 'server-managed',
    marketDataSlotPolicy: 'concurrent',
  },
] as const

export type PracticePropFirmConfigId = (typeof PRACTICE_PROP_FIRM_CONFIGS)[number]['id']

const CONFIG_BY_ID = new Map(
  PRACTICE_PROP_FIRM_CONFIGS.map((c) => [c.id, c] as const)
)

/** Map legacy/unknown prop firm ids to a supported firm. */
export function normalizePracticePropFirmId(
  propFirmId?: string | null
): PracticePropFirmConfigId {
  const id = String(propFirmId || '').trim()
  if (!id) return 'tradesea'
  return (CONFIG_BY_ID.has(id) ? id : 'tradesea') as PracticePropFirmConfigId
}

export function getPracticePropFirmConfig(
  propFirmId?: string | null
): PracticePropFirmMarketDataConfig {
  return CONFIG_BY_ID.get(normalizePracticePropFirmId(propFirmId)) ?? PRACTICE_PROP_FIRM_CONFIGS[0]
}

export function practiceFirmHasExclusiveMdsSlot(propFirmId?: string | null): boolean {
  return getPracticePropFirmConfig(propFirmId).marketDataSlotPolicy === 'exclusive'
}
