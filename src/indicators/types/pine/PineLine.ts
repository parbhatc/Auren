import type { ShapesAPI } from '../../shapes/ShapesAPI'
import type { ParsedPineBody } from './PineBody'
import type { PineScriptMeta } from './PineMeta'

export type StoredLine = {
  shapeId: string
  ruleIndex: number
  pivotTime: number
}

export type PineLineState = {
  cache: Map<number, import('../../base/CandleNode').CandleNode>
  activeLines: Map<number, StoredLine>
  seenPivotTimes: Map<string, Set<number>>
  period: string | null
  shapes: ShapesAPI
  resolutionToMinutes: (res: string) => number
  drawChain: Promise<void>
  drawGeneration: number
  parsed: ParsedPineBody
  meta: PineScriptMeta
}
