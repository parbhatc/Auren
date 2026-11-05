import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

const require = createRequire(import.meta.url)
function load(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`)(name => name === '../../services/dashboard/lucidAccountProfile' ? load('../../src/services/dashboard/lucidAccountProfile.ts') : require(name), module, module.exports)
  return module.exports
}
const { getLucidAccountProfile: profile, applyLucidAccountSettings } = load('../../src/services/dashboard/lucidAccountProfile.ts')
const Details = load('../../src/components/dashboard/LucidAccountDetails.tsx').default
const account = (name, extra = {}) => ({ id: 'account', label: name, name, ...extra })

test('Flex evaluations show targets and MLL by initial account size', () => {
  for (const [size, target, mll] of [[25, 1250, 1000], [50, 3000, 2000], [100, 6000, 3000], [150, 9000, 4500]]) {
    const result = profile(account(`LFE${String(size).padStart(3, '0')}-ABC-TEST001`))
    assert.equal(result.title, 'LucidFlex')
    assert.equal(result.phase, 'Evaluation')
    assert.equal(result.size, size * 1000)
    assert.equal(result.target, target)
    assert.equal(result.mll, mll)
    assert.match(result.consistency, /40% standard \/ 50% add-on/)
    assert.match(result.dailyLoss, /not provided/)
  }
})

test('funded Flex is simulated, has no evaluation target and no consistency rule', () => {
  const result = profile(account('LFF050-ABC-PRO001'))
  assert.equal(result.phase, 'Sim funded')
  assert.equal(result.target, undefined)
  assert.equal(result.mll, 2000)
  assert.equal(result.consistency, 'No funded consistency rule')
})

test('Pro evaluation does not inherit funded payout consistency', () => {
  const result = profile(account('LTE025-ABC-TEST001'))
  assert.equal(result.title, 'LucidPro')
  assert.equal(result.consistency, 'No evaluation consistency rule')
})

test('Daily plan codes never assert an unverified account phase', () => {
  const unconfirmed = profile(account('LDE050-ABC'))
  assert.equal(unconfirmed.phase, 'Unconfirmed')
  assert.equal(unconfirmed.target, undefined)
  assert.equal(unconfirmed.drawdown, 'Evaluation: EOD or intraday · funded: intraday')
  const evaluation = profile(account('LDI050-ABC', { accountType: 'evaluation' }))
  assert.equal(evaluation.target, 3000)
  assert.match(evaluation.drawdown, /Intraday/)
  assert.match(evaluation.consistency, /selection unconfirmed/)
  const funded = profile(account('LDE050-ABC', { accountType: 'funded' }))
  assert.equal(funded.drawdown, 'Intraday trailing')
})

test('Direct has its own MLL amounts and funded payout consistency', () => {
  for (const [size, mll] of [[25, 1000], [50, 2000], [100, 3500], [150, 5000]]) {
    const result = profile(account(`LTD${String(size).padStart(3, '0')}-ABC`, { accountType: 'funded' }))
    assert.equal(result.target, undefined)
    assert.equal(result.mll, mll)
    assert.equal(result.consistency, '20% per payout cycle')
  }
})

test('unrelated providers and similar names never get Lucid rules', () => {
  for (const name of ['AUR-E025-TEST001', 'OTHERLFE025-ABC', 'LFE0250-ABC', 'LFE025suffix', 'LFE075-ABC']) {
    assert.equal(profile(account(name)), null)
  }
  assert.equal(profile(account('LFE025-ABC', { propFirmDisplayName: 'Another Firm' })), null)
  assert.equal(profile(undefined), null)
})

test('Lucid accounts with unknown codes retain provider identity without invented limits', () => {
  const result = profile(account('UNKNOWN025-ABC', { propFirmDisplayName: 'Lucid Trading' }))
  assert.equal(result.title, 'Lucid Trading')
  assert.equal(result.mll, undefined)
  assert.equal(result.target, undefined)
})

test('conflicting identity and phase metadata suppress rule amounts', () => {
  for (const extra of [{ accountType: 'funded' }, { accountType: 'LucidPro evaluation' }, { accountType: 'live' }]) {
    const result = profile(account('LFE025-ABC', extra))
    assert.equal(result.mll, undefined)
    assert.equal(result.target, undefined)
  }
  assert.equal(profile(account('LFE025-ABC', { externalAccountId: 'LFF025-ABC' })), null)
  assert.equal(profile(account('LTD025-ABC', { accountType: 'evaluation' })).mll, undefined)
})

test('generic real account type does not label simulated funding as live', () => {
  assert.equal(profile(account('LFF025-ABC', { accountType: 'real' })).phase, 'Sim funded')
})

test('rules card distinguishes published allowance from current account progress', () => {
  const html = renderToStaticMarkup(React.createElement(Details, { profile: profile(account('LFE025-ABC')), dashboard: null }))
  for (const text of ['LucidFlex', 'Evaluation', '25K balance', '$1,250', '$1,000', 'Max loss limit (MLL)', 'Published plan reference', 'Not provided by connection', 'not your current breach balance', 'Tradesea']) {
    assert.ok(html.includes(text), text)
  }
  assert.match(html, /workspace-success/)
  assert.match(html, /workspace-danger/)
  assert.match(html, /support.lucidtrading.com/)
})

test('user-confirmed settings override references, preserve unknowns and distinguish DLL off', () => {
  const original = profile(account('LFE025-ABC'))
  const settings = { dllEnabled: true, dllAmount: 600, consistencyPercent: 40, drawdownMethod: 'intraday', profitTarget: 1433, maxLoss: null }
  const result = applyLucidAccountSettings(original, settings)
  assert.equal(result.target, 1433)
  assert.equal(result.mll, 1000)
  assert.equal(result.dailyLoss, '$600 · on, confirmed')
  assert.equal(result.consistency, '40% · confirmed')
  assert.equal(result.drawdown, 'Intraday trailing · confirmed')
  assert.equal(applyLucidAccountSettings(original, { ...settings, dllEnabled: false }).dailyLoss, 'Off · confirmed')
  assert.equal(original.target, 1250)
})

test('balance and trading days remain dated monthly statistics, not invented live progress', () => {
  const html = renderToStaticMarkup(React.createElement(Details, { profile: profile(account('LFE025-ABC')), period: 'October 2026', dashboard: {
    dailyAccountBalance: [{ date: '2026-10-29', value: 25104 }, { date: '2026-10-28', value: 25000 }],
    pnlAndTradeCountCalendar: [{ date: '2026-10-28', tradesCount: 2 }, { date: '2026-10-29', tradesCount: 3 }],
  } }))
  assert.ok(html.includes('$25,104'))
  assert.ok(html.includes('2026-10-29'))
  assert.ok(html.includes('selected month'))
  assert.ok(html.includes('Current consistency / amount left'))
  assert.ok(!html.includes('551.83%'))
})
