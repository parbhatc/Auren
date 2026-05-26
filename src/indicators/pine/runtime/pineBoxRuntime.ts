import type { CandleNode } from '../../base/CandleNode'
import { barsToSeconds } from '../../base/indicatorHelpers'
import type { BoxRule, PineBoxState } from '../../types/pine'
import type { PineRuntime } from '../PineRuntime'
import { evalBool, evalColor, evalPrice, evalTimeSec, type EvalContext } from '../eval/evalPineExpr'
import { pineDebug, pineWarn, shouldLogBar } from '../debug/pineDebug'

function inputIdForVar(state: PineBoxState, varName: string): string {
  return state.parsed.varToInputId.get(varName) ?? varName
}

function evalCtx(
  p: PineRuntime,
  state: PineBoxState,
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

function ruleMatches(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  rule: BoxRule,
  studyId: string
): boolean {
  for (const varName of rule.guardVars) {
    if (state.parsed.conditions.has(varName)) {
      const cond = state.parsed.conditions.get(varName)!
      if (!evalBool(cond, evalCtx(p, state, candle), state.parsed.varToInputId)) return false
      continue
    }
    const id = inputIdForVar(state, varName)
    if (!p.input.bool(id)) {
      if (shouldLogBar(studyId, candle.time)) {
        pineDebug(studyId, `rule blocked by input ${varName} (${id})=false`)
      }
      return false
    }
  }
  return true
}

function initArrays(parsed: PineBoxState['parsed']): Map<string, unknown[]> {
  const arrays = new Map<string, unknown[]>()
  for (const name of parsed.arrayVars) {
    arrays.set(name, [])
  }
  return arrays
}

function arr<T>(state: PineBoxState, name: string): T[] {
  if (!state.arrays.has(name)) state.arrays.set(name, [])
  return state.arrays.get(name)! as T[]
}

function leftBarOffset(expr: import('../../types/pine').PineExpr): number {
  if (expr.kind === 'sub' && expr.right.kind === 'literal' && typeof expr.right.value === 'number') {
    return expr.right.value
  }
  if (expr.kind === 'series' && expr.name === 'bar_index') return expr.offset
  return 2
}

/** TV rectangles need top price > bottom when script passes inverted top/bottom. */
function normalizeBoxCorners(
  left: number,
  right: number,
  top: number,
  bottom: number
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: Math.min(left, right),
    right: Math.max(left, right),
    top: Math.max(top, bottom),
    bottom: Math.min(top, bottom),
  }
}

function buildFillLocals(
  state: PineBoxState,
  fl: NonNullable<PineBoxState['parsed']['fillLoop']>,
  index: number,
  candle: CandleNode
): Record<string, string | number> {
  const locals: Record<string, string | number> = { close: candle.close }
  for (const loc of fl.locals) {
    const values = arr<unknown>(state, loc.arrayName)
    locals[loc.varName] = values[index] as string | number
  }
  if ('idx' in locals && state.anchorTimes[index] != null) {
    locals.idx = state.anchorTimes[index]
  }
  if (fl.colorTernary?.resultVar) {
    const t = fl.colorTernary
    const eqVal = String(locals[t.eqVar] ?? '')
    const colorVar = eqVal === t.whenLiteral ? t.thenVar : t.elseVar
    locals[t.resultVar] = colorVar
  }
  return locals
}

function runArrayPushes(
  p: PineRuntime,
  state: PineBoxState,
  rule: BoxRule,
  candle: CandleNode,
  shapeId: string | null
): void {
  const ctx = evalCtx(p, state, candle)
  for (const push of rule.arrayPushes) {
    const target = arr<unknown>(state, push.array)
    let value: unknown
    switch (push.value) {
      case 'box':
        value = shapeId ?? ''
        break
      case '_type':
        value = rule.typeLiteral ?? ''
        break
      case '_top':
        value = evalPrice(rule.box.top, ctx, state.parsed.varToInputId)
        break
      case '_bot':
        value = evalPrice(rule.box.bottom, ctx, state.parsed.varToInputId)
        break
      case 'bar_index':
        value = candle.time
        break
      default:
        value = push.value
    }
    target.push(value)
  }
}

export function createPineBoxState(
  meta: PineBoxState['meta'],
  parsed: PineBoxState['parsed'],
  deps: {
    shapes: PineBoxState['shapes']
    resolutionToMinutes: PineBoxState['resolutionToMinutes']
    rgbaToOpaque: PineBoxState['rgbaToOpaque']
    period?: string | null
  }
): PineBoxState {
  return {
    cache: new Map(),
    list: new Map(),
    arrays: initArrays(parsed),
    anchorTimes: [],
    period: deps.period ?? null,
    shapes: deps.shapes,
    resolutionToMinutes: deps.resolutionToMinutes,
    rgbaToOpaque: deps.rgbaToOpaque,
    drawChain: Promise.resolve(),
    drawGeneration: 0,
    highWaterTime: null,
    parsed,
    meta,
  }
}

/** TV history reload replays bars from the past — clear stale FVG arrays/shapes. */
function onHistoryRewind(state: PineBoxState, studyId: string): void {
  pineDebug(studyId, 'history rewind — reset box state')
  resetPineBoxState(state)
}

function collectBoxShapeIds(state: PineBoxState): string[] {
  const ids = new Set<string>()
  for (const item of state.list.values()) {
    if (item.shapeId) ids.add(item.shapeId)
  }
  const fl = state.parsed.fillLoop
  if (fl?.deleteBoxesArray) {
    for (const id of arr<string>(state, fl.deleteBoxesArray)) {
      if (typeof id === 'string' && id) ids.add(id)
    }
  }
  return [...ids]
}

function removeStoredBoxByShapeId(state: PineBoxState, shapeId: string): void {
  for (const [k, item] of state.list.entries()) {
    if (item.shapeId === shapeId) {
      state.list.delete(k)
      break
    }
  }
}

export async function deleteAllBoxShapes(state: PineBoxState): Promise<void> {
  const ids = collectBoxShapeIds(state)
  await Promise.all(ids.map((id) => state.shapes.deleteRectangle(id).catch(() => false)))
}

function barHasDrawnRule(state: PineBoxState, candle: CandleNode): boolean {
  for (let i = 0; i < state.parsed.boxRules.length; i++) {
    if (state.list.has(candle.time * 10 + i)) return true
  }
  return false
}

/** Draw cached bars once `candle.at(lookback)` becomes available (out-of-order / scroll). */
function flushCachedBarsWhenReady(
  p: PineRuntime,
  state: PineBoxState,
  studyId: string
): void {
  const lookback = state.parsed.lookback
  for (const [time, cached] of [...state.cache.entries()]) {
    if (!cached.at(lookback)) continue
    state.cache.delete(time)
    enqueueDraw(p, state, cached, studyId)
  }
}

function scheduleBarDraw(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  studyId: string
): void {
  const lookback = state.parsed.lookback
  if (!candle.at(lookback)) {
    state.cache.set(candle.time, candle)
    return
  }

  const wasPending = state.cache.delete(candle.time)
  const fillOnly = !wasPending && barHasDrawnRule(state, candle)
  enqueueDraw(p, state, candle, studyId, fillOnly ? { fillOnly: true } : undefined)
}

export function pineBoxOnBar(p: PineRuntime, state: PineBoxState, studyId = 'pine'): number {
  const time = p.contextTime()
  if (Number.isFinite(time)) {
    if (state.highWaterTime != null && time < state.highWaterTime) {
      onHistoryRewind(state, studyId)
    }
    if (state.highWaterTime == null || time > state.highWaterTime) {
      state.highWaterTime = time
    }
  }

  const candle = p.feedCandle()

  if (candle) {
    flushCachedBarsWhenReady(p, state, studyId)
    scheduleBarDraw(p, state, candle, studyId)
    return p.na
  }

  // TV revisits the same bar when scrolling (duplicate OHLC → null).
  const existing = p.candleAtTime(time)
  if (!existing) return p.na

  flushCachedBarsWhenReady(p, state, studyId)
  scheduleBarDraw(p, state, existing, studyId)
  return p.na
}

type DrawBarOptions = { fillOnly?: boolean }

function enqueueDraw(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  studyId: string,
  options?: DrawBarOptions
): void {
  state.drawChain = state.drawChain
    .then(() => drawBoxes(p, state, candle, studyId, options))
    .catch((err) => pineWarn(studyId, 'draw chain error', err))
}

function drawStale(state: PineBoxState, gen: number): boolean {
  return gen !== state.drawGeneration
}

async function drawBoxes(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  studyId: string,
  options?: DrawBarOptions
): Promise<void> {
  const gen = state.drawGeneration
  if (drawStale(state, gen)) return

  await processFillLoop(p, state, candle, studyId)
  if (drawStale(state, gen)) return

  if (options?.fillOnly) return

  for (let i = 0; i < state.parsed.boxRules.length; i++) {
    const rule = state.parsed.boxRules[i]
    if (!ruleMatches(p, state, candle, rule, studyId)) continue
    await drawBox(p, state, candle, rule, i, studyId)
    if (drawStale(state, gen)) return
  }
}

function fillLoopEnabled(p: PineRuntime, state: PineBoxState): boolean {
  const fl = state.parsed.fillLoop
  return Boolean(fl && p.input.bool(inputIdForVar(state, fl.guardVar)))
}

function entryCreatedAtMs(state: PineBoxState, index: number): number | null {
  const arrayName = state.parsed.creationBarArray
  if (!arrayName) return null
  const values = arr<number>(state, arrayName)
  if (index < 0 || index >= values.length) return null
  const t = values[index]
  return typeof t === 'number' && Number.isFinite(t) ? t : null
}

/** Skip fill on bars before the entry was created (history chunk replay). */
function canEvaluateFillAtBar(state: PineBoxState, index: number, candle: CandleNode): boolean {
  const createdAt = entryCreatedAtMs(state, index)
  if (createdAt == null) return true
  return candle.time >= createdAt
}

/** Pine `if filled` body for a single array index at one bar. Returns true when removed. */
async function tryFillAtIndex(
  p: PineRuntime,
  state: PineBoxState,
  index: number,
  candle: CandleNode,
  _studyId: string
): Promise<boolean> {
  const fl = state.parsed.fillLoop
  if (!fl) return false

  const sizeValues = arr<unknown>(state, fl.sizeArray)
  if (index < 0 || index >= sizeValues.length) return false
  if (!canEvaluateFillAtBar(state, index, candle)) return false

  const locals = buildFillLocals(state, fl, index, candle)
  const ctx = evalCtx(p, state, candle, locals)
  if (!evalBool(fl.filledExpr, ctx, state.parsed.varToInputId)) return false

  const createdAt = entryCreatedAtMs(state, index)
  pineDebug('box-fill', 'removed', { index, barTime: candle.time, createdAt })

  const boxes = fl.deleteBoxesArray ? arr<string>(state, fl.deleteBoxesArray) : []
  const onFilled = fl.onFilledBox
  if (onFilled && p.input.bool(inputIdForVar(state, onFilled.guardVar))) {
    const { box } = onFilled
    let color: string
    if (onFilled.bgcolorVar && fl.colorTernary) {
      const t = fl.colorTernary
      const eqVal = String(locals[t.eqVar] ?? '')
      color = p.input.color(inputIdForVar(state, eqVal === t.whenLiteral ? t.thenVar : t.elseVar))
    } else {
      color = evalColor(box.bgcolor, ctx, state.parsed.varToInputId)
    }

      let left = evalTimeSec(box.left, ctx, state.parsed.varToInputId)
      let right = evalTimeSec(box.right, ctx, state.parsed.varToInputId)
      let top = evalPrice(box.top, ctx, state.parsed.varToInputId)
      let bottom = evalPrice(box.bottom, ctx, state.parsed.varToInputId)
      if ([left, right, top, bottom].every(Number.isFinite)) {
        ;({ left, right, top, bottom } = normalizeBoxCorners(left, right, top, bottom))
        await state.shapes.createRectangle(
          { time: left, price: top },
          { time: right, price: bottom },
        {
          properties: {
            color,
            backgroundColor: color,
            text: box.text,
            textColor: state.rgbaToOpaque(color),
          },
        }
      )
    }
  }

  const shapeId = index < boxes.length ? boxes[index] : ''
  if (shapeId) {
    await state.shapes.deleteRectangle(shapeId)
    removeStoredBoxByShapeId(state, shapeId)
  }
  if (index < boxes.length) boxes.splice(index, 1)

  for (const arrayName of fl.removeArrays) {
    const a = arr<unknown>(state, arrayName)
    if (index < a.length) a.splice(index, 1)
  }
  if (index < state.anchorTimes.length) state.anchorTimes.splice(index, 1)

  return true
}

/** Walk bars forward from creation — catches fills when TV processes bars out of order. */
async function scanForwardFillFrom(
  p: PineRuntime,
  state: PineBoxState,
  index: number,
  fromCandle: CandleNode,
  studyId: string
): Promise<void> {
  if (!fillLoopEnabled(p, state)) return

  const createdAt = entryCreatedAtMs(state, index)
  let node: CandleNode | null = fromCandle
  while (node) {
    if (createdAt != null && node.time < createdAt) {
      node = node.next
      continue
    }
    if (await tryFillAtIndex(p, state, index, node, studyId)) return
    node = node.next
  }
}

async function processFillLoop(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  studyId: string
): Promise<void> {
  if (!fillLoopEnabled(p, state)) return

  const fl = state.parsed.fillLoop!
  const sizeValues = arr<unknown>(state, fl.sizeArray)

  for (let i = sizeValues.length - 1; i >= 0; i--) {
    await tryFillAtIndex(p, state, i, candle, studyId)
  }
}

async function drawBox(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  rule: BoxRule,
  ruleIndex: number,
  studyId: string
): Promise<void> {
  const gen = state.drawGeneration
  const ctx = evalCtx(p, state, candle)
  let left = evalTimeSec(rule.box.left, ctx, state.parsed.varToInputId)
  let right = evalTimeSec(rule.box.right, ctx, state.parsed.varToInputId)
  let top = evalPrice(rule.box.top, ctx, state.parsed.varToInputId)
  let bottom = evalPrice(rule.box.bottom, ctx, state.parsed.varToInputId)

  if (![left, right, top, bottom].every(Number.isFinite)) {
    pineWarn(studyId, 'invalid box geometry', { time: candle.time, ruleIndex })
    return
  }

  ;({ left, right, top, bottom } = normalizeBoxCorners(left, right, top, bottom))

  const color = evalColor(rule.box.bgcolor, ctx, state.parsed.varToInputId)
  const properties = {
    color,
    backgroundColor: color,
    text: rule.box.text,
    textColor: state.rgbaToOpaque(color),
  }

  const anchorTime = candle.at(leftBarOffset(rule.box.left))?.time ?? candle.time
  const key = candle.time * 10 + ruleIndex

  let shapeId: string | null = null
  const canDraw = !rule.boxGuardVar || p.input.bool(inputIdForVar(state, rule.boxGuardVar))

  if (canDraw) {
    if (state.list.has(key)) {
      const existing = state.list.get(key)!
      const updated = await state.shapes.updateRectangle(existing.shapeId, { properties })
      if (drawStale(state, gen)) return
      if (updated) {
        shapeId = existing.shapeId
      } else {
        // Shape was deleted externally (e.g. delete-after-fill); clear stale id.
        state.list.delete(key)
      }
    } else {
      shapeId = await state.shapes.createRectangle(
        { time: left, price: top },
        { time: right, price: bottom },
        { properties }
      )
      if (drawStale(state, gen)) return
      if (shapeId) {
        state.list.set(key, {
          shapeId,
          start: anchorTime,
          end: candle.time,
          side: 'bullish',
          ruleIndex,
          period: state.period,
        })
        state.anchorTimes.push(anchorTime)
      }
    }
  }

  if (drawStale(state, gen)) return

  if (rule.arrayPushes.length > 0) {
    runArrayPushes(p, state, rule, candle, shapeId)
    const fl = state.parsed.fillLoop
    if (fl) {
      const idx = arr<unknown>(state, fl.sizeArray).length - 1
      await scanForwardFillFrom(p, state, idx, candle, studyId)
    }
  }
}

export function pineBoxOnSettingsChange(
  changes: Record<string, { new?: unknown }>,
  state: PineBoxState
): boolean {
  const boolVars = state.parsed.boxRules
    .flatMap((r) => [...r.guardVars, ...(r.boxGuardVar ? [r.boxGuardVar] : [])])
    .filter((v) => !state.parsed.conditions.has(v))
  if (state.parsed.fillLoop) {
    boolVars.push(state.parsed.fillLoop.guardVar)
    if (state.parsed.fillLoop.onFilledBox) {
      boolVars.push(state.parsed.fillLoop.onFilledBox.guardVar)
    }
  }
  if (boolVars.some((v) => changes[inputIdForVar(state, v)])) return true

  const lengthVars = new Set<string>()
  const colorVars = new Set<string>()
  for (const rule of state.parsed.boxRules) {
    if (rule.box.right.kind === 'add' && rule.box.right.right.kind === 'var') {
      lengthVars.add(rule.box.right.right.name)
    }
    if (rule.box.bgcolor.kind === 'var') colorVars.add(rule.box.bgcolor.name)
  }

  const lengthChanged = [...lengthVars].some((v) => changes[inputIdForVar(state, v)])
  const colorChanged = [...colorVars].some((v) => changes[inputIdForVar(state, v)])

  if (lengthChanged || colorChanged) {
    state.list.forEach((item) => {
      const rule = state.parsed.boxRules[item.ruleIndex]
      if (!rule) return
      const shape = state.shapes.getShapeById(item.shapeId)
      if (!shape) return

      if (lengthChanged) {
        for (const varName of lengthVars) {
          const id = inputIdForVar(state, varName)
          const bars = changes[id]?.new
          if (bars == null) continue
          const end = item.end / 1000 + barsToSeconds(Number(bars), item.period)
          try {
            const points = (shape as { getPoints: () => Array<{ time: number; price: number }> }).getPoints()
            points[1].time = end
            ;(shape as { setPoints: (pts: typeof points) => void }).setPoints(points)
          } catch {
            /* removed */
          }
        }
      }

      if (colorChanged) {
        for (const varName of colorVars) {
          const id = inputIdForVar(state, varName)
          if (!changes[id]) continue
          if (rule.box.bgcolor.kind !== 'var' || rule.box.bgcolor.name !== varName) continue
          const color = String(changes[id].new)
          void state.shapes.updateRectangle(item.shapeId, {
            color,
            backgroundColor: color,
            textColor: state.rgbaToOpaque(color),
          })
        }
      }
    })
  }

  return false
}

export function resetPineBoxState(state: PineBoxState): void {
  state.drawGeneration++
  void deleteAllBoxShapes(state)
  state.cache.clear()
  state.list.clear()
  state.anchorTimes = []
  state.highWaterTime = null
  for (const name of state.parsed.arrayVars) {
    state.arrays.set(name, [])
  }
  state.drawChain = Promise.resolve()
}
