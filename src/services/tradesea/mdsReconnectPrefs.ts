const STORAGE_KEY = 'auren_mds_auto_reconnect'

/** Default on — matches prior behavior (limit + resume reconnect). */
export function readMdsAutoReconnect(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
  } catch {
    /* ignore */
  }
  return true
}

export function writeMdsAutoReconnect(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}
