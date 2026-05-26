import type { BaseIndicator } from '../../base/BaseIndicator'
import type { ParsedPineBody, PineScriptMeta } from '../../types/pine'
import type { PineJSContext } from '../../types'

export type PineIndicatorContext = {
  indicator: BaseIndicator
  meta: PineScriptMeta
  parsed: ParsedPineBody
}

export type PineRuntimeModule = {
  createState: (ctx: PineIndicatorContext) => unknown
  resetState: (state: unknown) => void
  init?: (ctx: PineIndicatorContext, state: unknown, changes: Record<string, unknown>) => void
  main: (ctx: PineIndicatorContext, state: unknown, context: PineJSContext) => number
}
