export type MobileEntryMode = 'auto' | 'market' | 'both'

export type MobileTradePrefs = {
  entryMode: MobileEntryMode
  floatingPad: boolean
  quickTradeMinimized: boolean
}

/** @deprecated use MobileTradePrefs */
export type PracticeMobileTradePrefs = MobileTradePrefs
