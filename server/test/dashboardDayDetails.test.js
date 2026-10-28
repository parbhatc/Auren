import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'

const state = { calls: [] }
globalThis.__dashboardDayTest = state
const mocks = {
  './dashboardReplayData': 'export const loadDashboardReplaySessions = async () => []; export const loadDashboardReplayData = async () => { throw new Error("Unexpected replay call") };',
  'api/practice.api':
    'export const practiceAPI = { getStats: (...args) => globalThis.__dashboardDayTest.getStats(...args) };',
  'api/tradesea.api': `export const tradeseaAPI = {
    getTradelensCalendar: (...args) => globalThis.__dashboardDayTest.getCalendar(...args),
    getTradelensTrades: (...args) => globalThis.__dashboardDayTest.getTrades(...args),
  };`,
}
const bundle = await build({
  entryPoints: [
    fileURLToPath(
      new URL(
        '../../src/services/dashboard/dashboardDayDetails.ts',
        import.meta.url
      )
    ),
  ],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'dashboard-day-read-boundaries',
      setup(builder) {
        builder.onResolve(
          { filter: /(?:api\/(?:practice|tradesea)\.api|\.\/dashboardReplayData)$/ },
          ({ path }) => {
            const key = Object.keys(mocks).find((key) => path.endsWith(key))
            return key
              ? { path: key, namespace: 'dashboard-day-test' }
              : undefined
          }
        )
        builder.onLoad(
          { filter: /.*/, namespace: 'dashboard-day-test' },
          ({ path }) => ({ contents: mocks[path] })
        )
      },
    },
  ],
})
const { loadDashboardDayDetails } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)
const practice = { source: 'practice', accountId: 'selected-practice' }
const connected = { source: 'tradesea', accountId: 'selected-connected' }
const success = (d) => ({ success: true, s: 'success', d })
const micros = (iso) => Date.parse(iso) * 1000
const seconds = (iso) => Date.parse(iso) / 1000
const closedPractice = (patch = {}) => ({
  id: 'practice-fill',
  symbol: 'MNQ',
  direction: 'long',
  contracts: 1,
  entryPrice: 21000,
  exitPrice: 21010,
  pnl: 100,
  fees: 2.5,
  entryTime: seconds('2026-10-27T15:00:00Z'),
  exitTime: seconds('2026-10-28T21:58:59Z'),
  ...patch,
})
const closedTradesea = (patch = {}) => ({
  id: 'live-fill',
  instrument: 'MES',
  side: 'LONG',
  quantity: 2,
  entryPrice: 6000,
  exitPrice: 6010,
  netPnl: 100,
  commission: 5,
  enteredAt: micros('2026-10-28T20:00:00Z'),
  exitedAt: micros('2026-10-29T01:00:00Z'),
  ...patch,
})

beforeEach((t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 28, 16) })
  state.calls = []
  state.practice = { trades: [] }
  state.calendar = success({
    pnlAndTradeCountCalendar: [
      { date: '2026-10-28', pnl: 100, tradesCount: 1, tradeWinPer: 100 },
    ],
  })
  state.trades = success({
    tradesList: [{ date: '2026-10-28', trades: [closedTradesea()] }],
  })
  state.getStats = async (...args) => {
    state.calls.push(['practice', ...args])
    return state.practice
  }
  state.getCalendar = async (body) => {
    state.calls.push(['calendar', body])
    return state.calendar
  }
  state.getTrades = async (body) => {
    state.calls.push(['trades', body])
    return state.trades
  }
})

test('practice session day filters closed exits across 5:59 PM ET and subtracts each fee once', async () => {
  state.practice = {
    account: { dayPnL: [{ date: '2026-10-27', pnl: 97.5 }] },
    trades: [
      closedPractice(),
      closedPractice({
        id: 'next-session',
        exitTime: seconds('2026-10-28T21:59:00Z'),
        pnl: -25,
        fees: 1,
      }),
      closedPractice({ id: 'open-record', exitTime: null, exitPrice: null }),
    ],
  }
  const result = await loadDashboardDayDetails(practice, '2026-10-27', {
    dateBasis: 'practice-session',
  })
  assert.deepEqual(state.calls, [['practice', practice.accountId]])
  assert.equal(result.netPnl, 97.5)
  assert.equal(result.totalFees, 2.5)
  assert.equal(result.totalTrades, 1)
  assert.equal(result.winRate, 100)
  assert.equal(result.trades[0].netPnl, 97.5)
  assert.equal(result.trades[0].exitTime, '2026-10-28T21:58:59.000Z')
  assert.equal(result.detailsStatus, 'available')
})

test('a weekday session includes its exact 5:59 PM ET start and excludes the next reset', async () => {
  state.practice = {
    trades: [
      closedPractice({ id: 'before-start', exitTime: seconds('2026-10-27T21:58:59.999Z') }),
      closedPractice({ id: 'at-start', exitTime: seconds('2026-10-27T21:59:00Z') }),
      closedPractice({ id: 'before-end', exitTime: seconds('2026-10-28T21:58:59.999Z') }),
      closedPractice({ id: 'at-next-reset', exitTime: seconds('2026-10-28T21:59:00Z') }),
    ],
  }
  const result = await loadDashboardDayDetails(practice, '2026-10-27', { dateBasis: 'practice-session' })
  assert.deepEqual(result.trades.map((trade) => trade.id), ['at-start', 'before-end'])
})

for (const weekend of [
  { name: 'fall DST', friday: '2026-10-30', saturday: '2026-10-31', sunday: '2026-11-01', monday: '2026-11-02', start: '2026-10-30T21:59:00Z', end: '2026-11-02T22:59:00Z' },
  { name: 'spring DST', friday: '2026-03-06', saturday: '2026-03-07', sunday: '2026-03-08', monday: '2026-03-09', start: '2026-03-06T22:59:00Z', end: '2026-03-09T21:59:00Z' },
]) {
  test(`Friday carries through the ${weekend.name} weekend until Monday at 5:59 PM ET`, async () => {
    state.practice = {
      trades: [
        closedPractice({ id: 'before-friday', exitTime: Date.parse(weekend.start) / 1000 - 0.001 }),
        closedPractice({ id: 'friday-reset', exitTime: seconds(weekend.start) }),
        closedPractice({ id: 'saturday', exitTime: seconds(`${weekend.saturday}T16:00:00Z`) }),
        closedPractice({ id: 'sunday', exitTime: seconds(`${weekend.sunday}T16:00:00Z`) }),
        closedPractice({ id: 'before-monday-reset', exitTime: Date.parse(weekend.end) / 1000 - 0.001 }),
        closedPractice({ id: 'monday-reset', exitTime: seconds(weekend.end) }),
      ],
    }
    const options = { dateBasis: 'practice-session' }
    const friday = await loadDashboardDayDetails(practice, weekend.friday, options)
    assert.deepEqual(friday.trades.map((trade) => trade.id), ['friday-reset', 'saturday', 'sunday', 'before-monday-reset'])
    for (const date of [weekend.saturday, weekend.sunday]) {
      const result = await loadDashboardDayDetails(practice, date, options)
      assert.equal(result.totalTrades, 0)
      assert.deepEqual(result.trades, [])
    }
    const monday = await loadDashboardDayDetails(practice, weekend.monday, options)
    assert.deepEqual(monday.trades.map((trade) => trade.id), ['monday-reset'])
  })
}

test('a 100-record history uses the clicked session interval without changing its selected trades', async (t) => {
  state.practice = {
    trades: Array.from({ length: 100 }, (_, index) => closedPractice({
      id: `history-${index}`,
      exitTime: seconds('2026-10-28T16:00:00Z') - index * 86400,
    })),
  }
  const started = performance.now()
  const result = await loadDashboardDayDetails(practice, '2026-10-27', { dateBasis: 'practice-session' })
  t.diagnostic(`100-record session drilldown: ${Math.round(performance.now() - started)} ms`)
  assert.equal(result.totalTrades, 1)
  assert.equal(result.trades[0].id, 'history-0')
  assert.equal(result.netPnl, 97.5)
})

test('practice calendar day follows exit date rather than entry date, with real zero results', async () => {
  const localExit = new Date(2026, 9, 28, 0, 1).getTime() / 1000
  state.practice = {
    trades: [
      closedPractice({
        entryTime: new Date(2026, 9, 27, 23, 58).getTime() / 1000,
        exitTime: localExit,
        pnl: 2.5,
      }),
    ],
  }
  assert.equal(
    (await loadDashboardDayDetails(practice, '2026-10-27')).totalTrades,
    0
  )
  const result = await loadDashboardDayDetails(practice, '2026-10-28')
  assert.equal(result.netPnl, 0)
  assert.equal(result.totalTrades, 1)
  assert.equal(result.winRate, 0)
})

test('missing practice fees remain unknown instead of treating gross profit as net', async () => {
  state.practice = {
    trades: [
      closedPractice({
        fees: undefined,
        exitTime: new Date(2026, 9, 28, 10).getTime() / 1000,
      }),
    ],
  }
  const result = await loadDashboardDayDetails(practice, '2026-10-28')
  assert.equal(result.trades[0].fees, null)
  assert.equal(result.netPnl, null)
  assert.equal(result.totalFees, null)
  assert.equal(result.winRate, null)
  assert.equal(result.detailsStatus, 'partial')
})

test('TradeLens preserves its calendar bucket and already-net P&L without double subtracting commission', async () => {
  const result = await loadDashboardDayDetails(connected, '2026-10-28')
  assert.equal(result.netPnl, 100)
  assert.equal(result.totalFees, 5)
  assert.equal(result.trades[0].netPnl, 100)
  assert.equal(result.trades[0].exitTime, '2026-10-29T01:00:00.000Z')
  assert.equal(result.trades[0].direction, 'long')
  assert.equal(result.detailsStatus, 'available')
  assert.deepEqual(
    state.calls.map(([method, body]) => [
      method,
      body.accountId,
      body.from,
      body.to,
    ]),
    [
      ['calendar', connected.accountId, '2026-10-28', '2026-10-28'],
      ['trades', connected.accountId, '2026-10-28', '2026-10-28'],
    ]
  )
})

test('TradeLens missing fees remain unavailable while reported net and calendar metrics are preserved', async () => {
  state.trades = success({
    tradesList: [
      {
        date: '2026-10-28',
        trades: [closedTradesea({ commission: undefined })],
      },
    ],
  })
  const result = await loadDashboardDayDetails(connected, '2026-10-28')
  assert.equal(result.netPnl, 100)
  assert.equal(result.totalTrades, 1)
  assert.equal(result.winRate, 100)
  assert.equal(result.totalFees, null)
  assert.equal(result.trades[0].fees, null)
  assert.equal(result.detailsStatus, 'partial')
})

test('prior-month TradeLens calendar totals remain available without fabricated historical executions', async () => {
  state.calendar = success({
    pnlAndTradeCountCalendar: [
      { date: '2026-09-15', pnl: -42, tradesCount: 2, tradeWinPer: 50 },
    ],
  })
  const result = await loadDashboardDayDetails(connected, '2026-09-15')
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0][0], 'calendar')
  assert.equal(result.netPnl, -42)
  assert.equal(result.totalTrades, 2)
  assert.equal(result.winRate, 50)
  assert.equal(result.totalFees, null)
  assert.deepEqual(result.trades, [])
  assert.equal(result.detailsStatus, 'unavailable')
  assert.match(result.message, /current month/)
})

test('a failed TradeLens detail read preserves authoritative calendar aggregates', async () => {
  state.getTrades = async () => {
    throw new Error('provider unavailable')
  }
  const result = await loadDashboardDayDetails(connected, '2026-10-28')
  assert.equal(result.netPnl, 100)
  assert.equal(result.totalTrades, 1)
  assert.equal(result.totalFees, null)
  assert.deepEqual(result.trades, [])
  assert.equal(result.detailsStatus, 'unavailable')
})

test('missing TradeLens aggregates and details stay null rather than becoming false zero results', async () => {
  state.calendar = { success: false, s: 'error' }
  state.trades = { success: false, s: 'error' }
  const result = await loadDashboardDayDetails(connected, '2026-10-28')
  assert.equal(result.netPnl, null)
  assert.equal(result.totalTrades, null)
  assert.equal(result.winRate, null)
  assert.equal(result.detailsStatus, 'unavailable')
})

test('invalid account/date and already-aborted requests perform no provider reads', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    loadDashboardDayDetails(connected, '2026-10-28', {
      signal: controller.signal,
    }),
    { name: 'AbortError' }
  )
  await assert.rejects(
    loadDashboardDayDetails(practice, '2026-02-30'),
    RangeError
  )
  await assert.rejects(
    loadDashboardDayDetails({ ...practice, accountId: '' }, '2026-10-28'),
    TypeError
  )
  assert.deepEqual(state.calls, [])
})

test('a request aborted while practice statistics load cannot publish its completed result', async () => {
  let resolve
  state.getStats = () =>
    new Promise((done) => {
      resolve = done
    })
  const controller = new AbortController()
  const pending = loadDashboardDayDetails(practice, '2026-10-28', {
    signal: controller.signal,
  })
  controller.abort()
  resolve({ trades: [] })
  await assert.rejects(pending, { name: 'AbortError' })
})
