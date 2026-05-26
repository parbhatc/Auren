import type { CandleNode } from '../../base/CandleNode'
import { barsToSeconds } from '../../base/indicatorHelpers'
import type { PineBoolExpr, PineCompareExpr, PineExpr } from '../../types/pine'
import type { PineRuntime } from '../PineRuntime'

export type EvalContext = {
  candle: CandleNode
  p: PineRuntime
  period: string | null
  resolutionToMinutes: (res: string) => number
  locals: Record<string, string | number>
}

function inputId(p: PineRuntime, varName: string, map: Map<string, string>): string {
  return map.get(varName) ?? varName.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

export function evalNumber(
  expr: PineExpr,
  ctx: EvalContext,
  varToInputId: Map<string, string>
): number {
  switch (expr.kind) {
    case 'literal':
      return typeof expr.value === 'number' ? expr.value : NaN
    case 'series': {
      const offset = expr.offsetVar
        ? ctx.p.input.int(inputId(ctx.p, expr.offsetVar, varToInputId), 0)
        : expr.offset
      const node = ctx.candle.at(offset)
      if (!node) return NaN
      if (expr.name === 'bar_index') return node.time
      return node[expr.name]
    }
    case 'var': {
      if (expr.name in ctx.locals) {
        const v = ctx.locals[expr.name]
        return typeof v === 'number' ? v : NaN
      }
      const stored = ctx.p.get(inputId(ctx.p, expr.name, varToInputId))
      const n = Number(stored)
      return Number.isFinite(n) ? n : NaN
    }
    case 'add': {
      if (
        expr.left.kind === 'series' &&
        expr.left.name === 'bar_index' &&
        expr.left.offset === 0 &&
        expr.right.kind === 'var'
      ) {
        const bars = ctx.p.input.int(inputId(ctx.p, expr.right.name, varToInputId), 0)
        return ctx.candle.time / 1000 + barsToSeconds(bars, ctx.period)
      }
      const l = evalNumber(expr.left, ctx, varToInputId)
      const r = evalNumber(expr.right, ctx, varToInputId)
      return Number.isFinite(l) && Number.isFinite(r) ? l + r : NaN
    }
    case 'sub': {
      if (
        expr.left.kind === 'series' &&
        expr.left.name === 'bar_index' &&
        expr.left.offset === 0 &&
        expr.right.kind === 'literal' &&
        typeof expr.right.value === 'number'
      ) {
        const node = ctx.candle.at(expr.right.value)
        return node ? node.time / 1000 : NaN
      }
      if (
        expr.left.kind === 'var' &&
        expr.right.kind === 'literal' &&
        typeof expr.right.value === 'number'
      ) {
        const base = ctx.locals[expr.left.name]
        if (typeof base === 'number') {
          return base / 1000 - barsToSeconds(expr.right.value, ctx.period)
        }
      }
      const l = evalNumber(expr.left, ctx, varToInputId)
      const r = evalNumber(expr.right, ctx, varToInputId)
      return Number.isFinite(l) && Number.isFinite(r) ? l - r : NaN
    }
  }
}

export function evalTimeSec(expr: PineExpr, ctx: EvalContext, varToInputId: Map<string, string>): number {
  const n = evalNumber(expr, ctx, varToInputId)
  if (!Number.isFinite(n)) return NaN
  return n > 1e12 ? n / 1000 : n
}

export function evalPrice(expr: PineExpr, ctx: EvalContext, varToInputId: Map<string, string>): number {
  const n = evalNumber(expr, ctx, varToInputId)
  return Number.isFinite(n) && n < 1e12 ? n : NaN
}

export function evalColor(
  expr: PineExpr,
  ctx: EvalContext,
  varToInputId: Map<string, string>
): string {
  if (expr.kind === 'var') {
    return ctx.p.input.color(inputId(ctx.p, expr.name, varToInputId))
  }
  if (expr.kind === 'literal' && typeof expr.value === 'string') return expr.value
  return '#ffffff'
}

export function evalCompare(
  expr: PineCompareExpr,
  ctx: EvalContext,
  varToInputId: Map<string, string>
): boolean {
  const left = evalNumber(expr.left, ctx, varToInputId)
  const right = evalNumber(expr.right, ctx, varToInputId)
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
    default:
      return false
  }
}

export function evalBool(
  expr: PineBoolExpr,
  ctx: EvalContext,
  varToInputId: Map<string, string>
): boolean {
  if (expr.kind === 'compare') {
    return evalCompare(expr, ctx, varToInputId)
  }
  switch (expr.kind) {
    case 'and':
      if (expr.parts.length === 0) return false
      return expr.parts.every((p) => evalBool(p, ctx, varToInputId))
    case 'or':
      return expr.parts.some((p) => evalBool(p, ctx, varToInputId))
    case 'eq': {
      const l = expr.left
      const r = expr.right
      if (l.kind === 'var' && r.kind === 'literal' && typeof r.value === 'string') {
        return String(ctx.locals[l.name] ?? '') === r.value
      }
      return evalNumber(l, ctx, varToInputId) === evalNumber(r, ctx, varToInputId)
    }
  }
}
