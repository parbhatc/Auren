import assert from 'node:assert/strict'
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { ensureMonthFileDir, monthFilePath } from '../src/utils/backtesterCsvPaths.js'
import { buildCsvInventory } from '../src/utils/backtesterCsvInventory.js'

test('refreshing one CSV dataset reads its updated end time and preserves its historical start', async (t) => {
  const csvDir = await mkdtemp(path.join(tmpdir(), 'auren-csv-inventory-'))
  t.after(() => rm(csvDir, { recursive: true, force: true }))

  const first = new Date(2020, 0, 1, 18).getTime()
  const oldEnd = new Date(2026, 10, 6, 16, 59, 30).getTime()
  const newEnd = new Date(2026, 10, 10, 10, 34, 30).getTime()
  const csvRow = (ms) => `${ms / 1000},1,1,1,1,1\n`

  ensureMonthFileDir(csvDir, 'NQ', 2020, '30s')
  ensureMonthFileDir(csvDir, 'NQ', 2026, '30s')
  ensureMonthFileDir(csvDir, 'NQ', 2026, '1m')
  const updatedMonth = monthFilePath(csvDir, 'NQ', 2026, 'November', '30s')
  await writeFile(monthFilePath(csvDir, 'NQ', 2020, 'January', '30s'), csvRow(first))
  await writeFile(updatedMonth, csvRow(oldEnd))
  await writeFile(monthFilePath(csvDir, 'NQ', 2026, 'November', '1m'), csvRow(oldEnd - 30_000))

  const inventory = await buildCsvInventory(csvDir)
  assert.equal(inventory.length, 2)
  assert.equal(inventory.find((row) => row.resolution === '30s').toMs, oldEnd)

  await appendFile(updatedMonth, csvRow(newEnd))
  const refreshed = await buildCsvInventory(csvDir, { symbol: 'NQ', resolution: '30s' })
  assert.equal(refreshed.length, 1)
  assert.equal(refreshed[0].resolution, '30s')
  assert.equal(refreshed[0].fromMs, first)
  assert.equal(refreshed[0].toMs, newEnd)
  assert.equal(refreshed[0].toLabel, 'NOV 10 2026 10:34:30 AM')
})
