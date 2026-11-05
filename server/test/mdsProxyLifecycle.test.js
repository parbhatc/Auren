import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'
import { test, beforeEach } from 'node:test'
import { build } from 'esbuild'

const state = {}
globalThis.__mdsProxyLifecycle = state
class Socket extends EventEmitter {
  static OPEN = 1; static CONNECTING = 0; static CLOSED = 3
  readyState = 1
  sent = []
  send(frame) { this.sent.push(frame) }
  close(code, reason) { this.readyState = 3; this.emit('close', code, Buffer.from(reason || '')) }
}
class Upstream extends Socket {
  constructor() { super(); this.readyState = 0; state.upstreams.push(this) }
}
state.WebSocket = Upstream
const mocks = {
  ws: 'export default globalThis.__mdsProxyLifecycle.WebSocket;',
  './WebSocketBase.js': 'export default class WebSocketBase {}',
  '../services/TokenService.js': 'export default { verifyAuthToken: () => ({ userId: "owner" }) };',
  '../config/Database.js': 'export default { get: (...args) => globalThis.__mdsProxyLifecycle.get(...args) };',
  '../controllers/PropsController.js': 'export default { initializeTable: async () => {} };',
  '../services/tradesea/TradeseaIdentityService.js': 'export default { findAccountById: (...args) => globalThis.__mdsProxyLifecycle.find(...args) };',
  '../services/tradesea/TradeseaAccountPolicy.js': 'export const getStreamEndpoints = () => ({ mdsStreamBase: "ws://isolated-upstream" });',
}
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/websocket/TradeseaMdsWebSocket.js', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'isolated-proxy', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path] }))
  } }],
})
const { default: proxy } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const request = { url: '/tradesea-mds-ws?accountId=account&token=test&connectionGroupId=group', headers: { host: 'localhost' } }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const subscribe = symbol => Buffer.from(JSON.stringify({ action: 'subscribe', type: 'traded_volume_at_price', symbols: [symbol] }))
beforeEach(() => { state.upstreams = []; state.get = async () => ({ token: 'test' }); state.find = async () => ({ userId: 'upstream-user' }) })

test('subscriptions arriving during account lookup are queued and flushed in order after the upstream settles', async t => {
  const lookup = deferred()
  state.find = () => lookup.promise
  const client = new Socket()
  const pending = proxy.handleConnection(client, request)
  client.emit('message', subscribe('CME:NQ'), false)
  client.emit('message', subscribe('CME:ES'), false)
  lookup.resolve({ userId: 'upstream-user' })
  await pending
  const upstream = state.upstreams[0]
  t.mock.method(console, 'log', () => {})
  t.mock.timers.enable({ apis: ['setTimeout'] })
  upstream.readyState = Socket.OPEN
  upstream.emit('open')
  assert.equal(upstream.sent.length, 0)
  t.mock.timers.tick(75)
  assert.deepEqual(upstream.sent.map(frame => JSON.parse(frame).s), [['CME:NQ'], ['CME:ES']])
  client.close(1000)
  assert.equal(upstream.readyState, Socket.CLOSED)
})

test('a client that closes during account discovery never opens a ghost upstream connection', async () => {
  const lookup = deferred()
  state.find = () => lookup.promise
  const client = new Socket()
  const pending = proxy.handleConnection(client, request)
  await Promise.resolve(); await Promise.resolve()
  client.close(1000)
  lookup.resolve({ userId: 'upstream-user' })
  await pending
  assert.equal(state.upstreams.length, 0)
})

test('closing during upstream settle cancels queued traffic and closes its socket', async t => {
  const client = new Socket()
  await proxy.handleConnection(client, request)
  const upstream = state.upstreams[0]
  t.mock.method(console, 'log', () => {})
  t.mock.timers.enable({ apis: ['setTimeout'] })
  upstream.readyState = Socket.OPEN
  upstream.emit('open')
  client.emit('message', subscribe('CME:NQ'), false)
  client.close(1000)
  t.mock.timers.tick(1000)
  assert.equal(upstream.sent.length, 0)
  assert.equal(upstream.readyState, Socket.CLOSED)
})
