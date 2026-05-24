import type { PineMetaInput, PineMetaPlot, PineScriptMeta } from '../../types/pine'

export type { PineMetaInput, PineMetaPlot, PineScriptMeta }

const PINE_COLORS: Record<string, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
}

function camelToSnake(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

function idFromFilePath(filePath: string): { id: string; title: string } {
  const base = filePath.split(/[/\\]/).pop()?.replace(/\.pine$/i, '') ?? 'Study'
  const id = base.replace(/Indicator$/i, '') || base
  const title = id.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return { id, title }
}

function parseColorDefval(raw: string): string {
  const m = raw.match(/color\.new\s*\(\s*color\.(\w+)\s*,\s*(\d+(?:\.\d+)?)\s*\)/i)
  if (!m) return raw.trim()
  const rgb = PINE_COLORS[m[1].toLowerCase()] ?? [128, 128, 128]
  const alpha = (100 - Number(m[2])) / 100
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(2)})`
}

function extractFirstArg(args: string): string {
  const trimmed = args.trim()
  if (trimmed.startsWith('color.new')) {
    let depth = 0
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '(') depth++
      if (trimmed[i] === ')') {
        depth--
        if (depth === 0) return trimmed.slice(0, i + 1)
      }
    }
  }
  const comma = trimmed.indexOf(',')
  return comma === -1 ? trimmed : trimmed.slice(0, comma).trim()
}

function parseFirstArg(args: string): unknown {
  const first = extractFirstArg(args)
  if (first === 'true') return true
  if (first === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(first)) return Number(first)
  if (first.startsWith('color.')) return parseColorDefval(first)
  const quoted = first.match(/^"([^"]*)"/)
  if (quoted) return quoted[1]
  return first
}

function parseIndicatorDecl(source: string, filePath: string) {
  const m = source.match(/indicator\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"([^)]*)\)/i)
  if (m) {
    return {
      title: m[1],
      id: m[2],
      overlay: /overlay\s*=\s*true/i.test(m[3]),
    }
  }
  const fallback = idFromFilePath(filePath)
  return { ...fallback, overlay: true }
}

function parseInputLine(line: string): { varName: string; pineType: string; argsRaw: string } | null {
  const start = line.match(/^\s*(\w+)\s*=\s*input\.(bool|int|float|color|string)\s*\(/i)
  if (!start) return null

  const openIdx = line.indexOf('(')
  let depth = 0
  for (let i = openIdx; i < line.length; i++) {
    if (line[i] === '(') depth++
    if (line[i] === ')') {
      depth--
      if (depth === 0) {
        return {
          varName: start[1],
          pineType: start[2],
          argsRaw: line.slice(openIdx + 1, i),
        }
      }
    }
  }
  return null
}

function parseInputDecls(source: string): PineMetaInput[] {
  const inputs: PineMetaInput[] = []

  for (const line of source.split(/\r?\n/)) {
    const parsed = parseInputLine(line)
    if (!parsed) continue

    const { varName, pineType, argsRaw } = parsed
    const nameMatch = argsRaw.match(/,\s*"([^"]+)"/)
    const groupMatch = argsRaw.match(/group\s*=\s*"([^"]+)"/i)
    const minMatch = argsRaw.match(/minval\s*=\s*(-?\d+(?:\.\d+)?)/i)
    const maxMatch = argsRaw.match(/maxval\s*=\s*(-?\d+(?:\.\d+)?)/i)

    const type =
      pineType === 'int' ? 'integer' : pineType === 'string' ? 'text' : (pineType as PineMetaInput['type'])

    let defval = parseFirstArg(argsRaw)
    if (pineType === 'color' && typeof defval === 'string' && defval.startsWith('color.')) {
      defval = parseColorDefval(defval)
    }

    inputs.push({
      id: camelToSnake(varName),
      type,
      name: nameMatch?.[1] ?? varName,
      defval,
      min: minMatch ? Number(minMatch[1]) : undefined,
      max: maxMatch ? Number(maxMatch[1]) : undefined,
      group: groupMatch?.[1],
    })
  }

  return inputs
}

function parsePlotDecl(source: string, hasBoxes: boolean): PineMetaPlot | undefined {
  const plots = [...source.matchAll(/plot\s*\(([\s\S]*?)\)/gi)]
  if (plots.length === 0) {
    return hasBoxes ? { type: 'bg_colorer', visible: true, color: 'red' } : undefined
  }
  const args = plots[plots.length - 1][1]
  const hidden = /display\s*=\s*display\.none/i.test(args)
  return {
    type: hasBoxes ? 'bg_colorer' : 'line',
    visible: !hidden,
    color: hidden ? 'red' : 'red',
  }
}

/** Build study meta from standard Pine declarations (`indicator()`, `input.*`, `plot()`). */
export function buildPineScriptMeta(source: string, filePath = ''): PineScriptMeta {
  const hasBoxes = /box\.new\s*\(/i.test(source)
  const indicator = parseIndicatorDecl(source, filePath)
  const inputs = parseInputDecls(source)
  const plot = parsePlotDecl(source, hasBoxes)

  return {
    id: indicator.id,
    title: indicator.title,
    description: indicator.id,
    overlay: indicator.overlay,
    plot,
    inputs,
  }
}

/** @deprecated Use {@link buildPineScriptMeta} */
export const parsePineScriptMeta = buildPineScriptMeta

export function pineMetaToInputs(meta: PineScriptMeta) {
  return (meta.inputs ?? []).map((inp) => ({
    type: inp.type === 'int' ? 'integer' : inp.type,
    id: inp.id,
    name: inp.name,
    defval: inp.defval,
    min: inp.min,
    max: inp.max,
    step: inp.step,
    options: inp.options,
    group: inp.group,
  }))
}
