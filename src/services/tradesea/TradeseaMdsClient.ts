/**
 * Market Data Stream (MDS) WebSocket client.
 * Speaks the MDS wire protocol on /tradesea-mds-ws; backend translates to Tradesea.
 */
import { getAuthToken, getWebSocketUrl } from '../../api/api'
import { dismissMdsConnectionToast, showMdsConnectionToast } from './mdsConnectionToast'
import {
  encodeMdsSubscribe,
  encodeMdsUnsubscribe,
  isMdsPong,
  isMdsTick,
  MDS_PING_FRAME,
  mdsTickToFrame,
  type MdsSubscriptionPayload,
} from '../mds/mdsWire'
import {
  readMdsAutoReconnect,
  readMdsReconnectOnLimit,
  writeMdsAutoReconnect,
  writeMdsReconnectOnLimit,
} from './mdsReconnectPrefs'
import { resolveMdsSubscribeTicker } from './tradeseaMdsSymbols'
import { DEFAULT_PRACTICE_CHART_SYMBOL } from '../../constants/practice'

/** MDS frame type constants (mdsWorker) */
const F_BEST_BID_ASK = 1
const F_LTP = 2
const F_DEPTH = 4
const F_CANDLES = 5
const F_QUOTES = 6
const F_TTV = 7

/** Wire buckets (match app.tradesea.ai DOM: bidAskDef + ttvDef; not panelDom / panelBestBidAsk). */
export const MDS_BUCKET_LTP = 'ltpDef'
export const MDS_BUCKET_BEST_BID_ASK = 'bidAskDef'
export const MDS_BUCKET_MARKET_DEPTH = 'marketDepthDef'
export const MDS_BUCKET_TTV = 'ttvDef'

export type TradeseaMdsMessage =
  | { f: 5; id: string; r: string; t: number; o: number; h: number; l: number; c: number; v?: number }
  | { f: 2; id: string; p: number; t: number; v?: number; s?: number; pc?: number; nc?: number }
  | { f: 1; id: string; ap?: number; bp?: number; as?: number; bs?: number; h?: boolean }
  | { f: 4; id: string; a?: [number, number][]; b?: [number, number][]; u?: number }
  | { f: 6; id: string; p?: number; ap?: number; bp?: number; as?: number; bs?: number; [key: string]: unknown }
  | { f: 7; id: string; v?: [number, number][]; u?: number }
  | { f: 0; c?: string; m?: string }

type MdsEventMap = {
  candles: Extract<TradeseaMdsMessage, { f: 5 }>
  ltp: Extract<TradeseaMdsMessage, { f: 2 }>
  bestBidAsk: Extract<TradeseaMdsMessage, { f: 1 }>
  depth: Extract<TradeseaMdsMessage, { f: 4 }>
  quotes: Extract<TradeseaMdsMessage, { f: 6 }>
  ttv: Extract<TradeseaMdsMessage, { f: 7 }>
  message: TradeseaMdsMessage
  connection: MdsConnectionState
  autoReconnect: boolean
  reconnectOnLimit: boolean
  connectionsLimitBlocked: void
  open: void
  resubscribed: void
  close: { code: number; reason: string }
  error: Error
}

export type MdsConnectionState = 'connected' | 'connecting' | 'disconnected'

type SubscriptionPayload = MdsSubscriptionPayload

export type TradeseaMdsBootstrap = {
  symbols: string[]
  resolution?: string
}

export class TradeseaMdsClient {
  private ws: WebSocket | null = null
  private sessionKey: string | null = null
  private subscriptionId = 0
  private activeSubs = new Map<number, SubscriptionPayload>()
  private bootstrap: TradeseaMdsBootstrap | null = null
  private bootstrapSubIds: number[] = []
  private listeners: {
    [K in keyof MdsEventMap]?: Set<(payload: MdsEventMap[K]) => void>
  } = {}
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pingSocket: WebSocket | null = null
  private loggedMdsErrors = new Set<string>()
  private autoReconnectEnabled = readMdsAutoReconnect()
  private reconnectOnLimitEnabled = readMdsReconnectOnLimit()
  private manualDisconnect = false
  /** Suppresses one onclose auto-reconnect when replacing the active socket. */
  private suppressAutoReconnectOnce = false
  /** Account/stream supports f:4 depth (delayed sandbox). Production feed = false. */
  private marketDepthEntitled = true
  /** Session flag; false when !entitled or upstream rejected depth. */
  private depthSubscribeAllowed = true
  private connectionState: MdsConnectionState = 'disconnected'
  private lastAccountId: string | null = null
  private lastConnectionGroupId: string | null = null
  private reconnecting = false
  private suspended = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Separate from reconnectTimer so a new connect() does not cancel limit retries. */
  private limitReconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Timestamps of limit-driven reconnect attempts (sliding 1-minute window). */
  private limitReconnectAttempts: number[] = []
  private limitReconnectStopped = false
  private static readonly LIMIT_RECONNECT_MAX_PER_MINUTE = 10
  private static readonly LIMIT_RECONNECT_WINDOW_MS = 60_000
  private static readonly CLOSE_GRACE_MS = 2_000
  private static readonly RESUME_DELAY_MS = 2_500
  private static readonly LIMIT_RECONNECT_MS = 1_000
  private static readonly LIMIT_RECONNECT_MAX_MS = 45_000
  private limitReconnectBackoffMs = 1_000
  /** Extra grace when replacing socket after connection-limit close. */
  private static readonly LIMIT_CLOSE_GRACE_MS = 1_000
  private static readonly DROP_RECONNECT_MS = 4_000
  private static readonly PING_INTERVAL_MS = 5_000
  /** Wait for proxy/upstream to settle before subscribe burst (Tradesea worker pattern). */
  private static readonly RESUBSCRIBE_DELAY_MS = 150
  /** iOS Safari keeps OPEN sockets after backgrounding; reconnect after this hidden duration. */
  private static readonly BACKGROUND_RECONNECT_MS = 30_000
  /** No wire activity for this long when foregrounding implies a zombie socket. */
  private static readonly STALE_WIRE_MS = 25_000
  private static readonly PAGE_VISIBLE_DEBOUNCE_MS = 150

  private static pageLifecycleBound = false
  private static readonly activeClients = new Set<TradeseaMdsClient>()

  private pageHiddenAt: number | null = null
  private lastWireActivityAt = 0
  private pageVisibleTimer: ReturnType<typeof setTimeout> | null = null

  /** Call after stream-config: production feed = false, sandbox delayed = true. */
  configureMarketDepth(entitled: boolean): void {
    this.marketDepthEntitled = entitled
    this.depthSubscribeAllowed = entitled
    if (!entitled) this.dropDepthSubscriptionsLocal()
  }

  isDepthSubscribeAllowed(): boolean {
    return this.depthSubscribeAllowed
  }

  isMarketDepthEntitled(): boolean {
    return this.marketDepthEntitled
  }

  /** Drop depth subs locally without wire unsubscribe (avoids ERR_SUB_NOT_FOUND when depth was never active). */
  private dropDepthSubscriptionsLocal(): void {
    const depthIds: number[] = []
    for (const [id, payload] of this.activeSubs.entries()) {
      if (payload.kind === 'depth') depthIds.push(id)
    }
    for (const id of depthIds) this.activeSubs.delete(id)
    this.bootstrapSubIds = this.bootstrapSubIds.filter((id) => !depthIds.includes(id))
  }

  private unsubscribeAllDepth(): void {
    const depthIds: number[] = []
    for (const [id, payload] of this.activeSubs.entries()) {
      if (payload.kind === 'depth') depthIds.push(id)
    }
    for (const id of depthIds) this.unsubscribe(id)
    this.bootstrapSubIds = this.bootstrapSubIds.filter((id) => !depthIds.includes(id))
  }

  private blockDepthAfterEntitlementError(message: string): void {
    if (!this.marketDepthEntitled || !this.depthSubscribeAllowed) return
    this.depthSubscribeAllowed = false
    this.dropDepthSubscriptionsLocal()
    console.info(
      '[TradeseaMdsClient] MDS depth disabled for this session:',
      message,
      '— using best bid/ask only. For full DOM use a sandbox/RD data account (CME-Delayed:MNQ).'
    )
  }

  getConnectionState(): MdsConnectionState {
    if (!this.ws) return this.connectionState === 'connecting' ? 'connecting' : 'disconnected'
    if (this.ws.readyState === WebSocket.OPEN) return 'connected'
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting'
    return 'disconnected'
  }

  private setConnectionState(state: MdsConnectionState): void {
    if (this.connectionState === state) return
    this.connectionState = state
    this.emit('connection', state)
  }

  private logWs(
    message: string,
    detail?: Record<string, string | number | boolean | null | undefined>
  ): void {
    if (detail && Object.keys(detail).length) {
      console.info(`[Tradesea MDS] ${message}`, detail)
    } else {
      console.info(`[Tradesea MDS] ${message}`)
    }
  }

  /**
   * Legacy hook — no longer closes the socket on tab hide (keeps DOM/book streams alive).
   * Use only if you explicitly need to pause reconnect loops.
   */
  suspend(): void {
    if (this.suspended) return
    this.suspended = true
    this.clearAllReconnectTimers()
  }

  resume(): void {
    if (!this.suspended) return
    this.suspended = false
    this.scheduleForegroundReconnectCheck()
  }

  private static bindPageLifecycleOnce(): void {
    if (TradeseaMdsClient.pageLifecycleBound || typeof document === 'undefined') return
    TradeseaMdsClient.pageLifecycleBound = true

    const notifyVisible = () => {
      for (const client of TradeseaMdsClient.activeClients) {
        client.scheduleForegroundReconnectCheck()
      }
    }
    const notifyHidden = () => {
      for (const client of TradeseaMdsClient.activeClients) {
        client.onPageHidden()
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') notifyHidden()
      else notifyVisible()
    })
    window.addEventListener('pageshow', () => {
      notifyVisible()
    })
    window.addEventListener('focus', notifyVisible)
  }

  private registerPageLifecycle(): void {
    TradeseaMdsClient.activeClients.add(this)
    TradeseaMdsClient.bindPageLifecycleOnce()
  }

  private unregisterPageLifecycle(): void {
    TradeseaMdsClient.activeClients.delete(this)
    if (this.pageVisibleTimer) {
      clearTimeout(this.pageVisibleTimer)
      this.pageVisibleTimer = null
    }
  }

  private onPageHidden(): void {
    this.pageHiddenAt = Date.now()
  }

  private touchWireActivity(): void {
    this.lastWireActivityAt = Date.now()
  }

  /** Debounced — iOS may fire visibilitychange, pageshow, and focus together. */
  private scheduleForegroundReconnectCheck(): void {
    if (this.pageVisibleTimer) clearTimeout(this.pageVisibleTimer)
    this.pageVisibleTimer = setTimeout(() => {
      this.pageVisibleTimer = null
      this.handleForegroundResume()
    }, TradeseaMdsClient.PAGE_VISIBLE_DEBOUNCE_MS)
  }

  private handleForegroundResume(): void {
    if (this.suspended) this.suspended = false
    this.syncPrefsFromStorage()
    if (!this.autoReconnectEnabled || !this.lastAccountId || !this.lastConnectionGroupId) return

    const hiddenMs = this.pageHiddenAt ? Date.now() - this.pageHiddenAt : 0
    this.pageHiddenAt = null

    if (this.ws?.readyState === WebSocket.CONNECTING) return

    const staleWire =
      this.lastWireActivityAt > 0 &&
      Date.now() - this.lastWireActivityAt > TradeseaMdsClient.STALE_WIRE_MS
    const longBackground = hiddenMs >= TradeseaMdsClient.BACKGROUND_RECONNECT_MS

    if (this.ws?.readyState === WebSocket.OPEN && (longBackground || staleWire)) {
      this.logWs('Reconnecting (foreground resume)', { hiddenMs, staleWire })
      showMdsConnectionToast('reconnecting')
      this.reconnect()
      return
    }

    if (!this.isConnectedOrConnecting()) {
      this.logWs('Reconnecting (foreground resume)', {
        delayMs: TradeseaMdsClient.RESUME_DELAY_MS,
        hiddenMs,
      })
      showMdsConnectionToast('reconnecting')
      this.scheduleConnect(TradeseaMdsClient.RESUME_DELAY_MS)
    }
  }

  isSuspended(): boolean {
    return this.suspended
  }

  isAutoReconnectEnabled(): boolean {
    return this.autoReconnectEnabled
  }

  setAutoReconnectEnabled(enabled: boolean): void {
    if (this.autoReconnectEnabled === enabled) return
    this.autoReconnectEnabled = enabled
    writeMdsAutoReconnect(enabled)
    if (!enabled) {
      this.clearReconnectTimer()
      this.clearLimitReconnectTimer()
      if (this.reconnectOnLimitEnabled) {
        this.reconnectOnLimitEnabled = false
        writeMdsReconnectOnLimit(false)
        this.emit('reconnectOnLimit', false)
      }
    }
    this.emit('autoReconnect', enabled)
    if (
      enabled &&
      this.reconnectOnLimitEnabled &&
      !this.isConnectedOrConnecting() &&
      this.lastAccountId &&
      this.lastConnectionGroupId &&
      !this.suspended
    ) {
      this.scheduleLimitReconnect()
    }
  }

  isReconnectOnLimitEnabled(): boolean {
    return this.reconnectOnLimitEnabled
  }

  setReconnectOnLimitEnabled(enabled: boolean): void {
    if (this.reconnectOnLimitEnabled === enabled) return
    this.reconnectOnLimitEnabled = enabled
    writeMdsReconnectOnLimit(enabled)
    this.emit('reconnectOnLimit', enabled)
    if (!enabled) {
      this.clearLimitReconnectTimer()
      return
    }
    if (
      this.autoReconnectEnabled &&
      !this.isConnectedOrConnecting() &&
      this.lastAccountId &&
      this.lastConnectionGroupId &&
      !this.suspended
    ) {
      this.scheduleLimitReconnect()
    }
  }

  /** True when ltp + bid/ask + quotes + ttv (and depth when entitled) are on the wire for `symbol`. */
  hasBookSubscriptionsFor(symbol: string): boolean {
    const sym = String(symbol || '').trim()
    if (!sym) return false
    let ltp = false
    let bestBidAsk = false
    let quotes = false
    let ttv = false
    let depth = !this.depthSubscribeAllowed
    for (const payload of this.activeSubs.values()) {
      if (!payload.symbols.includes(sym)) continue
      switch (payload.kind) {
        case 'ltp':
          ltp = true
          break
        case 'bestBidAsk':
          bestBidAsk = true
          break
        case 'quotes':
          quotes = true
          break
        case 'ttv':
          ttv = true
          break
        case 'depth':
          depth = true
          break
        default:
          break
      }
    }
    return ltp && bestBidAsk && quotes && ttv && depth
  }

  /** Re-open MDS after upstream has time to release the previous socket. */
  reconnect(): void {
    this.suspended = false
    this.resetLimitReconnectBudget()
    this.clearAllReconnectTimers()
    this.limitReconnectBackoffMs = TradeseaMdsClient.LIMIT_RECONNECT_MS
    this.logWs('Reconnecting…')
    showMdsConnectionToast('reconnecting')
    void this.reconnectInternal(TradeseaMdsClient.CLOSE_GRACE_MS)
  }

  private syncPrefsFromStorage(): void {
    this.autoReconnectEnabled = readMdsAutoReconnect()
    this.reconnectOnLimitEnabled = readMdsReconnectOnLimit()
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearLimitReconnectTimer(): void {
    if (this.limitReconnectTimer) {
      clearTimeout(this.limitReconnectTimer)
      this.limitReconnectTimer = null
    }
  }

  private clearAllReconnectTimers(): void {
    this.clearReconnectTimer()
    this.clearLimitReconnectTimer()
  }

  private static isConnectionsLimitClose(code: number, reason: string): boolean {
    if (code !== 1011) return false
    const text = String(reason || '').trim()
    if (!text) return true
    return /CONNECTIONS_LIMIT|ERR_CONNECTIONS_LIMIT|ERR_CONNECTIONS_LIMIT_EXCEEDED|limit/i.test(text)
  }

  private scheduleConnect(delayMs: number): void {
    this.clearReconnectTimer()
    if (
      !this.autoReconnectEnabled ||
      !this.lastAccountId ||
      !this.lastConnectionGroupId ||
      this.suspended
    ) {
      return
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.suspended) return
      if (!this.autoReconnectEnabled) return
      if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
        return
      }
      this.connect(this.lastAccountId!, this.lastConnectionGroupId!, this.bootstrap ?? undefined)
    }, delayMs)
  }

  private shouldRetryAfterLimitClose(): boolean {
    this.syncPrefsFromStorage()
    return (
      Boolean(this.lastAccountId && this.lastConnectionGroupId) &&
      !this.suspended &&
      !this.limitReconnectStopped &&
      this.autoReconnectEnabled &&
      this.reconnectOnLimitEnabled
    )
  }

  private pruneLimitReconnectAttempts(now = Date.now()): void {
    const cutoff = now - TradeseaMdsClient.LIMIT_RECONNECT_WINDOW_MS
    this.limitReconnectAttempts = this.limitReconnectAttempts.filter((t) => t > cutoff)
  }

  private limitReconnectBudgetExceeded(): boolean {
    this.pruneLimitReconnectAttempts()
    return this.limitReconnectAttempts.length >= TradeseaMdsClient.LIMIT_RECONNECT_MAX_PER_MINUTE
  }

  private recordLimitReconnectAttempt(): void {
    this.pruneLimitReconnectAttempts()
    this.limitReconnectAttempts.push(Date.now())
  }

  private resetLimitReconnectBudget(): void {
    this.limitReconnectAttempts = []
    this.limitReconnectStopped = false
  }

  private cancelLimitReconnectLoop(): void {
    this.limitReconnectStopped = true
    this.clearLimitReconnectTimer()
    this.logWs('Connection limit — stopped auto-reconnect', {
      attempts: this.limitReconnectAttempts.length,
      windowSec: TradeseaMdsClient.LIMIT_RECONNECT_WINDOW_MS / 1000,
    })
    console.warn(
      '[Tradesea MDS] Stopped auto-reconnect after 10 attempts in 1 minute. Close other Tradesea/Auren tabs, then use Refresh stream.'
    )
    showMdsConnectionToast('limit')
  }

  /** Wait for upstream to release the slot, then full reconnect (close grace + new socket). */
  private scheduleLimitReconnect(): void {
    this.clearLimitReconnectTimer()
    if (this.limitReconnectBudgetExceeded()) {
      this.cancelLimitReconnectLoop()
      return
    }
    if (!this.shouldRetryAfterLimitClose()) {
      this.logWs('Connection limit — reconnect skipped', {
        hasSession: Boolean(this.lastAccountId && this.lastConnectionGroupId),
        suspended: this.suspended,
        autoReconnect: this.autoReconnectEnabled,
        reconnectOnLimit: this.reconnectOnLimitEnabled,
      })
      return
    }
    const delayMs = this.limitReconnectBackoffMs
    this.logWs('Connection limit — scheduling reconnect', { delayMs })
    this.limitReconnectTimer = setTimeout(() => {
      this.limitReconnectTimer = null
      if (!this.shouldRetryAfterLimitClose()) {
        this.logWs('Connection limit — reconnect aborted (prefs/session changed)', {})
        return
      }
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.limitReconnectBackoffMs = TradeseaMdsClient.LIMIT_RECONNECT_MS
        return
      }
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        this.scheduleLimitReconnect()
        return
      }
      if (this.limitReconnectBudgetExceeded()) {
        this.cancelLimitReconnectLoop()
        return
      }
      this.recordLimitReconnectAttempt()
      this.logWs('Reconnecting (connection limit)…', { delayMs })
      showMdsConnectionToast('reconnecting')
      void this.reconnectInternal(TradeseaMdsClient.LIMIT_CLOSE_GRACE_MS).then(() => {
        if (!this.shouldRetryAfterLimitClose()) return
        if (this.getConnectionState() === 'connected') {
          this.limitReconnectBackoffMs = TradeseaMdsClient.LIMIT_RECONNECT_MS
          return
        }
        this.limitReconnectBackoffMs = Math.min(
          Math.round(this.limitReconnectBackoffMs * 1.4),
          TradeseaMdsClient.LIMIT_RECONNECT_MAX_MS
        )
        this.scheduleLimitReconnect()
      })
    }, delayMs)
  }

  private closeAndWait(graceMs: number): Promise<void> {
    return new Promise((resolve) => {
      const ws = this.ws
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        this.detachSocket(false)
        setTimeout(resolve, graceMs)
        return
      }
      const finish = () => {
        clearTimeout(fallback)
        resolve()
      }
      const fallback = setTimeout(finish, graceMs + 500)
      ws.addEventListener('close', finish, { once: true })
      this.detachSocket(false)
    })
  }

  private async reconnectInternal(closeGraceMs: number): Promise<void> {
    if (!this.lastAccountId || !this.lastConnectionGroupId) {
      this.logWs('Reconnect skipped — no session', {})
      return
    }
    if (this.reconnecting) {
      this.logWs('Reconnect deferred — already in progress', {})
      this.scheduleLimitReconnect()
      return
    }
    this.reconnecting = true
    this.suppressAutoReconnectOnce = true
    try {
      await this.closeAndWait(closeGraceMs)
      if (this.suspended) return
      this.connect(this.lastAccountId, this.lastConnectionGroupId, this.bootstrap ?? undefined)
    } finally {
      this.reconnecting = false
    }
  }

  on<K extends keyof MdsEventMap>(event: K, handler: (payload: MdsEventMap[K]) => void): () => void {
    let set = this.listeners[event] as Set<(payload: MdsEventMap[K]) => void> | undefined
    if (!set) {
      set = new Set()
      this.listeners[event] = set as (typeof this.listeners)[K]
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  private emit<K extends keyof MdsEventMap>(event: K, payload: MdsEventMap[K]) {
    this.listeners[event]?.forEach((fn) => {
      try {
        fn(payload)
      } catch (err) {
        console.warn('[TradeseaMdsClient] listener error:', err)
      }
    })
  }

  connect(
    accountId: string,
    connectionGroupId: string,
    bootstrap?: TradeseaMdsBootstrap | null
  ): void {
    if (this.suspended) return
    // disconnect() sets manualDisconnect but detachSocket() skips onclose — reset for new socket.
    this.manualDisconnect = false
    this.syncPrefsFromStorage()
    if (bootstrap !== undefined) {
      this.bootstrap = bootstrap
    }
    const sessionKey = `${accountId}:${connectionGroupId}`
    if (this.ws) {
      const state = this.ws.readyState
      if (this.sessionKey === sessionKey && (state === WebSocket.OPEN || state === WebSocket.CONNECTING)) {
        return
      }
    }

    this.lastAccountId = accountId
    this.lastConnectionGroupId = connectionGroupId
    this.registerPageLifecycle()
    this.clearReconnectTimer()
    this.suppressAutoReconnectOnce = true
    this.detachSocket()
    this.depthSubscribeAllowed = this.marketDepthEntitled
    this.loggedMdsErrors.clear()
    this.setConnectionState('connecting')
    this.logWs('Connecting…', {
      accountId: accountId.slice(0, 12) + '…',
    })
    showMdsConnectionToast(this.reconnecting ? 'reconnecting' : 'connecting')

    const token = getAuthToken()
    if (!token) {
      this.emit('error', new Error('Not authenticated'))
      return
    }

    const url =
      `${getWebSocketUrl('/tradesea-mds-ws')}` +
      `?accountId=${encodeURIComponent(accountId)}` +
      `&token=${encodeURIComponent(token)}` +
      `&connectionGroupId=${encodeURIComponent(connectionGroupId)}`

    const ws = new WebSocket(url)
    this.ws = ws
    this.sessionKey = sessionKey

    ws.onopen = () => {
      if (this.ws !== ws) return
      this.touchWireActivity()
      this.clearLimitReconnectTimer()
      this.resetLimitReconnectBudget()
      this.limitReconnectBackoffMs = TradeseaMdsClient.LIMIT_RECONNECT_MS
      this.startPing(ws)
      this.setConnectionState('connected')
      this.logWs('Connected')
      showMdsConnectionToast('connected')
      this.emit('open', undefined as MdsEventMap['open'])
      setTimeout(() => {
        if (this.ws !== ws) return
        this.resubscribeAll()
      }, TradeseaMdsClient.RESUBSCRIBE_DELAY_MS)
    }

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return
      const text = typeof ev.data === 'string' ? ev.data : ''
      if (!text) return
      if (isMdsPong(text)) {
        this.touchWireActivity()
        return
      }
      this.touchWireActivity()
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>
        const msg = isMdsTick(parsed)
          ? (mdsTickToFrame(parsed) as TradeseaMdsMessage | null)
          : (parsed as TradeseaMdsMessage)
        if (!msg || typeof msg.f !== 'number') return
        if (msg.f === 0) {
          const err = msg as { c?: string; m?: string }
          const key = `${err.c || ''}:${err.m || ''}`
          if (!this.loggedMdsErrors.has(key)) {
            this.loggedMdsErrors.add(key)
            const text = err.m || key || 'unknown'
            if (/full depth not allowed/i.test(text)) {
              this.blockDepthAfterEntitlementError(text)
            } else if (/ERR_SUB_NOT_FOUND/i.test(text) && /depth|marketDepth|panelDom/i.test(text)) {
              this.dropDepthSubscriptionsLocal()
            } else if (!/ERR_SUB_NOT_FOUND/i.test(text)) {
              console.warn('[TradeseaMdsClient] MDS error:', text, err.c ? `(${err.c})` : '')
            }
          }
          return
        }
        this.emit('message', msg)
        if (msg.f === F_CANDLES) this.emit('candles', msg as MdsEventMap['candles'])
        else if (msg.f === F_LTP) this.emit('ltp', msg as MdsEventMap['ltp'])
        else if (msg.f === F_BEST_BID_ASK) this.emit('bestBidAsk', msg as MdsEventMap['bestBidAsk'])
        else if (msg.f === F_DEPTH) this.emit('depth', msg as MdsEventMap['depth'])
        else if (msg.f === F_QUOTES) this.emit('quotes', msg as MdsEventMap['quotes'])
        else if (msg.f === F_TTV) this.emit('ttv', msg as MdsEventMap['ttv'])
      } catch {
        /* non-json frame */
      }
    }

    ws.onerror = () => {
      if (this.ws !== ws) return
      this.setConnectionState('disconnected')
      this.emit('error', new Error('MDS WebSocket error'))
    }

    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.stopPing()
      this.ws = null
      this.sessionKey = null
      this.setConnectionState('disconnected')

      const reason = String(ev.reason || '')
      if (!this.suspended) {
        this.logWs('Disconnected', {
          code: ev.code,
          reason: reason || '(none)',
        })
      }

      this.emit('close', { code: ev.code, reason: ev.reason })

      this.syncPrefsFromStorage()
      const limitExceeded = TradeseaMdsClient.isConnectionsLimitClose(ev.code, reason)
      const wasManual = this.manualDisconnect
      this.manualDisconnect = false
      const suppressAuto = this.suppressAutoReconnectOnce
      this.suppressAutoReconnectOnce = false

      if (!this.suspended) {
        console.info('[Tradesea MDS] close handled', {
          code: ev.code,
          reason: reason || '(none)',
          limitExceeded,
          wasManual,
          suppressAuto,
        })
      }

      if (limitExceeded && !this.suspended) {
        this.syncPrefsFromStorage()
        if (!this.autoReconnectEnabled || !this.reconnectOnLimitEnabled) {
          this.logWs('Connection limit — reconnect disabled by prefs', {
            autoReconnect: this.autoReconnectEnabled,
            reconnectOnLimit: this.reconnectOnLimitEnabled,
          })
          dismissMdsConnectionToast()
          this.emit('connectionsLimitBlocked', undefined as MdsEventMap['connectionsLimitBlocked'])
          return
        }
        showMdsConnectionToast('limit')
        if (this.limitReconnectStopped || this.limitReconnectBudgetExceeded()) {
          this.cancelLimitReconnectLoop()
          return
        }
        console.warn(
          '[Tradesea MDS] Connection limit exceeded — retrying (Connect on limit). Close other Tradesea/Auren tabs on this account.'
        )
        this.scheduleLimitReconnect()
        return
      }

      if (
        !this.suspended &&
        !this.reconnecting &&
        !wasManual &&
        !suppressAuto &&
        this.autoReconnectEnabled &&
        ev.code !== 1000
      ) {
        showMdsConnectionToast('reconnecting')
        this.scheduleConnect(TradeseaMdsClient.DROP_RECONNECT_MS)
      } else if (!this.suspended && !this.reconnecting && !wasManual && !suppressAuto) {
        showMdsConnectionToast('disconnected')
      } else if (wasManual || suppressAuto) {
        dismissMdsConnectionToast()
      }
    }
  }

  private startPing(ws: WebSocket): void {
    this.stopPing()
    this.pingSocket = ws
    this.pingTimer = setInterval(() => {
      if (this.ws !== ws || this.pingSocket !== ws || ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(MDS_PING_FRAME)
      } catch {
        /* ignore */
      }
    }, TradeseaMdsClient.PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.pingSocket = null
  }

  private detachSocket(clearLocalSubs = false): void {
    this.stopPing()
    const ws = this.ws
    if (!ws) return
    this.ws = null
    this.sessionKey = null
    this.setConnectionState('disconnected')
    if (clearLocalSubs) {
      this.dropBootstrapSubsLocal()
    }
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }

  disconnect(clearSubs = true): void {
    this.suspended = false
    this.manualDisconnect = true
    this.unregisterPageLifecycle()
    this.pageHiddenAt = null
    this.lastWireActivityAt = 0
    this.clearAllReconnectTimers()
    if (this.ws) {
      this.logWs('Disconnected (client disconnect)')
    }
    dismissMdsConnectionToast()
    this.detachSocket(clearSubs)
    if (clearSubs) {
      this.activeSubs.clear()
      this.bootstrapSubIds = []
    }
    // onclose is detached above — do not leave manualDisconnect stuck for the next connect().
    this.manualDisconnect = false
  }

  getBootstrapSymbols(): string[] {
    return this.bootstrap?.symbols?.filter(Boolean) ?? []
  }

  setBootstrap(bootstrap: TradeseaMdsBootstrap | null, options?: { apply?: boolean; wireUnsub?: boolean }): void {
    const prevSymbols = (this.bootstrap?.symbols ?? []).filter(Boolean).join('|')
    const nextSymbols = (bootstrap?.symbols ?? []).filter(Boolean)
    const symbolsChanged = prevSymbols !== nextSymbols.join('|')
    this.bootstrap = bootstrap
    if (options?.apply === false || !nextSymbols.length) return
    if (this.ws?.readyState === WebSocket.OPEN) {
      const wireUnsub = Boolean(options?.wireUnsub) && symbolsChanged
      this.applyBootstrap(wireUnsub)
    }
  }

  /** Re-send an existing subscription on the wire (no unsubscribe). */
  resendSubscription(id: number): void {
    const payload = this.activeSubs.get(id)
    if (payload) this.sendWire(payload, true)
  }

  /** Drop bootstrap subs in memory only (socket is closing or fresh upstream). */
  private dropBootstrapSubsLocal(): void {
    for (const id of this.bootstrapSubIds) {
      this.activeSubs.delete(id)
    }
    this.bootstrapSubIds = []
    for (const [id, payload] of [...this.activeSubs.entries()]) {
      if (payload.kind !== 'candles') this.activeSubs.delete(id)
    }
  }

  private clearBootstrapSubsWire(): void {
    for (const id of [...this.bootstrapSubIds]) {
      try {
        this.unsubscribe(id)
      } catch {
        /* ignore */
      }
    }
    this.bootstrapSubIds = []
  }

  private applyBootstrap(wireUnsub = false): void {
    if (wireUnsub) {
      this.clearBootstrapSubsWire()
    } else {
      this.dropBootstrapSubsLocal()
    }
    const symbols = this.bootstrap?.symbols?.filter(Boolean) || []
    if (!symbols.length) return

    const ensure = (kind: SubscriptionPayload['kind'], subscribe: () => number): number => {
      const existing = this.findSubscriptionId(kind, symbols)
      if (existing != null) return existing
      return subscribe()
    }

    // Match Tradesea: ltp + bidAsk + quotes + ttv on connect; f:4 only when entitled (delayed).
    this.bootstrapSubIds = [
      ensure('ltp', () => this.subscribeLtp(symbols)),
      ensure('bestBidAsk', () => this.subscribeBestBidAsk(symbols)),
      ensure('quotes', () => this.subscribeQuotes(symbols)),
      ensure('ttv', () => this.subscribeTtv(symbols)),
      ...(this.depthSubscribeAllowed
        ? [ensure('depth', () => this.subscribeDepth(symbols))]
        : []),
    ].filter((id) => id >= 0)
  }

  private findSubscriptionId(kind: SubscriptionPayload['kind'], symbols: string[]): number | undefined {
    const symKey = symbols.join('|')
    for (const [id, payload] of this.activeSubs.entries()) {
      if (payload.kind !== kind) continue
      if (payload.symbols.join('|') === symKey) return id
    }
    return undefined
  }

  /**
   * Re-send subscribe-only frames for every active subscription (Tradesea resubscribeAll).
   * Keeps registry across suspend; does not wire-unsub on a fresh upstream socket.
   */
  private resubscribeAll(): void {
    const payloads = [...this.activeSubs.values()]
    if (payloads.length) {
      for (const payload of payloads) {
        this.sendWire(payload, true)
      }
      this.logWs('Resubscribed', { streams: payloads.length })
      this.emit('resubscribed', undefined as MdsEventMap['resubscribed'])
      return
    }

    const bootstrapSymbols = this.bootstrap?.symbols?.filter(Boolean) ?? []
    if (bootstrapSymbols.length) {
      this.applyBootstrap(false)
      this.logWs('Resubscribed', { streams: this.activeSubs.size })
      this.emit('resubscribed', undefined as MdsEventMap['resubscribed'])
      return
    }

    const fallbackSymbols = [
      resolveMdsSubscribeTicker(DEFAULT_PRACTICE_CHART_SYMBOL, this.marketDepthEntitled),
    ]
    this.setBootstrap({ symbols: fallbackSymbols, resolution: this.bootstrap?.resolution || '1' })
    this.applyBootstrap(false)
    this.logWs('Resubscribed', { streams: this.activeSubs.size, defaultSymbol: fallbackSymbols[0] })
    this.emit('resubscribed', undefined as MdsEventMap['resubscribed'])
  }

  private sendWire(payload: SubscriptionPayload, subscribe: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const frame = subscribe ? encodeMdsSubscribe(payload) : encodeMdsUnsubscribe(payload)
    this.ws.send(JSON.stringify(frame))
  }

  private addSubscription(payload: SubscriptionPayload): number {
    const id = ++this.subscriptionId
    this.activeSubs.set(id, payload)
    this.sendWire(payload, true)
    return id
  }

  unsubscribe(id: number): void {
    const payload = this.activeSubs.get(id)
    if (!payload) return
    this.activeSubs.delete(id)
    this.sendWire(payload, false)
  }

  subscribeCandles(symbols: string[], resolutions: string[]): number {
    return this.addSubscription({ kind: 'candles', symbols, resolutions })
  }

  /** Subscribe to last-traded-price ticks for symbols (chart last price, P/L mark). */
  subscribeLtp(symbols: string[], bucket = MDS_BUCKET_LTP): number {
    return this.addSubscription({ kind: 'ltp', symbols, bucket })
  }

  subscribeBestBidAsk(symbols: string[], bucket = MDS_BUCKET_BEST_BID_ASK): number {
    return this.addSubscription({ kind: 'bestBidAsk', symbols, bucket })
  }

  subscribeDepth(symbols: string[], bucket = MDS_BUCKET_MARKET_DEPTH): number {
    if (!this.depthSubscribeAllowed) return -1
    return this.addSubscription({ kind: 'depth', symbols, bucket })
  }

  subscribeQuotes(symbols: string[]): number {
    return this.addSubscription({ kind: 'quotes', symbols })
  }

  subscribeTtv(symbols: string[], bucket = MDS_BUCKET_TTV): number {
    return this.addSubscription({ kind: 'ttv', symbols, bucket })
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  isConnectedOrConnecting(): boolean {
    const state = this.ws?.readyState
    return state === WebSocket.OPEN || state === WebSocket.CONNECTING
  }
}
