# Server-Side WebSocket Services Documentation

This document provides comprehensive documentation for the **server-side** WebSocket services used in the NexusSyncPro application. The services are built on top of Microsoft SignalR and provide real-time data streaming capabilities.

> **Note**: This is server-side documentation. For frontend usage, see [Frontend TopstepX Guide](./FRONTEND_TOPSTEPX.md).

## Table of Contents

1. [SignalRBase](#signalrbase)
2. [ChartService](#chartservice)
3. [AccountService](#accountservice)
4. [Usage Examples](#usage-examples)
5. [Message Types](#message-types)
6. [Testing](#testing)

---

## SignalRBase

A generic base class for SignalR WebSocket connections that can be used with any SignalR API implementation.

### Location

`server/src/websocket/SignalRBase.js`

### Constructor

```javascript
new SignalRBase(options)
```

**Parameters:**
- `options` (Object, optional):
  - `authMethod` (string, default: `'none'`): Authentication method - `'query'`, `'header'`, or `'none'`
  - `authParamName` (string, optional): Parameter name for authentication (for query or header auth)
  - `transport` (signalR.HttpTransportType, default: `WebSockets`): Transport type
  - `skipNegotiation` (boolean, default: `true`): Skip negotiation for direct WebSocket connection
  - `logLevel` (signalR.LogLevel, default: `Information`): Logging level
  - `reconnectConfig` (Object, optional): Reconnect configuration with custom retry delay function

### Methods

#### `buildConnectionUrl(fullUrl, accessToken)`
Builds the connection URL with optional authentication parameter.

**Parameters:**
- `fullUrl` (string): Full URL including base and hub path (e.g., "https://example.com/hubs/chart")
- `accessToken` (string, optional): Authentication token (if using query auth)

**Returns:** `string` - Full connection URL with optional auth parameter

#### `buildConnectionOptions(accessToken)`
Builds connection options for SignalR.

**Parameters:**
- `accessToken` (string, optional): Authentication token (if using header auth)

**Returns:** `Object` - Connection options object

#### `async connect(fullUrl, accessToken, callbacks)`
Connects to the SignalR hub.

**Parameters:**
- `fullUrl` (string): Full URL including base and hub path
- `accessToken` (string, optional): Authentication token
- `callbacks` (Object, optional): Callback functions:
  - `onConnected(connectionId)`: Called when connection is established
  - `onDisconnected(error)`: Called when connection is lost
  - `onError(error)`: Called when an error occurs
  - `onMessage(message)`: Called when any message is received (generic)

**Returns:** `Promise<signalR.HubConnection>` - The SignalR connection object

#### `async disconnect()`
Disconnects from the SignalR hub.

**Returns:** `Promise<void>`

#### `async invoke(methodName, ...args)`
Invokes a server method.

**Parameters:**
- `methodName` (string): Name of the server method to invoke
- `...args` (any): Arguments to pass to the server method

**Returns:** `Promise<any>` - Result from the server

#### `getState()`
Gets the current connection state.

**Returns:** `signalR.HubConnectionState` - Current connection state

---

## ChartService

Handles SignalR WebSocket connections for real-time chart data from the TopstepX API.

### Location

`server/src/services/topstepx/websocket/ChartService.js`

### Constructor

```javascript
new ChartService(chartBaseURL, options)
```

**Parameters:**
- `chartBaseURL` (string): Base URL for the chart API (e.g., "https://chartapi.topstepx.com")
- `options` (Object, optional):
  - `defaultQuoteSymbols` (Array<Array<string|number>>, optional): Default symbols for SubscribeQuotesForSymbolWithSpeed
    - Format: `[["F.US.EP", 1], ["F.US.ENQ", 1]]`
  - `defaultDomSymbols` (Array<Array<string|number>>, optional): Default symbols for SubscribeDomWithSpeed
    - Format: `[["F.US.MNQ", 1]]`

### Automatic Subscriptions

After connection, ChartService automatically:
1. Sends `GetChartDatasource` invocation
2. If response is "Primary", subscribes to:
   - `SubscribeYoutube`
   - `SubscribeAlerts`
   - `SubscribeHoags`
   - `SubscribeQuotesForSymbolWithSpeed` for each default quote symbol
   - `SubscribeDomWithSpeed` for each default DOM symbol
   - `SubscribeTilt`
3. Starts sending `ServerTime` every 5 seconds

### Methods

#### `async connect(accessToken, callbacks)`
Connects to the SignalR chart hub.

**Parameters:**
- `accessToken` (string): Authentication token
- `callbacks` (Object, optional): Callback functions:
  - `onConnected(connectionId)`: Called when connection is established
  - `onDisconnected(error)`: Called when connection is lost
  - `onError(error)`: Called when an error occurs
  - `onMessage(message)`: Called when any message is received (generic)
  - `onSubscriptionsComplete()`: Called when all automatic subscriptions are complete
  - `onServerTime(serverTime)`: Called when ServerTime response is received
  - `onRealTimeYoutube(data, message)`: Called when RealTimeYoutube message is received
  - `onRealTimeAlerts(data, message)`: Called when RealTimeAlerts message is received
  - `onRealTimeHoags(data, message)`: Called when RealTimeHoags message is received
  - `onRealTimeSymbolQuote(data, message)`: Called when RealTimeSymbolQuote message is received
  - `onRealTimeDom(data, message)`: Called when RealTimeDom message is received
  - `onRealTimeTilt(data, message)`: Called when RealTimeTilt message is received
  - `onRealTimeBar(data, message)`: Called when RealTimeBar message is received

**Returns:** `Promise<signalR.HubConnection>` - The SignalR connection object

#### `async subscribeToQuotes(symbol, speed)`
Subscribe to quotes for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to subscribe to (e.g., "F.US.GCE")
- `speed` (number, default: 1): Speed parameter

**Returns:** `Promise<any>` - Result from the server

#### `async subscribeToDom(symbol, speed)`
Subscribe to DOM (Depth of Market) for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to subscribe to (e.g., "F.US.MNQ")
- `speed` (number, default: 1): Speed parameter

**Returns:** `Promise<any>` - Result from the server

#### `async subscribeToBars(symbol, interval)`
Subscribe to bars for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to subscribe to (e.g., "F.US.GCE")
- `interval` (string|number): Interval parameter (e.g., "15")

**Returns:** `Promise<any>` - Result from the server

#### `async unsubscribeQuote(symbol)`
Unsubscribe from quotes for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to unsubscribe from (e.g., "F.US.GCE")

**Returns:** `Promise<any>` - Result from the server

#### `async unsubscribeDom(symbol)`
Unsubscribe from DOM for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to unsubscribe from (e.g., "F.US.MNQ")

**Returns:** `Promise<any>` - Result from the server

#### `async unsubscribeBars(symbol, interval)`
Unsubscribe from bars for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to unsubscribe from (e.g., "F.US.GCE")
- `interval` (string|number): Interval parameter (e.g., "15")

**Returns:** `Promise<any>` - Result from the server

#### `async getFullQuote(symbol)`
Get full quote for a specific symbol.

**Parameters:**
- `symbol` (string): Symbol to get quote for (e.g., "F.US.GCE")

**Returns:** `Promise<any>` - Result from the server

---

## AccountService

Handles SignalR WebSocket connections for account-related real-time data from the TopstepX API.

### Location

`server/src/services/topstepx/websocket/AccountService.js`

### Constructor

```javascript
new AccountService(accountBaseURL, options)
```

**Parameters:**
- `accountBaseURL` (string): Base URL for the account API (e.g., "https://userapi.topstepx.com")
- `options` (Object, optional):
  - `userId` (number, optional): User ID for subscriptions (must be provided for automatic subscriptions)

### Automatic Subscriptions

After connection, AccountService automatically:
1. If `userId` is provided, subscribes to:
   - `SubscribeSessions(userId)`
   - `SubscribeAccounts(userId)`
   - `SubscribeTradeFollowers()`
   - `SubscribeMarketStatus()`
   - `SubscribeMarketDataSubscriptionChange(userId)`
   - `SubscribeNotifications()`
2. Starts sending `ServerTime` every 5 seconds

### Methods

#### `async connect(accessToken, callbacks)`
Connects to the SignalR account hub.

**Parameters:**
- `accessToken` (string): Authentication token
- `callbacks` (Object, optional): Callback functions:
  - `onConnected(connectionId)`: Called when connection is established
  - `onDisconnected(error)`: Called when connection is lost
  - `onError(error)`: Called when an error occurs
  - `onMessage(message)`: Called when any message is received (generic)
  - `onSubscriptionsComplete()`: Called when all automatic subscriptions are complete
  - `onServerTime(serverTime)`: Called when ServerTime response is received
  - `onRealTimeSessions(data, message)`: Called when RealTimeSessions message is received
  - `onRealTimeAccounts(data, message)`: Called when RealTimeAccounts message is received
  - `onRealTimeAccount(data, message)`: Called when RealTimeAccount (singular) message is received (falls back to onRealTimeAccounts if not provided)
  - `onRealTimeTradeFollowers(data, message)`: Called when RealTimeTradeFollowers message is received
  - `onRealTimeTrades(data, message)`: Called when RealTimeTrades message is received
  - `onRealTimeTrade(data, message)`: Called when RealTimeTrade (singular) message is received (falls back to onRealTimeTrades if not provided)
  - `onRealTimeOrder(data, message)`: Called when RealTimeOrder message is received
  - `onRealTimePosition(data, message)`: Called when RealTimePosition message is received

**Returns:** `Promise<signalR.HubConnection>` - The SignalR connection object

#### `async subscribeToTrades(accountId)`
Subscribe to trades for a specific account.

**Parameters:**
- `accountId` (number): Account ID to subscribe to trades for

**Returns:** `Promise<any>` - Result from the server

#### `async subscribeToOrders(accountId)`
Subscribe to orders for a specific account.

**Parameters:**
- `accountId` (number): Account ID to subscribe to orders for

**Returns:** `Promise<any>` - Result from the server

#### `async subscribeToLinkedOrders(accountId)`
Subscribe to linked orders for a specific account.

**Parameters:**
- `accountId` (number): Account ID to subscribe to linked orders for

**Returns:** `Promise<any>` - Result from the server

#### `async subscribeToPositions(accountId)`
Subscribe to positions for a specific account.

**Parameters:**
- `accountId` (number): Account ID to subscribe to positions for

**Returns:** `Promise<any>` - Result from the server

#### `async registerSession(sessionId)`
Register a session with a specific session ID (UUID).

**Parameters:**
- `sessionId` (string): Session ID (UUID) to register (e.g., "8f991b22-c8b4-45d6-86e4-930d7eb91078")

**Returns:** `Promise<any>` - Result from the server

---

## Usage Examples

### ChartService Example

```javascript
import ChartService from './src/services/topstepx/websocket/ChartService.js'

const chartService = new ChartService('https://chartapi.topstepx.com', {
  defaultQuoteSymbols: [['F.US.EP', 1], ['F.US.ENQ', 1]],
  defaultDomSymbols: [['F.US.MNQ', 1]]
})

const callbacks = {
  onConnected: (connectionId) => {
    console.log('Connected:', connectionId)
  },
  onSubscriptionsComplete: async () => {
    // Subscribe to additional symbols after automatic subscriptions
    await chartService.subscribeToQuotes('F.US.GCE', 1)
    await chartService.subscribeToBars('F.US.GCE', '15')
  },
  onRealTimeSymbolQuote: (data, message) => {
    console.log('Quote update:', data)
  },
  onRealTimeBar: (data, message) => {
    console.log('Bar update:', data)
  },
  onServerTime: (serverTime) => {
    console.log('Server time:', serverTime)
  }
}

await chartService.connect(accessToken, callbacks)
```

### AccountService Example

```javascript
import AccountService from './src/services/topstepx/websocket/AccountService.js'

const accountService = new AccountService('https://userapi.topstepx.com', {
  userId: 419055
})

const callbacks = {
  onConnected: (connectionId) => {
    console.log('Connected:', connectionId)
  },
  onSubscriptionsComplete: async () => {
    // Subscribe to account-specific data after automatic subscriptions
    await accountService.subscribeToTrades(14639086)
    await accountService.subscribeToOrders(14639086)
    await accountService.subscribeToLinkedOrders(14639086)
    await accountService.subscribeToPositions(14639086)
    await accountService.registerSession('8f991b22-c8b4-45d6-86e4-930d7eb91078')
  },
  onRealTimeAccount: (data, message) => {
    console.log('Account update:', data)
  },
  onRealTimeOrder: (data, message) => {
    console.log('Order update:', data)
  },
  onRealTimePosition: (data, message) => {
    console.log('Position update:', data)
  },
  onRealTimeTrade: (data, message) => {
    console.log('Trade update:', data)
  }
}

await accountService.connect(accessToken, callbacks)
```

### Using TopstepXService

```javascript
import TopstepXService from './src/services/TopstepXService.js'

const topstepXService = new TopstepXService()

// Get chart service
const chartService = topstepXService.getChartWebSocketService()
await chartService.connect(token, chartCallbacks)

// Get account service
const accountService = topstepXService.getAccountWebSocketService()
await accountService.connect(token, accountCallbacks)
```

---

## Message Types

### Chart Service Messages

#### RealTimeSymbolQuote
Real-time quote updates for subscribed symbols.

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimeSymbolQuote',
  data: {
    symbol: 'F.US.EP',
    symbolName: '/ES',
    lastPrice: 6811.75,
    bestBid: 6811.75,
    bestAsk: 6812.00,
    change: -95.50,
    changePercent: -0.0138,
    open: 6914.00,
    high: 6915.50,
    low: 6805.00,
    volume: 991541,
    lastUpdated: '2025-12-12T16:54:47.485607+00:00',
    timestamp: '2025-12-11T22:54:32.468+00:00'
  },
  timestamp: '2025-12-12T16:54:47.485607+00:00'
}
```

#### RealTimeDom
Real-time Depth of Market updates.

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimeDom',
  data: {
    symbol: 'F.US.MNQ',
    // DOM data array
  },
  timestamp: '2025-12-12T16:54:47.485607+00:00'
}
```

#### RealTimeBar
Real-time bar/candlestick updates.

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimeBar',
  data: {
    symbol: 'F.US.GCE',
    interval: '15',
    timestamp: '2025-12-12T16:45:00+00:00',
    high: 4310.1,
    low: 4301.3,
    open: 4303.8,
    close: 4302.6,
    volume: 3737,
    isClosed: false
  },
  timestamp: '2025-12-12T16:54:47.485607+00:00'
}
```

### Account Service Messages

#### RealTimeAccount
Real-time account updates (singular - single account).

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimeAccount',
  data: {
    data: {
      id: 14639086,
      userId: 419055,
      balance: 44421.31,
      totalTrades: 146,
      dailyTrades: 92,
      realizedPnL: 996.01,
      winPercentage: 0.4246,
      // ... more account fields
    },
    action: 1 // 1 = update, 2 = delete, etc.
  },
  timestamp: '2025-12-12T17:41:17.3293182+00:00'
}
```

#### RealTimeOrder
Real-time order updates.

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimeOrder',
  data: {
    data: {
      id: 2082959745,
      symbolId: 'F.US.ENQ',
      accountId: 14639086,
      limitPrice: 25458.50,
      status: 3,
      type: 1,
      positionSize: -1,
      // ... more order fields
    },
    action: 1
  },
  timestamp: '2025-12-12T17:38:25.8680023+00:00'
}
```

#### RealTimePosition
Real-time position updates.

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimePosition',
  data: {
    data: {
      id: 485927686,
      symbolId: 'F.US.MNQ',
      accountId: 14639086,
      positionSize: 1,
      stopLoss: 25276.00,
      averagePrice: 25219.75,
      profitAndLoss: 123.00,
      // ... more position fields
    },
    action: 1
  },
  timestamp: '2025-12-12T17:43:02.2318016+00:00'
}
```

#### RealTimeTrade
Real-time trade updates (singular - single trade).

**Message Structure:**
```javascript
{
  type: 'realtime',
  method: 'RealTimeTrade',
  data: {
    data: {
      id: 1785126685,
      symbolId: 'F.US.MNQ',
      accountId: 14639086,
      entryPrice: 25272.00,
      exitPrice: 25281.50,
      pnL: 19.00,
      positionSize: -1,
      tradeDuration: '00:01:22.7627896',
      // ... more trade fields
    },
    action: 1
  },
  timestamp: '2025-12-12T17:43:02.2318016+00:00'
}
```

---

## Testing

### Test SignalR Server

A local test server is available for testing WebSocket connections without connecting to the production TopstepX API.

**Location:** `server/test-signalr-server.js`

**Start the test server:**
```bash
cd server
npm run test-signalr-server
```

**Test with the server:**
```bash
USE_TEST_SERVER=true node test-topstepx.js
```

See [TEST_SIGNALR_SERVER.md](../server/TEST_SIGNALR_SERVER.md) for more details.

---

## Error Handling

All services handle errors gracefully and provide error callbacks. It's recommended to implement error handling in your callbacks:

```javascript
const callbacks = {
  onError: (error) => {
    console.error('WebSocket error:', error)
    // Implement reconnection logic or error reporting
  },
  onDisconnected: (error) => {
    console.log('Disconnected:', error)
    // Implement reconnection logic if needed
  }
}
```

---

## Reconnection

The SignalRBase class includes automatic reconnection logic with exponential backoff:
- First retry: Immediate (0s)
- Second retry: 2 seconds
- Third retry: 10 seconds
- Fourth retry: 30 seconds
- After 4 attempts: Stops reconnecting

You can customize the reconnection behavior by providing a custom `reconnectConfig` in the constructor options.

---

## Notes

- All services automatically send `ServerTime` requests every 5 seconds after connection
- Automatic subscriptions are sent immediately after connection is established
- Use the `onSubscriptionsComplete` callback to send additional subscriptions after automatic ones are done
- Message callbacks receive both the parsed data and the full message object for flexibility
- All methods return Promises, so use `async/await` or `.then()` for handling results

---

## Additional Resources

- [Frontend TopstepX Guide](./FRONTEND_TOPSTEPX.md) - For React/frontend usage
- [TopstepX API Documentation](./TOPSTEPX_API.md) - REST API documentation
- [TopstepX Architecture](./TOPSTEPX_ARCHITECTURE.md) - System architecture
