const STORAGE_KEY = 'auren_mds_auto_reconnect'
const LIMIT_STORAGE_KEY = 'auren_mds_reconnect_on_limit'

/** Default on — retries after unexpected drops (not connection-limit unless enabled). */
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

/** Default off — limit-exceeded (1011) reconnect requires this and auto-reconnect. */
export function readMdsReconnectOnLimit(): boolean {
  try {
    const raw = localStorage.getItem(LIMIT_STORAGE_KEY)
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return false
}

export function writeMdsReconnectOnLimit(enabled: boolean): void {
  try {
    localStorage.setItem(LIMIT_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}
