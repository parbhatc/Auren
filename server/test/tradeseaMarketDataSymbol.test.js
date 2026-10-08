import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeTradeseaMarketDataSymbol } from '../src/utils/tradeseaMarketDataSymbol.js'

test('normalizes Tradesea market-data symbols for sandbox and production feeds', () => {
  assert.equal(normalizeTradeseaMarketDataSymbol('CME:NQ', true), 'CME-Delayed:NQ')
  assert.equal(normalizeTradeseaMarketDataSymbol('CME-Delayed:NQ', false), 'CME:NQ')
  assert.equal(normalizeTradeseaMarketDataSymbol('MNQZ26', true), 'CME-Delayed:MNQ')
  assert.equal(normalizeTradeseaMarketDataSymbol('COMEX:GC', true), 'COMEX-Delayed:GC')
  assert.equal(normalizeTradeseaMarketDataSymbol('MGCZ26', false), 'COMEX:MGC')
  assert.equal(normalizeTradeseaMarketDataSymbol('NYMEX-Delayed:MCL', false), 'NYMEX:MCL')
})
