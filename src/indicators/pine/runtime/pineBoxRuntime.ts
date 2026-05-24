import type { CandleNode } from '../../base/CandleNode'
import type { BoxRule, PineBoxState, PineCompareExpr, PineExpr } from '../../types/pine'
import type { PineRuntime } from '../PineRuntime'
import { pineDebug, pineWarn, shouldLogBar } from '../debug/pineDebug'

function inputIdForVar(state: PineBoxState, varName: string): string {
  return state.parsed.varToInputId.get(varName) ?? varName
}

function evalCompare(candle: CandleNode, expr: PineCompareExpr): boolean {
  const left = evalPrice(candle, expr.left)
  const right = evalPrice(candle, expr.right)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  switch (expr.op) {
    case '>':
      return left > right
    case '<':
      return left < right
    case '>=':
      return left >= right
    case '<=':
      return left <= right
  }
}

function evalPrice(candle: CandleNode, expr: PineExpr): number {
  switch (expr.kind) {
    case 'series': {
      const node = candle.at(expr.offset)
      if (!node) return NaN
      if (expr.name === 'bar_index') return node.time
      return node[expr.name]
    }
    case 'literal':
      return typeof expr.value === 'number' ? expr.value : NaN
    case 'var':
    case 'add':
      return NaN
  }
}

function evalTimeSec(candle: CandleNode, expr: PineExpr, p: PineRuntime, state: PineBoxState): number {
  if (expr.kind === 'series' && expr.name === 'bar_index') {
    const node = candle.at(expr.offset)
    return node ? node.time / 1000 : NaN
  }
  if (expr.kind === 'add' && expr.left.kind === 'series' && expr.left.name === 'bar_index' && expr.right.kind === 'var') {
    const lengthOfBox = p.input.int(inputIdForVar(state, expr.right.name), 20)
    return candle.time / 1000 + extendedLength(state, lengthOfBox)
  }
  const price = evalPrice(candle, expr)
  return Number.isFinite(price) ? (price > 1e12 ? price / 1000 : price) : NaN
}

function evalColor(p: PineRuntime, state: PineBoxState, expr: PineExpr): string {
  if (expr.kind === 'var') {
    return p.input.color(inputIdForVar(state, expr.name))
  }
  if (expr.kind === 'literal' && typeof expr.value === 'string') return expr.value
  return '#ffffff'
}

function extendedLength(state: PineBoxState, lengthOfBox: number, period: string | null = null): number {
  const res = period ?? state.period ?? '5'
  if (!res) return 0
  const chartBarIntervalMinutes = state.resolutionToMinutes(res) / 60
  const chartBarIntervalSeconds = chartBarIntervalMinutes * 60
  return parseInt(res, 10) * 60 * lengthOfBox + lengthOfBox * chartBarIntervalSeconds
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
      const ok = evalCompare(candle, state.parsed.conditions.get(varName)!)
      if (!ok) return false
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
    period: deps.period ?? null,
    shapes: deps.shapes,
    resolutionToMinutes: deps.resolutionToMinutes,
    rgbaToOpaque: deps.rgbaToOpaque,
    drawChain: Promise.resolve(),
    parsed,
    meta,
  }
}

export function pineBoxOnBar(p: PineRuntime, state: PineBoxState, studyId = 'pine'): number {
  const time = p.contextTime()
  const candle = p.feedCandle()

  if (state.cache.has(time)) {
    const current = state.cache.get(time)!
    if (current.at(state.parsed.lookback)) {
      if (shouldLogBar(studyId, time)) {
        pineDebug(studyId, 'cache replay draw', { time, lookback: state.parsed.lookback })
      }
      enqueueDraw(p, state, current, studyId)
      state.cache.delete(time)
    }
    return p.na
  }

  if (!candle) {
    if (shouldLogBar(studyId, time)) {
      pineDebug(studyId, 'feedCandle returned null (duplicate tick)', { time })
    }
    return p.na
  }

  enqueueDraw(p, state, candle, studyId)
  return p.na
}

function enqueueDraw(p: PineRuntime, state: PineBoxState, candle: CandleNode, studyId: string): void {
  state.drawChain = state.drawChain
    .then(() => drawBoxes(p, state, candle, studyId))
    .catch((err) => {
      pineWarn(studyId, 'draw chain error', err)
    })
}

async function drawBoxes(
  p: PineRuntime,
  state: PineBoxState,
  candle: CandleNode,
  studyId: string
): Promise<void> {
  if (!candle.at(state.parsed.lookback)) {
    state.cache.set(candle.time, candle)
    if (shouldLogBar(studyId, candle.time)) {
      pineDebug(studyId, 'waiting for lookback', {
        time: candle.time,
        need: state.parsed.lookback,
        hasChain: Boolean(candle.at(1)),
      })
    }
    return
  }

  let matched = 0
  for (let i = 0; i < state.parsed.boxRules.length; i++) {
    const rule = state.parsed.boxRules[i]
    if (!ruleMatches(p, state, candle, rule, studyId)) continue
    matched++
    await drawBox(p, state, candle, rule, i, studyId)
  }

  if (matched > 0 && shouldLogBar(studyId, candle.time)) {
    pineDebug(studyId, 'rules matched', { time: candle.time, matched, totalBoxes: state.list.size })
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
  const leftTime = evalTimeSec(candle, rule.box.left, p, state)
  const rightTime = evalTimeSec(candle, rule.box.right, p, state)
  const top = evalPrice(candle, rule.box.top)
  const bottom = evalPrice(candle, rule.box.bottom)

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
    pineWarn(studyId, 'invalid box geometry — skipped', {
      time: candle.time,
      ruleIndex,
      leftTime,
      rightTime,
      top,
      bottom,
      period: state.period,
    })
    return
  }

  const color = evalColor(p, state, rule.box.bgcolor)
  const properties = {
    color,
    backgroundColor: color,
    text: rule.box.text,
    textColor: state.rgbaToOpaque(color),
  }

  const leftOffset = rule.box.left.kind === 'series' ? rule.box.left.offset : 2
  const anchorTime = candle.at(leftOffset)?.time ?? candle.time
  const key = candle.time * 10 + ruleIndex

  if (state.list.has(key)) {
    await state.shapes.updateRectangle(state.list.get(key)!.shapeId, { properties })
    return
  }

  pineDebug(studyId, 'createRectangle', {
    time: candle.time,
    ruleIndex,
    side: rule.side,
    leftTime,
    rightTime,
    top,
    bottom,
    color,
    period: state.period,
  })

  const shapeId = await state.shapes.createRectangle(
    { time: leftTime, price: top },
    { time: rightTime, price: bottom },
    { properties }
  )

  if (!shapeId) {
    pineWarn(studyId, 'createRectangle returned null — chart widget may not be ready', {
      time: candle.time,
      ruleIndex,
    })
    return
  }

  pineDebug(studyId, 'box created', { shapeId, time: candle.time, ruleIndex, total: state.list.size + 1 })

  state.list.set(key, {
    shapeId,
    start: anchorTime,
    end: candle.time,
    side: rule.side,
    ruleIndex,
    period: state.period,
  })
}

export function pineBoxOnSettingsChange(
  changes: Record<string, { new?: unknown }>,
  state: PineBoxState
): boolean {
  const boolGuard = state.parsed.boxRules
    .flatMap((r) => r.guardVars)
    .filter((v) => !state.parsed.conditions.has(v))
    .some((v) => changes[inputIdForVar(state, v)])

  if (boolGuard) return true

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
          const lengthOfBox = changes[id]?.new
          if (lengthOfBox == null) continue
          const end = item.end / 1000 + extendedLength(state, Number(lengthOfBox), item.period)
          try {
            const points = (shape as { getPoints: () => Array<{ time: number; price: number }> }).getPoints()
            points[1].time = end
            ;(shape as { setPoints: (p: typeof points) => void }).setPoints(points)
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
  state.cache.clear()
  state.list.clear()
  state.drawChain = Promise.resolve()
}
