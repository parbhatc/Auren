import type { TradePanelSettings } from '../types/tradePanel'
import {
  TRADE_PANEL_SETTINGS_CHANGED_EVENT,
  TRADE_PANEL_SETTINGS_KEY,
  TRADE_PANEL_SETTINGS_LEGACY_EVENT,
  TRADE_PANEL_SETTINGS_LEGACY_KEY,
} from './tradePanel'

export type { TradePanelSettings, PracticeTradePanelSettings } from '../types/tradePanel'

const DEFAULT_TRADE_PANEL_SETTINGS: TradePanelSettings = {
  positionPnlDisplay: 'dollars',
  hideBuySell: false,
  hideJoinBidAsk: false,
  hideClosePosition: false,
  hideReverse: false,
  hideCancelAll: false,
  hideFlattenAll: false,
}

export function getTradePanelSettings(): TradePanelSettings {
  try {
    const raw =
      localStorage.getItem(TRADE_PANEL_SETTINGS_KEY) ??
      localStorage.getItem(TRADE_PANEL_SETTINGS_LEGACY_KEY)
    if (raw) {
      return { ...DEFAULT_TRADE_PANEL_SETTINGS, ...(JSON.parse(raw) as TradePanelSettings) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_TRADE_PANEL_SETTINGS }
}

export function saveTradePanelSettings(settings: TradePanelSettings): void {
  localStorage.setItem(TRADE_PANEL_SETTINGS_KEY, JSON.stringify(settings))
  localStorage.removeItem(TRADE_PANEL_SETTINGS_LEGACY_KEY)
  window.dispatchEvent(new Event(TRADE_PANEL_SETTINGS_CHANGED_EVENT))
  window.dispatchEvent(new Event(TRADE_PANEL_SETTINGS_LEGACY_EVENT))
}

export function getPositionPnlDisplay(): NonNullable<TradePanelSettings['positionPnlDisplay']> {
  const mode = getTradePanelSettings().positionPnlDisplay
  return mode === 'ticks' || mode === 'points' ? mode : 'dollars'
}

export function setPositionPnlDisplay(
  mode: NonNullable<TradePanelSettings['positionPnlDisplay']>
): void {
  const settings = getTradePanelSettings()
  if (settings.positionPnlDisplay === mode) return
  saveTradePanelSettings({ ...settings, positionPnlDisplay: mode })
}

/** @deprecated use getTradePanelSettings */
export const getPracticeTradePanelSettings = getTradePanelSettings

/** @deprecated use saveTradePanelSettings */
export const savePracticeTradePanelSettings = saveTradePanelSettings

/** @deprecated use TRADE_PANEL_SETTINGS_KEY from constants/tradePanel */
export const PRACTICE_TRADE_PANEL_SETTINGS_KEY = TRADE_PANEL_SETTINGS_KEY
