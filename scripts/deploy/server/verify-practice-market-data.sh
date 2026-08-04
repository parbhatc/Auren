#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
require_node
cd "$INSTALL_DIR/server"

API_PORT="$API_PORT" node --input-type=module <<'NODE'
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'
import providerRegistry from './src/services/practiceMarketData/PracticeMarketDataProviderRegistry.js'

const token = jwt.sign({ userId: 'deploy-practice-check' }, process.env.JWT_SECRET, { expiresIn: '2m' })
const publicOrigin = String(process.env.PUBLIC_URL || '').replace(/\/$/, '')
const streamOrigin = publicOrigin
  ? publicOrigin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  : `ws://127.0.0.1:${process.env.API_PORT || 3001}`
const streamPath = providerRegistry.descriptor?.transport?.clientGatewayPath
if (!streamPath) throw new Error('Practice market-data provider is missing its client gateway path')
const socket = new WebSocket(
  `${streamOrigin}${streamPath}?token=${encodeURIComponent(token)}`
)
const timeout = setTimeout(() => {
  console.error('Practice market-data verification timed out')
  process.exit(1)
}, 30_000)

socket.on('message', (raw) => {
  const message = JSON.parse(String(raw))
  if (message.type === 'connected') {
    socket.send(JSON.stringify({
      id: 'verify-history',
      type: 'history',
      symbol: 'NASDAQ:AAPL',
      resolution: '30S',
      bars: 5,
    }))
    return
  }
  if (message.type === 'error') {
    console.error(message.error?.message || 'Practice market-data verification failed')
    process.exit(1)
  }
  if (message.id !== 'verify-history') return
  const bars = message.data?.bars || []
  const ordered = bars.every((bar, index) => !index || bar.time > bars[index - 1].time)
  if (message.data?.interval !== '30S' || bars.length !== 5 || !ordered) {
    console.error('Practice market-data verification returned invalid history')
    process.exit(1)
  }
  clearTimeout(timeout)
  console.log(JSON.stringify({
    protocol: 'auren-practice-market-data.v1',
    symbol: message.data.symbol,
    resolution: message.data.interval,
    bars: bars.length,
    ordered,
    first: bars[0].time,
    last: bars.at(-1).time,
  }))
  socket.close()
})

socket.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
NODE
