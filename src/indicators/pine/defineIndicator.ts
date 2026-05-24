import { BaseIndicator } from '../base/BaseIndicator'
import type { PineJS, PineJSContext, InputCallback, DefaultStyle } from '../types'
import { hasInputChange } from '../base/indicatorHelpers'
import { PineRuntime } from './PineRuntime'
import type { PineInputDef } from './pineInput'

export type PinePlotConfig = {
  id: string
  type: string
  hidden?: boolean
  defaultStyle?: DefaultStyle
}

export type PineIndicatorHandlers<TState = void> = {
  /** Called when settings change (not on first load). Return true to reset all shapes/state. */
  onSettings?: (
    pine: PineRuntime,
    changes: Record<string, unknown>,
    state: TState,
    indicator: BaseIndicator
  ) => boolean | void
  /** Called every bar — return a plot value or NaN. */
  onBar: (pine: PineRuntime, state: TState, indicator: BaseIndicator) => number | void
  /** Called when indicator state is reset. */
  onReset?: (state: TState, indicator: BaseIndicator) => void
}

export type PineIndicatorConfig<TState = void> = {
  id: string
  title: string
  description?: string
  overlay?: boolean
  /** When false, uses `plot` or a hidden dummy plot. */
  hiddenPlot?: boolean
  plot?: PinePlotConfig
  inputs?: PineInputDef[]
  createState?: (indicator: BaseIndicator) => TState
} & PineIndicatorHandlers<TState>

export function defineIndicator<TState = void>(
  config: PineIndicatorConfig<TState>
): new () => BaseIndicator {
  const {
    id,
    title,
    description = title,
    overlay = true,
    hiddenPlot = true,
    plot,
    inputs = [],
    createState,
    onSettings,
    onBar,
    onReset,
  } = config

  return class DefinedPineIndicator extends BaseIndicator {
    private scriptState: TState | undefined

    constructor() {
      super(id, title, description)

      if (overlay) this.setPriceStudy(true)

      if (plot) {
        this.addPlot(plot.id, plot.type)
          .setPlotStyle(plot.id, { title: '', isHidden: plot.hidden ?? false })
          .setDefaultStyle(plot.id, plot.defaultStyle ?? { visible: false, color: 'transparent', plottype: 0 })
      } else if (hiddenPlot) {
        this.addPlot('plot_0', 'line')
          .setPlotStyle('plot_0', { title: '', isHidden: true })
          .setDefaultStyle('plot_0', { visible: false, color: 'transparent', plottype: 0 })
      }

      const groups = new Map<string, PineInputDef[]>()
      for (const inp of inputs) {
        const group = inp.group ?? 'Settings'
        if (!groups.has(group)) groups.set(group, [])
        groups.get(group)!.push(inp)
      }

      for (const [groupName, groupInputs] of groups) {
        this.addInputGroup(
          groupName,
          groupInputs.map((inp) => ({
            type: inp.type,
            id: inp.id,
            name: inp.name,
            defval: inp.defval,
            min: inp.min,
            max: inp.max,
            step: inp.step,
            options: inp.options,
            inline: inp.inline,
          }))
        )
      }

      if (createState) {
        this.scriptState = createState(this)
      }
    }

    init(_ctx: PineJSContext, _input: InputCallback, changes: Record<string, unknown> | null): void {
      if (!changes || !onSettings || !this.scriptState) return
      this.syncScriptStatePeriod()
      const pine = this.createPine(_ctx)
      const shouldReset = onSettings(pine, changes, this.scriptState, this)
      if (shouldReset === true) this.reset()
    }

    main(context: PineJSContext, _input: InputCallback): number {
      if (createState && this.scriptState === undefined) {
        this.scriptState = createState(this)
      }
      this.syncScriptStatePeriod()
      const pine = this.createPine(context)
      const state = this.scriptState as TState
      const result = onBar(pine, state, this)
      return typeof result === 'number' && Number.isFinite(result) ? result : NaN
    }

    reset(): void {
      super.reset()
      if (this.scriptState !== undefined && onReset) {
        onReset(this.scriptState, this)
      } else if (createState) {
        this.scriptState = createState(this)
      }
    }

    private syncScriptStatePeriod(): void {
      const state = this.scriptState as { period?: string | null } | undefined
      if (state && 'period' in state) {
        state.period = this.period
      }
    }

    private createPine(context: PineJSContext): PineRuntime {
      const PineJS = this._PineJS
      if (!PineJS) throw new Error(`[${id}] PineJS runtime not ready`)
      return new PineRuntime(this, context, PineJS)
    }
  }
}

export { hasInputChange }
