/** Persist docked trade panel tab per practice account (Quick Trade uses detach flag). */

export type PracticeTradePanelTab = 'quick' | 'dom' | 'ticket'

const tabKey = (accountId: string) => `practice_trade_panel_tab_${accountId}`

const LEGACY_TAB: Record<string, PracticeTradePanelTab> = {
  scalp: 'quick',
  order: 'ticket',
  quick: 'quick',
  dom: 'dom',
  ticket: 'ticket',
}

function parseTab(raw: string | null): PracticeTradePanelTab | null {
  if (!raw) return null
  return LEGACY_TAB[raw] ?? null
}

export function getPracticeTradePanelTab(accountId: string): PracticeTradePanelTab | null {
  try {
    return parseTab(localStorage.getItem(tabKey(accountId)))
  } catch {
    return null
  }
}

export function savePracticeTradePanelTab(accountId: string, tab: PracticeTradePanelTab): void {
  try {
    localStorage.setItem(tabKey(accountId), tab)
  } catch {
    /* ignore */
  }
}
