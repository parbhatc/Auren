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

export function clampPadFloatPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  margin = 8
): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y }
  const viewport = window.visualViewport
  const viewportLeft = viewport?.offsetLeft ?? 0
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportWidth = viewport?.width ?? window.innerWidth
  const viewportHeight = viewport?.height ?? window.innerHeight
  const minX = viewportLeft + margin
  const minY = viewportTop + margin
  const maxX = Math.max(minX, viewportLeft + viewportWidth - panelWidth - margin)
  const maxY = Math.max(minY, viewportTop + viewportHeight - panelHeight - margin)
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  }
}

function padFloatPositionKey(accountId: string): string {
  return `auren.trade-pad.float-position.${accountId}`
}

export function savePadFloatPosition(accountId: string, position: { x: number; y: number }): void {
  try {
    localStorage.setItem(padFloatPositionKey(accountId), JSON.stringify(position))
  } catch {
    /* ignore */
  }
}

export function getSavedPadFloatPosition(
  accountId: string,
  panelWidth = 346,
  panelHeight = 200
): { x: number; y: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(padFloatPositionKey(accountId)) || 'null')
    const x = Number(saved?.x)
    const y = Number(saved?.y)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return clampPadFloatPosition(x, y, panelWidth, panelHeight)
    }
  } catch {
    /* ignore */
  }
  return getPadFloatPosition(panelWidth, panelHeight)
}

export function getPadFloatPosition(panelWidth = 346, panelHeight = 200): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 80, y: 80 }
  const margin = 24
  return clampPadFloatPosition(
    Math.round((window.innerWidth - panelWidth) / 2),
    window.innerHeight - panelHeight - margin,
    panelWidth,
    panelHeight,
    margin
  )
}

/** @deprecated */
export const isPracticePadDetached = isPadDetached
export const setPracticePadDetached = setPadDetached
export const togglePracticePadDetached = togglePadDetached
export const dockPracticeTradePanel = dockTradePanel
export const getPracticePadFloatPosition = getPadFloatPosition
