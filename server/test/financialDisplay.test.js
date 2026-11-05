import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../src/utils/displayValue.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const module = { exports: {} }
vm.runInNewContext(`(function(module,exports){${code}\n})`)(module, module.exports)
const { financialDisplayValue: value, formatFinancialDisplay: format } = module.exports

test('dollar P&L preserves small realized results, fees and drawdown cents', () => {
  assert.equal(format(-0.5), '-$0.50')
  assert.equal(format(0.5), '+$0.50')
  assert.equal(format(999.5), '+$999.50')
  assert.equal(format(-0.5 / 3), '-$0.17')
  assert.equal(value(-0.5), -0.5)
})

test('rounded zero has neither a negative sign nor a negative tone in any unit', () => {
  for (const unit of ['usd', 'r', 'points', 'percent']) {
    for (const amount of [-0, -0.00001, 0, 0.00001]) {
      assert.equal(value(amount, unit, 25000, 100), 0)
      assert.equal(Object.is(value(amount, unit, 25000, 100), -0), false)
      assert.ok(!format(amount, unit, 25000, 100).startsWith('-'))
    }
  }
  assert.equal(format(-0.5, 'percent', 25000), '0.00%')
})

test('zero dollars remain neutral and connected-account formatting retains fixed cents', () => {
  assert.equal(format(0), '$0')
  assert.equal(format(-0.00001, 'usd', 1, 100, true), '$0.00')
  assert.equal(format(1, 'usd', 1, 100, true), '+$1.00')
  assert.equal(Math.sign(value(-0.01)), -1)
  assert.equal(Math.sign(value(0.01)), 1)
})
