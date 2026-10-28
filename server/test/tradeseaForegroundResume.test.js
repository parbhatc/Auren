import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

async function loadClient(name) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(`../../src/services/tradesea/${name}.ts`, import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'socket-test-host', setup(builder) {
      builder.onResolve({ filter: /\/api\/api$/ }, () => ({ path: 'api', namespace: 'host' }))
      builder.onResolve({ filter: /mdsConnectionToast$/ }, () => ({ path: 'toast', namespace: 'host' }))
      builder.onLoad({ filter: /.*/, namespace: 'host' }, ({ path }) => ({ contents: path === 'api'
        ? `export const getAuthToken = () => 'auth'; export const getWebSocketUrl = (path) => 'ws://localhost' + path;`
        : `export const dismissMdsConnectionToast = () => {}; export const isMdsConnectionToastActive = () => false; export const showMdsConnectionToast = () => {};`,
      }))
    } }],
  })
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`))[name]
}

const TradeseaMdsClient = await loadClient('TradeseaMdsClient')
const TradeseaTradesClient = await loadClient('TradeseaTradesClient')
const page = new EventTarget()
page.visibilityState = 'visible'
const browser = new EventTarget()

class FakeSocket extends EventTarget {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSING = 2
  static CLOSED = 3
  static instances = []
  readyState = 0
  constructor(url) { super(); this.url = url; FakeSocket.instances.push(this) }
  send() {}
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')) }
}

function setup(t) {
  const originals = new Map(['window', 'document', 'WebSocket', 'localStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  globalThis.window = browser
  globalThis.document = page
  globalThis.WebSocket = FakeSocket
  globalThis.localStorage = { getItem: () => null, setItem: () => {} }
  page.visibilityState = 'visible'
  FakeSocket.instances = []
  const clients = []
  t.mock.method(console, 'info', () => {})
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_800_000_000_000 })
  t.after(() => {
    for (const client of clients) client.disconnect()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return { clients }
}

function background(t, duration) {
  page.visibilityState = 'hidden'
  page.dispatchEvent(new Event('visibilitychange'))
  browser.dispatchEvent(new Event('pagehide'))
  t.mock.timers.tick(duration)
  page.visibilityState = 'visible'
  page.dispatchEvent(new Event('visibilitychange'))
  browser.dispatchEvent(new Event('pageshow'))
  browser.dispatchEvent(new Event('focus'))
  t.mock.timers.tick(150)
}

test('Trades replaces a zombie OPEN socket once after Safari resumes ten minutes later', (t) => {
  const { clients } = setup(t)
  const trades = new TradeseaTradesClient()
  clients.push(trades)
  trades.connect('selected-account')
  const first = FakeSocket.instances[0]
  first.readyState = FakeSocket.OPEN
  background(t, 600_000)
  assert.equal(FakeSocket.instances.length, 2, 'visibility, pageshow and focus must coalesce')
  assert.equal(first.readyState, FakeSocket.CLOSED)
  assert.match(FakeSocket.instances[1].url, /accountId=selected-account/)
  trades.disconnect()
  browser.dispatchEvent(new Event('focus'))
  t.mock.timers.tick(150)
  assert.equal(FakeSocket.instances.length, 2, 'an expired/unmounted session must stay disconnected')
})

test('Trades preserves a healthy foreground connection after a brief tab switch', (t) => {
  const { clients } = setup(t)
  const trades = new TradeseaTradesClient()
  clients.push(trades)
  trades.connect('selected-account')
  FakeSocket.instances[0].readyState = FakeSocket.OPEN
  background(t, 1_000)
  assert.equal(FakeSocket.instances.length, 1)
})

test('MDS replaces zombie OPEN and stale CONNECTING sockets after long suspension', async (t) => {
  const { clients } = setup(t)
  for (const state of [FakeSocket.OPEN, FakeSocket.CONNECTING]) {
    const mds = new TradeseaMdsClient()
    clients.push(mds)
    mds.connect('selected-account', 'connection-group', { symbols: ['CME:NQ'], resolution: '5' })
    const first = FakeSocket.instances.at(-1)
    first.readyState = state
    const before = FakeSocket.instances.length
    background(t, 600_000)
    await Promise.resolve()
    assert.equal(first.readyState, FakeSocket.CLOSED)
    assert.equal(FakeSocket.instances.length, before + 1)
    assert.match(FakeSocket.instances.at(-1).url, /accountId=selected-account/)
    assert.deepEqual(mds.getBootstrapSymbols(), ['CME:NQ'])
    mds.disconnect()
  }
})

test('disconnecting during MDS resume cancels the pending reopen', async (t) => {
  const { clients } = setup(t)
  const mds = new TradeseaMdsClient()
  clients.push(mds)
  mds.connect('selected-account', 'connection-group')
  FakeSocket.instances[0].readyState = FakeSocket.OPEN
  background(t, 600_000)
  mds.disconnect()
  await Promise.resolve()
  assert.equal(FakeSocket.instances.length, 1)
})
