import type { ResolutionString } from '../types/chart'

const RESTORE_LAST_CANDLE_KEY = 'auren-replay-restore-last-candle'
const CURSOR_KEY_PREFIX = 'auren-replay-last-candle:'

export type SavedReplayCursor = {
  cursorSec: number
  resolution: ResolutionString
}

export function getRestoreLastReplayCandle(): boolean {
  try {
    return localStorage.getItem(RESTORE_LAST_CANDLE_KEY) === '1'
  } catch {
    return false
  }
}

export function setRestoreLastReplayCandle(enabled: boolean): void {
  try {
    localStorage.setItem(RESTORE_LAST_CANDLE_KEY, enabled ? '1' : '0')
  } catch {
    // Storage is optional.
  }
  window.dispatchEvent(
    new CustomEvent('auren:replay-restore-preference', { detail: { enabled } })
  )
}

export function loadSavedReplayCursor(sessionId?: string | null): SavedReplayCursor | null {
  if (!sessionId || !getRestoreLastReplayCandle()) return null
  try {
    const raw = localStorage.getItem(`${CURSOR_KEY_PREFIX}${sessionId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedReplayCursor>
    const cursorSec = Number(parsed.cursorSec)
    if (!Number.isFinite(cursorSec) || cursorSec <= 0) return null
    return {
      cursorSec: Math.floor(cursorSec),
      resolution: String(parsed.resolution || '1') as ResolutionString,
    }
  } catch {
    return null
  }
}

export function saveReplayCursor(
  sessionId: string | null | undefined,
  cursorSec: number,
  resolution: ResolutionString = '1'
): void {
  if (!sessionId || !getRestoreLastReplayCandle() || !Number.isFinite(cursorSec)) return
  try {
    localStorage.setItem(
      `${CURSOR_KEY_PREFIX}${sessionId}`,
      JSON.stringify({ cursorSec: Math.floor(cursorSec), resolution })
    )
  } catch {
    // Storage is optional.
  }
}
