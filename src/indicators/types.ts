/**
 * Type definitions for TradingView indicators
 */

export interface PlotDefinition {
  id: string
  type: string
  [key: string]: any
}

export interface InputDefinition {
  id: string
  name: string
  type: 'integer' | 'float' | 'bool' | 'text' | 'color' | 'resolution' | 'source'
  defval?: any
  min?: number
  max?: number
  step?: number
  options?: string[]
  group?: string
  inline?: string
}

export interface PaletteDefinition {
  colors: Record<number, { name: string }>
}

export interface PlotStyle {
  title?: string
  isHidden?: boolean
  [key: string]: any
}

export interface DefaultStyle {
  visible?: boolean
  color?: string
  palette?: string
  plottype?: number
  [key: string]: any
}

export interface TimeframeConfig {
  enabled?: boolean
  resolution?: string
  text?: string
  id?: string
}

export interface TimeframeInfo {
  index: number
  enabled: boolean
  resolution: string
  text: string
  id?: string
}

export interface TimeframeChange {
  enabled?: boolean
  resolution?: string
  text?: string
  index: number
}

export interface Point {
  time: number
  price?: number
  x?: number
  y?: number
}

export interface ShapeOptions {
  shape?: string
  properties?: Record<string, any>
  ownerStudyId?: string
  disableSave?: boolean
  disableSelection?: boolean
  disableUndo?: boolean
  lock?: boolean
  filled?: boolean
  [key: string]: any
}

export interface PineJSContext {
  studyId?: string
  [key: string]: any
}

export type InputCallback = (index: number) => any

export interface TradingViewWidget {
  chart: () => any
  activeChart?: () => any
  subscribe: (event: string, callback: (...args: any[]) => void) => void
}

export interface ChartAPI {
  createShape: (point: Point, options: ShapeOptions) => Promise<string>
  createMultipointShape: (points: Point[], options: ShapeOptions) => Promise<string>
  createAnchoredShape: (position: Point, options: ShapeOptions) => Promise<string>
  createExecutionShape: (point: Point, options: ShapeOptions) => Promise<any>
  getShapeById: (shapeId: string) => any
  removeEntity: (shapeId: string) => void
  getAllShapes?: () => Array<{ id?: string } | string>
  removeAllShapes?: () => void
  getAllStudies: () => any[]
  getStudyById: (studyId: string) => any
}

export interface PineJS {
  Std: {
    high: (context: any) => number
    low: (context: any) => number
    open: (context: any) => number
    close: (context: any) => number
    time: (context: any) => number
    period: (context: any) => string
    ticker: (context: any) => string
  }
}

