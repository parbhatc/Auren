import test from 'node:test'
import assert from 'node:assert/strict'

import CSVLoader from '../src/utils/CSVLoader.js'

function loaderWithCache() {
  const loader = Object.create(CSVLoader.prototype)
  loader.monthCache = {
    NQ: {
      '1m': {
        2026: {
          July: { bars: [{ time: 1 }], lastAccess: 1 },
          June: { bars: [{ time: 2 }], lastAccess: 1 },
        },
      },
      '30s': {
        2026: {
          July: { bars: [{ time: 3 }], lastAccess: 1 },
        },
      },
    },
  }
  return loader
}

test('invalidating a rewritten month keeps other months and resolutions cached', () => {
  const loader = loaderWithCache()

  loader.invalidateMonthData('NQ', 2026, 6, '1m')

  assert.equal(loader.monthCache.NQ['1m'][2026].July, undefined)
  assert.ok(loader.monthCache.NQ['1m'][2026].June)
  assert.ok(loader.monthCache.NQ['30s'][2026].July)
})

test('invalidating a symbol removes stale replay data after a reset', () => {
  const loader = loaderWithCache()

  loader.invalidateSymbolData('NQ')

  assert.equal(loader.monthCache.NQ, undefined)
})
