import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import puppeteer from 'puppeteer'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const fixture = `const account = { id: 'LFE025-TEST009', name: 'LFE025-TEST009', label: 'Lucid Trading | LFE025-TEST009', propFirmDisplayName: 'Lucid Trading', providerAvailable: true };
  const read = () => JSON.parse(localStorage.getItem('fixtureSettings') || 'null');
  export const tradeseaAPI = {
    getAccounts: async () => ({ success: true, connected: true, accounts: [account] }),
    getSavedAccounts: async () => ({ success: true, accounts: localStorage.getItem('removed') ? [] : [{ ...account, ruleSettings: read() }] }),
    saveAccountSettings: async (id, settings) => { localStorage.setItem('fixtureSettings', JSON.stringify(settings)); localStorage.removeItem('removed'); return { success: true, ruleSettings: settings } },
    removeSavedAccount: async () => { localStorage.setItem('removed', 'yes'); localStorage.removeItem('fixtureSettings'); return { success: true } },
  };`
const mocks = {
  'api/api': `export const getAuthToken = () => 'fixture-owner';`,
  'api/tradesea.api': fixture,
  'constants/practice': `export const getPracticeAccounts = () => [];
    export const generatePracticeAccountName = () => 'Practice';
    export const getPracticeAccountDisplayTitle = a => a.displayName;
    export const getPracticeAccountMetaLabel = () => '';
    export const refreshPracticeFromApi = async () => {};
    export const PRACTICE_STORAGE_KEYS = {};
    export const createPracticeAccount = async () => ({});
    export const deletePracticeAccount = async () => {};
    export const resetPracticeAccount = async () => {};
    export const evaluatePracticeRules = () => ({});`,
  'services/dashboard/dashboardAccountData': 'export const invalidateDashboardAccountSnapshots = () => {};',
  'services/dashboard/dashboardAccountSelection': 'export const saveDashboardAccountSelection = () => {};',
  'services/dashboard/dashboardReplayData': `export const loadDashboardReplaySessions = async () => [{ id: 'replay-1', name: 'October replay', symbol: 'MNQ', startDate: '2026-10-29' }];`,
  'hooks/useTheme': `export const useTheme = () => ({ isDark: true, toggleTheme() {} });`,
  'components/layout/ProductHeader': 'export default function Header() { return null }',
  'components/trading/Practice/PracticeMarketDataSelector': 'export default function Selector() { return null }',
}
const bundle = await build({
  stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom'; import Page from './src/pages/practice/PracticeWorkspacePage'; createRoot(document.getElementById('root')).render(<MemoryRouter><Page /></MemoryRouter>);`, resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'browser', format: 'iife', write: false, jsx: 'automatic', loader: { '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-account-fixtures', setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      const path = resolve(args.resolveDir || root, args.path).replace(/\\/g, '/')
      const match = Object.keys(mocks).find(key => path.endsWith(key))
      if (match) return { path: match, namespace: 'fixture' }
    })
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path] }))
  } }],
})
let css = await fs.readFile(new URL('../../../src/pages/practice/PracticeWorkspacePage.css', import.meta.url), 'utf8')
const assets = await fs.readdir(new URL('../../../dist/assets/', import.meta.url))
const indexCss = assets.find(name => /^index-.*\.css$/.test(name))
if (indexCss) css += await fs.readFile(new URL(`../../../dist/assets/${indexCss}`, import.meta.url), 'utf8')
const server = http.createServer(async (req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return }
  if (req.url === '/brands/tradesea.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(await fs.readFile(new URL('../../../public/brands/tradesea.svg', import.meta.url))); return }
  res.setHeader('Content-Type', 'text/html'); res.end(`<html><head><style>:root{--app-bg:#09090b;--app-panel:#141416;--app-inset:#1c1c20;--app-text:#f4f4f5;--app-muted:#a1a1aa;--app-border:#303036;--app-accent:#a78bfa;--app-hover:#232328}body{margin:0;background:var(--app-bg);color:var(--app-text);font-family:Arial}${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewport({ width: 1440, height: 1050 })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const click = async label => {
    const handle = await page.waitForFunction(text => [...document.querySelectorAll('button')].find(button => (button.getAttribute('aria-label') || button.textContent.trim()) === text), {}, label)
    await handle.asElement().click()
  }
  await page.waitForSelector('#practice-accounts-tab')
  assert.deepEqual(await page.$$eval('[role="tab"]', tabs => tabs.slice(0, 3).map(tab => tab.getAttribute('aria-label') || tab.textContent.trim().replace(/\s*0$/, ''))), ['Practice', 'Tradesea', 'Replay'])
  await click('Tradesea')
  await click('Rules & settings')
  await click('Confirm account settings')
  await click('On')
  await page.type('input[placeholder="Enter the limit shown by Lucid"]', '600')
  await page.type('input[placeholder="e.g. 40 or 50 · 0 for none"]', '40')
  await click('EOD')
  await click('Save settings')
  await page.waitForFunction(() => document.body.textContent.includes('$600 · on, confirmed'))
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fixtureSettings')).consistencyPercent), 40)
  await click('Replay')
  await page.waitForFunction(() => document.body.textContent.includes('October replay'))
  await click('Tradesea')
  await click('Rules & settings')
  await page.waitForFunction(() => document.body.textContent.includes('40% · confirmed'))
  await fs.mkdir(new URL('../../../.codex-logs/', import.meta.url), { recursive: true })
  await page.screenshot({ path: fileURLToPath(new URL('../../../.codex-logs/account-manager-desktop.png', import.meta.url)), fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await page.screenshot({ path: fileURLToPath(new URL('../../../.codex-logs/account-manager-mobile.png', import.meta.url)), fullPage: true })
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width })))
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `mobile layout must not overflow: ${JSON.stringify(overflow)}`)
  await page.click('button[aria-label="Remove saved LFE025-TEST009"]')
  await click('Remove saved account')
  await page.waitForFunction(() => document.body.textContent.includes('No saved Tradesea accounts'))
  await click('Refresh')
  await page.waitForFunction(() => document.body.textContent.includes('No saved Tradesea accounts'))
  assert.equal(await page.evaluate(() => localStorage.getItem('fixtureSettings')), null)
  assert.deepEqual(errors, [])
  console.log('Passed: source tabs, confirmation form, saved rules after tab changes, replay listing, explicit removal, refresh retention and mobile overflow.')
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
