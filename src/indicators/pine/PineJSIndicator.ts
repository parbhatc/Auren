import { BaseIndicator } from '../base/BaseIndicator'
import type { PineJSContext, InputCallback } from '../types'
import type { ParsedPineBody, PineScriptMeta } from '../types/pine'
import { pineDebug } from './debug/pineDebug'
import { buildPineScriptMeta, pineMetaToInputs } from './parser/parsePineMeta'
import { parsePineBody } from './parser/parsePineBody'
import { getPineRuntime, type PineIndicatorContext } from './runtime/registry'

export class PineJSIndicator extends BaseIndicator {
  readonly pineSource: string
  readonly pinePath: string

  private readonly meta: PineScriptMeta
  private readonly parsed: ParsedPineBody
  private readonly runtimeKind: string
  private readonly runtimeCtx: PineIndicatorContext
  private runtimeState: unknown

  constructor(pineSource: string, pinePath: string) {
    const meta = buildPineScriptMeta(pineSource, pinePath)
    const parsed = parsePineBody(pineSource, meta)
    const runtimeKind = meta.id.toLowerCase()

    super(meta.id, meta.title, meta.description ?? meta.title)

    this.pineSource = pineSource
    this.pinePath = pinePath
    this.meta = meta
    this.parsed = parsed
    this.runtimeKind = runtimeKind
    this.runtimeCtx = { indicator: this, meta, parsed }

    const runtime = getPineRuntime(runtimeKind)
    this.runtimeState = runtime.createState(this.runtimeCtx)

    this.setPriceStudy(true)
    this.configurePlots(runtimeKind, meta, parsed)

    const inputs = pineMetaToInputs(meta)
    const groups = new Map<string, typeof inputs>()
    for (const inp of inputs) {
      const group = inp.group ?? 'Settings'
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(inp)
    }
    for (const [groupName, groupInputs] of groups) {
      this.addInputGroup(
        groupName,
        groupInputs.map((inp) => ({
          type: inp.type === 'bool' ? 'boolean' : inp.type,
          id: inp.id,
          name: inp.name,
          defval: inp.defval,
          min: inp.min,
          max: inp.max,
          step: inp.step,
          options: inp.options,
        }))
      )
    }

    pineDebug(meta.id, `registered (${runtimeKind})`)
  }

  private configurePlots(_runtimeKind: string, meta: PineScriptMeta, parsed: ParsedPineBody): void {
    if (parsed.boxRules.length > 0 || parsed.fillLoop) {
      this.addPlot('plot_0', 'bg_colorer')
        .setPlotStyle('plot_0', { title: '', isHidden: false })
        .setDefaultStyle('plot_0', { visible: true, color: 'red', plottype: 0 })
      return
    }
    if (parsed.lineRules.length > 0) {
      this.addPlot('plot_0', 'line')
        .setPlotStyle('plot_0', { title: meta.title, isHidden: false })
        .setDefaultStyle('plot_0', { visible: true, color: 'blue', plottype: 0 })
      return
    }
    if (meta.plot) {
      this.addPlot('plot_0', meta.plot.type)
        .setPlotStyle('plot_0', { title: '', isHidden: meta.plot.visible === false })
        .setDefaultStyle('plot_0', {
          visible: meta.plot.visible ?? false,
          color: meta.plot.color ?? 'red',
          plottype: 0,
        })
    } else {
      this.addPlot('plot_0', 'line')
        .setPlotStyle('plot_0', { title: '', isHidden: true })
        .setDefaultStyle('plot_0', { visible: false, color: 'red', plottype: 0 })
    }
  }

  init(_context: PineJSContext, _inputCallback: InputCallback, changes: Record<string, unknown> | null): void {
    if (changes === null) return
    const runtime = getPineRuntime(this.runtimeKind)
    runtime?.init?.(this.runtimeCtx, this.runtimeState, changes)
  }

  main(context: PineJSContext, _inputCallback: InputCallback): number {
    return getPineRuntime(this.runtimeKind).main(this.runtimeCtx, this.runtimeState, context)
  }

  reset(): void {
    pineDebug(this.meta.id, 'reset')
    getPineRuntime(this.runtimeKind).resetState(this.runtimeState)
    super.reset()
  }

  onShown(): void {
    pineDebug(this.meta.id, 'onShown')
  }

  onHidden(): void {
    pineDebug(this.meta.id, 'onHidden')
  }

  onRemove(): void {
    pineDebug(this.meta.id, 'onRemove')
    this.reset()
  }
}
