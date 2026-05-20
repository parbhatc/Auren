# TradingView WebSocket Service

A production-ready WebSocket client for TradingView's prodata server, providing an easy-to-use API for accessing market data, chart series, and replay functionality.

## Installation

```bash
npm install ws
```

## Quick Start

```javascript
import TradingViewWebSocket from './services/tradingview/TradingViewWebSocket.js'

const wsService = new TradingViewWebSocket({
  token: 'your_auth_token_here', // Optional, defaults to 'unauthorized_user_token'
  locale: 'en',
  country: 'US',
  timezone: 'America/New_York'
})

await wsService.connect({
  onConnected: () => {
    console.log('Connected to TradingView')
  },
  
  onSessionInit: (sessionData) => {
    // Create a series
    const series = wsService.createSeries('extended')
    
    // Set up callbacks
    series.onSymbolResolved = (data) => {
      console.log('Symbol resolved:', data.name)
    }
    
    series.onTimescaleUpdate = (data) => {
      // Handle candle updates
      const candles = data.series_data?.s || []
      console.log('Received', candles.length, 'candles')
    }
    
    // Resolve symbol and create series
    series.resolve('CME_MINI:NQ1!', '1', 300)
  }
})
```

## API Reference

### TradingViewWebSocket

Main class for managing TradingView WebSocket connections.

#### Constructor

```javascript
new TradingViewWebSocket(options)
```

**Parameters:**
- `options.baseURL` (string, optional): WebSocket URL (default: `'wss://prodata.tradingview.com'`)
- `options.token` (string, optional): Authentication token (default: `'unauthorized_user_token'`)
- `options.locale` (string, optional): Language locale (default: `'en'`)
- `options.country` (string, optional): Country code (default: `'US'`)
- `options.timezone` (string, optional): Timezone (default: `'America/New_York'`)
- `options.headers` (Object, optional): Custom WebSocket headers

#### Methods

##### `connect(callbacks)`

Establishes WebSocket connection and sets up event handlers.

**Parameters:**
- `callbacks.onConnected`: Called when connection is established
- `callbacks.onDisconnected`: Called when connection is lost
- `callbacks.onError`: Called when an error occurs
- `callbacks.onMessage`: Called for all messages (generic handler)
- `callbacks.onUnhandledMessage`: Called for messages without dedicated handlers
- `callbacks.onSessionInit`: Called when session is initialized
- `callbacks.onSymbolResolved`: Called when symbol is resolved
- `callbacks.onSeriesLoading`: Called when series starts loading
- `callbacks.onSeriesCompleted`: Called when series loading completes
- `callbacks.onTimescaleUpdate`: Called when timescale data is received

**Returns:** `Promise<void>`

##### `createSeries(session, adjustment, currencyId, metric)`

Creates a new Series instance for chart data.

**Parameters:**
- `session` (string, optional): Trading session (default: `'regular'`)
- `adjustment` (string, optional): Price adjustment method (default: `'splits'`)
- `currencyId` (string, optional): Currency ID (default: `'USD'`)
- `metric` (string, optional): Metric type (default: `'price'`)

**Returns:** `Series` instance

##### `disconnect()`

Closes the WebSocket connection.

### Series

Represents a single chart series with its own symbol, interval, and callbacks.

#### Methods

##### `resolve(symbol, interval, bars)`

Resolves a symbol and creates the series in one call.

**Parameters:**
- `symbol` (string): Symbol identifier (e.g., `'CME_MINI:NQ1!'`)
- `interval` (string, optional): Timeframe interval (default: `'1'`)
- `bars` (number, optional): Number of bars to request (default: `300`)

**Returns:** `boolean`

##### `changeTimeframe(interval)`

Changes the timeframe/interval of the series. Automatically increments subSeriesId.

**Parameters:**
- `interval` (string): New interval (e.g., `'15'`, `'60'`, `'1D'`)

**Returns:** `boolean`

##### `changeSymbol(symbol, replaySessionId)`

Changes the symbol of the series. Automatically increments symbolRequestId and subSeriesId.

**Parameters:**
- `symbol` (string): New symbol identifier
- `replaySessionId` (string, optional): Replay session ID for replay mode

**Returns:** `boolean`

##### `replay()`

Creates and returns a Replay instance for this series.

**Returns:** `Replay` instance

#### Callbacks

- `onSymbolResolved(data)`: Called when symbol is resolved
- `onSymbolError(error)`: Called when symbol resolution fails
- `onSeriesLoading(data)`: Called when series starts loading
- `onSeriesCompleted(data)`: Called when series loading completes
- `onSeriesError(error)`: Called when series encounters an error
- `onTimescaleUpdate(data)`: Called when candle data is received

### Replay

Handles replay sessions for historical data playback.

#### Methods

##### `start(timestamp, symbol, timeframe)`

Starts a replay session at a specific timestamp.

**Parameters:**
- `timestamp` (number): Unix timestamp to start replay
- `symbol` (string, optional): Symbol to replay (defaults to series symbol)
- `timeframe` (string, optional): Timeframe for replay (defaults to series interval)

**Returns:** `boolean`

##### `reset(timestamp)`

Resets the replay to a specific timestamp.

**Parameters:**
- `timestamp` (number): Unix timestamp to reset to

**Returns:** `boolean`

##### `getDepth(symbol, interval)`

Requests depth data for a symbol and interval.

**Parameters:**
- `symbol` (string): Symbol identifier
- `interval` (string): Interval/timeframe

**Returns:** `boolean`

##### `addSeries(symbol, interval)`

Adds a series to the replay session.

**Parameters:**
- `symbol` (string): Symbol identifier
- `interval` (string): Interval/timeframe

**Returns:** `boolean`

##### `setBroker(broker)`

Sets the broker for replay session.

**Parameters:**
- `broker` (string, optional): Broker name (default: `'replaybroker'`)

**Returns:** `boolean`

#### Callbacks

- `onReplayInstanceId(instanceId)`: Called when replay instance ID is received
- `onReplayOk()`: Called when replay operation succeeds
- `onReplayPoint(data)`: Called when replay reaches a point
- `onReplayError(error)`: Called when replay encounters an error
- `onReplayDepth(data)`: Called when depth data is received
- `onReplayResolutions(data)`: Called when replay resolutions are received

## Examples

### Basic Series Usage

```javascript
const series = wsService.createSeries('extended')

series.onSymbolResolved = (data) => {
  console.log('Symbol:', data.name)
}

series.onTimescaleUpdate = (data) => {
  const candles = data.series_data?.s || []
  candles.forEach(candle => {
    const [timestamp, open, high, low, close, volume] = candle.v
    console.log(new Date(timestamp * 1000), { open, high, low, close, volume })
  })
}

series.resolve('CME_MINI:NQ1!', '1', 300)
```

### Changing Timeframe

```javascript
series.resolve('CME_MINI:NQ1!', '1', 300)

// Later, change to 15-minute timeframe
series.changeTimeframe('15')
```

### Changing Symbol

```javascript
series.resolve('CME_MINI:NQ1!', '1', 300)

// Later, switch to ES futures
series.changeSymbol('CME_MINI:ES1!')
```

### Replay Usage

```javascript
const series = wsService.createSeries('extended')
const replay = series.replay()

replay.onReplayInstanceId = (instanceId) => {
  console.log('Replay instance:', instanceId)
  
  // Start replay at a specific timestamp
  const timestamp = Math.floor(new Date('2025-12-19').getTime() / 1000)
  replay.start(timestamp, 'CME_MINI:NQ1!', '1')
}

replay.onReplayPoint = (data) => {
  console.log('Replay point:', new Date(data.timestamp * 1000))
}

replay.onReplayDepth = (data) => {
  console.log('Depth data at:', new Date(data.timestamp * 1000))
}
```

## Error Handling

All methods return `false` on error. Check return values and use callbacks for error notifications:

```javascript
series.onSymbolError = (error) => {
  console.error('Symbol error:', error.error_message)
}

series.onSeriesError = (error) => {
  console.error('Series error:', error.error_code, error.error_message)
}

replay.onReplayError = (error) => {
  console.error('Replay error:', error.errorCode, error.errorDetails)
}
```

## Notes

- Symbol IDs (`symbolRequestId`, `seriesId`, `subSeriesId`) are automatically incremented
- Each series maintains its own state and callbacks
- Replay sessions require a valid TradingView Pro subscription
- The service handles reconnection automatically (configurable via `maxReconnectAttempts`)
