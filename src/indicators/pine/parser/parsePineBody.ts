import type {
  ArrayPushSpec,
  BoxGeom,
  BoxRule,
  ColorTernary,
  FillLoopLocal,
  LineGeom,
  LineRule,
  OnFilledBoxAction,
  ParsedPineBody,
  PivotSpec,
  PineBoolExpr,
  PineCompareExpr,
  PineExpr,
  PineFillLoop,
  PineScriptMeta,
  PineSeriesName,
} from '../../types/pine'

export type { ParsedPineBody, BoxRule } from '../../types/pine'

function camelToSnake(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

function splitCommas(raw: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of raw) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function substituteParams(text: string, bindings: Record<string, string>): string {
  let out = text
  const keys = Object.keys(bindings).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), bindings[key])
  }
  return out
}

export function parseExpr(raw: string): PineExpr {
  const s = raw.trim()

  const str = s.match(/^"(.*)"$/)
  if (str) return { kind: 'literal', value: str[1] }

  const subBar = s.match(/^bar_index\s*-\s*(\d+)$/i)
  if (subBar) {
    return {
      kind: 'sub',
      left: { kind: 'series', name: 'bar_index', offset: 0 },
      right: { kind: 'literal', value: Number(subBar[1]) },
    }
  }

  const subVar = s.match(/^(\w+)\s*-\s*(\d+)$/i)
  if (subVar) {
    return {
      kind: 'sub',
      left: { kind: 'var', name: subVar[1] },
      right: { kind: 'literal', value: Number(subVar[2]) },
    }
  }

  const seriesOffset = s.match(/^(open|high|low|close|bar_index)\[(\d+)\]$/i)
  if (seriesOffset) {
    return {
      kind: 'series',
      name: seriesOffset[1].toLowerCase() as PineSeriesName,
      offset: Number(seriesOffset[2]),
    }
  }

  const seriesVarOffset = s.match(/^(open|high|low|close|bar_index)\[(\w+)\]$/i)
  if (seriesVarOffset) {
    return {
      kind: 'series',
      name: seriesVarOffset[1].toLowerCase() as PineSeriesName,
      offset: 0,
      offsetVar: seriesVarOffset[2],
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
    kind: 'compare',
    left: parseExpr(left),
    op: op as PineCompareExpr['op'],
    right: parseExpr(right),
  }
}

const PINE_COLOR_NAMES: Record<string, string> = {
  red: 'red',
  green: 'green',
  blue: 'blue',
  white: 'white',
  black: 'black',
  gray: 'gray',
  orange: 'orange',
  yellow: 'yellow',
}

function parseColorExpr(raw: string): PineExpr {
  const s = raw.trim()
  const named = s.match(/^color\.(\w+)$/i)
  if (named) {
    const key = named[1].toLowerCase()
    return { kind: 'literal', value: PINE_COLOR_NAMES[key] ?? key }
  }
  return parseExpr(s)
}

function parseStringLiteral(raw: string | undefined): string {
  if (!raw) return ''
  const m = raw.trim().match(/^"([^"]*)"$/)
  return m ? m[1] : ''
}

function parseLineGeomFromNewCall(rawCall: string): LineGeom {
  const inner = rawCall.replace(/^line\.new\s*\(/i, '').replace(/\)\s*$/, '')
  const parts = splitCommas(inner)
  const named: Record<string, string> = {}
  const positional = parts.filter((p) => {
    const eq = p.indexOf('=')
    if (eq === -1) return true
    named[p.slice(0, eq).trim()] = p.slice(eq + 1).trim()
    return false
  })

  const x1 = positional[0] ?? named.x1
  const y1 = positional[1] ?? named.y1
  const x2 = positional[2] ?? named.x2
  const y2 = positional[3] ?? named.y2
  if (!x1 || !y1 || !x2 || !y2) {
    throw new Error(`line.new missing points: ${rawCall.slice(0, 80)}`)
  }

  const colorRaw = named.color ?? named.linecolor
  if (!colorRaw) {
    throw new Error(`line.new missing color: ${rawCall.slice(0, 80)}`)
  }

  const widthRaw = named.width ?? named.linewidth
  const width = widthRaw ? Number(widthRaw) : 1

  return {
    x1: parseExpr(x1),
    y1: parseExpr(y1),
    x2: parseExpr(x2),
    y2: parseExpr(y2),
    color: parseColorExpr(colorRaw),
    width: Number.isFinite(width) ? width : 1,
  }
}

function exprSame(a: PineExpr, b: PineExpr): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'var' && b.kind === 'var') return a.name === b.name
  if (a.kind === 'series' && b.kind === 'series') {
    return (
      a.name === b.name &&
      a.offset === b.offset &&
      (a.offsetVar ?? '') === (b.offsetVar ?? '')
    )
  }
  return false
}

function lineExtendsToCurrentBar(geom: LineGeom): boolean {
  return (
    exprSame(geom.y1, geom.y2) &&
    geom.x2.kind === 'series' &&
    geom.x2.name === 'bar_index' &&
    geom.x2.offset === 0 &&
    !geom.x2.offsetVar
  )
}

function parsePivotSpecs(source: string): PivotSpec[] {
  const specs: PivotSpec[] = []
  const re = /(\w+)\s*=\s*ta\.pivot(high|low)\s*\(\s*(high|low)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    specs.push({
      resultVar: match[1],
      kind: match[2].toLowerCase() === 'high' ? 'high' : 'low',
      leftBarsVar: match[4],
      rightBarsVar: match[5],
    })
  }
  return specs
}

function parseLineRules(source: string): LineRule[] {
  const rules: LineRule[] = []
  const re = /if\s+not\s+na\s*\(\s*(\w+)\s*\)\s*[\r\n]+\s*line\.new\s*\(([\s\S]*?)\)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    const line = parseLineGeomFromNewCall(`line.new(${match[2]})`)
    rules.push({
      pivotVar: match[1],
      line,
      extendToCurrentBar: lineExtendsToCurrentBar(line),
    })
  }
  return rules
}

function parseBoxGeomFromNewCall(rawCall: string): BoxGeom {
  const inner = rawCall.replace(/^box\.new\s*\(/i, '').replace(/\)\s*$/, '')
  const parts = splitCommas(inner)
  const named: Record<string, string> = {}
  const positional = parts.filter((p) => {
    const eq = p.indexOf('=')
    if (eq === -1) return true
    const key = p.slice(0, eq).trim()
    named[key] = p.slice(eq + 1).trim()
    return false
  })

  const left = positional[0] ?? named.left ?? named.x1
  const top = positional[1] ?? named.top ?? named.y1
  const right = positional[2] ?? named.right ?? named.x2
  const bottom = positional[3] ?? named.bottom ?? named.y2
  if (!left || !top || !right || !bottom) {
    throw new Error(`box.new missing corners: ${rawCall.slice(0, 80)}`)
  }

  const colorRaw = named.bgcolor ?? named.border_color
  if (!colorRaw) {
    throw new Error(`box.new missing bgcolor/border_color: ${rawCall.slice(0, 80)}`)
  }

  return {
    left: parseExpr(left),
    top: parseExpr(top),
    right: parseExpr(right),
    bottom: parseExpr(bottom),
    bgcolor: parseExpr(colorRaw),
    text: parseStringLiteral(named.text),
  }
}

function parseArrayPushes(body: string): ArrayPushSpec[] {
  const pushes: ArrayPushSpec[] = []
  const re = /array\.push\s*\(\s*(\w+)\s*,\s*([^)]+)\)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    const val = match[2].trim()
    pushes.push({
      array: match[1],
      value: val === 'b' ? 'box' : val,
    })
  }
  return pushes
}

function parseUserFunctionBody(source: string, fnName: string) {
  const re = new RegExp(
    `${fnName}\\s*\\(([^)]*)\\)\\s*=>\\s*([\\s\\S]*?)(?=\\n\\w+\\s*=>|\\nif\\s+\\w|\\nplot\\s*\\(|$)`,
    'i'
  )
  const match = source.match(re)
  if (!match) return null

  const params = match[1].split(',').map((p) => p.trim()).filter(Boolean)
  const body = match[2]
  const boxMatch = body.match(/box\.new\s*\([\s\S]*?\)/i)
  const boxGuard = body.match(/if\s+(\w+)\s*\n\s*\w+\s*=\s*box\.new/i)
  const pushes = parseArrayPushes(body)

  if (!boxMatch) return null

  return {
    params,
    boxRaw: boxMatch[0],
    boxGuardVar: boxGuard?.[1],
    pushes,
  }
}

function parseAddBoxCalls(
  source: string,
  conditions: Map<string, PineCompareExpr>,
  fnName = 'f_addBox'
): BoxRule[] {
  const fn = parseUserFunctionBody(source, fnName)
  if (!fn) return []

  const rules: BoxRule[] = []
  const callRe = new RegExp(
    `${fnName}\\s*\\(\\s*"([^"]+)"\\s*,\\s*([^,]+)\\s*,\\s*([^,]+)\\s*,\\s*(\\w+)\\s*\\)`,
    'gi'
  )

  let match: RegExpExecArray | null
  while ((match = callRe.exec(source)) !== null) {
    const [, typeLit, topRaw, botRaw, colVar] = match
    const bindings: Record<string, string> = {}
    if (fn.params[0]) bindings[fn.params[0]] = `"${typeLit}"`
    if (fn.params[1]) bindings[fn.params[1]] = topRaw.trim()
    if (fn.params[2]) bindings[fn.params[2]] = botRaw.trim()
    if (fn.params[3]) bindings[fn.params[3]] = colVar.trim()

    const boxSubbed = substituteParams(fn.boxRaw, bindings)
    const box = parseBoxGeomFromNewCall(boxSubbed)

    const before = source.slice(Math.max(0, (match.index ?? 0) - 400), match.index ?? 0)
    const lines = before.split(/\r?\n/).map((l) => l.trim())
    const lastIfLine = [...lines].reverse().find((l) => /^if\s+/i.test(l))
    if (!lastIfLine) continue

    const inner = lastIfLine
      .replace(/^if\s+/i, '')
      .split(/\s+and\s+/i)
      .map((v) => v.trim())
      .filter(Boolean)

    const outerIf = [...lines].reverse().find((l) => /^if\s+\w+\s*$/i.test(l) && !l.includes('and'))
    const guardVars = [...(outerIf ? [outerIf.replace(/^if\s+/i, '').trim()] : []), ...inner]
      .filter((v, i, a) => a.indexOf(v) === i)

    const conditionVar = guardVars.find((v) => conditions.has(v)) ?? guardVars[guardVars.length - 1]

    rules.push({
      guardVars,
      conditionVar,
      box,
      boxGuardVar: fn.boxGuardVar,
      arrayPushes: fn.pushes,
      typeLiteral: typeLit,
    })
  }

  return rules
}

function stripOuterParens(s: string): string {
  let t = s.trim()
  while (t.startsWith('(') && t.endsWith(')')) {
    let depth = 0
    let closedAtEnd = true
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++
      else if (t[i] === ')') depth--
      if (depth === 0 && i < t.length - 1) {
        closedAtEnd = false
        break
      }
    }
    if (!closedAtEnd) break
    t = t.slice(1, -1).trim()
  }
  return t
}

/** Split on `and` / `or` only outside parentheses (e.g. `(t == "bull" and close < bot_)`). */
function splitLogical(s: string, op: 'and' | 'or'): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  const re = new RegExp(`\\s+${op}\\s+`, 'i')

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0) {
      const rest = s.slice(i)
      const m = rest.match(re)
      if (m && m.index === 0) {
        const piece = s.slice(start, i).trim()
        if (piece) parts.push(piece)
        i += m[0].length - 1
        start = i + 1
      }
    }
  }

  const last = s.slice(start).trim()
  if (last) parts.push(last)
  return parts
}

function parseFilledClause(s: string): PineBoolExpr {
  const clause = stripOuterParens(s)

  const eqAnd = clause.match(
    /^(\w+)\s*==\s*"([^"]+)"\s+and\s+(open|high|low|close)\s*(<|>|<=|>=)\s*(\w+)$/i
  )
  if (eqAnd) {
    return {
      kind: 'and',
      parts: [
        {
          kind: 'eq',
          left: { kind: 'var', name: eqAnd[1] },
          right: { kind: 'literal', value: eqAnd[2] },
        },
        parseCompare(eqAnd[3], eqAnd[4], eqAnd[5]),
      ],
    }
  }

  const eqOnly = clause.match(/^(\w+)\s*==\s*"([^"]+)"$/i)
  if (eqOnly) {
    return {
      kind: 'eq',
      left: { kind: 'var', name: eqOnly[1] },
      right: { kind: 'literal', value: eqOnly[2] },
    }
  }

  const cmp = clause.match(/^(open|high|low|close)\s*(<|>|<=|>=)\s*(\w+)$/i)
  if (cmp) return parseCompare(cmp[1], cmp[2], cmp[3])

  // Unparsed clause — always false so fill-loop never deletes on bad syntax.
  return {
    kind: 'compare',
    left: { kind: 'literal', value: 1 },
    op: '<',
    right: { kind: 'literal', value: 0 },
  }
}

function parseFilledExpr(raw: string): PineBoolExpr {
  const s = stripOuterParens(raw.trim())
  const orParts = splitLogical(s, 'or')
  if (orParts.length > 1) {
    return { kind: 'or', parts: orParts.map(parseFilledExpr) }
  }

  const andParts = splitLogical(s, 'and')
  if (andParts.length > 1) {
    return { kind: 'and', parts: andParts.map(parseFilledClause) }
  }

  return parseFilledClause(s)
}

function parseColorTernary(body: string): ColorTernary | undefined {
  const m = body.match(
    /(\w+)\s*=\s*(\w+)\s*==\s*"([^"]+)"\s*\?\s*(\w+)\s*:\s*(\w+)/i
  )
  if (!m) return undefined
  return {
    resultVar: m[1],
    eqVar: m[2],
    whenLiteral: m[3],
    thenVar: m[4],
    elseVar: m[5],
  }
}

function parseFillLoopLocals(body: string): FillLoopLocal[] {
  const locals: FillLoopLocal[] = []
  const re = /(\w+)\s*=\s*array\.get\s*\(\s*(\w+)\s*,\s*i\s*\)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    locals.push({ varName: match[1], arrayName: match[2] })
  }
  return locals
}

function parseOnFilledBlock(filledBody: string): {
  onFilledBox?: OnFilledBoxAction
  deleteBoxesArray?: string
  removeArrays: string[]
} {
  const result: {
    onFilledBox?: OnFilledBoxAction
    deleteBoxesArray?: string
    removeArrays: string[]
  } = { removeArrays: [] }

  const guardBox = filledBody.match(/if\s+(\w+)\s*\n\s*box\.new\s*\(([\s\S]*?)\)/i)
  if (guardBox) {
    const box = parseBoxGeomFromNewCall(`box.new(${guardBox[2]})`)
    const bg =
      guardBox[2].match(/bgcolor\s*=\s*(\w+)/i) ??
      guardBox[2].match(/border_color\s*=\s*(\w+)/i)
    result.onFilledBox = {
      guardVar: guardBox[1],
      box,
      bgcolorVar: bg?.[1],
    }
  }

  const deleteMatch = filledBody.match(/array\.size\s*\(\s*(\w+)\s*\)/i)
  if (deleteMatch) result.deleteBoxesArray = deleteMatch[1]

  const removeRe = /array\.remove\s*\(\s*(\w+)\s*,\s*i\s*\)/gi
  let removeMatch: RegExpExecArray | null
  while ((removeMatch = removeRe.exec(filledBody)) !== null) {
    result.removeArrays.push(removeMatch[1])
  }

  return result
}

function parseFillLoop(source: string): PineFillLoop | undefined {
  const block = source.match(
    /if\s+(\w+)\s*\n\s*i\s*=\s*array\.size\((\w+)\)\s*-\s*1\s*\n\s*while\s+i\s*>=\s*0([\s\S]*?)\n\s*i\s*-=\s*1/i
  )
  if (!block) return undefined

  const [, guardVar, sizeArray, body] = block
  const locals = parseFillLoopLocals(body)
  const filledMatch = body.match(/filled\s*=\s*([^\n]+)/i)
  if (locals.length === 0 || !filledMatch) return undefined

  const filledBlock = body.match(/if\s+filled\s*([\s\S]*?)(?=\n\s*i\s*-=\s*1|$)/i)
  const filledBody = filledBlock?.[1] ?? ''
  const onFilled = parseOnFilledBlock(filledBody)

  return {
    guardVar,
    indexVar: 'i',
    sizeArray,
    locals,
    filledExpr: parseFilledExpr(filledMatch[1]),
    colorTernary: parseColorTernary(body),
    onFilledBox: onFilled.onFilledBox,
    deleteBoxesArray: onFilled.deleteBoxesArray,
    removeArrays: onFilled.removeArrays,
  }
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

    const box = parseBoxGeomFromNewCall(`box.new(${match[2]})`)
    rules.push({
      guardVars,
      conditionVar,
      box,
      arrayPushes: [],
    })
  }

  return rules
}

function maxOffsetInExpr(expr: PineExpr, pivotSpecs: PivotSpec[] = []): number {
  switch (expr.kind) {
    case 'series': {
      if (expr.offsetVar) {
        const spec = pivotSpecs.find((p) => p.rightBarsVar === expr.offsetVar || p.leftBarsVar === expr.offsetVar)
        return spec ? 50 : 20
      }
      return expr.offset
    }
    case 'add':
    case 'sub':
      return Math.max(
        maxOffsetInExpr(expr.left, pivotSpecs),
        maxOffsetInExpr(expr.right, pivotSpecs)
      )
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

function findCreationBarArray(boxRules: BoxRule[]): string | undefined {
  for (const rule of boxRules) {
    for (const push of rule.arrayPushes) {
      if (push.value === 'bar_index') return push.array
    }
  }
  return undefined
}

/** Parse conditions, user functions, box rules, arrays, and fill loops from `.pine`. */
export function parsePineBody(source: string, meta?: PineScriptMeta): ParsedPineBody {
  const varToInputId = parseInputVarMap(source, meta)
  const conditions = parseConditions(source)
  const pivotSpecs = parsePivotSpecs(source)
  const lineRules = parseLineRules(source)
  const boxRules = [...parseBoxRules(source, conditions), ...parseAddBoxCalls(source, conditions)]
  const fillLoop = parseFillLoop(source)
  const arrayVars = parseArrayVars(source)

  let lookback = 2
  for (const expr of conditions.values()) {
    lookback = Math.max(lookback, maxOffsetInCompare(expr))
  }
  for (const spec of pivotSpecs) {
    lookback = Math.max(lookback, 50)
  }
  for (const rule of boxRules) {
    lookback = Math.max(
      lookback,
      maxOffsetInExpr(rule.box.left, pivotSpecs),
      maxOffsetInExpr(rule.box.top, pivotSpecs),
      maxOffsetInExpr(rule.box.right, pivotSpecs),
      maxOffsetInExpr(rule.box.bottom, pivotSpecs)
    )
  }
  for (const rule of lineRules) {
    lookback = Math.max(
      lookback,
      maxOffsetInExpr(rule.line.x1, pivotSpecs),
      maxOffsetInExpr(rule.line.x2, pivotSpecs)
    )
  }

  return {
    varToInputId,
    conditions,
    boxRules,
    pivotSpecs,
    lineRules,
    lookback,
    fillLoop,
    arrayVars,
    creationBarArray: findCreationBarArray(boxRules),
  }
}

function parseArrayVars(source: string): string[] {
  const names: string[] = []
  const re = /var\s+\w+\[\]\s+(\w+)\s*=\s*array\.new/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    names.push(match[1])
  }
  return names
}
