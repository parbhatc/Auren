export function entryTimeToMs(entryTime: number | null | undefined): number {
  if (entryTime == null || !Number.isFinite(entryTime)) return Date.now()
  return entryTime < 1e12 ? entryTime * 1000 : entryTime
}

const BRACKET_CHECKPOINT_PREFIX = 'auren_practice_bracket_'

export function bracketCheckpointKey(accountId: string, cacheKey: string): string {
  return `${BRACKET_CHECKPOINT_PREFIX}${accountId}_${cacheKey}`
}

/** Last time (unix sec) we confirmed brackets were still open via live bar checks. */
export function readBracketCheckpointSec(accountId: string, cacheKey: string): number | null {
  try {
    const raw = sessionStorage.getItem(bracketCheckpointKey(accountId, cacheKey))
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
  } catch {
    return null
  }
}

export function writeBracketCheckpointSec(
  accountId: string,
  cacheKey: string,
  throughSec: number
): void {
  try {
    sessionStorage.setItem(
      bracketCheckpointKey(accountId, cacheKey),
      String(Math.floor(throughSec))
    )
  } catch {
    /* storage full / private mode */
  }
}

export function clearBracketCheckpoint(accountId: string, cacheKey: string): void {
  try {
    sessionStorage.removeItem(bracketCheckpointKey(accountId, cacheKey))
  } catch {
    /* ignore */
  }
}
