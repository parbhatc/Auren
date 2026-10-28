import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const modules = new Map()

function localModule(specifier, importer) {
  if (!specifier.startsWith('.')) return null
  const base = path.resolve(path.dirname(importer), specifier)
  return [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '.css'].map((extension) => base + extension),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((name) => path.join(base, name)),
  ].find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null
}

function staticImports(file) {
  if (modules.has(file)) return modules.get(file)
  const dependencies = []
  modules.set(file, dependencies)
  if (!/\.[cm]?[jt]sx?$/.test(file)) return dependencies
  // Strip erased type imports first, matching the runtime module graph rather
  // than treating type-only chart contracts as downloaded chart code.
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  for (const statement of source.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue
    const dependency = localModule(statement.moduleSpecifier.text, file)
    if (dependency) dependencies.push(dependency)
  }
  return dependencies
}

function graph(entry) {
  const visited = new Set()
  function visit(file) {
    if (visited.has(file)) return
    visited.add(file)
    staticImports(file).forEach(visit)
  }
  visit(path.join(root, entry))
  return new Set([...visited].map((file) => path.relative(root, file).split(path.sep).join('/')))
}

test('Dashboard and News download independent workspace pages', () => {
  const dashboard = graph('src/pages/workspace/DashboardPage.tsx')
  assert.ok(dashboard.has('src/hooks/useDashboardAccountData.ts'))
  assert.ok(!dashboard.has('src/journal/journalConditions.ts'))
  assert.ok(!dashboard.has('src/pages/workspace/AnalyticsPage.tsx'))
  assert.ok(!dashboard.has('src/pages/workspace/NewsWorkspacePage.tsx'))
  const news = graph('src/pages/workspace/NewsWorkspacePage.tsx')
  assert.ok(!news.has('src/hooks/useDashboardAccountData.ts'))
  assert.ok(!news.has('src/hooks/useActivePracticeData.ts'))
  assert.ok(!news.has('src/api/journal.api.ts'))
})

test('Journal list leaves editor and image workflows behind the open-editor boundary', () => {
  const journal = graph('src/pages/journal/JournalPage.tsx')
  assert.ok(!journal.has('src/journal/JournalEntryEditor.tsx'))
  assert.ok(!journal.has('src/journal/JournalRecapFields.tsx'))
  assert.ok(!journal.has('src/journal/useJournalDraft.ts'))
  assert.ok(!journal.has('src/journal/journalImages.ts'))
})

test('Journal detail renders its record without importing chart services first', () => {
  const detail = graph('src/pages/journal/JournalTradeDetailPage.tsx')
  assert.ok(!detail.has('src/journal/JournalReviewChart.tsx'))
  assert.ok(!detail.has('src/services/chart/AurenChart.tsx'))
  assert.ok(!detail.has('src/services/tradesea/TradeseaDatafeed.ts'))
  assert.ok(!detail.has('src/chart/aurenChartBoot.ts'))
})

test('Review formatting does not import the analytics screen', () => {
  const reviews = graph('src/pages/journal/JournalReviewsPage.tsx')
  assert.ok(reviews.has('src/journal/journalFormat.ts'))
  assert.ok(!reviews.has('src/journal/JournalAnalyticsPanel.tsx'))
})

test('Provider settings and Practice news do not load trading adapters', () => {
  for (const entry of [
    'src/components/settings/prop_firms/index.tsx',
    'src/components/trading/Practice/NewsPage.tsx',
  ]) {
    const page = graph(entry)
    assert.ok(!page.has('src/propfirms/registry.ts'), entry)
    assert.ok(!page.has('src/propfirms/tradesea/TradeseaPropFirm.ts'), entry)
    assert.ok(!page.has('src/services/chart/AurenChart.tsx'), entry)
    assert.ok(!page.has('src/services/tradesea/TradeseaMdsClient.ts'), entry)
  }
  const live = graph('src/components/trading/Live/LiveTradePage.tsx')
  assert.ok(live.has('src/propfirms/registry.ts'))
  assert.ok(!live.has('src/propfirms/tradesea/connect/TradeseaConnectPanel.tsx'))
  assert.ok(!live.has('src/propfirms/connect/settingsPanels.tsx'))
})

test('Replay overview leaves inactive tabs and dialogs outside its initial graph', () => {
  const stats = graph('src/components/backtester/Stats/index.ts')
  assert.ok(stats.has('src/components/trading/Stats/OverviewTab.tsx'))
  assert.ok(!stats.has('src/components/trading/Stats/StatsCalendar.tsx'))
  assert.ok(!stats.has('src/components/trading/Stats/TradesTable.tsx'))
  assert.ok(!stats.has('src/components/trading/Stats/DayStatsDialog.tsx'))
  assert.ok(!stats.has('src/components/trading/Stats/WeekStatsDialog.tsx'))
  assert.ok(!stats.has('src/components/trading/Stats/TradingTimeline.tsx'))
  for (const entry of [
    'src/components/backtester/BacktesterSessionsList/index.tsx',
    'src/components/backtester/DataManagement/index.tsx',
  ]) {
    const page = graph(entry)
    assert.ok(!page.has('src/backtester/components/chart/BacktesterChart.tsx'))
    assert.ok(!page.has('src/components/backtester/BacktesterChartView/BacktesterChartView.tsx'))
  }
})
