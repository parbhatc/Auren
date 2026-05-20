# TradingView Chart Usage Guide

This guide explains how to use TradingView charts in the NexusSyncPro project.

## Prerequisites

1. **TradingView Charting Library**: You need to obtain the TradingView Charting Library from [TradingView](https://www.tradingview.com/charting-library/).
2. **Library Files**: The library should be placed in `public/charting_library/` directory.

## Setup

### Step 1: Load the TradingView Library

Add the TradingView library script to your `index.html` file:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NexusSync</title>
    <!-- Load TradingView Charting Library -->
    <script src="/charting_library/charting_library.standalone.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Note**: If you're using the bundled version instead of standalone, you may need to load it differently. Check your TradingView library documentation.

### Step 2: Use the TradingViewChart Component

The project includes a `TradingViewChart` component that wraps the TradingView library. Here's how to use it:

## Basic Usage

```tsx
import TradingViewChart from '../components/common/TradingViewChart'

function MyComponent() {
  return (
    <TradingViewChart
      symbol="AAPL"
      timeframe="1h"
      isDark={false}
    />
  )
}
```

## Props

### Required Props

- **`symbol`** (string): The trading symbol to display (e.g., "AAPL", "BTCUSD", "ES1!")

### Optional Props

- **`timeframe`** (string): Chart timeframe/interval (e.g., "1m", "5m", "1h", "1D", "1W"). Default: "1h"
- **`isDark`** (boolean): Enable dark theme. Default: false
- **`widgetConfig`** (object): Custom widget configuration (see Configuration section below)
- **`style`** (CSSProperties): Custom container styles
- **`className`** (string): Custom container CSS class
- **`onWidgetReady`** (function): Callback when widget is loaded: `(widget: any) => void`
- **`onError`** (function): Callback when widget encounters an error: `(error: Error) => void`
- **`onChartReady`** (function): Callback when chart is ready: `() => Promise<void>`
- **`onIntervalChange`** (function): Callback when timeframe changes: `(interval: string) => void`
- **`onSymbolChange`** (function): Callback when symbol changes: `(symbol: string) => void`
- **`onAutoSaveNeeded`** (function): Callback when auto-save is needed: `() => Promise<void>`

## Examples

### Example 1: Basic Chart

```tsx
import TradingViewChart from '../components/common/TradingViewChart'

function BasicChart() {
  return (
    <div style={{ height: '600px' }}>
      <TradingViewChart
        symbol="ES1!"
        timeframe="5m"
        isDark={true}
      />
    </div>
  )
}
```

### Example 2: Chart with Custom Configuration

```tsx
import TradingViewChart from '../components/common/TradingViewChart'

function CustomChart() {
  return (
    <TradingViewChart
      symbol="BTCUSD"
      timeframe="1D"
      isDark={true}
      widgetConfig={{
        disabled_features: ['header_symbol_search', 'header_compare'],
        enabled_features: ['study_templates', 'side_toolbar_in_fullscreen_mode'],
        overrides: {
          'paneProperties.background': '#0f172a',
          'paneProperties.backgroundType': 'solid',
        },
      }}
      onWidgetReady={(widget) => {
        console.log('Widget ready:', widget)
      }}
      onChartReady={async () => {
        console.log('Chart is ready!')
      }}
    />
  )
}
```

### Example 3: Chart with Event Handlers

```tsx
import { useState } from 'react'
import TradingViewChart from '../components/common/TradingViewChart'

function InteractiveChart() {
  const [currentSymbol, setCurrentSymbol] = useState('AAPL')
  const [currentTimeframe, setCurrentTimeframe] = useState('1h')

  return (
    <div>
      <div>
        <p>Current Symbol: {currentSymbol}</p>
        <p>Current Timeframe: {currentTimeframe}</p>
      </div>
      <TradingViewChart
        symbol={currentSymbol}
        timeframe={currentTimeframe}
        isDark={true}
        onSymbolChange={(symbol) => {
          console.log('Symbol changed to:', symbol)
          setCurrentSymbol(symbol)
        }}
        onIntervalChange={(interval) => {
          console.log('Timeframe changed to:', interval)
          setCurrentTimeframe(interval)
        }}
        onChartReady={async () => {
          console.log('Chart ready!')
        }}
      />
    </div>
  )
}
```

### Example 4: Chart with Custom Datafeed (Advanced)

For custom datafeeds (like backtesting), you can provide a datafeed configuration:

```tsx
import TradingViewChart from '../components/common/TradingViewChart'

function BacktestChart() {
  const customDatafeed = {
    onReady: (callback) => {
      // Initialize your datafeed
      callback({
        supported_resolutions: ['1', '5', '15', '30', '60', 'D'],
        supports_group_request: false,
        supports_marks: true,
        supports_search: true,
        supports_time: true,
      })
    },
    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
      // Implement symbol search
    },
    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
      // Resolve symbol configuration
    },
    getBars: (symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) => {
      // Fetch historical data
    },
    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
      // Subscribe to real-time updates
    },
    unsubscribeBars: (subscriberUID) => {
      // Unsubscribe from updates
    },
  }

  return (
    <TradingViewChart
      symbol="ES1!"
      timeframe="5m"
      isDark={true}
      widgetConfig={{
        datafeed: customDatafeed,
      }}
    />
  )
}
```

## Configuration Options

The `widgetConfig` prop allows you to customize the TradingView widget. Here are common options:

### Features

```tsx
widgetConfig={{
  // Disable features
  disabled_features: [
    'header_symbol_search',
    'header_compare',
    'use_localstorage_for_settings',
  ],
  
  // Enable features
  enabled_features: [
    'study_templates',
    'side_toolbar_in_fullscreen_mode',
  ],
}}
```

### Styling

```tsx
widgetConfig={{
  // Theme colors
  toolbar_bg: '#1e293b',
  
  // Chart overrides
  overrides: {
    'paneProperties.background': '#0f172a',
    'paneProperties.backgroundType': 'solid',
    'paneProperties.vertGridProperties.color': '#1e293b',
    'paneProperties.horzGridProperties.color': '#1e293b',
  },
  
  // Study overrides
  studies_overrides: {
    'volume.volume.color.0': '#00FFFF',
  },
}}
```

### Storage

```tsx
widgetConfig={{
  charts_storage_url: 'https://saveload.tradingview.com',
  charts_storage_api_version: '1.1',
  client_id: 'tradingview.com',
  user_id: 'public_user_id',
  load_last_chart: false,
}}
```

### Advanced Options

```tsx
widgetConfig={{
  locale: 'en',
  timezone: 'America/New_York',
  fullscreen: false,
  autosize: true,
  debug: false,
}}
```

## Common Timeframes

TradingView supports various timeframes:

- **Minutes**: `1`, `2`, `3`, `5`, `10`, `15`, `30`, `60`
- **Hours**: `1H`, `2H`, `3H`, `4H`, `6H`, `8H`, `12H`
- **Days**: `1D`, `2D`, `3D`, `1W`, `1M`

**Note**: The component accepts both formats (e.g., "1h" or "1H" both work).

## Current Usage in Project

The TradingView chart is currently used in:

1. **Backtester Chart View** (`src/components/backtester/BacktesterChartView/BacktesterChartView.tsx`)
   - Displays charts for backtesting sessions
   - Includes playback controls

2. **Trading View** (`src/components/trading/Trading/TradingRenderer.tsx`)
   - Real-time trading charts

3. **Backtester Main** (`src/components/backtester/Backtester/BacktesterRenderer.tsx`)
   - Multiple session management with charts

## Troubleshooting

### Chart Not Loading

1. **Check if library is loaded**: Open browser console and check if `window.TradingView` is defined
2. **Verify file path**: Ensure `charting_library.standalone.js` exists in `public/charting_library/`
3. **Check console errors**: Look for any JavaScript errors in the browser console

### Chart Shows Placeholder

If you see a loading placeholder that never finishes:
- The TradingView library may not be loaded
- Check the browser console for errors
- Verify the script tag in `index.html` is correct

### Styling Issues

- Ensure the container has a defined height (e.g., `height: '600px'` or `minHeight: '600px'`)
- Check if `autosize` is enabled in widget config
- Verify theme colors match your design

## Additional Resources

- [TradingView Charting Library Documentation](https://www.tradingview.com/charting-library/)
- [TradingView Widget API Reference](https://www.tradingview.com/charting-library-docs/latest/api/)

## Type Definitions

Type definitions are available in `src/types/chart.ts`:

- `TradingViewChartProps`: Props for the TradingViewChart component
- `TradingViewWidgetConfig`: Configuration options for the widget

