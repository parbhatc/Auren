import { WebSocketMessage, WebSocketClientOptions, WebSocketStatus, WebSocketClientCallbacks } from '../../types/websocket'

export class WebSocketClientBase {
  protected ws: WebSocket | null = null;
  private url: string;
  private protocols?: string | string[];
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private enableHeartbeat: boolean;
  private pingMessage: string;
  private pongMessage: string;
  private status: WebSocketStatus = 'disconnected';
  private isIOS: boolean;
  // Event callbacks
  private onOpenCallback?: () => void;
  private onCloseCallback?: (event: CloseEvent) => void;
  private onErrorCallback?: (error: Event) => void;
  private onMessageCallback?: (data: WebSocketMessage | string) => void;
  private onStatusChangeCallback?: (status: WebSocketStatus) => void;
  private onMaxReconnectAttemptsReachedCallback?: () => void;
  protected callbacks?: WebSocketClientCallbacks;

  constructor(
    callbacksOrOptions?: WebSocketClientCallbacks | WebSocketClientOptions,
    options?: WebSocketClientOptions
  ) {
    // Handle two different constructor signatures:
    // 1. constructor(options) - original signature
    // 2. constructor(callbacks, options) - new signature used by child classes
    let callbacks: WebSocketClientCallbacks | undefined;
    let opts: WebSocketClientOptions;

    if (options !== undefined) {
      // Second signature: constructor(callbacks, options)
      callbacks = callbacksOrOptions as WebSocketClientCallbacks;
      opts = options;
    } else {
      // First signature: constructor(options)
      opts = callbacksOrOptions as WebSocketClientOptions;
    }

    this.callbacks = callbacks;
    this.url = opts.url;
    this.protocols = opts.protocols;
    this.reconnectInterval = opts.reconnectInterval || 3000;
    this.maxReconnectAttempts = opts.maxReconnectAttempts || 5;
    this.enableHeartbeat = opts.enableHeartbeat !== false;
    this.pingMessage = opts.pingMessage || 'ping';
    this.pongMessage = opts.pongMessage || 'pong';
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Set callbacks if provided
    if (callbacks) {
      if (callbacks.onConnected) this.onOpen(callbacks.onConnected);
      if (callbacks.onDisconnected) this.onClose(() => callbacks!.onDisconnected!());
      if (callbacks.onMessage) this.onMessage(callbacks.onMessage);
      if (callbacks.onError) this.onError(callbacks.onError);
      if (callbacks.onStatusChange) this.onStatusChange(callbacks.onStatusChange);
      if (callbacks.onMaxReconnectAttemptsReached) this.onMaxReconnectAttemptsReached(callbacks.onMaxReconnectAttemptsReached);
    }
  }

  async testConnection(url: string): Promise<boolean> {
    try {
      let response = await fetch(url);
      let data = await response.json();

      console.log('[WebSocket Client] Connection test successful:', data);
      return true;
    } catch (error) {
        console.error('[WebSocket Client] Connection test failed:', error);
      return false;
    }
    
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.warn('[WebSocket Client] Already connected');
        return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.warn('[WebSocket Client] Connection already in progress');
        return;
    }

    this.setStatus('connecting');
    
    if (this.isIOS) {
        this.createConnection();
        this.testConnection(this.getHttpUrlFromWsUrl(this.url) + "/health_ios");

        setTimeout(() => {
            if(this.ws && this.ws.readyState !== WebSocket.OPEN){
              this.disconnect();
              this.attemptReconnect(true);
            }
        }, this.reconnectInterval);
    } else {
        this.createConnection();
    }
  }

  createConnection(): void {
    try {
      this.ws = new WebSocket(this.url, this.protocols);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket Client] Connection error:', error);
      this.setStatus('error');
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      const readyState = this.ws.readyState;
      
      // Only close if WebSocket is OPEN
      // If CONNECTING, just set to null and let it fail naturally to avoid errors
      if (readyState === WebSocket.OPEN) {
        try {
          this.ws.close(1000, 'Client disconnect');
        } catch (error) {
          // Ignore errors if WebSocket is already closing/closed
          console.warn('[WebSocket Client] Error during disconnect:', error);
        }
      } else if (readyState === WebSocket.CONNECTING) {
        // If still connecting, remove error handler to prevent error logs
        // and set to null - the connection will fail naturally
        this.ws.onerror = null;
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onmessage = null;
      }
      // For CLOSING or CLOSED states, just set to null
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage | string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket Client] Cannot send message: not connected');
      return;
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(data);
    } catch (error) {
      console.error('[WebSocket Client] Error sending message:', error);
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket Client] Connected');
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();

      if (this.enableHeartbeat) {
        this.startHeartbeat();
      }

      if (this.onOpenCallback) {
        this.onOpenCallback();
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log('[WebSocket Client] Disconnected', event.code, event.reason);
      this.stopHeartbeat();
      this.ws = null;

      // Only attempt reconnect if it wasn't a manual disconnect
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.setStatus('reconnecting');
        this.attemptReconnect();
      } else {
        this.setStatus('disconnected');
        
        // If max reconnect attempts reached, notify callback
        if (event.code !== 1000 && this.reconnectAttempts >= this.maxReconnectAttempts) {
          if (this.onMaxReconnectAttemptsReachedCallback) {
            this.onMaxReconnectAttemptsReachedCallback();
          }
        }
      }

      if (this.onCloseCallback) {
        this.onCloseCallback(event);
      }
    };

    this.ws.onerror = (error: Event) => {
      console.error('[WebSocket Client] Error:', error);
      this.setStatus('error');

      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };
  }

  /**
   * Handle incoming WebSocket message
   * Can be overridden by child classes to add custom message handling
   * @param event - MessageEvent from WebSocket
   */
  protected handleMessage(event: MessageEvent): void {
    try {
      let data: WebSocketMessage | string;

      // Try to parse as JSON
      try {
        data = JSON.parse(event.data);
      } catch {
        // If not JSON, treat as string
        data = event.data.toString();
      }

      // Handle heartbeat: server sends ServerTime (ping), client responds with ClientTime (pong)
      if (this.enableHeartbeat && this.isPingMessage(data)) {
        // Server sent ping (ServerTime), respond with pong (ClientTime)
        this.send({
          type: this.pongMessage,
          timestamp: Date.now()
        });
        return;
      }

      // Handle heartbeat pong (if client was sending pings, which we don't do anymore)
      if (this.enableHeartbeat && this.isPongMessage(data)) {
        // Pong received, connection is alive
        return;
      }

      // Handle "connected" message type
      if (typeof data === 'object' && data !== null && data.type === 'connected') {
        this.handleConnectedMessage(data as { type: string; message: string; timestamp: string });
        return;
      }

      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    } catch (error) {
      console.error('[WebSocket Client] Error processing message:', error);
    }
  }

  /**
   * Handle "connected" message from server
   * Can be overridden by child classes to add custom handling
   * @param data - Parsed message data with type, message, and timestamp
   */
  protected handleConnectedMessage(data: { type: string; message: string; timestamp: string }): void {
    console.log('[WebSocket Client] Connected message received:', data.message);
    
    if (this.callbacks?.onConnectedMessage) {
      this.callbacks.onConnectedMessage(data);
    }
  }


  /**
   * Attempt to reconnect
   */
  private attemptReconnect(instant = false): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket Client] Max reconnect attempts reached');
      this.setStatus('disconnected');
      
      // Notify callback that max reconnect attempts have been reached
      if (this.onMaxReconnectAttemptsReachedCallback) {
        this.onMaxReconnectAttemptsReachedCallback();
      }
      return;
    }
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket Client] Attempting reconnect... ' + this.reconnectAttempts + ' of ' + this.maxReconnectAttempts);
      this.connect();
    }, instant ? 0 : this.reconnectInterval);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start heartbeat mechanism
   * Note: The client doesn't send periodic ping messages.
   * Instead, it responds to server's ServerTime messages with ClientTime messages.
   * This method is kept for compatibility but doesn't send periodic messages.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    // Heartbeat is handled by responding to server's ServerTime messages
    // No need to send periodic ping messages from client
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Check if message is a ping/heartbeat request from server
   */
  private isPingMessage(data: WebSocketMessage | string): boolean {
    if (typeof data === 'string') {
      return data.toLowerCase() === this.pingMessage.toLowerCase();
    }
    if (typeof data === 'object' && data !== null) {
      return data.type === this.pingMessage;
    }
    return false;
  }

  /**
   * Check if message is a pong/heartbeat response
   */
  private isPongMessage(data: WebSocketMessage | string): boolean {
    if (typeof data === 'string') {
      return data.toLowerCase() === this.pongMessage.toLowerCase();
    }
    if (typeof data === 'object' && data !== null) {
      return data.type === this.pongMessage ||
             data.message === this.pongMessage ||
             data.pong === true;
    }
    return false;
  }

  /**
   * Set status and notify callback
   */
  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(status);
      }
    }
  }

  // Event handler setters
  onOpen(callback: () => void): void {
    this.onOpenCallback = callback;
  }

  onClose(callback: (event: CloseEvent) => void): void {
    this.onCloseCallback = callback;
  }

  onError(callback: (error: Event) => void): void {
    this.onErrorCallback = callback;
  }

  onMessage(callback: (data: WebSocketMessage | string) => void): void {
    this.onMessageCallback = callback;
  }

  onStatusChange(callback: (status: WebSocketStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  onMaxReconnectAttemptsReached(callback: () => void): void {
    this.onMaxReconnectAttemptsReachedCallback = callback;
  }

  /**
   * Set multiple callbacks at once
   * @param callbacks - Object containing callback functions
   */
  setCallbacks(callbacks: WebSocketClientCallbacks): void {
    if (callbacks.onConnected) this.onOpen(callbacks.onConnected);
    if (callbacks.onDisconnected) this.onClose(() => callbacks.onDisconnected!());
    if (callbacks.onMessage) this.onMessage(callbacks.onMessage);
    if (callbacks.onError) this.onError(callbacks.onError);
    if (callbacks.onStatusChange) this.onStatusChange(callbacks.onStatusChange);
    if (callbacks.onMaxReconnectAttemptsReached) this.onMaxReconnectAttemptsReached(callbacks.onMaxReconnectAttemptsReached);
    // Update callbacks property to keep it in sync
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private getHttpUrlFromWsUrl(wsUrl: string): string {
    try {
      const url = new URL(wsUrl)
      const protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
      return `${protocol}//${url.host}`
    } catch {
      const location = window.location
      const protocol = location.protocol
      return `${protocol}//${location.host}`
    }
  }
}

export default WebSocketClientBase;

