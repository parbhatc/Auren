const STORAGE_KEY = 'tradesea_debug_upl'

export type TradeseaUplDebugState = {
  updatedAt: number
  lastEvent: string
  upl: number
  markPrice?: number
  chartSymbol?: string
  chartInstrument?: string
  positionsCount: number
  positions: unknown[]
  streamCounted?: boolean
  streamTotal?: number
  cacheSnapshot?: { entry: number; contracts: number } | null
  counted?: boolean
  total?: number
  tradeHandlerSet?: boolean
  blockedStreamZero?: boolean
  skippedSameUpl?: boolean
}

let lastBarLogAt = 0
let debugState: TradeseaUplDebugState = {
  updatedAt: 0,
  lastEvent: 'init',
  upl: 0,
  positionsCount: 0,
  positions: [],
}

export function isTradeseaUplDebug(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

export function setTradeseaUplDebug(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  console.info(
    `[Tradesea UPL] debug ${enabled ? 'ON' : 'OFF'} — localStorage.${STORAGE_KEY}=${enabled ? '1' : '0'}`
  )
}

export function getTradeseaUplDebugState(): TradeseaUplDebugState {
  return { ...debugState, positions: [...debugState.positions] }
}

export function patchTradeseaUplDebugState(
  event: string,
  patch: Partial<TradeseaUplDebugState>
): void {
  debugState = {
    ...debugState,
    ...patch,
    updatedAt: Date.now(),
    lastEvent: event,
  }

  if (typeof window !== 'undefined') {
    ;(window as unknown as { __tradeseaUplDebug?: TradeseaUplDebugState }).__tradeseaUplDebug =
      getTradeseaUplDebugState()
  }
}

/** Console + in-memory snapshot. Bar events throttled to ~2s unless `force`. */
export function debugTradeseaUpl(
  event: string,
  payload: Record<string, unknown> & { force?: boolean }
): void {
  if (!isTradeseaUplDebug()) return

  const now = Date.now()
  const isBar = event === 'bar' || event === 'calc'
  if (isBar && !payload.force && now - lastBarLogAt < 2000) {
    patchTradeseaUplDebugState(event, payload as Partial<TradeseaUplDebugState>)
    return
  }
  if (isBar) lastBarLogAt = now

  patchTradeseaUplDebugState(event, payload as Partial<TradeseaUplDebugState>)
  console.log(`[Tradesea UPL] ${event}`, payload)
}

export function installTradeseaUplDebugConsoleApi(): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as {
    tradeseaUplDebug?: (on?: boolean) => boolean
    tradeseaUplDebugState?: () => TradeseaUplDebugState
  }
  w.tradeseaUplDebug = (on = true) => {
    setTradeseaUplDebug(on)
    return isTradeseaUplDebug()
  }
  w.tradeseaUplDebugState = () => getTradeseaUplDebugState()
  if (isTradeseaUplDebug()) {
    console.info(
      '[Tradesea UPL] debug is ON. Commands: tradeseaUplDebug(false), tradeseaUplDebugState()'
    )
  }
}

installTradeseaUplDebugConsoleApi()

const SL_STORAGE_KEY = 'tradesea_debug_sl'

export type TradeseaSlDebugState = {
  updatedAt: number
  lastEvent: string
  price?: number | null
  oldPrice?: number | null
  context?: string
  positionId?: string | null
  stopLossOrderId?: string | null
  accountId?: string | null
  cacheKey?: string
  entry?: number
  contracts?: number
  bracketStop?: unknown
  apiResponse?: unknown
  note?: string
}

let slDebugState: TradeseaSlDebugState = {
  updatedAt: 0,
  lastEvent: 'init',
}

export function isTradeseaSlDebug(): boolean {
  try {
    const v = localStorage.getItem(SL_STORAGE_KEY)
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

export function setTradeseaSlDebug(enabled: boolean): void {
  try {
    localStorage.setItem(SL_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  console.info(
    `[Tradesea SL] debug ${enabled ? 'ON' : 'OFF'} — localStorage.${SL_STORAGE_KEY}=${enabled ? '1' : '0'}`
  )
}

export function getTradeseaSlDebugState(): TradeseaSlDebugState {
  return { ...slDebugState }
}

function patchTradeseaSlDebugState(event: string, patch: Partial<TradeseaSlDebugState>): void {
  slDebugState = {
    ...slDebugState,
    ...patch,
    updatedAt: Date.now(),
    lastEvent: event,
  }
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __tradeseaSlDebug?: TradeseaSlDebugState }).__tradeseaSlDebug =
      getTradeseaSlDebugState()
  }
}

/** Stop-loss flow logging (chart drag, API, WS sync). Enable: tradeseaSlDebug(true) */
export function debugTradeseaSl(event: string, payload: Record<string, unknown> = {}): void {
  if (!isTradeseaSlDebug()) return
  patchTradeseaSlDebugState(event, payload as Partial<TradeseaSlDebugState>)
  console.log(`[Tradesea SL] ${event}`, payload)
}

export function installTradeseaSlDebugConsoleApi(): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as {
    tradeseaSlDebug?: (on?: boolean) => boolean
    tradeseaSlDebugState?: () => TradeseaSlDebugState
  }
  w.tradeseaSlDebug = (on = true) => {
    setTradeseaSlDebug(on)
    return isTradeseaSlDebug()
  }
  w.tradeseaSlDebugState = () => getTradeseaSlDebugState()
  if (isTradeseaSlDebug()) {
    console.info(
      '[Tradesea SL] debug is ON. Commands: tradeseaSlDebug(false), tradeseaSlDebugState()'
    )
  }
}

installTradeseaSlDebugConsoleApi()
