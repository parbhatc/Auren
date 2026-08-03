import { BaseIndicator } from '/js/indicators/BaseIndicator.js'
import { createBool, createInt } from '/js/indicators/builders.js'
import { buildPositionBoxes } from './positionBoxes.js'
import { getPaperFeedSnapshot, getPaperFeedVersion } from './paperFeed.js'

class CustomSetupsPaperIndicator extends BaseIndicator {
  constructor() {
    super('custom-setups-paper', 'Custom Setups', 'Custom Setups 1-8 Live Paper')
    this.setOverlayPrimitive('boxes')
    this.setGraphicObjects([{ styleKey: 'graphicPositions', label: 'Trade positions', overlay: 'boxes' }])
    this.setInputs([
      createBool('drawPositionTool', 'Draw long/short position tool', true, {
        section: 'Display', showInStatusLine: false,
      }),
      createBool('showSignalLabels', 'Show setup signal labels', true, {
        section: 'Display', showInStatusLine: false,
      }),
      createInt('maxClosedTrades', 'Maximum closed trades', 1000, {
        min: 1, section: 'Display', showInStatusLine: false,
      }),
      ...Array.from({ length: 8 }, (_, index) => createBool(
        `showSetup${index + 1}`,
        `Setup ${index + 1}`,
        true,
        { section: 'Setups', showInStatusLine: false },
      )),
    ])
  }

  mergeStyleDefaults(style) {
    return { ...style, graphicPositions: style.graphicPositions ?? true }
  }

  legendParams() {
    const snapshot = getPaperFeedSnapshot()
    return [snapshot.openPosition ? `S${snapshot.openPosition.setupId} OPEN` : 'paper']
  }

  static overlayRecomputeExtra(instance, ctx) {
    return `${getPaperFeedVersion()}|${ctx.primarySymbol ?? ''}|${JSON.stringify(instance.inputs)}`
  }

  static computeOverlay(_utcBars, _chartBars, instance, ctx = {}) {
    const symbol = String(ctx.primarySymbol ?? ctx.symbol ?? '').toUpperCase()
    if (!/(^|[:_])M?NQ(?:1!?|[A-Z0-9]*)?$/.test(symbol) && !symbol.includes('MNQ') && !symbol.includes('NQ')) return []
    return buildPositionBoxes(getPaperFeedSnapshot(), instance.inputs, Number(ctx.barSec) || 60)
  }
}

BaseIndicator.define(CustomSetupsPaperIndicator)
export default CustomSetupsPaperIndicator
