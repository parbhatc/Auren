import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: `
      export { PracticeTradeHandler } from './src/services/practice/PracticeTradeHandler'
      export { TradeseaTradeHandler } from './src/services/tradesea/TradeseaTradeHandler'
    `,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  banner: { js: 'const require = globalThis.__tradePadTestRequire' },
  write: false,
  define: { 'import.meta.env': '{}' },
  plugins: [{
    name: 'mock-order-submission',
    setup(builder) {
      builder.onResolve({ filter: /(?:\/tradesea\.api|\/aurenToast)$/ }, ({ path }) => ({
        path,
        namespace: 'trade-pad-test',
      }))
      builder.onLoad({ filter: /.*/, namespace: 'trade-pad-test' }, ({ path }) => ({
        contents: path.endsWith('/aurenToast')
          ? 'export const aurenToast = new Proxy({}, { get: () => () => {} })'
          : `export const tradeseaAPI = new Proxy({}, { get: (_, name) => async (order) => {
              globalThis.__tradePadOrders.push({ name, order })
              return { success: true, s: 'ok' }
            } })`,
      }))
    },
  }],
})
globalThis.__tradePadTestRequire = createRequire(import.meta.url)
const { PracticeTradeHandler, TradeseaTradeHandler } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
).finally(() => { delete globalThis.__tradePadTestRequire })

function setMicroOnly(t, accountId) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => key === `auren_trade_pad_micro_only_${accountId}` ? '1' : null },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  })
}

test('live Micro only rejects minis, other micros, and reversals but permits MES/MNQ and closes', async (t) => {
  setMicroOnly(t, 'live-test')
  const orders = []
  globalThis.__tradePadOrders = orders
  t.after(() => { delete globalThis.__tradePadOrders })
  const firm = {
    selectedAccountId: 'live-test',
    chartServices: { datafeed: { resolveStreamInstrument: (symbol) => symbol } },
    positions: [{ id: 'nq-position', instrument: 'CME:NQ', qty: 1, side: 'buy' }],
  }
  const handler = new TradeseaTradeHandler(firm)
  handler.scheduleRefresh = () => {}
  for (const symbol of ['CME:NQ', 'CME:ES', 'CME:M2K', 'COMEX:MGC']) {
    await handler.logButtonPress('Buy', { symbol, quantity: 1 })
  }
  await handler.logButtonPress('Reverse Position', { symbol: 'CME:NQ', quantity: 1 })
  assert.equal(orders.length, 0)

  for (const symbol of ['CME-Delayed:MNQ', 'CME:MESZ6']) {
    await handler.logButtonPress('Buy', { symbol, quantity: 1 })
  }
  await handler.logButtonPress('Close Position', { symbol: 'CME:NQ', quantity: 1 })
  firm.selectedAccountId = 'other-live-account'
  await handler.logButtonPress('Sell', { symbol: 'CME:NQ', quantity: 1 })
  assert.deepEqual(orders.map(({ name, order }) => [name, order.instrument ?? order.positionId]), [
    ['placeOrder', 'CME-Delayed:MNQ'],
    ['placeOrder', 'CME:MESZ6'],
    ['closePosition', 'nq-position'],
    ['placeOrder', 'CME:NQ'],
  ])
})

test('Practice Micro only applies to direct limits and market entries while retaining closes', async (t) => {
  setMicroOnly(t, 'practice-test')
  const handler = new PracticeTradeHandler({ chartServices: {} }, 'practice-test')
  const entries = []
  const exits = []
  handler.getAccount = () => ({ size: 50000 })
  handler.getTradingLockMessage = () => null
  handler.getMarketClosedMessage = () => null
  handler.getMarkPrice = () => 100
  handler.getMarketExecutionPrice = () => 100
  handler.getActiveChartResolution = () => '1'
  handler.attachPendingOrderLine = async () => {}
  handler.tradeCache = {
    getPosition: (symbol) => symbol === 'CME:NQ' ? { contracts: 1 } : undefined,
    onOpenPosition: (symbol) => entries.push(symbol),
    onClosePosition: (symbol) => exits.push(symbol),
  }

  await handler.placeLimitOrder('buy', 1, 99, undefined, 'CME:NQ')
  await handler.logButtonPress('Buy', { symbol: 'CME:ES', quantity: 1 })
  assert.deepEqual(handler.pendingOrders, [])
  assert.deepEqual(entries, [])

  await handler.placeLimitOrder('buy', 1, 99, undefined, 'CME:MES')
  await handler.logButtonPress('Buy', { symbol: 'CME:MNQ', quantity: 1 })
  await handler.logButtonPress('Close Position', { symbol: 'CME:NQ', quantity: 1 })
  assert.deepEqual(handler.pendingOrders.map(({ symbol }) => symbol), ['CME:MES'])
  assert.deepEqual(entries, ['CME:MNQ'])
  assert.deepEqual(exits, ['CME:NQ'])
})
