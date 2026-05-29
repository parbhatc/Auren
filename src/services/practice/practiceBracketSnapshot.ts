/** Seconds after saved candle time before replaying 1s bars (avoids re-filling the same bar). */
export const BRACKET_REPLAY_GRACE_SEC = 3

export type PracticeBracketSnapshot = {
  barTimeSec: number
  barTimeMs: number
  barTimeLabel?: string
  open: number
  high: number
  low: number
  close: number
  resolution: string
  recordedAtSec: number
  reason: 'ws_disconnect' | 'live_bar' | 'page_hide'
}

export function formatSnapshotTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function parseBracketSnapshot(raw: unknown): PracticeBracketSnapshot | null {
  if (raw == null) return null
  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>
  } else {
    return null
  }

  const barTimeMs = Number(obj.barTimeMs ?? (Number(obj.barTimeSec) < 1e12 ? Number(obj.barTimeSec) * 1000 : obj.barTimeSec))
  if (!Number.isFinite(barTimeMs)) return null

  const open = Number(obj.open)
  const high = Number(obj.high)
  const low = Number(obj.low)
  const close = Number(obj.close)
  if (![open, high, low, close].every(Number.isFinite)) return null

  return {
    barTimeSec: Math.floor(barTimeMs / 1000),
    barTimeMs: Math.floor(barTimeMs),
    open,
    high,
    low,
    close,
    resolution: String(obj.resolution || '1'),
    recordedAtSec: Math.floor(Number(obj.recordedAtSec) || Date.now() / 1000),
    reason:
      obj.reason === 'ws_disconnect' || obj.reason === 'page_hide' || obj.reason === 'live_bar'
        ? obj.reason
        : 'live_bar',
  }
}

export function barMatchesSnapshot(
  bar: { open?: number; high?: number; low?: number; close?: number },
  snapshot: PracticeBracketSnapshot,
  tickSize = 0.25
): boolean {
  const tol = Math.max(tickSize / 2, 0.01)
  const eq = (a: number, b: number) => Math.abs(a - b) <= tol
  return (
    eq(Number(bar.open), snapshot.open) &&
    eq(Number(bar.high), snapshot.high) &&
    eq(Number(bar.low), snapshot.low) &&
    eq(Number(bar.close), snapshot.close)
  )
}

export function replayFromSecForSnapshot(
  snapshot: PracticeBracketSnapshot | null | undefined,
  entrySec: number,
  nowSec: number
): number {
  if (snapshot?.barTimeSec) {
    return Math.max(entrySec, snapshot.barTimeSec + BRACKET_REPLAY_GRACE_SEC)
  }
  return Math.max(entrySec, nowSec - 120)
}
