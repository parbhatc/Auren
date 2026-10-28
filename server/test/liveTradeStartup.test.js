import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const dependencies = {
  react: `
    export const useContext = () => true;
    export const useCallback = (callback) => callback;
    export const useRef = (current) => ({ current });
    export const useState = (initial) => {
      const index = globalThis.__liveStartup.values.push(initial) - 1;
      return [initial, (value) => { globalThis.__liveStartup.values[index] = value }];
    };
    export const useEffect = (effect) => { globalThis.__liveStartup.effects.push(effect) };
  `,
  'react/jsx-runtime': 'export const jsx = (...args) => ({ args }); export const jsxs = jsx;',
  'react-router-dom': 'export const useNavigate = () => () => {};',
  'lucide-react': 'export const RefreshCw = () => null;',
  '../../../hooks/useTheme': 'export const useTheme = () => ({ isDark: true, toggleTheme() {} });',
  '../../../constants/theme': 'export const getThemeColors = () => ({});',
  '../../../propfirms/registry': 'export const propFirmRegistry = [globalThis.__liveStartup.firm]; export class TradeseaPropFirm {}',
  '../../../constants/routes': 'export const ROUTES = { HOME: "/dashboard" };',
  '../Trading/TradingRenderer': 'export default () => null;',
  '../../../utils/translator': 'export const t = (key) => key;',
  '../../../utils/liveTrade': 'export const getLiveTradePropFirmId = () => "tradesea";',
  '../../layout/ProductHeader': 'export default () => null;',
  '../../../api/api': 'export const getAuthToken = () => "auth";',
  '../../../constants/trade': 'export const getTradeTradeseaAccount = () => ({ accountId: "live-account" });',
  '../../../contexts/LiveTradeViewContext': 'export const LiveTradeViewActive = {};',
  '../../../services/chart/loadAurenChartBoot': 'export const loadAurenChartBoot = () => globalThis.__liveStartup.warmChart();',
  '../../../services/debug/startupTrace': 'export const traceStartup = (name) => globalThis.__liveStartup.traces.push(name);',
  '../../../services/trading/liveTradeSession': `
    export const invalidateLiveTradeSession = () => {};
    export const acquireLiveTradeSession = (options) => {
      globalThis.__liveStartup.options = options;
      return { ready: Promise.resolve().then(() => options.load(() => {})), release() {} };
    };
  `,
}
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../../src/components/trading/Live/LiveTradePage.tsx', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'startup-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === 'entry-point') return
      if (!(path in dependencies)) throw new Error(`Unexpected Live dependency: ${path}`)
      return { path, namespace: 'startup-test' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'startup-test' }, ({ path }) => ({ contents: dependencies[path] }))
  } }],
})

for (const failedWarmup of [false, true]) {
  test(`Live starts account validation while chart modules ${failedWarmup ? 'fail to warm' : 'are still downloading'}`, async (t) => {
    const previousFixture = globalThis.__liveStartup
    const previousStorage = globalThis.localStorage
    const state = {
      values: [], effects: [], events: [], traces: [], options: null,
      firm: {
        id: 'tradesea', practiceMode: false, streamsReady: false,
        setPracticeMode() {},
        async initializeLiveTrade() {
          state.events.push('accounts')
          this.streamsReady = true
        },
        validate() { throw new Error('Live must not run the redundant credential preflight') },
      },
      warmChart() {
        state.events.push('modules')
        return failedWarmup ? Promise.reject(new Error('Warmup unavailable')) : new Promise(() => {})
      },
    }
    globalThis.__liveStartup = state
    globalThis.localStorage = { setItem() {} }
    t.after(() => { globalThis.__liveStartup = previousFixture; globalThis.localStorage = previousStorage })
    // A unique URL keeps each component's module-level provider registry isolated.
    const { default: LiveTradePage } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}#${failedWarmup}`)
    LiveTradePage()
    const cleanups = state.effects.map((effect) => effect()).filter(Boolean)
    await new Promise(setImmediate)
    assert.deepEqual(state.events, ['modules', 'accounts'])
    assert.deepEqual(state.traces, ['account-start', 'account-ready'])
    assert.equal(state.values[0], null, 'a speculative module failure must not become an account validation error')
    assert.equal(state.values[1], false, 'module warmup cannot block provider readiness')
    assert.equal(state.firm.streamsReady, true)
    for (const cleanup of cleanups) cleanup()
  })
}
