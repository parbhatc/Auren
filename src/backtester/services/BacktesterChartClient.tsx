import { BacktesterChartClientCallbacks, BacktesterChartClientOptions, BacktestSession } from '../../types/backtester'
import { WebSocketClientBase } from '../../services/websocket/WebSocketClientBase'
import { WebSocketClientCallbacks } from '../../types/websocket'
import { getWebSocketUrl } from '../../api/api'

/**
 * Backtester Chart WebSocket Client
 * Handles WebSocket connection and communication for backtester chart
 * Extends WebSocketClientBase for common WebSocket functionality
 */
export class BacktesterChartClient extends WebSocketClientBase {
  private session: BacktestSession | null
  private chartReady: boolean = false
  private sessionReady: boolean = false
  private chart: any = null // Reference to BacktesterChart component instance

  constructor(
    callbacks: BacktesterChartClientCallbacks = {},
    options: BacktesterChartClientOptions
  ) {
    const wsUrl = BacktesterChartClient.buildWebSocketUrl()
    
    super(callbacks as WebSocketClientCallbacks, {
      url: wsUrl,
      reconnectInterval: 2000, // 2 seconds for Safari
      enableHeartbeat: true,
      pingMessage: 'ServerTime',
      pongMessage: 'ClientTime'
    })

    this.session = options.session
  }

  /**
   * Get session data
   */
  getSession(): BacktestSession | null {
    return this.session
  }

  /**
   * Update session data
   */
  updateSession(session: BacktestSession | null): void {
    this.session = session
  }

  /**
   * Build WebSocket URL
   * Uses the API base URL to construct WebSocket URL consistently
   */
  private static buildWebSocketUrl(): string {
    const token = localStorage.getItem('token')
    const wsUrl = getWebSocketUrl('/backtester-ws')
    return `${wsUrl}${token ? `?token=${token}` : ''}`
  }

  /**
   * Override buildWebSocketUrl to use the static method
   */
  protected buildWebSocketUrl(): string {
    return BacktesterChartClient.buildWebSocketUrl()
  }

  /**
   * Override connect to add backtester-specific logging
   */
  async connect(): Promise<void> {
    this.chartReady = false
    this.sessionReady = false
    await super.connect()
  }

  disconnect(): void {
    this.chartReady = false
    this.sessionReady = false
    super.disconnect()
  }

  protected handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)
      if (this.handleCustomMessage(data)) {
        return
      }
      super.handleMessage(event)
    } catch (error) {
      super.handleMessage(event)
    }
  }

  /**
   * Handle custom message types specific to backtester
   * Override this method to add new message type handlers
   * @param data - Parsed message data
   * @returns true if message was handled, false to let base class handle it
   */
  private datafeed: any = null

  setDatafeed(datafeed: any): void {
    this.datafeed = datafeed
  }

  protected handleCustomMessage(data: any): boolean {
    switch (data.type) {
      case 'realtimeBar':
        if (this.datafeed && typeof this.datafeed.handleRealtimeBar === 'function') {
          this.datafeed.handleRealtimeBar(data)
          return true
        }
        return false
      case 'realtimeBars':
        if (this.datafeed && typeof this.datafeed.handleRealtimeBars === 'function') {
          this.datafeed.handleRealtimeBars(data)
          return true
        }
        return false
      case 'nextCandleAck':
        if (this.datafeed && typeof this.datafeed.handleNextCandleAck === 'function') {
          this.datafeed.handleNextCandleAck(data)
          return true
        }
        return true
      case 'replayResponse':
        {
          const callbacks = this.callbacks as BacktesterChartClientCallbacks
          if (callbacks && typeof callbacks.onReplayResponse === 'function') {
            callbacks.onReplayResponse(data)
            return true
          }
        }
        return false
      case 'date_navigation_response':
        {
          const callbacks = this.callbacks as BacktesterChartClientCallbacks
          if (callbacks && typeof callbacks.onDateNavigationResponse === 'function') {
            callbacks.onDateNavigationResponse(data)
            return true
          }
        }
        return false
      case 'sessionDataAck':
        this.sessionReady = true
        if (this.datafeed && typeof this.datafeed.flushPendingMessages === 'function') {
          this.datafeed.flushPendingMessages()
        }
        {
          const callbacks = this.callbacks as BacktesterChartClientCallbacks
          if (callbacks?.onChartReady) {
            callbacks.onChartReady()
          }
        }
        return true
      default:
        return false
    }
  }

  /**
   * Override handleConnectedMessage to trigger chart display
   * This is called when the server sends a "connected" message
   */
  protected handleConnectedMessage(data: { type: string; message: string; timestamp: string }): void {
    console.log('[Backtester WS Client] Connected message received:', data.message)
    
    // Call the parent implementation first
    super.handleConnectedMessage(data)
    
    this.chartReady = true
    void this.sendSessionData()
  }

  async sendSessionData(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.session) {
      // Load symbols from datafeed if available
      let symbols: Record<string, { tickSize: number; tickValue: number }> | null = null
      if (this.datafeed && typeof this.datafeed.loadSymbols === 'function') {
        try {
          symbols = await this.datafeed.loadSymbols()
        } catch (error) {
          console.error('[BacktesterChartClient] Failed to load symbols:', error)
        }
      }

      this.send({
        type: 'sessionData',
        session: this.session,
        symbols: symbols || {}
      })
    }
  }

  /**
   * True when WS is connected and server session/bar cache is initialized.
   */
  isChartReady(): boolean {
    return this.chartReady && this.sessionReady
  }

  isSessionReady(): boolean {
    return this.sessionReady
  }

  /**
   * Set the BacktesterChart component reference
   * @param chart - BacktesterChart component instance
   */
  setChart(chart: any): void {
    this.chart = chart
  }

  /**
   * Get the BacktesterChart component reference
   * @returns BacktesterChart component instance or null
   */
  getChart(): any {
    return this.chart
  }

  /**
   * Set multiple callbacks at once
   * Overrides base class method to handle BacktesterChartClient-specific callbacks
   * @param callbacks - Object containing callback functions
   */
  setCallbacks(callbacks: BacktesterChartClientCallbacks): void {
    // Set base callbacks
    super.setCallbacks(callbacks as WebSocketClientCallbacks);
    
    // Update the callbacks property with all callbacks (including BacktesterChartClient-specific ones)
    this.callbacks = { ...this.callbacks, ...callbacks } as BacktesterChartClientCallbacks;
  }

}

