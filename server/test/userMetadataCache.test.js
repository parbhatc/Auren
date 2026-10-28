import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserMetadataCache } from '../../src/services/cache/userMetadataCache.ts'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }

test('consumer cancellation cannot cancel another page sharing a pending metadata read', async () => {
  const cache = createUserMetadataCache({ getOwner: () => 'auth-a', ttlMs: 30_000 })
  const gate = deferred()
  let loads = 0
  let sourceSignal
  const load = (signal) => { loads++; sourceSignal = signal; return gate.promise }
  const consumer = new AbortController()
  const first = cache.read('catalog', load, { signal: consumer.signal })
  const second = cache.read('catalog', load)
  const cancelled = assert.rejects(first, { name: 'AbortError' })
  await flush()
  consumer.abort()
  await cancelled
  assert.equal(sourceSignal.aborted, false)
  gate.resolve([{ id: 'saved', name: 'Original' }])
  const result = await second
  result[0].name = 'Local edit'
  const reused = await cache.read('catalog', load)
  assert.equal(reused[0].name, 'Original')
  assert.equal(loads, 1)
})

test('metadata uses a bounded LRU and expires without retaining failed reads', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 })
  const cache = createUserMetadataCache({ getOwner: () => 'auth-a', ttlMs: 30_000, maxEntries: 2 })
  let loads = 0
  const load = async () => ({ value: ++loads })
  await cache.read('a', load)
  await cache.read('b', load)
  await cache.read('a', load)
  await cache.read('c', load)
  await cache.read('b', load)
  assert.equal(loads, 4, 'the least recently used catalog is evicted')
  t.mock.timers.setTime(Date.now() + 30_001)
  await cache.read('b', load)
  assert.equal(loads, 5)
  await assert.rejects(cache.read('failure', async () => { throw new Error('offline') }), /offline/)
  await cache.read('failure', load)
  assert.equal(loads, 6)
})

test('logout or a replacement owner discards pending results and never reuses another user cache', async () => {
  let owner = 'auth-a'
  const cache = createUserMetadataCache({ getOwner: () => owner, ttlMs: 30_000 })
  const gate = deferred()
  const old = cache.read('catalog', () => gate.promise)
  const discarded = assert.rejects(old, { name: 'AbortError' })
  await flush()
  owner = null
  gate.resolve(['old owner'])
  await discarded
  owner = 'auth-b'
  assert.deepEqual(await cache.read('catalog', async () => ['new owner']), ['new owner'])
  owner = 'auth-a'
  assert.deepEqual(await cache.read('catalog', async () => ['refetched owner']), ['refetched owner'])
})

test('force refresh detaches a pending older response instead of letting it repopulate the cache', async () => {
  const cache = createUserMetadataCache({ getOwner: () => 'auth-a', ttlMs: 30_000 })
  const gate = deferred()
  const old = cache.read('catalog', () => gate.promise)
  const discarded = assert.rejects(old, { name: 'AbortError' })
  await flush()
  assert.deepEqual(await cache.read('catalog', async () => ['fresh'], { force: true }), ['fresh'])
  gate.resolve(['stale'])
  await discarded
  assert.deepEqual(await cache.read('catalog', async () => { throw new Error('must use fresh') }), ['fresh'])
})

test('mutation cancellation uses AbortError consistently even when the HTTP client reports CanceledError', async () => {
  const cache = createUserMetadataCache({ getOwner: () => 'auth-a', ttlMs: 30_000 })
  const pending = cache.read('catalog', (signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('HTTP client canceled')
      error.name = 'CanceledError'
      reject(error)
    }, { once: true })
  }))
  const discarded = assert.rejects(pending, { name: 'AbortError' })
  await flush()
  cache.invalidate()
  await discarded
})
