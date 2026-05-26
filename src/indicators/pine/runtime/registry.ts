import type { PineRuntimeModule } from './pineRuntimeTypes'
import { pineScriptRuntime } from './pineScriptRuntime'

/** All `.pine` scripts use the generic executor (parsed boxes, lines, pivots). */
export function getPineRuntime(_runtimeKind: string): PineRuntimeModule {
  return pineScriptRuntime
}

export { pineScriptRuntime }
export type { PineIndicatorContext, PineRuntimeModule } from './pineRuntimeTypes'
export type { PineScriptState } from './pineScriptRuntime'
