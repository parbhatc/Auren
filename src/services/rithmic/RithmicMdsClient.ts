/**
 * Rithmic market-data WebSocket client (proxied via /rithmic-mds-ws).
 */
import { getAuthToken, getWebSocketUrl } from '../../api/api'
import {
  readMdsAutoReconnect,
  readMdsReconnectOnLimit,
  writeMdsAutoReconnect,
  writeMdsReconnectOnLimit,
} from '../tradesea/mdsReconnectPrefs'
import type { MdsConnectionState } from '../tradesea/TradeseaMdsClient'
import {
  parseChartSymbol,
  type RithmicMdsLatestClosePayload,
  type RithmicMdsLatestHighLowPayload,
  type RithmicMdsQuotePayload,
  type RithmicMdsUpdatePayload,
} from './rithmicMdsFormat'

export type { MdsConnectionState }
export type {
  RithmicMdsLatestClosePayload,
  RithmicMdsLatestHighLowPayload,
  RithmicMdsQuotePayload,
  RithmicMdsUpdatePayload,
}

export type RithmicMdsBarMessage = {
  type: 'bar'
  symbol: string
  resolution: string
  time: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export type RithmicMdsQuoteMessage = {
  type: 'quote'
} & RithmicMdsQuotePayload

export type RithmicMdsUpdateMessage = {
  type: 'update'
} & RithmicMdsUpdatePayload

export type RithmicMdsLatestHighLowMessage = {
  type: 'latest_high_low'
} & RithmicMdsLatestHighLowPayload

export type RithmicMdsLatestCloseMessage = {
  type: 'latest_close'
} & RithmicMdsLatestClosePayload

export type RithmicMdsWireMessage =
  | RithmicMdsBarMessage
  | RithmicMdsQuoteMessage
  | RithmicMdsUpdateMessage
  | RithmicMdsLatestHighLowMessage
  | RithmicMdsLatestCloseMessage
  | {
      type: 'subscribed' | 'unsubscribed' | 'pong' | 'error'
      symbol?: string
      resolution?: string
      message?: string
    }

type RithmicMdsEventMap = {
  bar: RithmicMdsBarMessage
  quote: RithmicMdsQuotePayload
  update: RithmicMdsUpdatePayload
  latest_high_low: RithmicMdsLatestHighLowPayload
  latest_close: RithmicMdsLatestClosePayload
  open: void
  close: { code: number; reason: string }
  error: Error
  connection: MdsConnectionState
  autoReconnect: boolean
  reconnectOnLimit: boolean
}

export type RithmicMdsBootstrap = {
  /** Chart label, e.g. CME:NQ */
  chartSymbol: string
  resolution: string
}

const RECONNECT_DELAY_MS = 3_000

export class RithmicMdsClient {
  private ws: WebSocket | null = null
  private accountId = ''
  private bootstrap: RithmicMdsBootstrap | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectionState: MdsConnectionState = 'disconnected'
  private autoReconnectEnabled = readMdsAutoReconnect()
  private reconnectOnLimitEnabled = readMdsReconnectOnLimit()
  private lastSentSubscribeKey = ''
  private listeners: {
    [K in keyof RithmicMdsEventMap]?: Set<(payload: RithmicMdsEventMap[K]) => void>
  } = {}

  getConnectionState(): MdsConnectionState {
    if (!this.ws) {
      return this.connectionState === 'connecting' ? 'connecting' : 'disconnected'
    }
    if (this.ws.readyState === WebSocket.OPEN) return 'connected'
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting'
    return 'disconnected'
  }

  isAutoReconnectEnabled(): boolean {
    return this.autoReconnectEnabled
  }

  setAutoReconnectEnabled(enabled: boolean): void {
    if (this.autoReconnectEnabled === enabled) return
    this.autoReconnectEnabled = enabled
    writeMdsAutoReconnect(enabled)
    if (!enabled) this.clearReconnectTimer()
    this.emit('autoReconnect', enabled)
  }

  isReconnectOnLimitEnabled(): boolean {
    return this.reconnectOnLimitEnabled
  }

  setReconnectOnLimitEnabled(enabled: boolean): void {
    if (this.reconnectOnLimitEnabled === enabled) return
    this.reconnectOnLimitEnabled = enabled
    writeMdsReconnectOnLimit(enabled)
    this.emit('reconnectOnLimit', enabled)
  }

  connect(accountId: string, bootstrap?: RithmicMdsBootstrap | null): void {
    if (bootstrap !== undefined) {
      this.bootstrap = bootstrap
    }

    if (
      this.ws &&
      this.accountId === accountId &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.flushBootstrapSubscribe()
      }
      return
    }

    this.clearReconnectTimer()
    this.detachSocket()
    this.accountId = accountId
    this.setConnectionState('connecting')

    const token = getAuthToken()
    if (!token) {
      this.emit('error', new Error('Not authenticated'))
      this.setConnectionState('disconnected')
      return
    }

    const url =
      `${getWebSocketUrl('/rithmic-mds-ws')}` +
      `?accountId=${encodeURIComponent(accountId)}` +
      `&token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return
      this.startPing(ws)
      // Stay connecting until server acks live Rithmic subscription (ChartSession can take a few seconds).
      this.setConnectionState('connecting')
      this.emit('open', undefined as RithmicMdsEventMap['open'])
      this.flushBootstrapSubscribe()
    }

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return
      const text = typeof ev.data === 'string' ? ev.data : ''
      if (!text || text === 'pong') return
      try {
        const msg = JSON.parse(text) as RithmicMdsWireMessage
        this.dispatch(msg)
      } catch {
        /* ignore */
      }
    }

    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.clearPing()
      this.ws = null
      this.lastSentSubscribeKey = ''
      this.setConnectionState('disconnected')
      this.emit('close', { code: ev.code, reason: String(ev.reason || '') })
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      if (this.ws !== ws) return
      this.emit('error', new Error('Rithmic MDS WebSocket error'))
    }
  }

  /** @param chartSymbol e.g. CME:NQ or NQ */
  subscribe(chartSymbol: string, resolution = '1'): void {
    const { chartSymbol: sym } = parseChartSymbol(chartSymbol)
    this.bootstrap = { chartSymbol: sym, resolution }
    this.flushBootstrapSubscribe()
  }

  private flushBootstrapSubscribe(): void {
    if (!this.bootstrap || !this.isConnected()) return
    const { chartSymbol, resolution } = this.bootstrap
    const key = `${chartSymbol}|${resolution}`
    if (key === this.lastSentSubscribeKey) return
    if (!this.sendSubscribe(chartSymbol, resolution)) return
    this.lastSentSubscribeKey = key
  }

  unsubscribe(): void {
    this.lastSentSubscribeKey = ''
    this.send({ type: 'unsubscribe' })
  }

  reconnect(): void {
    const accountId = this.accountId
    const bootstrap = this.bootstrap
    this.clearReconnectTimer()
    this.detachSocket()
    if (accountId) {
      this.connect(accountId, bootstrap)
    }
  }

  disconnect(): void {
    this.clearReconnectTimer()
    this.detachSocket()
    this.setConnectionState('disconnected')
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  isConnectedOrConnecting(): boolean {
    const state = this.ws?.readyState
    return state === WebSocket.OPEN || state === WebSocket.CONNECTING
  }

  on<K extends keyof RithmicMdsEventMap>(
    event: K,
    handler: (payload: RithmicMdsEventMap[K]) => void
  ): () => void {
    let set = this.listeners[event] as Set<(payload: RithmicMdsEventMap[K]) => void> | undefined
    if (!set) {
      set = new Set()
      this.listeners[event] = set as (typeof this.listeners)[K]
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnectEnabled || !this.accountId) return
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.isConnectedOrConnecting() || !this.accountId) return
      this.connect(this.accountId, this.bootstrap)
    }, RECONNECT_DELAY_MS)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private detachSocket(): void {
    this.clearPing()
    const ws = this.ws
    this.ws = null
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try {
        ws.close(1000, 'client disconnect')
      } catch {
        /* ignore */
      }
    }
  }

  private dispatch(msg: RithmicMdsWireMessage): void {
    switch (msg.type) {
      case 'bar':
        this.emit('bar', msg as RithmicMdsBarMessage)
        break
      case 'quote': {
        const { type: _t, ...quote } = msg as RithmicMdsQuoteMessage
        this.emit('quote', quote)
        break
      }
      case 'update': {
        const { type: _t, ...update } = msg as RithmicMdsUpdateMessage
        this.emit('update', update)
        break
      }
      case 'latest_high_low': {
        const { type: _t, ...row } = msg as RithmicMdsLatestHighLowMessage
        this.emit('latest_high_low', row)
        break
      }
      case 'latest_close': {
        const { type: _t, ...row } = msg as RithmicMdsLatestCloseMessage
        this.emit('latest_close', row)
        break
      }
      case 'error':
        this.lastSentSubscribeKey = ''
        console.warn('[RithmicMdsClient]', (msg as { message?: string }).message || 'error')
        this.setConnectionState('disconnected')
        if (this.bootstrap && this.isConnected()) {
          setTimeout(() => this.flushBootstrapSubscribe(), 500)
        }
        break
      case 'subscribed':
        this.setConnectionState('connected')
        break
      default:
        break
    }
  }

  private send(payload: object): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  private sendSubscribe(chartSymbol: string, resolution: string): boolean {
    return this.send({
      type: 'subscribe',
      symbol: chartSymbol,
      resolution,
    })
  }

  private startPing(ws: WebSocket): void {
    this.clearPing()
    this.pingTimer = setInterval(() => {
      if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return
      this.send({ type: 'ping' })
    }, 25_000)
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private setConnectionState(state: MdsConnectionState): void {
    if (this.connectionState === state) return
    this.connectionState = state
    this.emit('connection', state)
  }

  private emit<K extends keyof RithmicMdsEventMap>(event: K, payload: RithmicMdsEventMap[K]): void {
    this.listeners[event]?.forEach((fn) => {
      try {
        fn(payload)
      } catch (err) {
        console.warn('[RithmicMdsClient] listener error:', err)
      }
    })
  }
}
