import type { TradePanelTab } from '../types/tradePanel'

export const DEFAULT_SL_TICKS = 10
export const DEFAULT_TP_TICKS = 10

export const BRACKET_TICK_PRESETS = [10, 25, 50, 100] as const

export const TRADE_PANEL_SETTINGS_KEY = 'practiceTradePanelSettings'
export const TRADE_PANEL_SETTINGS_LEGACY_KEY = 'practiceOrderPadSettings'

export const TRADE_PANEL_TAB_STORAGE_PREFIX = 'trade_panel_tab_'
export const TRADE_PANEL_TAB_LEGACY_PREFIX = 'practice_trade_panel_tab_'

export const TRADE_PANEL_TAB_LEGACY: Record<string, TradePanelTab> = {
  scalp: 'quick',
  order: 'ticket',
  quick: 'quick',
  dom: 'dom',
  ticket: 'ticket',
}

export const TRADE_PANEL_SETTINGS_CHANGED_EVENT = 'tradePanelSettingsChanged'
export const TRADE_PANEL_SETTINGS_LEGACY_EVENT = 'practiceTradePanelSettingsChanged'

export const PAD_DETACHED_STORAGE_PREFIX = 'practice_pad_detached_'
