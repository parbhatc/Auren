/**
 * Tradesea unified user-data WebSocket.
 * Keepalive: wait for unifiedSnapshot → ping → pong → 3s → repeat.
 */
import { getAuthToken, getWebSocketUrl } from '../../api/api'
import {
  isTradesPing,
  isTradesPong,
  isUnifiedSnapshotMessage,
  parseTradeseaTradesMessage,
  TradeseaTradesWsMessage,
} from './tradeseaTradesMessages'

export type TradeseaTradesListener = (message: TradeseaTradesWsMessage) => void

const PING_INTERVAL_MS = 3000
const PONG_TIMEOUT_MS = 15_000
const SNAPSHOT_WAIT_MS = 30_000

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
  private snapshotReceived = false
  private pongWaiter: ((ok: boolean) => void) | null = null

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

    const url = `${getWebSocketUrl('/tradesea-trades-ws')}?accountId=${encodeURIComponent(accountId)}&token=${encodeURIComponent(token)}`
    const generation = ++this.connectGeneration
    const ws = new WebSocket(url)
    this.ws = ws
    this.snapshotReceived = false
    console.info('[Tradesea Trades WS] Connecting…', {
      accountId: accountId.slice(0, 12) + '…',
    })

    ws.onopen = () => {
      if (this.ws !== ws || generation !== this.connectGeneration) return
      console.info('[Tradesea Trades WS] Connected')
      this.startKeepalive(ws, generation)
    }

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return
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
          if (isUnifiedSnapshotMessage(parsed)) {
            this.snapshotReceived = true
          }
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
        const deadline = Date.now() + SNAPSHOT_WAIT_MS
        while (!this.snapshotReceived && !ac.signal.aborted) {
          if (Date.now() > deadline) {
            console.warn('[TradeseaTradesClient] unifiedSnapshot not received before timeout')
            break
          }
          if (this.ws !== ws || generation !== this.connectGeneration) return
          await sleep(50, ac.signal)
        }

        while (
          !ac.signal.aborted &&
          this.ws === ws &&
          generation === this.connectGeneration &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send('ping')
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
    this.snapshotReceived = false
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
