export type PineSeriesName = 'open' | 'high' | 'low' | 'close' | 'bar_index'

export type PineExpr =
  | { kind: 'series'; name: PineSeriesName; offset: number }
  | { kind: 'var'; name: string }
  | { kind: 'literal'; value: string | number }
  | { kind: 'add'; left: PineExpr; right: PineExpr }

export type PineCompareExpr = {
  left: PineExpr
  op: '>' | '<' | '>=' | '<='
  right: PineExpr
}

export type BoxRule = {
  guardVars: string[]
  conditionVar: string
  box: {
    left: PineExpr
    top: PineExpr
    right: PineExpr
    bottom: PineExpr
    bgcolor: PineExpr
    text: string
  }
  side: 'bullish' | 'bearish'
}

export type ParsedPineBody = {
  varToInputId: Map<string, string>
  conditions: Map<string, PineCompareExpr>
  boxRules: BoxRule[]
  lookback: number
}
