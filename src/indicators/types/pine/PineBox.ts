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
  /** Runtime arrays declared with `var type[] name = array.new_*()` in `.pine`. */
  arrays: Map<string, unknown[]>
  anchorTimes: number[]
  period: string | null
  shapes: ShapesAPI
  resolutionToMinutes: (res: string) => number
  rgbaToOpaque: (color: string, opacity?: number) => string
  drawChain: Promise<void>
  /** Bumped on reset/teardown — in-flight draws no-op when stale. */
  drawGeneration: number
  /** Latest bar time (ms) seen in `main()` — rewind triggers a box-state reset. */
  highWaterTime: number | null
  parsed: ParsedPineBody
  meta: PineScriptMeta
}
