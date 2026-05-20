export const PRACTICE_TRADE_PANEL_SETTINGS_KEY = 'practiceTradePanelSettings'
const LEGACY_SETTINGS_KEY = 'practiceOrderPadSettings'

export type PracticeTradePanelSettings = {
  hideBuySell: boolean
  hideJoinBidAsk: boolean
  hideClosePosition: boolean
  hideReverse: boolean
  hideCancelAll: boolean
  hideFlattenAll: boolean
}

const DEFAULT_PRACTICE_TRADE_PANEL_SETTINGS: PracticeTradePanelSettings = {
  hideBuySell: false,
  hideJoinBidAsk: false,
  hideClosePosition: false,
  hideReverse: false,
  hideCancelAll: false,
  hideFlattenAll: false,
}

export function getPracticeTradePanelSettings(): PracticeTradePanelSettings {
  try {
    const raw =
      localStorage.getItem(PRACTICE_TRADE_PANEL_SETTINGS_KEY) ??
      localStorage.getItem(LEGACY_SETTINGS_KEY)
    if (raw) {
      return { ...DEFAULT_PRACTICE_TRADE_PANEL_SETTINGS, ...(JSON.parse(raw) as PracticeTradePanelSettings) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PRACTICE_TRADE_PANEL_SETTINGS }
}

export function savePracticeTradePanelSettings(settings: PracticeTradePanelSettings): void {
  localStorage.setItem(PRACTICE_TRADE_PANEL_SETTINGS_KEY, JSON.stringify(settings))
  localStorage.removeItem(LEGACY_SETTINGS_KEY)
  window.dispatchEvent(new Event('practiceTradePanelSettingsChanged'))
}
