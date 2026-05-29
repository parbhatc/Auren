export type PracticeFirmMarketDataSelection = {
  accountId: string
  accountLabel: string
  offlineModePositions?: boolean
}

export interface PracticeMarketDataSettings {
  propFirmId: string
  accountId: string
  accountLabel: string
  /** When true, server holds the MDS slot while away and tracks SL/TP on open bracket positions. */
  offlineModePositions?: boolean
  /** Saved market-data choices per prop firm (account, offline mode). */
  byFirm?: Record<string, PracticeFirmMarketDataSelection>
}
