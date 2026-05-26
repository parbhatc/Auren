import type { BaseIndicator } from '../../base/BaseIndicator'
import type { CandleNode } from '../../base/CandleNode'
import type { PivotInfo } from '../../../types/chart'
import type { LineRule, PineLineState, PivotSpec } from '../../types/pine'
import type { PineScriptMeta } from '../../types/pine'
import type { ParsedPineBody } from '../../types/pine'
import { evalColor, evalPrice, evalTimeSec, type EvalContext } from '../eval/evalPineExpr'
import { pineDebug, pineWarn } from '../debug/pineDebug'
import type { PineRuntime } from '../PineRuntime'

function inputIdForVar(state: PineLineState, varName: string): string {
  return state.parsed.varToInputId.get(varName) ?? varName
}

function evalCtx(
  p: PineRuntime,
  state: PineLineState,
  candle: CandleNode,
  locals: Record<string, string | number> = {}
): EvalContext {
  return {
    candle,
    p,
    period: state.period,
    resolutionToMinutes: state.resolutionToMinutes,
    locals,
  }
}

function pivotForSpec(
  indicator: BaseIndicator,
  spec: PivotSpec,
  candle: CandleNode,
  state: PineLineState
): PivotInfo | null {
  const left = Number(indicator.getInputValueById(inputIdForVar(state, spec.leftBarsVar)) ?? 5)
  const right = Number(indicator.getInputValueById(inputIdForVar(state, spec.rightBarsVar)) ?? 5)
  const raw =
    spec.kind === 'high'
      ? indicator.pivotHigh(left, right, candle)
      : indicator.pivotLow(left, right, candle)
  if (!raw) return null
  return { time: raw.time, price: raw.price }
}

function specForPivotVar(parsed: ParsedPineBody, pivotVar: string): PivotSpec | undefined {
  return parsed.pivotSpecs.find((s) => s.resultVar === pivotVar)
}

function extendActiveLine(state: PineLineState, ruleIndex: number, candleTime: number): void {
  const item = state.activeLines.get(ruleIndex)
  if (!item) return
  const shape = state.shapes.getShapeById(item.shapeId)
  if (!shape) return
  const points = (shape as { getPoints: () => Array<{ time: number; price: number }> }).getPoints()
  points[1].time = candleTime / 1000
  ;(shape as { setPoints: (p: typeof points) => void }).setPoints(points)
}

async function drawLine(
  p: PineRuntime,
  state: PineLineState,
  candle: CandleNode,
  rule: LineRule,
  ruleIndex: number,
  locals: Record<string, string | number>,
  studyId: string
): Promise<void> {
  const ctx = evalCtx(p, state, candle, locals)
  const x1 = evalTimeSec(rule.line.x1, ctx, state.parsed.varToInputId)
  const x2 = evalTimeSec(rule.line.x2, ctx, state.parsed.varToInputId)
  const y1 = evalPrice(rule.line.y1, ctx, state.parsed.varToInputId)
  const y2 = evalPrice(rule.line.y2, ctx, state.parsed.varToInputId)

  if (![x1, x2, y1, y2].every(Number.isFinite)) {
    pineWarn(studyId, 'invalid line geometry', { time: candle.time, ruleIndex })
    return
  }

  const color = evalColor(rule.line.color, ctx, state.parsed.varToInputId)
  const shapeId = await state.shapes.createTrendLine(
    { time: x1, price: y1 },
    { time: x2, price: y2 },
    {
      properties: {
        linecolor: color,
        linestyle: 0,
        linewidth: rule.line.width,
      },
    }
  )

  if (!shapeId) return

  const pivotTime = (locals._pivotTime as number) ?? candle.time
  state.activeLines.set(ruleIndex, { shapeId, ruleIndex, pivotTime })
  pineDebug(studyId, 'line drawn', { ruleIndex, pivotTime, color })
}

async function processLines(
  p: PineRuntime,
  indicator: BaseIndicator,
  state: PineLineState,
  candle: CandleNode,
  studyId: string
): Promise<void> {
  const pivotActive = new Map<string, PivotInfo | null>()

  for (const spec of state.parsed.pivotSpecs) {
    const pivot = pivotForSpec(indicator, spec, candle, state)
    pivotActive.set(spec.resultVar, pivot)
  }

  const anyPivot = [...pivotActive.values()].some(Boolean)

  if (!anyPivot) {
    for (let ruleIndex = 0; ruleIndex < state.parsed.lineRules.length; ruleIndex++) {
      if (!state.parsed.lineRules[ruleIndex].extendToCurrentBar) continue
      extendActiveLine(state, ruleIndex, candle.time)
    }
    return
  }

  for (let ruleIndex = 0; ruleIndex < state.parsed.lineRules.length; ruleIndex++) {
    const rule = state.parsed.lineRules[ruleIndex]
    const spec = specForPivotVar(state.parsed, rule.pivotVar)
    if (!spec) continue

    const pivot = pivotActive.get(rule.pivotVar)
    if (!pivot) {
      if (rule.extendToCurrentBar) extendActiveLine(state, ruleIndex, candle.time)
      continue
    }

    if (!state.seenPivotTimes.has(rule.pivotVar)) {
      state.seenPivotTimes.set(rule.pivotVar, new Set())
    }
    const seen = state.seenPivotTimes.get(rule.pivotVar)!
    if (seen.has(pivot.time)) {
      if (rule.extendToCurrentBar) extendActiveLine(state, ruleIndex, candle.time)
      continue
    }

    if (rule.extendToCurrentBar) extendActiveLine(state, ruleIndex, candle.time)

    seen.add(pivot.time)
    const locals: Record<string, string | number> = {
      [rule.pivotVar]: pivot.price,
      _pivotTime: pivot.time,
    }
    await drawLine(p, state, candle, rule, ruleIndex, locals, studyId)
  }
}

export function createPineLineState(
  meta: PineScriptMeta,
  parsed: ParsedPineBody,
  deps: {
    shapes: PineLineState['shapes']
    resolutionToMinutes: PineLineState['resolutionToMinutes']
    period?: string | null
  }
): PineLineState {
  return {
    cache: new Map(),
    activeLines: new Map(),
    seenPivotTimes: new Map(),
    period: deps.period ?? null,
    shapes: deps.shapes,
    resolutionToMinutes: deps.resolutionToMinutes,
    drawChain: Promise.resolve(),
    drawGeneration: 0,
    parsed,
    meta,
  }
}

export async function deleteAllLineShapes(state: PineLineState): Promise<void> {
  const ids = [...state.activeLines.values()].map((l) => l.shapeId)
  await Promise.all(ids.map((id) => state.shapes.deleteShape(id).catch(() => false)))
}

export function resetPineLineState(state: PineLineState): void {
  state.drawGeneration++
  void deleteAllLineShapes(state)
  state.cache.clear()
  state.activeLines.clear()
  state.seenPivotTimes.clear()
  state.drawChain = Promise.resolve()
}

export function pineLineOnBar(
  p: PineRuntime,
  indicator: BaseIndicator,
  state: PineLineState,
  studyId: string
): number {
  const time = p.contextTime()
  const candle = p.feedCandle()

  if (state.cache.has(time)) {
    const current = state.cache.get(time)!
    if (current.at(state.parsed.lookback)) {
      enqueueLineDraw(p, indicator, state, current, studyId)
      state.cache.delete(time)
    }
    return p.na
  }

  if (!candle) return p.na

  enqueueLineDraw(p, indicator, state, candle, studyId)
  return p.na
}

function enqueueLineDraw(
  p: PineRuntime,
  indicator: BaseIndicator,
  state: PineLineState,
  candle: CandleNode,
  studyId: string
): void {
  state.drawChain = state.drawChain
    .then(() => drawLines(p, indicator, state, candle, studyId))
    .catch((err) => pineWarn(studyId, 'line draw error', err))
}

async function drawLines(
  p: PineRuntime,
  indicator: BaseIndicator,
  state: PineLineState,
  candle: CandleNode,
  studyId: string
): Promise<void> {
  const gen = state.drawGeneration

  if (!candle.at(state.parsed.lookback)) {
    state.cache.set(candle.time, candle)
    return
  }
  await processLines(p, indicator, state, candle, studyId)
  if (gen !== state.drawGeneration) return
}
