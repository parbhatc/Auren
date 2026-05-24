import type {
  BoxRule,
  ParsedPineBody,
  PineCompareExpr,
  PineExpr,
  PineScriptMeta,
  PineSeriesName,
} from '../../types/pine'

export type { ParsedPineBody, BoxRule } from '../../types/pine'

function camelToSnake(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

function parseExpr(raw: string): PineExpr {
  const s = raw.trim()

  const str = s.match(/^"(.*)"$/)
  if (str) return { kind: 'literal', value: str[1] }

  const seriesOffset = s.match(/^(open|high|low|close|bar_index)\[(\d+)\]$/i)
  if (seriesOffset) {
    return {
      kind: 'series',
      name: seriesOffset[1].toLowerCase() as PineSeriesName,
      offset: Number(seriesOffset[2]),
    }
  }

  const add = s.match(/^bar_index\s*\+\s*(\w+)$/i)
  if (add) {
    return {
      kind: 'add',
      left: { kind: 'series', name: 'bar_index', offset: 0 },
      right: { kind: 'var', name: add[1] },
    }
  }

  const series = s.match(/^(open|high|low|close|bar_index)$/i)
  if (series) {
    return { kind: 'series', name: series[1].toLowerCase() as PineSeriesName, offset: 0 }
  }

  if (/^\d+(\.\d+)?$/.test(s)) return { kind: 'literal', value: Number(s) }

  return { kind: 'var', name: s }
}

function parseCompare(left: string, op: string, right: string): PineCompareExpr {
  return {
    left: parseExpr(left),
    op: op as PineCompareExpr['op'],
    right: parseExpr(right),
  }
}

function inferSide(expr: PineCompareExpr): 'bullish' | 'bearish' {
  const left = expr.left
  const right = expr.right
  if (left.kind === 'series' && left.name === 'low' && left.offset === 0) return 'bullish'
  if (left.kind === 'series' && left.name === 'high' && left.offset === 0) return 'bearish'
  if (right.kind === 'series' && right.name === 'low' && right.offset === 0) return 'bearish'
  if (right.kind === 'series' && right.name === 'high' && right.offset === 0) return 'bullish'
  return expr.op === '>' ? 'bullish' : 'bearish'
}

function maxOffsetInExpr(expr: PineExpr): number {
  switch (expr.kind) {
    case 'series':
      return expr.offset
    case 'add':
      return Math.max(maxOffsetInExpr(expr.left), maxOffsetInExpr(expr.right))
    case 'var':
    case 'literal':
      return 0
  }
}

function maxOffsetInCompare(expr: PineCompareExpr): number {
  return Math.max(maxOffsetInExpr(expr.left), maxOffsetInExpr(expr.right))
}

function parseInputVarMap(source: string, meta?: PineScriptMeta): Map<string, string> {
  const map = new Map<string, string>()
  const metaInputs = meta?.inputs ?? []
  let metaIndex = 0

  const re = /^\s*(\w+)\s*=\s*input\.(?:bool|int|float|color|string|source)/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const varName = match[1]
    const snake = camelToSnake(varName)
    const byId = metaInputs.find((i) => i.id === snake || i.id === varName)
    if (byId) {
      map.set(varName, byId.id)
    } else if (metaInputs[metaIndex]) {
      map.set(varName, metaInputs[metaIndex].id)
      metaIndex++
    } else {
      map.set(varName, snake)
    }
  }

  return map
}

function parseConditions(source: string): Map<string, PineCompareExpr> {
  const conditions = new Map<string, PineCompareExpr>()
  const re =
    /^\s*(\w+)\s*=\s*(open|high|low|close)\s*(>|<|>=|<=)\s*(open|high|low|close)\[(\d+)\]\s*$/gim

  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const [, name, leftSeries, op, rightSeries, offset] = match
    conditions.set(name, parseCompare(leftSeries, op, `${rightSeries}[${offset}]`))
  }

  return conditions
}

function parseBoxArgBlock(block: string): Record<string, string> {
  const args: Record<string, string> = {}
  const re = /(\w+)\s*=\s*([^,\n)]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(block)) !== null) {
    args[match[1]] = match[2].trim()
  }
  return args
}

function parseBoxRules(source: string, conditions: Map<string, PineCompareExpr>): BoxRule[] {
  const rules: BoxRule[] = []
  const re = /if\s+([\w\sand]+)\s*\n\s*box\.new\s*\(([\s\S]*?)\)/gi

  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const guardRaw = match[1].trim()
    const guardVars = guardRaw.split(/\s+and\s+/i).map((v) => v.trim())
    const conditionVar = guardVars.find((v) => conditions.has(v))
    if (!conditionVar) continue

    const args = parseBoxArgBlock(match[2])
    const condition = conditions.get(conditionVar)!
    const textExpr = parseExpr(args.text ?? '"FVG"')
    const text =
      textExpr.kind === 'literal' && typeof textExpr.value === 'string' ? textExpr.value : 'FVG'
    rules.push({
      guardVars,
      conditionVar,
      side: inferSide(condition),
      box: {
        left: parseExpr(args.left ?? 'bar_index[2]'),
        top: parseExpr(args.top ?? 'low'),
        right: parseExpr(args.right ?? 'bar_index'),
        bottom: parseExpr(args.bottom ?? 'high[2]'),
        bgcolor: parseExpr(args.bgcolor ?? args.border_color ?? '#ffffff'),
        text,
      },
    })
  }

  return rules
}

/** Parse box.new rules and conditions from a `.pine` script body. */
export function parsePineBody(source: string, meta?: PineScriptMeta): ParsedPineBody {
  const varToInputId = parseInputVarMap(source, meta)
  const conditions = parseConditions(source)
  const boxRules = parseBoxRules(source, conditions)

  if (boxRules.length === 0) {
    throw new Error('No box.new rules found in pine script')
  }

  let lookback = 0
  for (const expr of conditions.values()) {
    lookback = Math.max(lookback, maxOffsetInCompare(expr))
  }
  for (const rule of boxRules) {
    lookback = Math.max(
      lookback,
      maxOffsetInExpr(rule.box.left),
      maxOffsetInExpr(rule.box.top),
      maxOffsetInExpr(rule.box.right),
      maxOffsetInExpr(rule.box.bottom)
    )
  }

  return {
    varToInputId,
    conditions,
    boxRules,
    lookback,
  }
}
