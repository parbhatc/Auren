import { BaseIndicator } from '/js/indicators/BaseIndicator.js'
import {
  createBool,
  createColor,
  createFloat,
  createInt,
  createSelect,
  createText,
} from '/js/indicators/builders.js'
import { styleColor } from '/js/indicators/styleColor.js'
import { levelsHtf } from '/testing/js/indicators/levels/htf.js'
import { LevelsEngine } from '/testing/js/indicators/levels/LevelsEngine.js'
import { buildLevelsEngineOpts } from '/testing/js/indicators/levels/overlayMap.js'
import { buildReferenceLevelLines } from '/testing/js/indicators/levels/referenceLevels.js'
import { computeNiceSweepSignals } from './niceSweepEngine.js'

const LEVELS_FALLBACK_INPUTS = {
  timeLevels: [
    { enabled: true, label: '4H', layer: '240' },
    { enabled: true, label: '1H', layer: '60' },
    { enabled: false, label: '15m', layer: '15' },
  ],
  sessionLevels: [
    { enabled: true, label: 'Asia', sessionId: 'asia', startTime: '20:00', endTime: '00:00' },
    { enabled: true, label: 'London', sessionId: 'london', startTime: '02:00', endTime: '05:00' },
  ],
  previousDayEnabled: true,
  previousWeekEnabled: false,
  midpointEnabled: true,
  midpointStartTime: '18:00',
  newsEnabled: true,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  maxBarsBack: 300,
  maxUnswept: 50,
  maxSwept: 500,
  sweptHoldBars: 500,
  maxSessions: 3,
  mergeConfluence: true,
  showPriceInLabels: false,
}

function activeLevelsInstance(instance) {
  try {
    const widgets = [
      ...(globalThis.__AUREN_BWC_WIDGETS__ ?? []),
      ...(globalThis.__BWC_WIDGET__ ? [globalThis.__BWC_WIDGET__] : []),
    ]
    for (const widget of widgets) {
      const rows = widget?.indicators?.list?.() ?? []
      if (!rows.some((row) => row.instanceId === instance.instanceId)) continue
      const levels = rows.find((row) =>
        row.defId === 'levels' && row.paneIndex === instance.paneIndex
      )
      if (levels) return levels
    }
    return null
  } catch {
    return null
  }
}

function resolvedLevels(instance) {
  const active = activeLevelsInstance(instance)
  return {
    inputs: { ...LEVELS_FALLBACK_INPUTS, ...(active?.inputs ?? {}) },
    style: { ...(active?.style ?? {}), graphicLines: true, graphicLabels: true },
  }
}

function levelSweepLabel(line) {
  const side = line.kind === 'high' ? 'High' : 'Low'
  const main = String(line.label ?? line.referenceTag ?? '').trim()
  const session = String(line.sessionLabel ?? line.sessionTag ?? '').trim()
  if (main && session && !main.includes(session)) return `${main} + ${session} ${side}`
  return main || (session ? `${session} ${side}` : `Level ${side}`)
}

function computeLevelsSweeps(utcBars, chartBars, inputs, style, ctx) {
  if (!utcBars.length || utcBars.length !== chartBars.length) return []
  const anchorUnix = utcBars.at(-1)?.time
  if (anchorUnix == null) return []
  const engine = new LevelsEngine()
  const opts = {
    ...buildLevelsEngineOpts(inputs, style, ctx, engine, levelsHtf),
    chartBars,
    maxSwept: 500,
    sweptHoldBars: 500,
    showLabels: true,
    showPriceInLabels: false,
  }
  const referenceLines = buildReferenceLevelLines(
    utcBars,
    chartBars,
    anchorUnix,
    opts,
    ctx,
  )
  const { lines } = engine.run(utcBars, anchorUnix, { ...opts, referenceLines })
  return lines
    .filter((line) => line.swept && Number.isFinite(Number(line.sweepTime)))
    .map((line) => ({
      time: Number(line.sweepTime),
      kind: line.kind,
      price: Number(line.price),
      label: levelSweepLabel(line),
    }))
}

class NiceSweepIndicator extends BaseIndicator {
  constructor() {
    super('nice-sweep', 'NiceSweep', 'NiceSweep')
    this.setOverlayPrimitive('boxes')
    this.setGraphicObjects([
      { styleKey: 'graphicLabels', label: 'Entry markers', overlay: 'boxes' },
    ])
    this.setInputs([
      createText('windowStart', 'Start', '09:30', {
        section: 'New York trade window',
        showInStatusLine: false,
      }),
      createText('windowEnd', 'End', '11:00', {
        section: 'New York trade window',
        showInStatusLine: false,
      }),
      createSelect('direction', 'Allowed entries', 'both', [
        { id: 'both', label: 'Buy + Sell' },
        { id: 'long', label: 'Buy only' },
        { id: 'short', label: 'Sell only' },
      ], { section: 'Signals', showInStatusLine: false }),
      createBool('requireBodyDominance', 'Require body larger than both wicks', true, {
        section: 'Signals',
        showInStatusLine: false,
      }),
      createBool('requireDirectionalClose', 'Require clean directional close', true, {
        section: 'Signals',
        showInStatusLine: false,
      }),
      createFloat('minDirectionalClosePercent', 'Minimum close strength %', 80, {
        min: 50,
        max: 100,
        step: 5,
        section: 'Signals',
        showInStatusLine: false,
      }),
      createBool('requireStrongReaction', 'Require strong reaction body', true, {
        section: 'Signals',
        showInStatusLine: false,
      }),
      createFloat('displacementMultiplier', 'Strong body multiplier', 1.5, {
        min: 1,
        max: 5,
        step: 0.1,
        section: 'Signals',
        showInStatusLine: false,
      }),
      createInt('maxBarsAfterSweep', 'Maximum bars after sweep', 20, {
        min: 1,
        max: 120,
        section: 'Signals',
        showInStatusLine: false,
      }),
      createInt('sweepLookback', 'Internal sweep lookback', 6, {
        min: 2,
        max: 30,
        section: 'Signals',
        showInStatusLine: false,
      }),
      createInt('maxEntriesPerSweep', 'Maximum entries per sweep', 2, {
        min: 1,
        max: 5,
        section: 'Signals',
        showInStatusLine: false,
      }),
      createInt('cooldownBars', 'Minimum bars between entries', 0, {
        min: 0,
        max: 240,
        section: 'Signals',
        showInStatusLine: false,
      }),
      createInt('pivotLeft', '4H pivot left', 1, {
        min: 1,
        max: 10,
        section: '4H sweep',
        showInStatusLine: false,
      }),
      createInt('pivotRight', '4H pivot right', 1, {
        min: 1,
        max: 10,
        section: '4H sweep',
        showInStatusLine: false,
      }),
      createInt('maxSignals', 'Maximum entry markers', 100, {
        min: 1,
        max: 1000,
        section: 'Display',
        showInStatusLine: false,
      }),
      createColor('buyColor', 'Buy entry', { color: '#089981', opacity: 100 }, {
        section: 'Display',
        store: 'style',
        showInStatusLine: false,
      }),
      createColor('sellColor', 'Sell entry', { color: '#f23645', opacity: 100 }, {
        section: 'Display',
        store: 'style',
        showInStatusLine: false,
      }),
    ])
  }

  mergeStyleDefaults(style) {
    return {
      ...style,
      graphicLabels: style.graphicLabels ?? true,
      buyColor: style.buyColor ?? '#089981',
      sellColor: style.sellColor ?? '#f23645',
    }
  }

  legendParams(instance) {
    const inputs = instance.inputs ?? {}
    const direction = inputs.direction === 'long'
      ? 'Buy'
      : inputs.direction === 'short'
        ? 'Sell'
        : 'Buy + Sell'
    return [`${inputs.windowStart ?? '09:30'}–${inputs.windowEnd ?? '11:00'} NY`, direction]
  }

  requiredChartBars(_inputs, chartResolution) {
    return String(chartResolution).toUpperCase().endsWith('S') ? 3000 : 1500
  }

  collectDataNeeds(instance, pane) {
    const { inputs } = resolvedLevels(instance)
    const chartRes = pane.resolution ?? '1'
    const chartBars = pane.bars?.length ?? 3000
    const htf = levelsHtf.enabledResolutions(inputs, chartRes).map(({ tfId, tfSec }) => ({
      symbol: pane.symbol ?? '',
      resolution: tfId,
      countBack: levelsHtf.requiredHtfCountForLayer(inputs, chartBars, chartRes, tfSec),
    }))
    if ((inputs.previousDayEnabled !== false || inputs.previousWeekEnabled === true) &&
      !htf.some((need) => need.resolution === '60')) {
      htf.push({ symbol: pane.symbol ?? '', resolution: '60', countBack: 240 })
    }
    return {
      htf,
    }
  }

  static computeOverlay(utcBars, chartBars, instance, ctx = {}) {
    if (instance.style?.graphicLabels === false) return []
    const levels = resolvedLevels(instance)
    const levelSweeps = computeLevelsSweeps(
      utcBars,
      chartBars,
      levels.inputs,
      levels.style,
      ctx,
    )
    const signals = computeNiceSweepSignals({
      bars: utcBars,
      levelSweeps,
      inputs: instance.inputs,
      chartResolution: ctx.chartResolution,
      formingTime: ctx.formingBar?.time ?? null,
    })
    const style = instance.style ?? {}
    const barSeconds = Math.max(1, Number(ctx.barSec) || 30)
    return signals.map((signal) => {
      const index = utcBars.findIndex((bar) => Number(bar.time) === signal.time)
      const bar = index >= 0 ? utcBars[index] : null
      const nextTime = Number(utcBars[index + 1]?.time)
      return {
        kind: 'label',
        timeStart: signal.time,
        timeEnd: Number.isFinite(nextTime) ? nextTime : signal.time + barSeconds,
        priceTop: signal.price,
        priceBottom: signal.direction === 'long'
          ? Number(bar?.high ?? signal.price)
          : Number(bar?.low ?? signal.price),
        label: signal.direction === 'long' ? '▲' : '▼',
        labelAlign: 'center',
        fontSize: 14,
        fontWeight: 700,
        textColor: signal.direction === 'long'
          ? styleColor(style, 'buyColor', '#089981')
          : styleColor(style, 'sellColor', '#f23645'),
        hoverId: `nice-sweep:${signal.time}:${signal.direction}`,
        hoverLabel: [
          `NiceSweep ${signal.direction === 'long' ? 'BUY' : 'SELL'}`,
          ...signal.why.map((reason) => `✓ ${reason}`),
        ].join('\n'),
        zOrder: 'top',
      }
    })
  }
}

BaseIndicator.define(NiceSweepIndicator)
export default NiceSweepIndicator

