import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import TradingViewDataHandler from '../src/websocket/handlers/TradingViewDataHandler.js'

const AUGUST_10_2026 = 1_786_320_000

function createHarness() {
  const csvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auren-tv-handler-'))
  const monthDir = path.join(csvDir, 'NQ', '1m', '2026')
  fs.mkdirSync(monthDir, { recursive: true })
  const monthFile = path.join(monthDir, 'August.csv')
  fs.writeFileSync(monthFile, `${AUGUST_10_2026},1,2,0,1.5,10`, 'utf8')
  const broadcasts = []
  const progress = []
  const ws = {
    csvDir,
    configPath: path.join(csvDir, 'config.json'),
    broadcast: (message) => broadcasts.push(message),
    sendProgress: (...args) => progress.push(args),
    server: { csvLoader: { invalidateMonthData() {} } },
  }
  return { csvDir, monthFile, broadcasts, progress, ws }
}

test('TradingView CSV update starts after the latest stored candle', async (t) => {
  const harness = createHarness()
  t.after(() => fs.rmSync(harness.csvDir, { recursive: true, force: true }))
  const handler = new TradingViewDataHandler(harness.ws)
  let request
  handler.marketData = {
    async loadAllBars(symbol, options) {
      request = { symbol, options }
      options.onProgress({ bars: 2 })
      return {
        bars: [
          { time: AUGUST_10_2026 + 60, open: 2, high: 3, low: 1, close: 2.5, volume: 11 },
          { time: AUGUST_10_2026 + 120, open: 2.5, high: 4, low: 2, close: 3.5, volume: 12 },
        ],
      }
    },
  }

  const result = await handler.update('CME_MINI:NQ1!', 'NQ', '1', { chunkSize: 10_000 })

  assert.equal(request.symbol, 'CME_MINI:NQ1!')
  assert.equal(request.options.after, AUGUST_10_2026)
  assert.equal(request.options.chunkSize, 10_000)
  assert.equal(request.options.session, 'extended')
  assert.equal(result.newBars, 2)
  assert.equal(harness.broadcasts.at(-1).success, true)
  assert.match(harness.progress[0].at(-1), /10,000-bar batches/)
  assert.deepEqual(
    fs.readFileSync(harness.monthFile, 'utf8').split('\n').map((line) => Number(line.split(',')[0])),
    [AUGUST_10_2026, AUGUST_10_2026 + 60, AUGUST_10_2026 + 120]
  )
})

test('TradingView CSV update succeeds when no newer candles exist', async (t) => {
  const harness = createHarness()
  t.after(() => fs.rmSync(harness.csvDir, { recursive: true, force: true }))
  const handler = new TradingViewDataHandler(harness.ws)
  handler.marketData = { loadAllBars: async () => ({ bars: [] }) }

  const result = await handler.update('CME_MINI:NQ1!', 'NQ', '1')

  assert.equal(result.newBars, 0)
  assert.equal(harness.broadcasts.at(-1).success, true)
  assert.match(harness.broadcasts.at(-1).message, /already up to date/)
})
