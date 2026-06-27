/**
 * WebSocket Types
 */

/**
 * Options for WebSocket Forwarder Client
 */
export interface WebSocketForwarderOptions {
  /** Target WebSocket URL (e.g., 'wss://md-demo.tradovateapi.com/v1/websocket?r=0.5967910167584555') */
  targetUrl: string
  /** Optional Origin header (e.g., 'https://trader.tradovate.com'). If not provided, will be auto-derived from targetUrl */
  origin?: string
  /** Backend forwarder URL (default: 'wss://localhost:3001/forwarder') */
  forwarderUrl?: string
  /** WebSocket protocol(s) */
  protocols?: string | string[]
}

/**
 * WebSocket Base Client Interfaces
 */
export interface WebSocketMessage {
  type?: string
  [key: string]: any
}

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface WebSocketClientOptions {
  url: string
  protocols?: string | string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
  enableHeartbeat?: boolean
  pingMessage?: string
  pongMessage?: string
}

export interface WebSocketClientCallbacks {
  onConnected?: () => void
  onDisconnected?: () => void
  onMessage?: (message: any) => void
  onError?: (error: Event) => void
  onStatusChange?: (status: WebSocketStatus) => void
  onConnectedMessage?: (data: { type: string; message: string; timestamp: string }) => void
  onMaxReconnectAttemptsReached?: () => void
}

/**
 * SignalR Base Interfaces
 */
export interface SignalRBaseOptions {
  authMethod?: 'query' | 'header' | 'none'
  authParamName?: string
  transport?: any // signalR.HttpTransportType
  skipNegotiation?: boolean
  logLevel?: any // signalR.LogLevel
  reconnectConfig?: {
    nextRetryDelayInMilliseconds: (retryContext: any) => number | null
  }
  connectionTimeout?: number // Timeout in milliseconds (default: 10000ms = 10 seconds)
}

export interface SignalRCallbacks {
  onConnected?: (connectionId: string) => void
  onDisconnected?: (error?: Error) => void
  onError?: (error: Error) => void
  onMessage?: (message: any) => void
}

