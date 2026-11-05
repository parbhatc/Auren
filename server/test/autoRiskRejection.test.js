import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../../src/components/trading/shared/pad/bracketUtils.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const module = { exports: {} }
vm.runInNewContext(`(function(require,module,exports){${code}\n})`)(() => ({ BRACKET_TICK_PRESETS: [] }), module, module.exports)
const { positionSizeForRisk: size, riskSizingRejectionMessage: explain } = module.exports

test('the selected 28700.50 stop exceeds the $100 MNQ budget and explains the minimum risk', () => {
  const result = size(100, 28790, 28700.5, 0.25, 0.5, 20, 0)
  assert.equal(result.quantity, 0)
  assert.equal(result.perContractRisk, 179)
  assert.match(explain(result, 100, 0, 'MNQ', 20), /1 MNQ contract risks \$179\.00/)
  assert.match(explain(result, 100, 0, 'MNQ', 20), /limit is \$100\.00/)
})

test('valid long and short stops retain the same five-contract $100 risk sizing', () => {
  for (const stop of [28780, 28800]) {
    const result = size(100, 28790, stop, 0.25, 0.5, 20, 0)
    assert.equal(result.quantity, 5)
    assert.equal(result.plannedRisk, 100)
  }
})

test('explicit buffers and account quantity caps remain enforced', () => {
  const buffered = size(100, 28790, 28700.5, 0.25, 0.5, 20, 100)
  assert.equal(buffered.quantity, 1)
  assert.match(explain(buffered, 100, 100, 'MNQ', 20), /\$200\.00 including buffer/)
  assert.equal(size(100, 28790, 28780, 0.25, 0.5, 0), null)
  assert.match(explain(null, 100, 0, 'MNQ', 0), /account’s quantity limit/)
  assert.match(explain(null, 100, 0, 'MNQ', 20), /current quote/)
})
