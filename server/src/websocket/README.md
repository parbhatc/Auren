# SignalR WebSocket Services

This directory contains generic SignalR WebSocket services that can be used with any SignalR API implementation.

## SignalRBase

A generic base class for SignalR WebSocket connections that supports:

- **Multiple authentication methods**: Query parameters, headers, or no authentication
- **Configurable transport types**: WebSockets, Server-Sent Events, Long Polling
- **Automatic reconnection**: With customizable retry strategies
- **Flexible logging**: Configurable log levels
- **Connection management**: Connect, disconnect, invoke methods, subscribe/unsubscribe

### Usage Examples

#### Example 1: Query Parameter Authentication (TopstepX style)
```javascript
import SignalRBase from './websocket/SignalRBase.js'

class MyService extends SignalRBase {
  constructor(baseURL) {
    super(baseURL, {
      authMethod: 'query',
      authParamName: 'access_token',
      transport: signalR.HttpTransportType.WebSockets,
      skipNegotiation: true
    })
    this.hubPath = '/hubs/mydata'
  }

  async connect(token, callbacks) {
    return await super.connect(this.hubPath, token, callbacks)
  }
}
```

#### Example 2: Header Authentication (Bearer Token)
```javascript
import SignalRBase from './websocket/SignalRBase.js'
import * as signalR from '@microsoft/signalr'

class MyService extends SignalRBase {
  constructor(baseURL) {
    super(baseURL, {
      authMethod: 'header',
      authParamName: 'Authorization', // Will automatically add 'Bearer ' prefix
      transport: signalR.HttpTransportType.WebSockets,
      skipNegotiation: false // Allow negotiation
    })
    this.hubPath = '/hubs/mydata'
  }

  async connect(token, callbacks) {
    return await super.connect(this.hubPath, token, callbacks)
  }
}
```

#### Example 3: Custom Header Authentication
```javascript
import SignalRBase from './websocket/SignalRBase.js'
import * as signalR from '@microsoft/signalr'

class MyService extends SignalRBase {
  constructor(baseURL) {
    super(baseURL, {
      authMethod: 'header',
      authParamName: 'X-API-Key', // Custom header name
      transport: signalR.HttpTransportType.WebSockets
    })
    this.hubPath = '/hubs/mydata'
  }

  async connect(apiKey, callbacks) {
    return await super.connect(this.hubPath, apiKey, callbacks)
  }
}
```

#### Example 4: No Authentication
```javascript
import SignalRBase from './websocket/SignalRBase.js'
import * as signalR from '@microsoft/signalr'

class MyService extends SignalRBase {
  constructor(baseURL) {
    super(baseURL, {
      authMethod: 'none',
      transport: signalR.HttpTransportType.WebSockets
    })
    this.hubPath = '/hubs/public'
  }

  async connect(callbacks) {
    return await super.connect(this.hubPath, null, callbacks)
  }
}
```

### Configuration Options

- **authMethod**: `'query'` | `'header'` | `'none'` - Authentication method
- **authParamName**: `string` - Parameter/header name for authentication (default: `'access_token'`)
- **transport**: `signalR.HttpTransportType` - Transport type (default: `WebSockets`)
- **skipNegotiation**: `boolean` - Skip negotiation for direct WebSocket (default: `true`)
- **logLevel**: `signalR.LogLevel` - Logging level (default: `Information`)
- **reconnectConfig**: `Object` - Custom reconnect configuration with `nextRetryDelayInMilliseconds` function

### Methods

- `connect(hubPath, accessToken, callbacks)` - Connect to a SignalR hub
- `disconnect()` - Disconnect from the WebSocket
- `invoke(methodName, ...args)` - Invoke a hub method
- `on(methodName, callback)` - Subscribe to a hub method
- `off(methodName, callback)` - Unsubscribe from a hub method
- `getState()` - Get connection state
- `getIsConnected()` - Check if connected
- `getConnectionId()` - Get connection ID

### Callbacks

- `onConnected(connectionId)` - Called when connection is established
- `onDisconnected(error)` - Called when connection is lost
- `onReconnecting(error)` - Called when reconnecting
- `onReconnected(connectionId)` - Called when reconnected
- `onError(error)` - Called when an error occurs

