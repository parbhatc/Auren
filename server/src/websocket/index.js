/**
 * WebSocket Module Exports
 * Makes WebSocket classes globally accessible
 * 
 * Usage:
 *   import { WebSocketBase } from './websocket'
 *   import { WebSocketManager, webSocketManager } from './websocket'
 */

export { default as WebSocketBase } from './WebSocketBase.js'
export { default as WebSocketManager } from './WebSocketManager.js'
export { default as SignalRBase } from './SignalRBase.js'
// Export singleton instances
export { default as webSocketManager } from './WebSocketManager.js'

