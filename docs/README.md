# NexusSyncPro Documentation

Welcome to the NexusSyncPro documentation. This directory contains comprehensive documentation for all aspects of the application.

## Documentation Structure

### Frontend Documentation

- **[Frontend TopstepX Guide](./FRONTEND_TOPSTEPX.md)** - Complete guide for using TopstepX WebSocket services in the React frontend
  - Installation and setup
  - Using the `useTopstepX` hook
  - WebSocket services (ChartService, AccountService)
  - Component examples
  - TypeScript types
  - Troubleshooting

### Server-Side Documentation

- **[Server WebSocket Services](./SERVER_WEBSOCKET.md)** - Server-side WebSocket services documentation
  - SignalRBase class
  - ChartService for real-time chart data
  - AccountService for account data
  - Usage examples
  - Message types

- **[TopstepX API Documentation](./TOPSTEPX_API.md)** - REST API integration documentation
  - Authentication
  - User services
  - Market data
  - Orders, positions, trades
  - Statistics

- **[TopstepX Architecture](./TOPSTEPX_ARCHITECTURE.md)** - System architecture overview
  - Service structure
  - Data flow
  - Component relationships

- **[Test SignalR Server](./TEST_SIGNALR_SERVER.md)** - Local testing server documentation
  - Setup and usage
  - Testing WebSocket connections
  - Protocol details

## Quick Links

### For Frontend Developers

1. Start with [Frontend TopstepX Guide](./FRONTEND_TOPSTEPX.md)
2. Review TypeScript types and examples
3. Check component usage patterns

### For Backend Developers

1. Start with [Server WebSocket Services](./SERVER_WEBSOCKET.md)
2. Review [TopstepX API Documentation](./TOPSTEPX_API.md)
3. Check [TopstepX Architecture](./TOPSTEPX_ARCHITECTURE.md) for system design

### For Testing

1. Use [Test SignalR Server](./TEST_SIGNALR_SERVER.md) for local development
2. Test WebSocket connections without production API

## Getting Started

### Frontend

```typescript
import { useTopstepX } from '../hooks/useTopstepX'

function MyComponent() {
  const { connectChart, connectAccount, accounts, quotes } = useTopstepX({
    accountOptions: { userId: 419055 },
    chartOptions: {
      defaultQuoteSymbols: [['F.US.EP', 1]]
    }
  })

  // Use the hook...
}
```

### Server-Side

```javascript
import ChartService from './src/services/topstepx/websocket/ChartService.js'

const chartService = new ChartService('https://chartapi.topstepx.com')
await chartService.connect(accessToken, callbacks)
```

## Additional Resources

- [Main README](../README.md) - Project overview
- [Architecture](../ARCHITECTURE.md) - Frontend architecture
- [Server Architecture](../server/SERVER_ARCHITECTURE.md) - Backend architecture
- [Database](../server/DATABASE.md) - Database schema

## Need Help?

- Check the specific documentation for your use case
- Review code examples in the documentation
- Check the troubleshooting sections
- Review the TypeScript types for type definitions
