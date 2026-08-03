import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import webSocketManager from '../src/websocket/WebSocketManager.js'

class FakeSocket extends EventEmitter {
  constructor() {
    super()
    this.OPEN = 1
    this.readyState = this.OPEN
    this.closeCode = null
    this.closeReason = null
  }

  close(code, reason) {
    this.closeCode = code
    this.closeReason = reason
    this.readyState = 3
    this.emit('close', code, Buffer.from(reason || ''))
  }
}

test('an async connection-handler rejection closes only the client socket', async () => {
  const httpServer = new EventEmitter()
  webSocketManager.closeAll()
  webSocketManager.httpServer = null
  webSocketManager.upgradeHandler = null
  webSocketManager.initialize(httpServer)

  const expectedError = new Error('expired upstream token')
  const wss = webSocketManager.registerServer(
    'AsyncFailureTest',
    '/async-failure-test',
    async () => {
      throw expectedError
    }
  )
  const socket = new FakeSocket()
  const originalConsoleError = console.error
  const loggedErrors = []
  console.error = (...args) => loggedErrors.push(args)

  try {
    wss.emit('connection', socket, {
      url: '/async-failure-test?token=test-token',
      headers: { host: 'localhost' },
      socket: { remoteAddress: '127.0.0.1' },
    })
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(socket.closeCode, 1011)
    assert.equal(socket.closeReason, 'Internal server error')
    assert.equal(loggedErrors.length, 1)
    assert.equal(loggedErrors[0][1], expectedError)
  } finally {
    console.error = originalConsoleError
    webSocketManager.unregisterServer('AsyncFailureTest')
    httpServer.removeListener('upgrade', webSocketManager.upgradeHandler)
    webSocketManager.httpServer = null
    webSocketManager.upgradeHandler = null
  }
})
