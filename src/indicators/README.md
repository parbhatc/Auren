# TradingView Custom Indicators

## Add a custom indicator (`.pine` only)

1. Create `scripts/MyStudy.pine` with standard Pine Script
2. Add `import myStudySource from './MyStudy.pine?raw'` in `loadPineScripts.ts` (or restart dev server — Vite glob is compile-time)
3. Reload — auto-registered via `loadPineScriptIndicators()`

No JSON meta comments. `PineJSIndicator` is the template for every `.pine` file.

```pine
//@version=5
indicator("Fair Value Gap", "FVG", overlay=true, max_boxes_count=500)

showFvg      = input.bool(true,  "Show FVG",        group="FVG Settings")
lengthOfBox  = input.int(20,     "Length of Box",   group="FVG Settings", minval=1, maxval=50)
bullishColor = input.color(color.new(color.green, 80), "Bullish Color", group="FVG Settings")
bearishColor = input.color(color.new(color.red,   80), "Bearish Color", group="FVG Settings")

bullishFvg = low > high[2]
bearishFvg = high < low[2]

if showFvg and bullishFvg
    box.new(left=bar_index[2], top=low, right=bar_index + lengthOfBox, bottom=high[2], bgcolor=bullishColor, text="FVG")

plot(na, title="FVG", display=display.none)
```

## Layout

```
indicators/
  types/pine/          # PineMeta, PineBody, PineBox types
  pine/
    parser/            # parsePineMeta, parsePineBody
    runtime/           # pineBoxRuntime (box.new executor)
    PineJSIndicator.ts # template class for .pine scripts
  scripts/*.pine       # your indicators
```

## Runtime

| Piece | Role |
|-------|------|
| `PineJSIndicator` | Template for all `.pine` scripts |
| `parser/parsePineMeta` | Auto-generates study config from Pine |
| `parser/parsePineBody` | Parses conditions + `box.new` (optional) |
| FVG runtime | `box.new` scripts — fair value gap boxes |
| Swing runtime | `ta.pivothigh` / `ta.pivotlow` scripts — horizontal swing lines |

## Example: Swing

```pine
//@version=5
indicator("Swing High/Low", "Swing", overlay=true, max_lines_count=500)

leftBars  = input.int(5, "Left Bars",  group="Swing Settings", minval=1, maxval=50)
rightBars = input.int(5, "Right Bars", group="Swing Settings", minval=1, maxval=50)

ph = ta.pivothigh(high, leftBars, rightBars)
pl = ta.pivotlow(low, leftBars, rightBars)

plot(na, title="Swing", display=display.none)
```
