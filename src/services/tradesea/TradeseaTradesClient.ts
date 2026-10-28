/**
 * Tradesea unified user-data WebSocket.
 * Keepalive: ping as soon as the socket opens → pong → 3s → repeat.
 */
import { getAuthToken, getWebSocketUrl } from '../../api/api'
import {
  encodeTradesPing,
  isTradesPing,
  isTradesPong,
  parseTradeseaTradesMessage,
  TradeseaTradesWsMessage,
} from './tradeseaTradesMessages'

export type TradeseaTradesListener = (message: TradeseaTradesWsMessage) => void

const PING_INTERVAL_MS = 3000
const PONG_TIMEOUT_MS = 15_000

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export class TradeseaTradesClient {
  private ws: WebSocket | null = null
  private accountId: string | null = null
  private listeners = new Set<TradeseaTradesListener>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = false
  private connectGeneration = 0
  private keepaliveAbort: AbortController | null = null
  private pongWaiter: ((ok: boolean) => void) | null = null
  private static readonly activeClients = new Set<TradeseaTradesClient>()
  private static pageLifecycleBound = false
  private pageHiddenAt: number | null = null
  private lastWireActivityAt = 0
  private connectionStartedAt = 0
  private pageVisibleTimer: ReturnType<typeof setTimeout> | null = null

  private registerPageLifecycle(): void {
    TradeseaTradesClient.activeClients.add(this)
    if (TradeseaTradesClient.pageLifecycleBound || typeof document === 'undefined') return
    TradeseaTradesClient.pageLifecycleBound = true
    const hidden = () => {
      for (const client of TradeseaTradesClient.activeClients) client.pageHiddenAt = Date.now()
    }
    const visible = () => {
      if (document.visibilityState === 'hidden') return
      for (const client of TradeseaTradesClient.activeClients) {
        if (client.pageVisibleTimer) clearTimeout(client.pageVisibleTimer)
        client.pageVisibleTimer = setTimeout(() => {
          client.pageVisibleTimer = null
          client.handleForegroundResume()
        }, 150)
      }
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') hidden()
      else visible()
    })
    window.addEventListener('pagehide', hidden)
    window.addEventListener('pageshow', visible)
    window.addEventListener('focus', visible)
  }

  private handleForegroundResume(): void {
    if (!this.shouldReconnect || !this.accountId || !getAuthToken()) return
    const now = Date.now()
    const hiddenMs = this.pageHiddenAt == null ? 0 : now - this.pageHiddenAt
    this.pageHiddenAt = null
    const longBackground = hiddenMs >= 30_000
    const staleWire = this.lastWireActivityAt > 0 && now - this.lastWireActivityAt >= 25_000
    const staleConnect = this.ws?.readyState === WebSocket.CONNECTING && now - this.connectionStartedAt >= 30_000
    if (!longBackground && !staleWire && !staleConnect && this.ws
      && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const accountId = this.accountId
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    // Safari can leave a dead socket OPEN after suspension. Retire it even
    // when readyState would otherwise make connect(accountId) a no-op.
    this.connectGeneration += 1
    this.detachSocket()
    this.connect(accountId)
  }

  onMessage(listener: TradeseaTradesListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  connect(accountId: string): void {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    if (this.ws && this.accountId === accountId && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    if (this.ws && this.accountId === accountId && this.ws.readyState === WebSocket.CONNECTING) {
      return
    }

    this.detachSocket()
    this.shouldReconnect = true
    this.accountId = accountId
    this.connectionStartedAt = Date.now()
    this.registerPageLifecycle()

    const url = `${getWebSocketUrl('/tradesea-trades-ws')}?accountId=${encodeURIComponent(accountId)}&token=${encodeURIComponent(token)}`
    const generation = ++this.connectGeneration
    const ws = new WebSocket(url)
    this.ws = ws
    console.info('[Tradesea Trades WS] Connecting…', {
      accountId: accountId.slice(0, 12) + '…',
    })

    ws.onopen = () => {
      if (this.ws !== ws || generation !== this.connectGeneration) return
      this.lastWireActivityAt = Date.now()
      console.info('[Tradesea Trades WS] Connected')
      this.startKeepalive(ws, generation)
    }

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return
      this.lastWireActivityAt = Date.now()
      const text = typeof ev.data === 'string' ? ev.data.trim() : ''
      if (!text) return

      if (isTradesPong(text)) {
        this.resolvePongWaiter(true)
        return
      }

      if (isTradesPing(text)) return

      try {
        const parsed = parseTradeseaTradesMessage(JSON.parse(text))
        if (parsed) {
          this.listeners.forEach((fn) => fn(parsed))
        }
      } catch {
        /* ignore non-JSON */
      }
    }

    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.stopKeepalive()
      this.ws = null
      console.info('[Tradesea Trades WS] Disconnected', {
        code: ev.code,
        reason: ev.reason || '(none)',
      })
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      if (this.ws !== ws) return
      this.stopKeepalive()
    }
  }

  private resolvePongWaiter(ok: boolean): void {
    if (!this.pongWaiter) return
    const done = this.pongWaiter
    this.pongWaiter = null
    done(ok)
  }

  private waitForPong(signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false)
        return
      }

      const timer = setTimeout(() => {
        if (this.pongWaiter) {
          this.pongWaiter = null
          resolve(false)
        }
      }, PONG_TIMEOUT_MS)

      const onAbort = () => {
        clearTimeout(timer)
        if (this.pongWaiter) {
          this.pongWaiter = null
          resolve(false)
        }
      }

      signal.addEventListener('abort', onAbort, { once: true })
      this.pongWaiter = (ok) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve(ok)
      }
    })
  }

  private startKeepalive(ws: WebSocket, generation: number): void {
    this.stopKeepalive()
    const ac = new AbortController()
    this.keepaliveAbort = ac

    void (async () => {
      try {
        while (
          !ac.signal.aborted &&
          this.ws === ws &&
          generation === this.connectGeneration &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(encodeTradesPing())
          const gotPong = await this.waitForPong(ac.signal)
          if (!gotPong || ac.signal.aborted) {
            break
          }
          await sleep(PING_INTERVAL_MS, ac.signal)
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('[TradeseaTradesClient] keepalive stopped:', err)
        }
      }
    })()
  }

  private stopKeepalive(): void {
    this.keepaliveAbort?.abort()
    this.keepaliveAbort = null
    this.resolvePongWaiter(false)
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || !this.accountId) return
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.shouldReconnect || !this.accountId) return
      try {
        this.connect(this.accountId)
      } catch {
        this.scheduleReconnect()
      }
    }, 3000)
  }

  private detachSocket(): void {
    this.stopKeepalive()
    const ws = this.ws
    this.ws = null
    if (!ws) return
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }

  disconnect(clearReconnect = true): void {
    TradeseaTradesClient.activeClients.delete(this)
    if (this.pageVisibleTimer) clearTimeout(this.pageVisibleTimer)
    this.pageVisibleTimer = null
    this.pageHiddenAt = null
    this.lastWireActivityAt = 0
    if (clearReconnect) {
      this.shouldReconnect = false
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.connectGeneration += 1
    if (this.ws) {
      console.info('[Tradesea Trades WS] Disconnected (client disconnect)')
    }
    this.detachSocket()
    if (clearReconnect) {
      this.accountId = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
