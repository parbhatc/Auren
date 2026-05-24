import { CandleNode } from '../base/CandleNode'
import { BaseIndicator } from '../base/BaseIndicator'
import type { PineJSContext, InputCallback } from '../types'
import type { ParsedPineBody, PineScriptMeta } from '../types/pine'
import { pineDebug, isPineDebugEnabled } from './debug/pineDebug'
import { buildPineScriptMeta, pineMetaToInputs } from './parser/parsePineMeta'
import { parsePineBody } from './parser/parsePineBody'

type StoredBox = {
  shapeId: string
  start: number
  end: number
  type: 'bullish' | 'bearish'
  period: string | null
  ruleIndex: number
}

/**
 * Template indicator for `.pine` scripts with `box.new` rules.
 * Bar/box runtime matches the original working FVGIndicator class.
 */
export class PineJSIndicator extends BaseIndicator {
  readonly pineSource: string
  readonly pinePath: string

  private readonly meta: PineScriptMeta
  private readonly parsed: ParsedPineBody
  private cache = new Map<number, CandleNode>()
  private list = new Map<number, StoredBox>()

  constructor(pineSource: string, pinePath: string) {
    const meta = buildPineScriptMeta(pineSource, pinePath)
    const parsed = parsePineBody(pineSource, meta)

    super(meta.id, meta.title, meta.description ?? meta.title)

    this.pineSource = pineSource
    this.pinePath = pinePath
    this.meta = meta
    this.parsed = parsed

    const hasBoxes = parsed.boxRules.length > 0
    this.setPriceStudy(true)

    if (hasBoxes) {
      this.addPlot('plot_0', 'bg_colorer')
        .setPlotStyle('plot_0', { title: '', isHidden: false })
        .setDefaultStyle('plot_0', { visible: true, color: 'red', plottype: 0 })
    } else if (meta.plot) {
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

    pineDebug(meta.id, 'loaded', {
      path: pinePath,
      boxRules: parsed.boxRules.length,
      lookback: parsed.lookback,
    })
    if (isPineDebugEnabled()) {
      console.log(`[pine:${meta.id}] ready — add "${meta.title}" to chart`)
    }
  }

  init(_context: PineJSContext, _inputCallback: InputCallback, changes: Record<string, unknown> | null): void {
    if (changes === null) return

    const showId = this.showInputId()
    if (showId && (changes as Record<string, unknown>)[showId]) {
      this.reset()
      return
    }

    const lengthId = this.parsed.varToInputId.get('lengthOfBox') ?? 'length_of_box'
    const bullId = this.parsed.varToInputId.get('bullishColor') ?? 'bullish_color'
    const bearId = this.parsed.varToInputId.get('bearishColor') ?? 'bearish_color'
    const ch = changes as Record<string, { new?: unknown }>

    if (ch[lengthId] || ch[bullId] || ch[bearId]) {
      const lengthOfBox = ch[lengthId]?.new
      const bullishColor = ch[bullId]?.new
      const bearishColor = ch[bearId]?.new

      this.list.forEach((item) => {
        const shape = this.getShapes().getShapeById(item.shapeId)
        if (!shape) return

        if (ch[lengthId] && lengthOfBox != null) {
          const extendedEnd = item.end / 1000 + this.getExtendedLength(Number(lengthOfBox), item.period)
          try {
            const points = (shape as { getPoints: () => Array<{ time: number; price: number }> }).getPoints()
            points[1].time = extendedEnd
            ;(shape as { setPoints: (p: typeof points) => void }).setPoints(points)
          } catch {
            /* removed */
          }
        }

        if (ch[bullId] || ch[bearId]) {
          let update = Boolean(ch[bullId] && ch[bearId])
          if (!update) {
            update = ch[bullId] ? item.type === 'bullish' : item.type === 'bearish'
          }
          if (update) {
            const color = String(ch[bullId] ? bullishColor : bearishColor)
            void this.getShapes().updateRectangle(item.shapeId, {
              color,
              backgroundColor: color,
              textColor: this.rgbaToOpaque(color),
            })
          }
        }
      })
    }
  }

  main(context: PineJSContext, _inputCallback: InputCallback): number {
    const showId = this.showInputId()
    if (showId && !this.getInputValueById(showId)) {
      return NaN
    }

    const PineJS = this._PineJS
    if (!PineJS) return NaN

    const high = PineJS.Std.high(context)
    const low = PineJS.Std.low(context)
    const close = PineJS.Std.close(context)
    const open = PineJS.Std.open(context)
    const time = PineJS.Std.time(context)
    const candle = this.processCandle(time, open, high, low, close)

    if (this.cache.has(time)) {
      const current = this.cache.get(time)!
      if (current.at(1) && current.at(2)) {
        void this.onCandle(current)
        this.cache.delete(time)
      }
      return NaN
    }

    if (candle) void this.onCandle(candle)
    return NaN
  }

  private async onCandle(candle: CandleNode): Promise<void> {
    const middleCandle = candle.at(1)
    const firstCandle = candle.at(2)

    if (!firstCandle || !middleCandle || !candle) {
      this.cache.set(candle.time, candle)
      return
    }

    const isBullish = candle.low > firstCandle.high
    const isBearish = candle.high < firstCandle.low

    if (!isBullish && !isBearish) return

    const lengthId = this.parsed.varToInputId.get('lengthOfBox') ?? 'length_of_box'
    const bullId = this.parsed.varToInputId.get('bullishColor') ?? 'bullish_color'
    const bearId = this.parsed.varToInputId.get('bearishColor') ?? 'bearish_color'

    const lengthOfBox = Number(this.getInputValueById(lengthId) ?? 20)
    const bullishColor = String(this.getInputValueById(bullId) ?? 'rgba(0, 255, 0, 0.20)')
    const bearishColor = String(this.getInputValueById(bearId) ?? 'rgba(255, 0, 0, 0.20)')

    const start = firstCandle.time / 1000
    const extendedEnd = candle.time / 1000 + this.getExtendedLength(lengthOfBox)
    const points = isBullish
      ? [
          { time: start, price: candle.low },
          { time: extendedEnd, price: firstCandle.high },
        ]
      : [
          { time: start, price: candle.high },
          { time: extendedEnd, price: firstCandle.low },
        ]

    const properties = {
      color: isBullish ? bullishColor : bearishColor,
      backgroundColor: isBullish ? bullishColor : bearishColor,
      text: 'FVG',
      textColor: this.rgbaToOpaque(isBullish ? bullishColor : bearishColor),
    }

    if (this.list.has(candle.time)) {
      const item = this.list.get(candle.time)!
      await this.getShapes().updateRectangle(item.shapeId, { properties })
      return
    }

    const shapeId = await this.getShapes().createRectangle(points[0], points[1], { properties })
    if (!shapeId) return

    this.list.set(candle.time, {
      shapeId,
      start: firstCandle.time,
      end: candle.time,
      type: isBullish ? 'bullish' : 'bearish',
      period: this.period,
      ruleIndex: 0,
    })
  }

  getExtendedLength(lengthOfBox: number, period: string | null = null): number {
    const res = period ?? this.period
    if (!res) return 0
    const chartBarIntervalMinutes = this.resolutionToMinutes(res) / 60
    const chartBarIntervalSeconds = chartBarIntervalMinutes * 60
    return parseInt(res, 10) * 60 * lengthOfBox + lengthOfBox * chartBarIntervalSeconds
  }

  private showInputId(): string | null {
    for (const rule of this.parsed.boxRules) {
      for (const varName of rule.guardVars) {
        if (!this.parsed.conditions.has(varName)) {
          return this.parsed.varToInputId.get(varName) ?? varName
        }
      }
    }
    return null
  }

  reset(): void {
    pineDebug(this.meta.id, 'reset')
    super.reset()
    this.cache.clear()
    this.list.clear()
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
