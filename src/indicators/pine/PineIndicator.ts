import { BaseIndicator } from '../base/BaseIndicator'
import type { PineJS, PineJSContext } from '../types'
import { PineRuntime } from './PineRuntime'

/**
 * Base class with PineScript-like `this.pine(context)` runtime.
 * Extend for class-based indicators; use `defineIndicator()` for functional style.
 */
export abstract class PineIndicator extends BaseIndicator {
  protected pine(context: PineJSContext, seriesId = 'current'): PineRuntime {
    const PineJS = this._PineJS
    if (!PineJS) throw new Error(`[${this.name}] PineJS runtime not ready`)
    return new PineRuntime(this, context, PineJS, seriesId)
  }
}
