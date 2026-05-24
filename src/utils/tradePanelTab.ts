import type { TradePanelTab } from '../types/tradePanel'
import {
  TRADE_PANEL_TAB_LEGACY,
  TRADE_PANEL_TAB_LEGACY_PREFIX,
  TRADE_PANEL_TAB_STORAGE_PREFIX,
} from '../constants/tradePanel'

export type { TradePanelTab, PracticeTradePanelTab } from '../types/tradePanel'

function tabKey(accountId: string): string {
  return `${TRADE_PANEL_TAB_STORAGE_PREFIX}${accountId}`
}

function parseTab(raw: string | null): TradePanelTab | null {
  if (!raw) return null
  return TRADE_PANEL_TAB_LEGACY[raw] ?? null
}

export function getTradePanelTab(accountId: string): TradePanelTab | null {
  try {
    const next = parseTab(localStorage.getItem(tabKey(accountId)))
    if (next) return next
    return parseTab(localStorage.getItem(`${TRADE_PANEL_TAB_LEGACY_PREFIX}${accountId}`))
  } catch {
    return null
  }
}

export function saveTradePanelTab(accountId: string, tab: TradePanelTab): void {
  try {
    localStorage.setItem(tabKey(accountId), tab)
  } catch {
    /* ignore */
  }
}

/** @deprecated use getTradePanelTab */
export const getPracticeTradePanelTab = getTradePanelTab

/** @deprecated use saveTradePanelTab */
export const savePracticeTradePanelTab = saveTradePanelTab
