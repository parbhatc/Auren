import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundled = await build({
  stdin: {
    contents: `export { journalAPI } from './src/api/journal.api.ts'; export { economicNewsAPI } from './src/api/economicNews.api.ts';`,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'metadata-http-boundary', setup(builder) {
    builder.onResolve({ filter: /^\.\/api$/ }, () => ({ path: 'api', namespace: 'metadata-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'metadata-test' }, () => ({ contents: `
      export const getAuthToken = () => globalThis.__metadataReads.token;
      export const getAuthHeaders = () => ({ Authorization: getAuthToken() });
      const call = (method, path, ...args) => {
        globalThis.__metadataReads.calls.push({method, path, args});
        return globalThis.__metadataReads[method](path, ...args);
      };
      export default { get: (...args) => call('get', ...args), post: (...args) => call('post', ...args),
        put: (...args) => call('put', ...args), delete: (...args) => call('delete', ...args) };
    ` }))
  } }],
})
const { journalAPI, economicNewsAPI } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
let sequence = 0
function fixture(t) {
  const previous = globalThis.__metadataReads
  const state = {
    token: `auth-${++sequence}`, calls: [],
    get: async (path) => ({ data: path.endsWith('/strategies') ? { strategies: [{ id: 'strategy' }] }
      : path.endsWith('/building-blocks') ? { blocks: [{ id: 'block' }] }
      : path.includes('economic-news') ? { success: true, events: [{ event: 'Release', actual: '1' }] }
      : { entries: [] } }),
    post: async () => ({ data: { strategy: { id: 'new' }, block: { id: 'block' } } }),
    put: async () => ({ data: { strategy: { id: 'updated' } } }),
    delete: async () => ({ data: {} }),
  }
  globalThis.__metadataReads = state
  t.after(() => { globalThis.__metadataReads = previous })
  return state
}
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve() }

test('Analytics and Journal share only catalog reads while journal entries remain uncached', async (t) => {
  const state = fixture(t)
  const [first, second] = await Promise.all([journalAPI.listStrategies(), journalAPI.listStrategies()])
  assert.notEqual(first, second)
  first[0].id = 'local editor'
  assert.equal((await journalAPI.listStrategies())[0].id, 'strategy')
  await Promise.all([journalAPI.listBuildingBlocks(), journalAPI.listBuildingBlocks()])
  await journalAPI.listEntries()
  await journalAPI.listEntries()
  assert.deepEqual(state.calls.map((call) => call.path), [
    '/trading-journal/strategies', '/trading-journal/building-blocks', '/trading-journal/entries', '/trading-journal/entries',
  ])
})

test('catalog writes invalidate reads started before and during the mutation', async (t) => {
  const state = fixture(t)
  const before = deferred()
  const during = deferred()
  const write = deferred()
  let list = 0
  state.get = () => ++list === 1 ? before.promise : list === 2 ? during.promise : Promise.resolve({ data: { strategies: [{ id: 'newest' }] } })
  state.post = () => write.promise
  const old = journalAPI.listStrategies()
  const discardedBefore = assert.rejects(old, { name: 'AbortError' })
  await flush()
  const mutation = journalAPI.createStrategy('New', [])
  const middle = journalAPI.listStrategies()
  const discardedDuring = assert.rejects(middle, { name: 'AbortError' })
  await flush()
  before.resolve({ data: { strategies: [{ id: 'obsolete-before' }] } })
  await discardedBefore
  write.resolve({ data: { strategy: { id: 'new' } } })
  await mutation
  during.resolve({ data: { strategies: [{ id: 'obsolete-during' }] } })
  await discardedDuring
  assert.equal((await journalAPI.listStrategies())[0].id, 'newest')
  assert.equal(list, 3)
})

for (const [name, mutate] of [
  ['strategy update', () => journalAPI.updateStrategy('id', 'Updated', [])],
  ['strategy deletion', () => journalAPI.deleteStrategy('id')],
  ['block creation', () => journalAPI.createBuildingBlock('Block', 'type', 'description')],
  ['block deletion', () => journalAPI.deleteBuildingBlock('id')],
]) {
  test(`${name} refreshes both related metadata lists`, async (t) => {
    const state = fixture(t)
    await journalAPI.listStrategies()
    await journalAPI.listBuildingBlocks()
    await mutate()
    await journalAPI.listStrategies()
    await journalAPI.listBuildingBlocks()
    assert.equal(state.calls.filter((call) => call.method === 'get').length, 4)
  })
}

test('failed catalog writes also detach metadata fetched while the write was pending', async (t) => {
  const state = fixture(t)
  await journalAPI.listStrategies()
  state.post = async () => { throw new Error('write failed') }
  await assert.rejects(journalAPI.createStrategy('New', []), /write failed/)
  await journalAPI.listStrategies()
  assert.equal(state.calls.filter((call) => call.method === 'get').length, 2)
})

test('news panels share monthly reads, refresh explicitly, and retry unsuccessful responses', async (t) => {
  const state = fixture(t)
  await Promise.all([economicNewsAPI.getEvents(2026, 10), economicNewsAPI.getEvents(2026, 10)])
  const cached = await economicNewsAPI.getEvents(2026, 10)
  cached.events[0].actual = 'local change'
  assert.equal((await economicNewsAPI.getEvents(2026, 10)).events[0].actual, '1')
  assert.equal(state.calls.length, 1)
  await economicNewsAPI.getEvents(2026, 10, { force: true })
  assert.equal(state.calls.length, 2)
  state.get = async () => ({ data: { success: false, events: [] } })
  await economicNewsAPI.getEvents(2026, 11)
  await economicNewsAPI.getEvents(2026, 11)
  assert.equal(state.calls.length, 4, 'unsuccessful news payloads must not be cached')
})

test('workspace metadata TTLs expire and different owners never share catalog or news values', async (t) => {
  const state = fixture(t)
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 })
  await journalAPI.listStrategies()
  await economicNewsAPI.getEvents(2026, 10)
  t.mock.timers.setTime(Date.now() + 30_001)
  await journalAPI.listStrategies()
  await economicNewsAPI.getEvents(2026, 10)
  assert.equal(state.calls.length, 3)
  t.mock.timers.setTime(Date.now() + 30_000)
  await economicNewsAPI.getEvents(2026, 10)
  assert.equal(state.calls.length, 4)
  state.token = 'replacement-owner'
  await journalAPI.listStrategies()
  await economicNewsAPI.getEvents(2026, 10)
  assert.equal(state.calls.length, 6)
})
