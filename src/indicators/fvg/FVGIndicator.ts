/**
 * FVG (Fair Value Gap) Indicator
 */
import { BaseIndicator } from '../base/BaseIndicator'
import { CandleNode } from '../base/CandleNode'
import type { PineJSContext, InputCallback } from '../types'

export class FVGIndicator extends BaseIndicator {
  private cache: Map<number, CandleNode>
  private list: Map<number, { shapeId: string; start: number; end: number; type: 'bullish' | 'bearish'; period: string | null }>

  constructor() {
    super('FVG', 'Fair Value Gap', 'FVG')
    this.setPriceStudy(true)
      .addPlot('plot_0', 'bg_colorer')
      .setPlotStyle('plot_0', { title: '', isHidden: false })
      .setDefaultStyle('plot_0', {
        visible: true,
        color: 'red',
        plottype: 0
      })

    this.addInputGroup('FVG Settings', [
      { type: 'boolean', id: 'show_fvg', name: 'Show FVG', defval: true },
      { type: 'integer', id: 'length_of_box', name: 'Length of Box', defval: 20, min: 1, max: 50 },
      { type: 'color', id: 'bullish_color', name: 'Bullish Color', defval: 'rgba(0, 255, 0, 0.20)' },
      { type: 'color', id: 'bearish_color', name: 'Bearish Color', defval: 'rgba(255, 0, 0, 0.20)' }
    ])
    this.cache = new Map()
    this.list = new Map()
  }

  init(_context: PineJSContext, _inputCallback: InputCallback, changes: Record<string, any> | null): void {
    const indicator = (this as any)._indicatorInstance || this

    if (changes === null) {
      return
    }
    if (changes.show_fvg) {
      indicator.reset()
    }
    
    if (changes.length_of_box || changes.bullish_color || changes.bearish_color) {
      const lengthOfBox = changes?.length_of_box?.new
      const bullishColor = changes?.bullish_color?.new
      const bearishColor = changes?.bearish_color?.new
      indicator.list.forEach((item: any) => {
        const shape = indicator.getShapes().getShapeById(item.shapeId)
        if (shape) {
          if (changes.length_of_box) {
            const extendedEnd = (item.end / 1000) + indicator.getExtendedLength(lengthOfBox, item.period)
            const points = (shape as any).getPoints()
            points[1].time = extendedEnd
            ;(shape as any).setPoints(points)
          }

          if (changes.bullish_color || changes.bearish_color) {
            let update = changes.bullish_color && changes.bearish_color

            if (!update) {
              if (changes.bullish_color) {
                update = item.type === 'bullish'
              } else {
                update = item.type === 'bearish'
              }
            }
            if (update) {
              const color = changes.bullish_color ? bullishColor : bearishColor
              indicator.getShapes().updateRectangle(item.shapeId, {
                color: color,
                backgroundColor: color,
                textColor: indicator.rgbaToOpaque(color)
              })
            }
          }
        }
      })
    }
  }

  main(context: PineJSContext, _inputCallback: InputCallback): number {
    const PineJS = (this as any)._PineJS
    const indicator = (this as any)._indicatorInstance || this

    if (!indicator.getInputValueById('show_fvg')) {
      return NaN
    }
    const high = PineJS.Std.high(context)
    const low = PineJS.Std.low(context)
    const close = PineJS.Std.close(context)
    const open = PineJS.Std.open(context)
    const time = PineJS.Std.time(context)
    const candle = indicator.processCandle(time, open, high, low, close)

    if (indicator.cache.has(time)) {
      const current = indicator.cache.get(time)!
      const middle = current.at(1)
      const first = current.at(2)

      if (middle && first) {
        indicator.onCandle(current)
        indicator.cache.delete(time)
      }
      return NaN
    }
    if (candle) {
      indicator.onCandle(candle)
    }
    return NaN
  }

  async onCandle(candle: CandleNode): Promise<void> {
    const middleCandle = candle.at(1)
    const firstCandle = candle.at(2)

    if (!firstCandle || !middleCandle || !candle) {
      this.cache.set(candle.time, candle)
      return
    }
    const isBullish = candle.low > firstCandle.high
    const isBearish = candle.high < firstCandle.low

    if (isBullish || isBearish) {
      const lengthOfBox = this.getInputValueById('length_of_box')
      const bullishColor = this.getInputValueById('bullish_color')
      const bearishColor = this.getInputValueById('bearish_color')
      const start = firstCandle.time / 1000
      const extendedEnd = (candle.time / 1000) + this.getExtendedLength(lengthOfBox)
      const points = isBullish
        ? [{ time: start, price: candle.low }, { time: extendedEnd, price: firstCandle.high }]
        : [{ time: start, price: candle.high }, { time: extendedEnd, price: firstCandle.low }]

      const properties = {
        color: isBullish ? bullishColor : bearishColor,
        backgroundColor: isBullish ? bullishColor : bearishColor,
        text: 'FVG',
        textColor: isBullish ? this.rgbaToOpaque(bullishColor) : this.rgbaToOpaque(bearishColor)
      }
      if (this.list.has(candle.time)) {
        const item = this.list.get(candle.time)!
        const shapeId = item.shapeId
        await this.getShapes().updateRectangle(shapeId, {
          properties: properties
        })
        return
      }
      const shapeId = await this.getShapes().createRectangle(
        points[0],
        points[1],
        {
          properties: properties
        })
      if (shapeId) {
        this.list.set(candle.time, {
          shapeId,
          start: firstCandle.time,
          end: candle.time,
          type: isBullish ? 'bullish' : 'bearish',
          period: this.period
        })
      }
    }
  }

  getExtendedLength(lengthOfBox: number, period: string | null = null): number {
    if (!period) {
      period = this.period
    }
    if (!period) return 0
    const chartBarIntervalMinutes = this.resolutionToMinutes(period) / 60
    const chartBarIntervalSeconds = chartBarIntervalMinutes * 60
    return (parseInt(period) * 60) * lengthOfBox + (lengthOfBox * chartBarIntervalSeconds)
  }

  reset(): void {
    super.reset()
    this.cache.clear()
    this.list.clear()
  }
}

