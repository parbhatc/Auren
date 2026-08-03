import { BaseIndicator } from '/js/indicators/BaseIndicator.js'
import { createBool, createColor, createInt } from '/js/indicators/builders.js'
import { buildPositionBoxes, filterPaperSnapshotToBars } from './positionBoxes.js?v=4'
import {
  getPaperFeedSnapshot,
  getPaperFeedVersion,
  startPaperFeedPolling,
  subscribePaperFeed,
} from './paperFeed.js?v=2'

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
      createBool('showHoverStats', 'Show position stats on hover', true, {
        section: 'Display', showInStatusLine: false,
      }),
      createInt('riskAmountUsd', 'Risk amount ($)', 150, {
        min: 1, max: 100000, section: 'Position style', showInStatusLine: false,
      }),
      createColor('targetColor', 'Target area', { color: '#089981', opacity: 18 }, {
        section: 'Position style', showInStatusLine: false,
      }),
      createColor('stopColor', 'Stop area', { color: '#f23645', opacity: 18 }, {
        section: 'Position style', showInStatusLine: false,
      }),
      createBool('showPositionBorder', 'Show position border', false, {
        section: 'Position style', showInStatusLine: false,
      }),
      createColor('targetBorderColor', 'Target border', { color: '#089981', opacity: 100 }, {
        section: 'Position style', showInStatusLine: false,
      }),
      createColor('stopBorderColor', 'Stop border', { color: '#f23645', opacity: 100 }, {
        section: 'Position style', showInStatusLine: false,
      }),
      createInt('positionBorderWidth', 'Border width', 1, {
        min: 1, max: 4, section: 'Position style', showInStatusLine: false,
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

  legendParams(instance) {
    const snapshot = getPaperFeedSnapshot()
    if (snapshot.openPosition) return [`S${snapshot.openPosition.setupId} OPEN`]
    const tradeCount = Number(instance?._loadedTradeCount) || 0
    return [tradeCount ? `${tradeCount} loaded trades` : snapshot.error || 'no loaded trades']
  }

  static overlayRecomputeExtra(instance, ctx) {
    return `${getPaperFeedVersion()}|${ctx.primarySymbol ?? ''}|${JSON.stringify(instance.inputs)}`
  }

  static computeOverlay(utcBars, _chartBars, instance, ctx = {}) {
    const symbol = String(ctx.primarySymbol ?? ctx.symbol ?? '').toUpperCase()
    if (!/(^|[:_])M?NQ(?:1!?|[A-Z0-9]*)?$/.test(symbol) && !symbol.includes('MNQ') && !symbol.includes('NQ')) return []
    const loadedSnapshot = filterPaperSnapshotToBars(getPaperFeedSnapshot(), utcBars)
    instance._loadedTradeCount = loadedSnapshot.trades.length
    return buildPositionBoxes(
      loadedSnapshot,
      instance.inputs,
      Number(ctx.barSec) || 60,
    )
  }
}

BaseIndicator.define(CustomSetupsPaperIndicator)
export { startPaperFeedPolling, subscribePaperFeed }
export default CustomSetupsPaperIndicator
