import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const commonPath = fileURLToPath(
  new URL('../../scripts/deploy/server/common.sh', import.meta.url)
)
const configSource = fs.readFileSync(commonPath, 'utf8')

const websocketPaths = [
  '/tradesea-mds-ws',
  '/tradesea-trades-ws',
  '/practice-account-ws',
  '/practice-market-data-ws',
  '/backtester-ws',
  '/backtester/data-management-ws',
]

for (const path of websocketPaths) {
  test(`production nginx proxies ${path} websocket upgrades`, () => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const block = configSource.match(
      new RegExp(`location ${escaped} \\{([\\s\\S]*?)\\n    \\}`)
    )?.[1]

    assert.ok(block, `missing nginx location for ${path}`)
    assert.match(block, /proxy_pass http:\/\/127\.0\.0\.1:\$\{API_PORT\};/)
    assert.ok(block.includes('proxy_set_header Upgrade \\$http_upgrade;'))
    assert.match(block, /proxy_set_header Connection "upgrade";/)
  })
}
