import test from 'node:test'
import assert from 'node:assert/strict'
import WebSocketBase from '../src/websocket/WebSocketBase.js'

test('socket dispatch reports synchronous and asynchronous failures once without replaying the operation', async (t) => {
  t.mock.method(console, 'error', () => {})
  for (const asynchronous of [false, true]) {
    const server = new WebSocketBase({ serverName: 'dispatch-test', path: '/test' })
    let calls = 0
    const messages = []
    server.send = (_socket, message) => messages.push(message)
    server.onMessage = (_socket, data) => {
      calls++
      assert.deepEqual(data, { type: 'operation' })
      if (asynchronous) return Promise.reject(new Error('private upstream detail'))
      throw new Error('private upstream detail')
    }
    await server.handleMessage({}, Buffer.from('{"type":"operation"}'), { id: 'test' }, {})
    assert.equal(calls, 1)
    assert.deepEqual(messages, [{ type: 'error', message: 'The requested operation failed.' }])
  }
})

test('socket dispatch keeps plain text compatibility and consumes JSON/plain heartbeats', async () => {
  const server = new WebSocketBase({ serverName: 'heartbeat-test', path: '/test' })
  const handled = []; const pongs = []
  server.onMessage = (_socket, data) => handled.push(data)
  server.handlePong = (id) => pongs.push(id)
  for (const text of ['pong', '{"type":"pong"}', 'hello', '{"type":"subscribe"}']) await server.handleMessage({}, text, { id: 'client' }, {})
  assert.deepEqual(pongs, ['client', 'client'])
  assert.deepEqual(handled, ['hello', { type: 'subscribe' }])
})
