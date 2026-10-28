import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import ts from 'typescript'

const state = { effects: [], calls: [], search: '' }
globalThis.__legacyReplayRedirect = state
const mocks = {
  react:
    'export const useEffect = (effect) => globalThis.__legacyReplayRedirect.effects.push(effect);',
  'react-router-dom': `export const useLocation = () => ({ search: globalThis.__legacyReplayRedirect.search }); export const useNavigate = () => (...args) => globalThis.__legacyReplayRedirect.calls.push(['navigate', ...args]);`,
  '../../constants/routes':
    'export const ROUTES = { DASHBOARD: "/dashboard" };',
  '../../services/dashboard/dashboardAccountSelection':
    'export const saveDashboardAccountSelection = (selection) => globalThis.__legacyReplayRedirect.calls.push(["select", selection]);',
}
const bundle = await build({
  entryPoints: [
    fileURLToPath(
      new URL(
        '../../src/components/backtester/LegacyReplayStatsRedirect.tsx',
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
      name: 'legacy-replay-redirect-boundaries',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
          if (kind === 'entry-point') return
          if (!(path in mocks))
            throw new Error(
              `Redirect must not import a data or order service: ${path}`
            )
          return { path, namespace: 'legacy-replay-test' }
        })
        builder.onLoad(
          { filter: /.*/, namespace: 'legacy-replay-test' },
          ({ path }) => ({ contents: mocks[path] })
        )
      },
    },
  ],
})
const { default: LegacyReplayStatsRedirect } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
)
beforeEach(() => {
  state.effects = []
  state.calls = []
  state.search = ''
})

test('legacy Replay URL selects its decoded account before replacing the route with Overview', () => {
  state.search = '?sessionId=replay%2Fone%2Btwo&unrelated=ignored'
  assert.equal(LegacyReplayStatsRedirect(), null)
  assert.deepEqual(
    state.calls,
    [],
    'selection must wait for the protected component effect'
  )
  state.effects.forEach((effect) => effect())
  assert.deepEqual(state.calls, [
    ['select', { source: 'replay', accountId: 'replay/one+two' }],
    ['navigate', '/dashboard', { replace: true }],
  ])
})

test('legacy Replay URLs without an account preserve the saved selection and still replace the old route', () => {
  for (const search of ['', '?sessionId=', '?sessionId=%20%20&other=id']) {
    state.calls = []
    state.effects = []
    state.search = search
    LegacyReplayStatsRedirect()
    state.effects.forEach((effect) => effect())
    assert.deepEqual(state.calls, [
      ['navigate', '/dashboard', { replace: true }],
    ])
  }
})

test('the legacy Replay redirect remains behind the real application authentication guard', async () => {
  const code = await readFile(
    new URL('../../src/App.tsx', import.meta.url),
    'utf8'
  )
  const source = ts.createSourceFile(
    'App.tsx',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let route
  const visit = (node) => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(source) === 'Route'
    ) {
      const path = node.attributes.properties.find(
        (attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.text === 'path'
      )
      if (
        path?.initializer?.expression?.getText(source) ===
        'ROUTES.BACKTESTER_STATS'
      )
        route = node
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(route, 'the legacy route must remain registered')
  const element = route.attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.text === 'element'
  )?.initializer?.expression
  assert.ok(element && ts.isJsxElement(element))
  assert.equal(element.openingElement.tagName.getText(source), 'ProtectedRoute')
  assert.ok(
    element.children.some(
      (child) =>
        ts.isJsxSelfClosingElement(child) &&
        child.tagName.getText(source) === 'LegacyReplayStatsRedirect'
    )
  )
})
