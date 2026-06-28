import { WebSocketClientBase } from '../../services/websocket/WebSocketClientBase'
import { WebSocketClientCallbacks } from '../../types/websocket'
import { getWebSocketUrl } from '../../api/api'
import { BacktesterDataClientCallbacks, BacktesterDataClientOptions } from '../../types/backtesterDataManagement'

// Re-export for backward compatibility
export type { BacktesterDataClientCallbacks, BacktesterDataClientOptions }

/**
 * Backtester Data Management WebSocket Client
 * Handles WebSocket connection and communication for backtester data management
 * Extends WebSocketClientBase for common WebSocket functionality
 */
export class BacktesterDataClient extends WebSocketClientBase {
  constructor(
    callbacks: BacktesterDataClientCallbacks = {},
    _options: BacktesterDataClientOptions = {}
  ) {
    const wsUrl = BacktesterDataClient.buildWebSocketUrl()
    
    super(callbacks as WebSocketClientCallbacks, {
      url: wsUrl,
      reconnectInterval: 2000, // 2 seconds for Safari
      enableHeartbeat: true,
      pingMessage: 'ServerTime',
      pongMessage: 'ClientTime'
    })
  }

  /**
   * Build WebSocket URL
   * Uses the API base URL to construct WebSocket URL consistently
   */
  private static buildWebSocketUrl(): string {
    const token = localStorage.getItem('token')
    const wsUrl = getWebSocketUrl('/backtester/data-management-ws')
    return `${wsUrl}${token ? `?token=${token}` : ''}`
  }

  /**
   * Override buildWebSocketUrl to use the static method
   */
  protected buildWebSocketUrl(): string {
    return BacktesterDataClient.buildWebSocketUrl()
  }

  /**
   * Override connect to add data management-specific logging
   */
  async connect(): Promise<void> {
    await super.connect()
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
   * Handle custom message types specific to backtester data management
   * Override this method to add new message type handlers
   * @param data - Parsed message data
   * @returns true if message was handled, false to let base class handle it
   */
  protected handleCustomMessage(data: any): boolean {
    const callbacks = this.callbacks as BacktesterDataClientCallbacks
    switch (data.type) {
      case 'tab_change_response':
        if (callbacks.onTabChangeResponse) {
          callbacks.onTabChangeResponse(data)
          return true
        }
        return false
      case 'search_response':
        if (callbacks.onSearchResponse) {
          callbacks.onSearchResponse(data)
          return true
        }
        return false
      case 'initial_data':
        if (callbacks.onInitialData) {
          callbacks.onInitialData(data)
          return true
        }
        return false
      case 'save_token_response':
        if (callbacks.onSaveTokenResponse) {
          callbacks.onSaveTokenResponse(data)
          return true
        }
        return false
      case 'user_login_response':
        if (callbacks.onUserLoginResponse) {
          callbacks.onUserLoginResponse(data)
          return true
        }
        return false
      case 'download_response':
        if (callbacks.onDownloadResponse) {
          callbacks.onDownloadResponse(data)
          return true
        }
        return false
      case 'update_response':
        if (callbacks.onUpdateResponse) {
          callbacks.onUpdateResponse(data)
          return true
        }
        return false
      case 'overwrite_response':
        if (callbacks.onOverwriteResponse) {
          callbacks.onOverwriteResponse(data)
          return true
        }
        return false
      case 'reset_response':
        if (callbacks.onResetResponse) {
          callbacks.onResetResponse(data)
          return true
        }
        return false
      case 'progress':
        if (callbacks.onProgressResponse) {
          callbacks.onProgressResponse(data)
          return true
        }
        return false
      default:
        return false
    }
  }

  /**
   * Send tab change message
   * @param tab - The tab to change to
   */
  sendTabChange(tab: 'symbol-info' | 'csv-data'): void {
    this.send({
      type: 'tab_change',
      tab: tab === 'csv-data' ? 'symbol-info' : tab,
    })
  }

  /**
   * Send search message
   * @param search - The search query
   * @param token - Optional token to include in search
   */
  sendSearch(search: string, token?: string): void {
    this.send({
      type: 'search',
      search: search,
      ...(token && { token })
    })
  }

  /**
   * Send save token message
   * @param token - The token to save
   * @param source - The source ('topstep' or 'tradingview')
   */
  sendSaveToken(token: string, source: 'topstep' | 'tradingview'): void {
    this.send({
      type: 'save-token',
      token: token,
      source: source
    })
  }

  /**
   * Send user login message
   * @param username - The username
   * @param password - The password
   * @param source - The source ('topstep' or 'tradingview')
   */
  sendUserLogin(username: string, password: string, source: 'topstep' | 'tradingview'): void {
    this.send({
      type: 'user_login',
      username: username,
      password: password,
      source: source
    })
  }

  /**
   * Send download message
   * @param storageSymbol - Folder symbol (e.g. NQ)
   * @param source - tradesea or tradingview
   * @param ticker - API ticker (e.g. CME_MINI:NQ1!)
   */
  sendDownload(storageSymbol: string, source: 'tradesea' | 'tradingview', ticker?: string, resolution = '1'): void {
    const serverSource = source === 'tradesea' ? 'topstep' : 'tradingview'
    this.send({
      type: 'download',
      symbol: ticker || storageSymbol,
      storageSymbol,
      source: serverSource,
      resolution,
    })
  }

  /**
   * Send update message
   * @param symbol - The symbol to update
   * @param source - The source ('topstep' or 'tradingview')
   */
  sendUpdate(storageSymbol: string, source: 'tradesea' | 'tradingview', ticker?: string, resolution = '1'): void {
    const serverSource = source === 'tradesea' ? 'topstep' : 'tradingview'
    this.send({
      type: 'update',
      symbol: ticker || storageSymbol,
      storageSymbol,
      source: serverSource,
      resolution,
    })
  }

  sendOverwrite(storageSymbol: string, source: 'tradesea' | 'tradingview', ticker?: string, resolution = '1'): void {
    const serverSource = source === 'tradesea' ? 'topstep' : 'tradingview'
    this.send({
      type: 'overwrite',
      symbol: ticker || storageSymbol,
      storageSymbol,
      source: serverSource,
      resolution,
    })
  }

  /**
   * Send reset message
   * @param symbol - The symbol to reset
   * @param source - The source ('topstep' or 'tradingview')
   */
  sendReset(symbol: string, source: 'topstep' | 'tradingview'): void {
    this.send({
      type: 'reset',
      symbol: symbol,
      source: source
    })
  }
}
