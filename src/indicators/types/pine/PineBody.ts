export type PineSeriesName = 'open' | 'high' | 'low' | 'close' | 'bar_index'

export type PineSeriesExpr = {
  kind: 'series'
  name: PineSeriesName
  /** Fixed bar offset, or 0 when {@link offsetVar} is set. */
  offset: number
  /** Dynamic offset from an input/var (e.g. `bar_index[rightBars]`). */
  offsetVar?: string
}

export type PineExpr =
  | PineSeriesExpr
  | { kind: 'var'; name: string }
  | { kind: 'literal'; value: string | number }
  | { kind: 'add'; left: PineExpr; right: PineExpr }
  | { kind: 'sub'; left: PineExpr; right: PineExpr }

export type PineCompareExpr = {
  kind: 'compare'
  left: PineExpr
  op: '>' | '<' | '>=' | '<='
  right: PineExpr
}

export type PineBoolExpr =
  | PineCompareExpr
  | { kind: 'and'; parts: PineBoolExpr[] }
  | { kind: 'or'; parts: PineBoolExpr[] }
  | { kind: 'eq'; left: PineExpr; right: PineExpr }

export type BoxGeom = {
  left: PineExpr
  top: PineExpr
  right: PineExpr
  bottom: PineExpr
  bgcolor: PineExpr
  text: string
}

/** `array.push(name, value)` inside a user function body. */
export type ArrayPushSpec = {
  array: string
  /** `box` = shape id from box.new; otherwise a param/var name. */
  value: 'box' | string
}

export type LineGeom = {
  x1: PineExpr
  y1: PineExpr
  x2: PineExpr
  y2: PineExpr
  color: PineExpr
  width: number
}

/** `ph = ta.pivothigh(high, leftBars, rightBars)` */
export type PivotSpec = {
  resultVar: string
  kind: 'high' | 'low'
  leftBarsVar: string
  rightBarsVar: string
}

/** `if not na(ph)` then `line.new(...)`. */
export type LineRule = {
  pivotVar: string
  line: LineGeom
  /** Extend the last line's x2 while pivot is inactive (parsed `x2 = bar_index`, horizontal). */
  extendToCurrentBar: boolean
}

export type BoxRule = {
  guardVars: string[]
  conditionVar: string
  box: BoxGeom
  /** Optional inner `if` before `box.new` in the user function (e.g. showFVG). */
  boxGuardVar?: string
  arrayPushes: ArrayPushSpec[]
  /** First string arg to the user function — stored in type array. */
  typeLiteral?: string
}

/** `x = array.get(arrName, i)` inside the fill while-loop. */
export type FillLoopLocal = {
  varName: string
  arrayName: string
}

/** `result = eqVar == "lit" ? thenVar : elseVar` (e.g. colIF assignment). */
export type ColorTernary = {
  resultVar?: string
  eqVar: string
  whenLiteral: string
  thenVar: string
  elseVar: string
}

/** Optional `box.new` drawn inside `if filled` (with its own `if` guard). */
export type OnFilledBoxAction = {
  guardVar: string
  box: BoxGeom
  /** When `bgcolor = someVar`, color resolved via {@link ColorTernary} at loop level. */
  bgcolorVar?: string
}

export type PineFillLoop = {
  guardVar: string
  indexVar: string
  sizeArray: string
  locals: FillLoopLocal[]
  filledExpr: PineBoolExpr
  colorTernary?: ColorTernary
  onFilledBox?: OnFilledBoxAction
  deleteBoxesArray?: string
  removeArrays: string[]
}

export type ParsedPineBody = {
  varToInputId: Map<string, string>
  conditions: Map<string, PineCompareExpr>
  boxRules: BoxRule[]
  pivotSpecs: PivotSpec[]
  lineRules: LineRule[]
  lookback: number
  fillLoop?: PineFillLoop
  arrayVars: string[]
  /** Array receiving `array.push(..., bar_index)` from the add-box user function (creation bar time ms). */
  creationBarArray?: string
}
