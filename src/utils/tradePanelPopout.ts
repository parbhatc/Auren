import { PAD_DETACHED_STORAGE_PREFIX } from '../constants/tradePanel'
import { saveTradePanelTab } from './tradePanelTab'

export function padDetachedKey(accountId: string): string {
  return `${PAD_DETACHED_STORAGE_PREFIX}${accountId}`
}

/** @deprecated use padDetachedKey */
export const practicePadDetachedKey = padDetachedKey

export function isPadDetached(accountId: string): boolean {
  try {
    return localStorage.getItem(padDetachedKey(accountId)) === '1'
  } catch {
    return false
  }
}

export function setPadDetached(accountId: string, detached: boolean): void {
  try {
    if (detached) {
      localStorage.setItem(padDetachedKey(accountId), '1')
    } else {
      localStorage.removeItem(padDetachedKey(accountId))
    }
  } catch {
    /* ignore */
  }
}

export function togglePadDetached(accountId: string): boolean {
  const next = !isPadDetached(accountId)
  setPadDetached(accountId, next)
  if (next) saveTradePanelTab(accountId, 'quick')
  return next
}

export function dockTradePanel(accountId: string): void {
  setPadDetached(accountId, false)
}

export function getPadFloatPosition(panelWidth = 346, panelHeight = 200): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 80, y: 80 }
  const margin = 24
  return {
    x: Math.max(margin, Math.round((window.innerWidth - panelWidth) / 2)),
    y: Math.max(margin, window.innerHeight - panelHeight - margin),
  }
}

/** @deprecated */
export const isPracticePadDetached = isPadDetached
export const setPracticePadDetached = setPadDetached
export const togglePracticePadDetached = togglePadDetached
export const dockPracticeTradePanel = dockTradePanel
export const getPracticePadFloatPosition = getPadFloatPosition
