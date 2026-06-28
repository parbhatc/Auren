#!/usr/bin/env node
/**
 * Move backtester CSVs to SYMBOL/1m/YEAR/month.csv
 *
 * Handles:
 *   SYMBOL/YEAR/month.csv
 *   SYMBOL/YEAR/1m/month.csv
 *
 * Usage: node server/scripts/migrate-backtester-csv-layout.mjs [--dry-run]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const csvDir = path.join(__dirname, '..', 'data', 'backtester', 'csv')
const RESOLUTION = '1m'
const dryRun = process.argv.includes('--dry-run')

const MONTHS = new Set([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
])

let moved = 0
let skipped = 0

function moveMonthFile(from, to) {
  const month = path.basename(from, '.csv')
  if (!MONTHS.has(month)) return

  if (fs.existsSync(to)) {
    console.log(`skip (exists): ${to}`)
    skipped++
    return
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}${from} -> ${to}`)
  if (!dryRun) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.renameSync(from, to)
  }
  moved++
}

function removeIfEmpty(dir) {
  if (dryRun || !fs.existsSync(dir)) return
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir)
  }
}

function migrate() {
  if (!fs.existsSync(csvDir)) {
    console.log(`CSV dir not found: ${csvDir}`)
    return
  }

  for (const symbol of fs.readdirSync(csvDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    if (symbol === RESOLUTION) continue

    const symbolDir = path.join(csvDir, symbol)

    for (const yearEntry of fs.readdirSync(symbolDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      if (!/^\d{4}$/.test(yearEntry.name)) continue

      const year = yearEntry.name
      const legacyYearDir = path.join(symbolDir, year)
      const targetYearDir = path.join(symbolDir, RESOLUTION, year)

      for (const file of fs.readdirSync(legacyYearDir, { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith('.csv'))) {
        moveMonthFile(path.join(legacyYearDir, file.name), path.join(targetYearDir, file.name))
      }

      const legacyResDir = path.join(legacyYearDir, RESOLUTION)
      if (fs.existsSync(legacyResDir)) {
        for (const file of fs.readdirSync(legacyResDir, { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith('.csv'))) {
          moveMonthFile(path.join(legacyResDir, file.name), path.join(targetYearDir, file.name))
        }
        removeIfEmpty(legacyResDir)
      }

      removeIfEmpty(legacyYearDir)
    }

    // Remove legacy SYMBOL/YEAR trees when canonical SYMBOL/1m/YEAR exists
    for (const yearEntry of fs.readdirSync(symbolDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))) {
      const year = yearEntry.name
      const legacyYearDir = path.join(symbolDir, year)
      const targetYearDir = path.join(symbolDir, RESOLUTION, year)
      if (!fs.existsSync(targetYearDir)) continue
      const targetMonths = fs.readdirSync(targetYearDir).filter((f) => f.endsWith('.csv'))
      if (!targetMonths.length) continue
      if (!dryRun) {
        fs.rmSync(legacyYearDir, { recursive: true, force: true })
        console.log(`removed legacy dir: ${legacyYearDir}`)
      } else {
        console.log(`[dry-run] remove legacy dir: ${legacyYearDir}`)
      }
    }
  }

  console.log(`Done. moved=${moved} skipped=${skipped}${dryRun ? ' (dry-run)' : ''}`)
}

migrate()
