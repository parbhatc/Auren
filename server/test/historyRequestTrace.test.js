import test from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryRequestTrace } from '../../shared/historyRequestTrace.js'

test('history trace distinguishes logical reads, real downloads, cache hits and joined reads', () => {
  let now = 100
  const trace = createHistoryRequestTrace(3, () => now)
  const read = { symbol: 'ES', resolution: '30S', countBack: 500, reason: 'chart.initial' }
  trace.start({ ...read, kind: 'logical' })({ bars: 500 })
  const finish = trace.start({ ...read, kind: 'wire', url: '/secret?token=private', accountId: 'private' })
  now += 42
  finish({ bars: 500 })
  finish({ error: true })
  trace.start({ ...read, kind: 'cache' })()
  trace.start({ ...read, kind: 'joined' })()
  const snapshot = trace.snapshot()
  assert.deepEqual(snapshot.counts, { logical: 1, wire: 1, cache: 1, joined: 1, retries: 0, failed: 0 })
  assert.equal(snapshot.events.length, 3)
  assert.equal(snapshot.events[0].durationMs, 42)
  assert.equal(snapshot.series[0].bars, 500)
  assert.doesNotMatch(JSON.stringify(snapshot), /private|secret|token|accountId/)
  snapshot.series[0].wire = 99
  assert.equal(trace.snapshot().series[0].wire, 1)
})

test('retries and failures remain visible after the event ring rotates', () => {
  const trace = createHistoryRequestTrace(1)
  trace.start({ kind: 'wire', symbol: 'NQ', resolution: '60', attempt: 0 })({ error: true })
  trace.start({ kind: 'wire', symbol: 'NQ', resolution: '60', attempt: 1 })({ bars: 320 })
  assert.equal(trace.snapshot().counts.wire, 2)
  assert.equal(trace.snapshot().counts.retries, 1)
  assert.equal(trace.snapshot().counts.failed, 1)
  assert.equal(trace.snapshot().events.length, 1)
})
