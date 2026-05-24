/**
 * TradingView Indicators
 * 
 * This module provides a framework for creating custom TradingView indicators
 * with TypeScript support.
 */

// Base classes
export { BaseIndicator, CandleNode } from './base'

// Shapes API
export { ShapesAPI } from './shapes'

// Indicators (`.pine` scripts auto-load from scripts/)
export { loadPineScriptIndicators } from './scripts'

// Manager
export { IndicatorManager } from './manager'
export { createIndicatorManager } from './registry'

// Helpers
export {
  readBar,
  barsToSeconds,
  hasInputChange,
  isFvgZoneFilled,
  normalizeFillMode,
  rgbaToOpaque,
  timeToSeconds,
} from './base/indicatorHelpers'
export type { Bar, FvgFillMode } from './base/indicatorHelpers'

// PineScript-like API
export {
  PineRuntime,
  PineIndicator,
  PineJSIndicator,
  defineIndicator,
  input,
} from './pine'
export type { PineIndicatorConfig, PineIndicatorHandlers, PinePlotConfig } from './pine'
export { buildPineScriptMeta, parsePineScriptMeta, pineMetaToInputs } from './pine/parser'
export type { PineScriptMeta, PineMetaInput, PineMetaPlot } from './types/pine'
export type { ParsedPineBody, BoxRule } from './types/pine'
export type { PineBoxState, StoredBox } from './types/pine'
export { parsePineBody } from './pine/parser'
export { createIndicatorFromPineFile } from './pine/createIndicatorFromPineFile'

// Types
export type * from './types'

