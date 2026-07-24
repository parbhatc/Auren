import assert from 'node:assert/strict'
import test from 'node:test'

import {
  translateClientToUpstream,
  translateUpstreamToClient,
} from '../src/websocket/mds/MdsProtocol.js'

function translateClient(frame) {
  return JSON.parse(
    translateClientToUpstream(Buffer.from(JSON.stringify(frame)), false)
  )
}

function translateUpstream(frame) {
  return JSON.parse(
    translateUpstreamToClient(Buffer.from(JSON.stringify(frame)), false)
  )
}

test('keeps f:7 TTV enabled for a two-pane NQ/ES layout', () => {
  assert.deepEqual(
    translateClient({
      action: 'subscribe',
      type: 'traded_volume_at_price',
      symbols: ['CME:NQ', 'CME:ES'],
    }),
    {
      f: 7,
      b: 'ttvDef',
      s: ['CME:NQ', 'CME:ES'],
      u: [],
      l: 0,
    }
  )
})

test('subscribes f:8 market mode for every chart pane', () => {
  assert.deepEqual(
    translateClient({
      action: 'subscribe',
      type: 'market_mode',
      symbols: ['CME:NQ', 'CME:ES'],
    }),
    {
      f: 8,
      b: 'marketModeDef',
      s: ['CME:NQ', 'CME:ES'],
      u: [],
      l: 0,
    }
  )
})

test('translates f:7 and f:8 responses without dropping their payloads', () => {
  assert.deepEqual(
    translateUpstream({
      f: 7,
      id: 'CME:NQ',
      v: [[23456.75, 19]],
      u: 1,
    }),
    {
      type: 'traded_volume_at_price',
      symbol: 'CME:NQ',
      levels: [[23456.75, 19]],
      updateType: 1,
    }
  )

  assert.deepEqual(
    translateUpstream({
      f: 8,
      id: 'CME:ES',
      reason: 'MARKET_EVENT',
      mode: 'OPEN',
    }),
    {
      type: 'market_mode',
      symbol: 'CME:ES',
      reason: 'MARKET_EVENT',
      mode: 'OPEN',
    }
  )
})
