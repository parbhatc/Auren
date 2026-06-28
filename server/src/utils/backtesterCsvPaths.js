import fs from 'fs'
import path from 'path'

/** Default on-disk resolution folder — 1-minute candles (aggregated to HTF in code). */
export const DEFAULT_CSV_RESOLUTION = '1m'

/** Native sub-minute CSV folders (no aggregation from 1m). */
export const NATIVE_SUB_MINUTE_CSV_RESOLUTIONS = ['30s']

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthNameFromIndex(monthIndex) {
  return MONTH_NAMES[monthIndex] ?? 'January'
}

/** Chart resolution → on-disk folder (30S → 30s, 1T → 1t, minute+ → 1m). */
export function csvFolderForChartResolution(resolution) {
  const raw = String(resolution ?? '').trim()
  const upper = raw.toUpperCase()

  const tickMatch = upper.match(/^(\d+)T$/)
  if (tickMatch) return `${tickMatch[1]}t`

  const rangeMatch = upper.match(/^(\d+)R$/)
  if (rangeMatch) return `${rangeMatch[1]}r`

  const secMatch = raw.match(/^(\d+)s$/i)
  if (secMatch) return `${secMatch[1]}s`
  if (/^\d+S$/.test(upper)) {
    return `${parseInt(upper.slice(0, -1), 10)}s`
  }
  return DEFAULT_CSV_RESOLUTION
}

export function symbolHasCsvResolution(csvDir, symbol, csvResolution) {
  const dir = path.join(csvDir, symbol, csvResolution)
  if (!fs.existsSync(dir)) return false
  for (const yearEntry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue
    const yearDir = path.join(dir, yearEntry.name)
    const hasCsv = fs.readdirSync(yearDir).some((f) => f.endsWith('.csv'))
    if (hasCsv) return true
  }
  return false
}

/** e.g. ['1m', '30s'] — 1m always listed; sub-minute only when files exist. */
export function listSymbolCsvResolutions(csvDir, symbol) {
  const out = [DEFAULT_CSV_RESOLUTION]
  for (const res of NATIVE_SUB_MINUTE_CSV_RESOLUTIONS) {
    if (symbolHasCsvResolution(csvDir, symbol, res)) {
      out.push(res)
    }
  }
  return out
}

/** Wire / chart resolutions available for a symbol. */
export function listSymbolChartResolutions(csvDir, symbol) {
  const csvRes = listSymbolCsvResolutions(csvDir, symbol)
  const chart = ['1', '2', '3', '5', '15', '30', '60', '240', '1D']
  if (csvRes.includes('30s')) {
    chart.unshift('30S')
  }
  return chart
}

/** Canonical write path: csvDir/SYMBOL/1m/2026/January.csv */
export function monthFilePath(csvDir, symbol, year, monthName, resolution = DEFAULT_CSV_RESOLUTION) {
  return path.join(csvDir, symbol, resolution, String(year), `${monthName}.csv`)
}

export function ensureMonthFileDir(csvDir, symbol, year, resolution = DEFAULT_CSV_RESOLUTION) {
  const dir = path.join(csvDir, symbol, resolution, String(year))
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Resolve an existing month CSV (read). Native sub-minute folders never fall back to 1m.
 */
export function resolveMonthFilePath(csvDir, symbol, year, monthName, resolution = DEFAULT_CSV_RESOLUTION) {
  const symbolDir = path.join(csvDir, symbol)
  const yearStr = String(year)
  const fileName = `${monthName}.csv`
  const isSubMinute = resolution !== DEFAULT_CSV_RESOLUTION
  const candidates = isSubMinute
    ? [
        path.join(symbolDir, resolution, yearStr, fileName),
        path.join(symbolDir, yearStr, resolution, fileName),
      ]
    : [
        path.join(symbolDir, resolution, yearStr, fileName),
        path.join(symbolDir, yearStr, resolution, fileName),
        path.join(symbolDir, yearStr, fileName),
      ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]
}

/**
 * List year directories for a symbol/resolution pair.
 */
export function listYearDirs(symbolDir, resolution = DEFAULT_CSV_RESOLUTION) {
  const resDir = path.join(symbolDir, resolution)
  if (fs.existsSync(resDir)) {
    return fs.readdirSync(resDir, { withFileTypes: true })
      .filter((item) => item.isDirectory() && /^\d{4}$/.test(item.name))
      .map((item) => item.name)
      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
  }

  // Legacy: symbol/YEAR/*.csv (years directly under symbol)
  if (!fs.existsSync(symbolDir)) return []
  return fs.readdirSync(symbolDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && /^\d{4}$/.test(item.name))
    .map((item) => item.name)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
}

function monthCsvEntriesForYearDir(yearDir, symbol, year, resolution) {
  if (!fs.existsSync(yearDir)) return []
  return fs.readdirSync(yearDir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.endsWith('.csv'))
    .map((item) => {
      const month = item.name.replace('.csv', '')
      const filePath = path.join(yearDir, item.name)
      const stats = fs.statSync(filePath)
      return {
        symbol,
        resolution,
        year: parseInt(String(year), 10),
        month,
        fileName: item.name,
        filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      }
    })
}

/**
 * Enumerate all month CSV files for one symbol (new + legacy layouts).
 */
export function listSymbolCsvFiles(csvDir, symbol, resolution = DEFAULT_CSV_RESOLUTION) {
  const symbolDir = path.join(csvDir, symbol)
  if (!fs.existsSync(symbolDir)) return []

  const files = []
  const seen = new Set()

  const resDir = path.join(symbolDir, resolution)
  if (fs.existsSync(resDir)) {
    for (const yearStr of listYearDirs(symbolDir, resolution)) {
      const yearDir = path.join(resDir, yearStr)
      for (const entry of monthCsvEntriesForYearDir(yearDir, symbol, yearStr, resolution)) {
        const key = `${entry.year}:${entry.month}`
        if (!seen.has(key)) {
          seen.add(key)
          files.push(entry)
        }
      }
    }
  }

  // Legacy symbol/YEAR/month.csv
  for (const yearStr of fs.readdirSync(symbolDir, { withFileTypes: true })
    .filter((item) => item.isDirectory() && /^\d{4}$/.test(item.name))
    .map((item) => item.name)) {
    const yearDir = path.join(symbolDir, yearStr)
    for (const entry of monthCsvEntriesForYearDir(yearDir, symbol, yearStr, resolution)) {
      const key = `${entry.year}:${entry.month}`
      if (!seen.has(key)) {
        seen.add(key)
        files.push(entry)
      }
    }
  }

  files.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return MONTH_NAMES.indexOf(b.month) - MONTH_NAMES.indexOf(a.month)
  })

  return files
}

/**
 * Enumerate all month CSV files under csvDir.
 */
export function listAllCsvFiles(csvDir, resolution = DEFAULT_CSV_RESOLUTION) {
  if (!fs.existsSync(csvDir)) return []

  const symbols = fs.readdirSync(csvDir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)

  const files = []
  for (const symbol of symbols) {
    files.push(...listSymbolCsvFiles(csvDir, symbol, resolution))
  }
  return files
}

/**
 * Find the latest year/month on disk for incremental updates.
 */
export function findLatestMonth(csvDir, symbol, resolution = DEFAULT_CSV_RESOLUTION) {
  const files = listSymbolCsvFiles(csvDir, symbol, resolution)
  if (!files.length) {
    return { latestYear: null, latestMonth: null, latestMonthIndex: null }
  }

  const latest = files[0]
  const latestMonthIndex = MONTH_NAMES.indexOf(latest.month)
  return {
    latestYear: latest.year,
    latestMonth: latest.month,
    latestMonthIndex: latestMonthIndex >= 0 ? latestMonthIndex : null,
  }
}

/**
 * Last candle timestamp (seconds) from the newest month file on disk.
 */
export function findLatestBarTimestamp(csvDir, symbol, resolution = DEFAULT_CSV_RESOLUTION) {
  const files = listSymbolCsvFiles(csvDir, symbol, resolution)
  if (!files.length) return null

  const latest = files[0]
  if (!fs.existsSync(latest.filePath)) return null

  const lines = fs.readFileSync(latest.filePath, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return null

  const timestamp = parseInt(lines[lines.length - 1].split(',')[0], 10)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null

  return {
    timestampSeconds: timestamp,
    timestampMs: timestamp * 1000,
    year: latest.year,
    month: latest.month,
  }
}
