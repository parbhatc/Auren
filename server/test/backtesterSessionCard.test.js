import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// Render the actual card with inert UI boundaries. No route prefetch or action
// may run merely because a replay session's result is displayed.
const dependencies = {
  'react/jsx-runtime':
    'export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;',
  'lucide-react':
    'export const BarChart3 = "chart-icon", Pencil = "edit-icon", Play = "play-icon", RotateCcw = "reset-icon", Trash2 = "delete-icon";',
  '../../../backtester/constants':
    'export const resolveSessionDisplaySymbol = (symbol) => symbol;',
  '../../../constants/routes':
    'export const ROUTES = { BACKTESTER_CHART: "/backtester/chart", DASHBOARD: "/dashboard" };',
  '../../../utils/translator':
    'export const t = (key, _params, fallback) => fallback ?? key;',
  '../../../navigation/routeModules':
    'export const prefetchRouteOnIntent = () => { throw new Error("Rendering must not prefetch a route"); };',
}
const bundled = await build({
  entryPoints: [
    fileURLToPath(
      new URL(
        '../../src/components/backtester/shared/BacktesterSessionCard.tsx',
        import.meta.url
      )
    ),
  ],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'session-card-boundaries',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
          if (kind === 'entry-point') return
          if (!(path in dependencies))
            throw new Error(`Unexpected session card dependency: ${path}`)
          return { path, namespace: 'session-card-test' }
        })
        builder.onLoad(
          { filter: /.*/, namespace: 'session-card-test' },
          ({ path }) => ({ contents: dependencies[path] })
        )
      },
    },
  ],
})
const { default: BacktesterSessionCard } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (node == null || typeof node === 'boolean') return ''
  return typeof node === 'object' ? text(node.props?.children) : String(node)
}
function findPnl(node) {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'span' && text(node).startsWith('P/L:')) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findPnl(child)
    if (found) return found
  }
  return null
}
const noAction = () =>
  assert.fail('Rendering a result must not trigger an action')

for (const [pnl, expectedText, tone] of [
  [250, 'P/L: +$250.00', 'emerald'],
  [-250, 'P/L: -$250.00', 'red'],
  [0, 'P/L: $0.00', 'zinc'],
]) {
  test(`replay P&L ${pnl} displays its signed result with the matching semantic tone`, () => {
    for (const isDark of [false, true]) {
      const card = BacktesterSessionCard({
        session: {
          id: 'result-fixture',
          name: 'Result fixture',
          symbol: 'NQ',
          timeframe: '1m',
          startDate: '2026-10-28',
          startTime: '09:30',
          createdAt: '2026-10-28T13:30:00Z',
          initialBalance: 50000,
          currentBalance: 50000 + pnl,
        },
        isDark,
        onPlay: noAction,
        onEdit: noAction,
        onReset: noAction,
        onDelete: noAction,
        onOverview: noAction,
      })
      const result = findPnl(card)
      assert.ok(result, 'the card must contain a visible P/L result')
      assert.equal(text(result), expectedText)
      assert.equal(
        result.props.className,
        `text-${tone}-${tone === 'zinc' ? 500 : isDark ? 400 : 600}`
      )
    }
  })
}

test('View results invokes only the Overview action on an explicit click', () => {
  let overviewClicks = 0
  const card = BacktesterSessionCard({
    session: {
      id: 'result-fixture',
      name: 'Result fixture',
      symbol: 'NQ',
      timeframe: '1m',
      startDate: '2026-10-28',
      startTime: '09:30',
      createdAt: '2026-10-28T13:30:00Z',
    },
    isDark: true,
    onPlay: noAction,
    onEdit: noAction,
    onReset: noAction,
    onDelete: noAction,
    onOverview: () => {
      overviewClicks += 1
    },
  })
  const find = (node) => {
    if (!node || typeof node !== 'object') return null
    if (
      node.type === 'button' &&
      node.props['aria-label'] === 'View results in Overview'
    )
      return node
    return [node.props?.children].flat(Infinity).map(find).find(Boolean)
  }
  const action = find(card)
  assert.ok(action)
  assert.match(text(action), /View results/)
  assert.equal(overviewClicks, 0)
  let stopped = false
  action.props.onClick({
    stopPropagation() {
      stopped = true
    },
  })
  assert.equal(overviewClicks, 1)
  assert.equal(stopped, true, 'the card must not also launch a replay')
})
