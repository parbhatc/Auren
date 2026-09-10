import test from 'node:test'
import assert from 'node:assert/strict'
import { WebSocketClientBase } from '../../src/services/websocket/WebSocketClientBase.ts'

class FakeSocket {
  static OPEN = 1
  static CONNECTING = 0
  static instances = []
  constructor(url) { this.url = url; this.readyState = 0; FakeSocket.instances.push(this) }
  close(code) { this.closeCode = code; this.readyState = 3 }
  send(data) { this.sent = data }
}

test('client retires connecting sockets, ignores stale events, and rebuilds authenticated URLs', async (t) => {
  const original = globalThis.WebSocket
  globalThis.WebSocket = FakeSocket
  t.after(() => { globalThis.WebSocket = original })
  t.mock.method(console, 'log', () => {})
  class Client extends WebSocketClientBase {
    token = 'first'
    buildWebSocketUrl() { return `ws://localhost/test?token=${this.token}` }
    messages = []
    handleCustomMessage(data) { this.messages.push(data); return true }
  }
  const client = new Client({}, { url: 'ws://localhost/test', maxReconnectAttempts: 0 })
  t.after(() => client.disconnect())
  await client.connect()
  const first = FakeSocket.instances.at(-1)
  const staleClose = first.onclose
  const staleOpen = first.onopen
  const staleMessage = first.onmessage
  client.disconnect()
  assert.equal(first.closeCode, 1000, 'a CONNECTING transport must actually be closed')
  assert.equal(first.onmessage, null)
  client.token = 'refreshed'
  await client.connect()
  const second = FakeSocket.instances.at(-1)
  assert.match(second.url, /token=refreshed/)
  second.readyState = FakeSocket.OPEN
  second.onopen()
  staleClose({ code: 1006, reason: 'old connection failed' })
  staleOpen()
  staleMessage({ data: '{"type":"stale"}' })
  assert.equal(client.isConnected(), true)
  second.onmessage({ data: '{"type":"bar","close":123}' })
  assert.deepEqual(client.messages, [{ type: 'bar', close: 123 }])
  second.onmessage({ data: '{"type":"ping"}' })
  assert.equal(JSON.parse(second.sent).type, 'pong')
  second.onclose({ code: 1006, reason: 'network' })
  assert.equal(client.getStatus(), 'disconnected', 'zero reconnect attempts must be respected')
})
