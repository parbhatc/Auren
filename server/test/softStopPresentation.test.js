import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const code = ts.transpileModule(fs.readFileSync(new URL('../../src/chart/bwcPositionBridge.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { setTimeout })(() => ({ isBwcChartPanning: () => false }), module, module.exports)
const { BwcPositionBridge } = module.exports

test('bridge labels initial and unchanged-price soft stops from current cache without recreating orders', async () => {
  const cached = { stopLoss: 95, takeProfit: 105, stopLossMode: 'soft' }
  let snapshot = null
  let opens = 0
  let stopWrites = 0
  const presentations = []
  const overlay = {
    onClose: () => () => {}, onStopLossChanged: () => () => {}, onTakeProfitChanged: () => () => {},
    getPosition: () => snapshot,
    setPresentation: value => presentations.push({ ...value }),
    clear: () => { snapshot = null },
    setMarkPrice() {},
    async buy({ price, qty }) { opens++; snapshot = { entry: price, qty, stopLoss: null, takeProfit: null } },
    async sell() { throw new Error('Unexpected sell') },
    async setStopLoss(value) { stopWrites++; snapshot.stopLoss = value },
    async setTakeProfit(value) { snapshot.takeProfit = value },
  }
  const bridge = new BwcPositionBridge({ positionOverlay: overlay }, { getPosition: () => cached }, () => {})
  await bridge.sync('NQ', 100, 1, 95, 105, { presentation: { symbolLabel: 'MNQ', tickSize: 0.25, tickValue: 0.5 } })
  assert.equal(presentations.at(-1).softStopLoss, true)
  assert.equal(presentations.at(-1).symbolLabel, 'MNQ')
  const original = { ...snapshot }
  cached.stopLossMode = 'hard'
  await bridge.sync('NQ', 100, 1, 95, 105)
  assert.equal(presentations.at(-1).softStopLoss, false)
  assert.deepEqual(snapshot, original)
  assert.equal(opens, 1)
  assert.equal(stopWrites, 1)
  const count = presentations.length
  await bridge.sync('NQ', 100, 1, 95, 105)
  assert.equal(presentations.length, count, 'unchanged presentation does not repaint')
})
