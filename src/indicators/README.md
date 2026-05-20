# TradingView Custom Indicators

This module provides a TypeScript framework for creating custom TradingView indicators.

## Quick Start

### 1. Create an IndicatorManager instance

```typescript
import { IndicatorManager, FVGIndicator, SwingIndicator } from '@/indicators'

const manager = new IndicatorManager()

// Register indicators
manager.register(new FVGIndicator())
manager.register(new SwingIndicator())
```

### 2. Use with TradingView Widget

When creating a TradingView widget, pass the `getter` method as the `custom_indicators_getter`:

```typescript
import { IndicatorManager, FVGIndicator, SwingIndicator } from '@/indicators'

const manager = new IndicatorManager()
manager.register(new FVGIndicator())
manager.register(new SwingIndicator())

// In your TradingViewChart component or widget config:
const widgetConfig = {
  // ... other config
  custom_indicators_getter: manager.getter.bind(manager)
  // OR use the helper method:
  // custom_indicators_getter: manager.getCustomIndicatorsGetter()
}

// When widget is ready, set it on the manager
widget.onChartReady(() => {
  manager.setWidget(widget)
  manager.onReady()
})
```

### 3. Complete Example

```typescript
import { IndicatorManager, FVGIndicator, SwingIndicator } from '@/indicators'
import TradingViewChart from '@/services/tradingview/TradingViewChart'

function MyChart() {
  const managerRef = useRef<IndicatorManager | null>(null)

  useEffect(() => {
    // Initialize manager
    const manager = new IndicatorManager()
    manager.register(new FVGIndicator())
    manager.register(new SwingIndicator())
    managerRef.current = manager

    return () => {
      // Cleanup if needed
    }
  }, [])

  return (
    <TradingViewChart
      symbol="AAPL"
      timeframe="1h"
      widgetConfig={{
        custom_indicators_getter: (PineJS) => {
          return managerRef.current?.getter(PineJS) || Promise.resolve([])
        }
      }}
      onWidgetReady={(widget) => {
        if (managerRef.current) {
          managerRef.current.setWidget(widget)
          managerRef.current.onReady()
        }
      }}
    />
  )
}
```

## Available Indicators

- **FVGIndicator**: Fair Value Gap indicator
- **SwingIndicator**: Swing High/Low indicator

## Creating Custom Indicators

Extend `BaseIndicator` to create your own indicators:

```typescript
import { BaseIndicator } from '@/indicators'
import type { PineJSContext, InputCallback } from '@/indicators/types'

export class MyCustomIndicator extends BaseIndicator {
  constructor() {
    super('MyIndicator', 'My Custom Indicator', 'Description of my indicator')
    
    // Configure plots, inputs, etc.
    this.setPriceStudy(true)
      .addPlot('plot_0', 'line')
      .addIntegerInput('my_param', 'My Parameter', 10, 1, 100)
  }

  main(context: PineJSContext, inputCallback: InputCallback): number {
    const PineJS = (this as any)._PineJS
    const value = inputCallback(0) // Get first input value
    
    // Your indicator logic here
    const close = PineJS.Std.close(context)
    
    return close * value // Example calculation
  }
}
```

## API Reference

### IndicatorManager

- `register(indicator: BaseIndicator)`: Register a single indicator
- `registerAll(indicators: BaseIndicator[])`: Register multiple indicators
- `getter(PineJS: PineJS)`: Get all indicators in TradingView format (used as callback)
- `getCustomIndicatorsGetter()`: Get a bound function for use as `custom_indicators_getter`
- `setWidget(widget: TradingViewWidget)`: Set the TradingView widget reference
- `onReady()`: Call when widget is ready to set up event listeners

### BaseIndicator

See the BaseIndicator class for all available methods for configuring plots, inputs, timeframes, etc.
