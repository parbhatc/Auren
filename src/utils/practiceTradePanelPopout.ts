import { savePracticeTradePanelTab } from './practiceTradePanelTab'

const DETACHED_KEY_PREFIX = 'practice_pad_detached_'

export function practicePadDetachedKey(accountId: string): string {
  return `${DETACHED_KEY_PREFIX}${accountId}`
}

export function isPracticePadDetached(accountId: string): boolean {
  try {
    return localStorage.getItem(practicePadDetachedKey(accountId)) === '1'
  } catch {
    return false
  }
}

export function setPracticePadDetached(accountId: string, detached: boolean): void {
  try {
    if (detached) {
      localStorage.setItem(practicePadDetachedKey(accountId), '1')
    } else {
      localStorage.removeItem(practicePadDetachedKey(accountId))
    }
  } catch {
    /* ignore */
  }
}

export function togglePracticePadDetached(accountId: string): boolean {
  const next = !isPracticePadDetached(accountId)
  setPracticePadDetached(accountId, next)
  if (next) savePracticeTradePanelTab(accountId, 'quick')
  return next
}

export function dockPracticeTradePanel(accountId: string): void {
  setPracticePadDetached(accountId, false)
}

export function getPracticePadFloatPosition(panelWidth = 346, panelHeight = 200): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 80, y: 80 }
  const margin = 24
  return {
    x: Math.max(margin, Math.round((window.innerWidth - panelWidth) / 2)),
    y: Math.max(margin, window.innerHeight - panelHeight - margin),
  }
}
