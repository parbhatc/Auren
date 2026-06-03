/** CME Globex-style electronic session (Sun 17:00 → Fri 16:00, daily 16:00–17:00 break). */
const GLOBEX_SESSION = '1700-1600'

const GLOBEX_EXCHANGES = new Set(['CME', 'CBOT', 'NYMEX', 'COMEX'])

export function rithmicSessionForExchange(exchange: string): string {
  const ex = String(exchange || '').trim().toUpperCase()
  return GLOBEX_EXCHANGES.has(ex) ? GLOBEX_SESSION : '24x7'
}

export function rithmicTimezoneForExchange(exchange: string): string {
  const ex = String(exchange || '').trim().toUpperCase()
  return GLOBEX_EXCHANGES.has(ex) ? 'America/Chicago' : 'Etc/UTC'
}
