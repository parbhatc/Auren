import assert from 'node:assert/strict'
import test from 'node:test'

test('paper feed only polls while its indicator is active and shares pending requests', async () => {
  const oldWindow = globalThis.window
  const oldDocument = globalThis.document
  const oldFetch = globalThis.fetch
  let tick
  let active = false
  let requests = 0
  let finishRequest
  globalThis.window = {
    localStorage: { getItem: () => null },
    setInterval: (callback) => { tick = callback; return 1 },
  }
  globalThis.document = { visibilityState: 'visible' }
  globalThis.fetch = () => {
    requests += 1
    return new Promise((resolve) => { finishRequest = resolve })
  }

  try {
    const feed = await import(`../../public/auren-indicators/custom-setups/paperFeed.js?poll-test=${Date.now()}`)
    feed.startPaperFeedPolling(30000, () => active)
    assert.equal(requests, 0)
    tick()
    assert.equal(requests, 0)

    active = true
    tick()
    tick()
    assert.equal(requests, 1)
    finishRequest({ ok: true, json: async () => ({ data: { trades: [], totalTrades: 0 } }) })
    await feed.refreshPaperFeed()

    globalThis.document.visibilityState = 'hidden'
    tick()
    assert.equal(requests, 1)
  } finally {
    globalThis.window = oldWindow
    globalThis.document = oldDocument
    globalThis.fetch = oldFetch
  }
})
