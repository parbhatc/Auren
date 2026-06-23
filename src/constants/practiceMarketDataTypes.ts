export type PracticeFirmMarketDataSelection = {
  accountId: string
  accountLabel: string
}

export interface PracticeMarketDataSettings {
  propFirmId: string
  accountId: string
  accountLabel: string
  /** Saved market-data choices per prop firm. */
  byFirm?: Record<string, PracticeFirmMarketDataSelection>
}
