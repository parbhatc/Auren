/**
 * Swing High/Low Indicator
 */
import { BaseIndicator } from '../base/BaseIndicator'
import { CandleNode } from '../base/CandleNode'
import type { PineJSContext, InputCallback } from '../types'
import { PivotInfo } from '../../types/chart'

export class SwingIndicator extends BaseIndicator {
  private pivotHighs: PivotInfo[]
  private pivotLows: PivotInfo[]
  private list: Map<number, { shapeId: string; is_finished: boolean }>
  private _candlePromiseChain: Promise<void>

  constructor() {
    super('Swing', 'Swing High/Low', 'Swing')
    this.setPriceStudy(true)
      .addPlot('plot_0', 'line')
      .setPlotStyle('plot_0', { title: 'Swing', isHidden: false })
      .setDefaultStyle('plot_0', {
        visible: true,
        color: 'blue',
        plottype: 0
      })

    this.addInputGroup('Swing Settings', [
      { type: 'integer', id: 'left_bars', name: 'Left Bars', defval: 5, min: 1, max: 50 },
      { type: 'integer', id: 'right_bars', name: 'Right Bars', defval: 5, min: 1, max: 50 }
    ])
    
    this.pivotHighs = []
    this.pivotLows = []
    this.list = new Map()
    this._candlePromiseChain = Promise.resolve()
  }

  main(context: PineJSContext, _inputCallback: InputCallback): number {
    const PineJS = (this as any)._PineJS
    const indicator = (this as any)._indicatorInstance || this
    
    const high = PineJS.Std.high(context)
    const low = PineJS.Std.low(context)
    const close = PineJS.Std.close(context)
    const open = PineJS.Std.open(context)
    const time = PineJS.Std.time(context)
    
    const candle = indicator.processCandle(time, open, high, low, close)
    
    if (!candle) {
      return NaN
    }
    
    if (candle) {
      indicator.onCandle(candle)
    }
    
    return NaN
  }

  onCandle(candle: CandleNode): void {
    this._candlePromiseChain = this._candlePromiseChain.then(async () => {
      const leftBars = this.getInputValueById('left_bars') || 5
      const rightBars = this.getInputValueById('right_bars') || 5
      const pivotHigh = this.pivotHigh(leftBars, rightBars, candle)
      const pivotLow = this.pivotLow(leftBars, rightBars, candle)

      if (!pivotHigh && !pivotLow) {
        const previousPivotHigh = this.getPivotBefore(candle, false)
        const previousPivotLow = this.getPivotBefore(candle, true)

        if (!previousPivotHigh && !previousPivotLow) {
          return
        }
        if (previousPivotHigh) {
          const item = this.list.get(previousPivotHigh.time)
          if (!item) {
            return
          }
          const shape = this.getShapes().getShapeById(item.shapeId)
          if (shape) {
            const points = (shape as any).getPoints()
            points[1].time = candle.time / 1000
            ;(shape as any).setPoints(points)
          }
        }
        if (previousPivotLow) {
          const item = this.list.get(previousPivotLow.time)
          if (!item) {
            return
          }
          const shape = this.getShapes().getShapeById(item.shapeId)
          if (shape) {
            const points = (shape as any).getPoints()
            points[1].time = candle.time / 1000
            ;(shape as any).setPoints(points)
          }
        }
        return
      }
      
      if (pivotHigh) {
        const exists = this.pivotHighs.some(p => p.time === pivotHigh.time)
        if (!exists) {
          const previousPivotHigh = this.getPivotBefore(candle, false)
          if (previousPivotHigh) {
            const item = this.list.get(previousPivotHigh.time)
            if (item) {
              const shape = this.getShapes().getShapeById(item.shapeId)
              if (shape) {
                const points = (shape as any).getPoints()
                points[1].time = candle.time / 1000
                ;(shape as any).setPoints(points)
              }
            }
          }
          this.pivotHighs.push(pivotHigh)
          this.pivotHighs.sort((a, b) => a.time - b.time)
          
          const currentIndex = this.pivotHighs.findIndex(p => p.time === pivotHigh.time)
          const beforePivot = currentIndex > 0 ? this.pivotHighs[currentIndex - 1] : null
          await this.onPivot('high', pivotHigh, beforePivot, candle)
        }
      }
      
      if (pivotLow) {
        const exists = this.pivotLows.some(p => p.time === pivotLow.time)
        if (!exists) {
          const previousPivotLow = this.getPivotBefore(candle, true)
          if (previousPivotLow) {
            const item = this.list.get(previousPivotLow.time)
            if (item) {
              const shape = this.getShapes().getShapeById(item.shapeId)
              if (shape) {
                const points = (shape as any).getPoints()
                points[1].time = candle.time / 1000
                ;(shape as any).setPoints(points)
              }
            }
          }
          
          this.pivotLows.push(pivotLow)
          this.pivotLows.sort((a, b) => a.time - b.time)
          
          const currentIndex = this.pivotLows.findIndex(p => p.time === pivotLow.time)
          const beforePivot = currentIndex > 0 ? this.pivotLows[currentIndex - 1] : null
          await this.onPivot('low', pivotLow, beforePivot, candle)
        }
      }
    })
  }
  
  getPivotBefore(candle: CandleNode, low: boolean): PivotInfo | null {
    const pivotArray = low ? this.pivotLows : this.pivotHighs
    
    for (let i = pivotArray.length - 1; i >= 0; i--) {
      if (pivotArray[i].time < candle.time) {
        return pivotArray[i]
      }
    }
    
    return null
  }
  
  async onPivot(type: 'high' | 'low', pivot: PivotInfo, beforePivot: PivotInfo | null, candle: CandleNode): Promise<void> {
    if (!beforePivot) {
      return
    }
    const point1 = {
      time: pivot.time / 1000,
      price: pivot.price
    }
    const point2 = {
      time: candle.time / 1000,
      price: point1.price
    }
    const shapeId = await this.getShapes().createTrendLine(point1, point2, {
      properties: {
        linecolor: type === 'high' ? 'red' : 'green',
        linestyle: 0,
        linewidth: 2
      }
    })
    if (shapeId) {
      this.list.set(pivot.time, { shapeId, is_finished: false })
    }
  }
  
  reset(): void {
    super.reset()
    this.pivotHighs = []
    this.pivotLows = []
    this._candlePromiseChain = Promise.resolve()
  }
}

