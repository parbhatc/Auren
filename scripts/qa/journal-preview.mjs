// Isolated UI fixture: real journal controllers + in-memory SQLite, no provider connections.
// Run with: node scripts/qa/journal-preview.mjs
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import Database from '../../server/src/config/Database.js'
import journal from '../../server/src/controllers/TradingJournalController.js'

const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url))
const express = serverRequire('express')
const sqlite3 = serverRequire('sqlite3')
Database.db = new sqlite3.Database(':memory:')
await Database.createTables()
const user = { id: 'journal-qa', username: 'journal-qa', name: 'Journal Preview', email: 'preview@example.test', role: 'user', email_verified: true, isAdmin: false }
const app = express()
app.use(express.json({ limit: '4mb' }))
app.get('/roles/status', (_req, res) => res.json({ success: true, hasRoles: true, rolesCount: 1, roles: [] }))
app.post('/auth/login', (_req, res) => res.json({ success: true, token: 'local-journal-fixture', user }))
app.get('/auth/validate', (_req, res) => res.json({ success: true, user }))
app.use((req, _res, next) => { req.user = user; next() })
for (const [method, route, handler] of [
  ['get', '/trading-journal/analytics', 'getJournalAnalytics'],
  ['get', '/trading-journal/reviews/:kind/:start', 'getJournalReview'],
  ['put', '/trading-journal/reviews/:kind/:start', 'saveJournalReview'],
  ['get', '/trading-journal/entries', 'getJournalEntries'],
  ['post', '/trading-journal/entries', 'createJournalEntry'],
  ['get', '/trading-journal/entries/:id', 'getJournalEntry'],
  ['put', '/trading-journal/entries/:id', 'updateJournalEntry'],
  ['delete', '/trading-journal/entries/:id', 'deleteJournalEntry'],
  ['get', '/trading-journal/strategies', 'getStrategies'],
]) app[method](route, journal[handler].bind(journal))
app.get('/backtester/history', (_req, res) => res.json({ bars: [] }))
app.get('/practice/accounts', (_req, res) => res.json({ success: true, accounts: [] }))
app.get('/practice/accounts/:id/stats', (_req, res) => res.json({ success: true, stats: { trades: [{ id: 'qa-closed', symbol: 'NQ', direction: 'short', entryPrice: 20000, exitPrice: 19990, contracts: 2, pnl: 400, fees: 5, entryTime: 1789047900, exitTime: 1789048800 }] } }))
app.get('/backtester/trades', (_req, res) => res.json({ success: true, trades: [{ id: 'qa-replay-closed', session_id: 'qa-replay', symbol: 'NQ', direction: 'short', entry_price: 20000, exit_price: 19990, contracts: 2, entry_time: 1789047900, exit_time: 1789048800 }] }))
app.get('/tradesea/executions', (_req, res) => res.json({ success: true, s: 'ok', d: [{ id: 'qa-live-close', instrument: 'CME:NQ', side: 'buy', price: 19990, qty: 2, isClose: true, commission: 5, time: 1789048800 }] }))
app.use((_req, res) => res.json({ success: true, accounts: [], entries: [], firms: [], data: [] }))

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII='
await journal.createJournalEntry({ user, body: {
  playbook: 'Sweep + HTF FVG + IFVG', symbol: 'NQ', dateTime: '2026-09-10T09:35', exitDateTime: '2026-09-10T09:45', side: 'short', entryPrice: '20000', closePrice: '19995', size: '1', pnl: '100', outcome: 'win', conditionResponses: { 'Liquidity sweep': '9:30 AM | 8:00 AM | high | 20001 | Asia high', 'Clear targets': true, IFVG: '1m @ 9:34 AM' }, notes: 'Synthetic UI fixture. No real account or trade.', recap: { title: 'Setup #1 · Morning confirmation', execution: 'taken', grade: 'A', lesson: 'Wait for the planned confirmation.', session: 'New York AM', screenshots: [{ id: 'fixture', caption: 'Small synthetic attachment for persistence checks', dataUrl: png }] },
} }, { status() { return this }, json() {} })

const vite = await createServer({
  server: { host: '127.0.0.1', port: 3310, strictPort: true, proxy: {} },
  plugins: [{ name: 'isolated-journal-fixture', configureServer(server) { server.middlewares.use('/api', app) } }],
})
await vite.listen()
console.log('Journal UI fixture: http://127.0.0.1:3310/journal (sign in with any fixture credentials)')
const stop = async () => { await vite.close(); await new Promise((resolve) => Database.db.close(resolve)); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
