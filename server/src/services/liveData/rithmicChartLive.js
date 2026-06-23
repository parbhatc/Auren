import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { init, ChartLive } from 'rithmic-api'
import {
  logLiveDataConnected,
  logLiveDataDisconnected,
  logLiveDataInfo,
} from './liveDataLog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROVIDER = 'Rithmic'
const DEFAULT_LOG_DIR = path.join(__dirname, '../../../data/rithmic-live-logs')

/** @type {import('rithmic-api').ChartLive | null} */
let live = null

/** @type {((kind: string, payload: object) => void) | null} */
let marketHandler = null

export function setChartLiveMarketHandler(handler) {
  marketHandler = handler
  if (live && handler) wireMarketEvents(live)
}

function wireMarketEvents(chartLive) {
  const forward = (kind) => (payload) => {
    marketHandler?.(kind, payload)
  }
  chartLive.on('live', forward('live'))
  chartLive.on('bar', forward('bar'))
  chartLive.on('closed', forward('closed'))
}

function wireLiveEvents(chartLive) {
  chartLive.on('line', (line) => {
    if (
      /^(bootstrap|Feeds:|Logging|Wire log|Streaming|shutdown|Stopped|live feed|unsubscribed|timeframe)/.test(
        line
      )
    ) {
      logLiveDataInfo(`${PROVIDER} ${line}`)
    }
  })

  if (process.env.RITHMIC_CHART_DEBUG === '1') {
    chartLive.on('live', ({ label, bar }) => {
      logLiveDataInfo(`${PROVIDER} ${label} live @ ${bar?.marker ?? '?'}`)
    })
    chartLive.on('bar', ({ label, marker }) => {
      logLiveDataInfo(`${PROVIDER} ${label} closed bar @ ${marker ?? '?'}`)
    })
  }
}

export function getRithmicChartLive() {
  return live
}

export function isRithmicChartLiveOpen() {
  return live != null
}

/**
 * Open a shared ChartLive session (no symbols subscribed until {@link subscribeRithmicChartLive}).
 * @param {{ username: string, password: string, systemName: string, gatewayName: string }} cfg
 */
export async function openRithmicChartLive(cfg) {
  if (live) return { ok: true, reused: true }

  await init()

  const instance = await ChartLive.open({
    user: cfg.username,
    password: cfg.password,
    systemName: cfg.systemName,
    gatewayName: cfg.gatewayName,
    log: false,
    logDir: process.env.RITHMIC_LIVE_LOG_DIR || DEFAULT_LOG_DIR,
  })

  wireLiveEvents(instance)
  wireMarketEvents(instance)
  live = instance
  logLiveDataConnected(PROVIDER)
  logLiveDataInfo(`${PROVIDER} ChartLive open — no symbols subscribed yet.`)

  return { ok: true }
}

/** Subscribe a symbol on the shared session (starts live feed on first subscribe). */
export async function subscribeRithmicChartLive(symbol, exchange, resolution, forming = true) {
  if (!live) {
    throw new Error('Rithmic ChartLive is not open')
  }
  await live.subscribe(symbol, exchange, resolution, forming)
  logLiveDataInfo(`${PROVIDER} subscribed ${symbol}@${exchange} ${resolution}`)
}

export async function unsubscribeRithmicChartLive(symbol, exchange) {
  if (!live) return
  await live.unsubscribe(symbol, exchange)
}

export async function closeRithmicChartLive() {
  if (!live) return
  const instance = live
  live = null
  try {
    await instance.close()
  } catch {
    /* ignore */
  }
  logLiveDataDisconnected(PROVIDER)
}
