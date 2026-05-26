import type { PineJSContext } from '../../types'
import type { PineBoxState, PineLineState } from '../../types/pine'
import { PineRuntime } from '../PineRuntime'
import type { PineIndicatorContext, PineRuntimeModule } from './pineRuntimeTypes'
import {
  createPineBoxState,
  pineBoxOnBar,
  pineBoxOnSettingsChange,
  resetPineBoxState,
} from './pineBoxRuntime'
import {
  createPineLineState,
  pineLineOnBar,
  resetPineLineState,
} from './pineLineRuntime'

export type PineScriptState = {
  box: PineBoxState | null
  line: PineLineState | null
}

function getPineJS(ctx: PineIndicatorContext) {
  return (ctx.indicator as unknown as { _PineJS?: ConstructorParameters<typeof PineRuntime>[2] })._PineJS
}

function usesBox(parsed: PineIndicatorContext['parsed']): boolean {
  return parsed.boxRules.length > 0 || parsed.fillLoop != null
}

function usesLine(parsed: PineIndicatorContext['parsed']): boolean {
  return parsed.lineRules.length > 0
}

/** Generic `.pine` executor — boxes, arrays, fill loops, pivot lines. */
export const pineScriptRuntime: PineRuntimeModule = {
  createState(ctx) {
    const ind = ctx.indicator
    const deps = {
      shapes: ind.getShapes(),
      resolutionToMinutes: ind.resolutionToMinutes.bind(ind),
      rgbaToOpaque: ind.rgbaToOpaque.bind(ind),
      period: (ind as { period?: string | null }).period ?? null,
    }

    return {
      box: usesBox(ctx.parsed) ? createPineBoxState(ctx.meta, ctx.parsed, deps) : null,
      line: usesLine(ctx.parsed) ? createPineLineState(ctx.meta, ctx.parsed, deps) : null,
    } satisfies PineScriptState
  },

  resetState(state) {
    const s = state as PineScriptState
    if (s.box) resetPineBoxState(s.box)
    if (s.line) resetPineLineState(s.line)
  },

  init(ctx, state, changes) {
    const s = state as PineScriptState
    if (!s.box) return
    const ch = changes as Record<string, { new?: unknown }>
    // TV re-inits the study when history chunks merge — no input diff, but bars replay from scratch.
    if (!ch || Object.keys(ch).length === 0) {
      resetPineBoxState(s.box)
      return
    }
    const shouldReset = pineBoxOnSettingsChange(ch, s.box)
    if (shouldReset) {
      ctx.indicator.reset()
    }
  },

  main(ctx, state, context) {
    const PineJS = getPineJS(ctx)
    if (!PineJS) return NaN

    const s = state as PineScriptState
    const period = (ctx.indicator as { period?: string | null }).period ?? null
    if (s.box) s.box.period = period
    if (s.line) s.line.period = period

    const p = new PineRuntime(ctx.indicator, context, PineJS)
    const studyId = ctx.meta.id

    if (s.box) pineBoxOnBar(p, s.box, studyId)
    if (s.line) pineLineOnBar(p, ctx.indicator, s.line, studyId)

    return NaN
  },
}
