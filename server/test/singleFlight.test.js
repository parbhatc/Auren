import test from 'node:test'
import assert from 'node:assert/strict'
import { createSingleFlight } from '../../shared/singleFlight.js'

test('concurrent reads share work while subsequent reads get fresh data', async () => {
  const read = createSingleFlight()
  let calls = 0
  let complete
  const load = () => {
    calls++
    return new Promise((resolve) => { complete = resolve })
  }
  const first = read('accounts:session-a', load)
  const second = read('accounts:session-a', load)
  assert.equal(first, second)
  await Promise.resolve()
  assert.equal(calls, 1)
  complete({ accounts: ['one'] })
  assert.deepEqual(await second, { accounts: ['one'] })
  assert.deepEqual(await read('accounts:session-a', () => ({ accounts: ['two'] })), { accounts: ['two'] })
})

test('account and session keys keep independent requests separate', async () => {
  const read = createSingleFlight()
  const first = read('session-a:stream:one', () => 'one')
  const second = read('session-a:stream:two', () => 'two')
  const third = read('session-b:stream:one', () => 'other user')
  assert.deepEqual(await Promise.all([first, second, third]), ['one', 'two', 'other user'])
})

test('failed reads can be retried, including synchronous loader errors', async () => {
  const read = createSingleFlight()
  const failure = read('auth', () => { throw new Error('unavailable') })
  assert.equal(failure, read('auth', () => 'should share failure'))
  await assert.rejects(failure, /unavailable/)
  assert.equal(await read('auth', () => 'recovered'), 'recovered')
})
