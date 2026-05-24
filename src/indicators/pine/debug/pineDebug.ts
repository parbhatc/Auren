/** Enable: `localStorage.setItem('auren.pine.debug', '1')` then reload. */
export function isPineDebugEnabled(): boolean {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('auren.pine.debug') === '1') {
    return true
  }
  return Boolean(import.meta.env?.DEV)
}

export function pineDebug(scope: string, message: string, data?: unknown): void {
  if (!isPineDebugEnabled()) return
  if (data !== undefined) {
    console.log(`[pine:${scope}] ${message}`, data)
  } else {
    console.log(`[pine:${scope}] ${message}`)
  }
}

export function pineWarn(scope: string, message: string, data?: unknown): void {
  console.warn(`[pine:${scope}] ${message}`, data !== undefined ? data : '')
}

export function pineTvLog(studyName: string, phase: 'init' | 'main', detail?: unknown): void {
  if (!isPineDebugEnabled()) return
  console.log(`[pine:tv:${studyName}] ${phase}`, detail ?? '')
}

/** Log first N bar events per study, then every Nth bar. */
export function shouldLogBar(studyId: string, barTime: number, every = 200): boolean {
  if (!isPineDebugEnabled()) return false
  const key = `__pineBarLog_${studyId}`
  const g = globalThis as Record<string, { count: number; lastTime: number }>
  if (!g[key]) g[key] = { count: 0, lastTime: -1 }
  const state = g[key]
  if (barTime === state.lastTime) return false
  state.lastTime = barTime
  state.count++
  return state.count <= 5 || state.count % every === 0
}

if (typeof window !== 'undefined') {
  ;(window as Window & { enablePineDebug?: () => void }).enablePineDebug = () => {
    localStorage.setItem('auren.pine.debug', '1')
    console.log('[pine] debug ON — reload the page, then add the indicator to the chart')
  }
}
