import type { CandleNode } from '../../base/CandleNode'
import type { ShapesAPI } from '../../shapes/ShapesAPI'
import type { ParsedPineBody } from './PineBody'
import type { PineScriptMeta } from './PineMeta'

export type StoredBox = {
  shapeId: string
  start: number
  end: number
  side: 'bullish' | 'bearish'
  ruleIndex: number
  period: string | null
}

export type PineBoxState = {
  cache: Map<number, CandleNode>
  list: Map<number, StoredBox>
  period: string | null
  shapes: ShapesAPI
  resolutionToMinutes: (res: string) => number
  rgbaToOpaque: (color: string, opacity?: number) => string
  drawChain: Promise<void>
  parsed: ParsedPineBody
  meta: PineScriptMeta
}
