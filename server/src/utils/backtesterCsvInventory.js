import fs from 'fs'
import path from 'path'
import {
  DEFAULT_CSV_RESOLUTION,
  NATIVE_SUB_MINUTE_CSV_RESOLUTIONS,
  listSymbolCsvFiles,
} from './backtesterCsvPaths.js'

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function readFirstLastTimestamp(filePath) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  if (!content) return null
  const lines = content.split('\n').filter((line) => line.trim())
  if (!lines.length) return null
  const first = parseInt(lines[0].split(',')[0], 10)
  const last = parseInt(lines[lines.length - 1].split(',')[0], 10)
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null
  return { firstMs: first * 1000, lastMs: last * 1000 }
}

function formatInventoryTime(ms) {
  const d = new Date(ms)
  let hours = d.getHours()
  const minutes = d.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  if (minutes === 0) return `${hours}:00 ${ampm}`
  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`
}

function formatInventoryDate(ms) {
  const d = new Date(ms)
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`
}

function formatInventoryDateTime(ms) {
  return `${formatInventoryDate(ms)} ${formatInventoryTime(ms)}`
}

function resolutionLabel(csvResolution) {
  if (csvResolution === '1m') return '1 min'
  const sec = String(csvResolution).match(/^(\d+)s$/i)
  if (sec) return `${sec[1]} sec`
  const tick = String(csvResolution).match(/^(\d+)t$/i)
  if (tick) return `${tick[1]} tick${tick[1] === '1' ? '' : 's'}`
  const range = String(csvResolution).match(/^(\d+)r$/i)
  if (range) return `${range[1]} range${range[1] === '1' ? '' : 's'}`
  return csvResolution
}

function listResolutionDirs(symbolDir) {
  if (!fs.existsSync(symbolDir)) return []
  return fs
    .readdirSync(symbolDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !/^\d{4}$/.test(name))
}

/**
 * Scan on-disk CSV folders and return per-symbol resolution date ranges.
 */
export function buildCsvInventory(csvDir) {
  if (!fs.existsSync(csvDir)) return []

  const reservedNames = new Set([DEFAULT_CSV_RESOLUTION, ...NATIVE_SUB_MINUTE_CSV_RESOLUTIONS])
  const symbols = fs
    .readdirSync(csvDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !reservedNames.has(name))

  const inventory = []

  for (const symbol of symbols) {
    const symbolDir = path.join(csvDir, symbol)
    const resolutionDirs = listResolutionDirs(symbolDir)
    const csvResolutions =
      resolutionDirs.length > 0 ? resolutionDirs : [DEFAULT_CSV_RESOLUTION, ...NATIVE_SUB_MINUTE_CSV_RESOLUTIONS]

    for (const csvResolution of csvResolutions) {
      const files = listSymbolCsvFiles(csvDir, symbol, csvResolution)
      if (!files.length) continue

      let minMs = Infinity
      let maxMs = -Infinity

      for (const file of files) {
        const range = readFirstLastTimestamp(file.filePath)
        if (!range) continue
        minMs = Math.min(minMs, range.firstMs)
        maxMs = Math.max(maxMs, range.lastMs)
      }

      if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) continue

      inventory.push({
        symbol,
        resolution: csvResolution,
        resolutionLabel: resolutionLabel(csvResolution),
        fromMs: minMs,
        toMs: maxMs,
        fromLabel: formatInventoryDateTime(minMs),
        toLabel: formatInventoryDateTime(maxMs),
      })
    }
  }

  inventory.sort((a, b) => {
    const sym = a.symbol.localeCompare(b.symbol)
    if (sym !== 0) return sym
    return a.resolution.localeCompare(b.resolution)
  })

  return inventory
}
