import type { ResolutionString } from '../types/chart'

const RESTORE_LAST_CANDLE_KEY = 'auren-replay-restore-last-candle'
const CURSOR_KEY_PREFIX = 'auren-replay-last-candle:'
const POSITION_KEY_PREFIX = 'auren-replay-open-positions:'
const POSITION_RESET_KEY_PREFIX = 'auren-replay-position-reset:'
export const REPLAY_POSITIONS_RESET_EVENT = 'auren:replay-positions-reset'

export function getReplayPositionsStorageKey(sessionId: string): string {
  return `${POSITION_KEY_PREFIX}${sessionId}`
}

export function getReplayPositionsResetStorageKey(sessionId: string): string {
  return `${POSITION_RESET_KEY_PREFIX}${sessionId}`
}

/** Clear restored replay positions and notify an open chart in this tab. */
export function clearSavedReplayPositions(sessionId?: string | null): void {
  if (!sessionId) return
  try {
    localStorage.removeItem(getReplayPositionsStorageKey(sessionId))
    // A remove on an already-missing position key emits no StorageEvent. Pulse
    // a dedicated key so another open chart tab is always told about the reset.
    const resetKey = getReplayPositionsResetStorageKey(sessionId)
    localStorage.setItem(resetKey, String(Date.now()))
    localStorage.removeItem(resetKey)
  } catch {
    // Storage is optional; the in-tab event still clears a mounted chart.
  }
  window.dispatchEvent(
    new CustomEvent(REPLAY_POSITIONS_RESET_EVENT, { detail: { sessionId } })
  )
}

export type SavedReplayCursor = {
  cursorSec: number
  resolution: ResolutionString
}

export type SavedReplayPosition = {
  chartSymbol: string
  executionSymbol?: string
  entry: number
  contracts: number
  stopLoss: number | null
  takeProfit: number | null
  entryTime: number
  stopLossMode?: 'hard' | 'soft'
  softStopTrigger?: 'bar_close'
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
    if (!enabled) {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index)
        if (key?.startsWith(POSITION_KEY_PREFIX)) localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage is optional.
  }
  window.dispatchEvent(
    new CustomEvent('auren:replay-restore-preference', { detail: { enabled } })
  )
}

export function loadSavedReplayPositions(
  sessionId?: string | null
): SavedReplayPosition[] {
  if (!sessionId || !getRestoreLastReplayCandle()) return []
  try {
    const raw = localStorage.getItem(getReplayPositionsStorageKey(sessionId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value): SavedReplayPosition[] => {
      const row = value as Partial<SavedReplayPosition>
      const chartSymbol = String(row.chartSymbol || '').trim()
      const entry = Number(row.entry)
      const contracts = Number(row.contracts)
      const entryTime = Number(row.entryTime)
      if (
        !chartSymbol ||
        !Number.isFinite(entry) ||
        !Number.isFinite(contracts) ||
        contracts === 0 ||
        !Number.isFinite(entryTime)
      ) return []
      const finitePrice = (price: unknown): number | null => {
        const numeric = Number(price)
        return price != null && Number.isFinite(numeric) ? numeric : null
      }
      return [{
        chartSymbol,
        executionSymbol: String(row.executionSymbol || '').trim() || undefined,
        entry,
        contracts,
        stopLoss: finitePrice(row.stopLoss),
        takeProfit: finitePrice(row.takeProfit),
        entryTime,
        stopLossMode: row.stopLossMode === 'soft' ? 'soft' : 'hard',
        softStopTrigger: 'bar_close',
      }]
    })
  } catch {
    return []
  }
}

export function saveReplayPositions(
  sessionId: string | null | undefined,
  positions: SavedReplayPosition[]
): void {
  if (!sessionId || !getRestoreLastReplayCandle()) return
  try {
    const key = getReplayPositionsStorageKey(sessionId)
    if (!positions.length) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(positions))
  } catch {
    // Storage is optional.
  }
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
