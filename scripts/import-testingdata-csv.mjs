import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destinationRoot = path.join(projectRoot, 'server', 'data', 'backtester', 'csv')
const backupRoot = path.join(projectRoot, 'server', 'data', 'backtester', 'import-backups', new Date().toISOString().replace(/[:.]/g, '-'))
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length)
const apply = process.argv.includes('--apply')

if (!sourceArg) {
  throw new Error('Usage: node scripts/import-testingdata-csv.mjs --source=<testingdata directory> [--apply]')
}

const sourceRoot = path.resolve(sourceArg, 'data', 'csv')
if (!fs.statSync(sourceRoot).isDirectory()) throw new Error(`CSV source is not a directory: ${sourceRoot}`)

function readRows(filePath) {
  if (!fs.existsSync(filePath)) return new Map()
  const rows = new Map()
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue
    const fields = line.split(',')
    const timestamp = Number(fields[0])
    if (fields.length !== 6 || !Number.isInteger(timestamp) || timestamp <= 0 ||
      fields.slice(1).some((value) => !Number.isFinite(Number(value)))) {
      throw new Error(`Invalid CSV row in ${filePath}: ${line.slice(0, 100)}`)
    }
    // The source contains a few revised duplicate bars; its last row is the revision.
    rows.set(timestamp, line)
  }
  return rows
}

const changes = []
for (const symbol of ['ES', 'NQ']) {
  for (const resolution of ['30s', '1m']) {
    const symbolRoot = path.join(sourceRoot, symbol)
    for (const year of fs.readdirSync(symbolRoot).filter((name) => /^\d{4}$/.test(name))) {
      const sourceDir = path.join(symbolRoot, year, resolution)
      if (!fs.existsSync(sourceDir)) continue
      for (const monthFile of fs.readdirSync(sourceDir).filter((name) => /^[A-Z][a-z]+\.csv$/.test(name))) {
        const sourceFile = path.join(sourceDir, monthFile)
        const destinationFile = path.join(destinationRoot, symbol, resolution, year, monthFile)
        const sourceRows = readRows(sourceFile)
        const merged = readRows(destinationFile)
        let added = 0
        let replaced = 0
        for (const [timestamp, line] of sourceRows) {
          if (!merged.has(timestamp)) added++
          else if (merged.get(timestamp) !== line) replaced++
          merged.set(timestamp, line)
        }
        if (!added && !replaced) continue
        changes.push({ sourceFile, destinationFile, merged, added, replaced, symbol, resolution })
      }
    }
  }
}

const summary = { files: changes.length, added: 0, replaced: 0, datasets: {} }
for (const change of changes) {
  summary.added += change.added
  summary.replaced += change.replaced
  const key = `${change.symbol}/${change.resolution}`
  summary.datasets[key] ??= { files: 0, added: 0, replaced: 0 }
  summary.datasets[key].files++
  summary.datasets[key].added += change.added
  summary.datasets[key].replaced += change.replaced
}

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', sourceRoot, destinationRoot, ...summary }, null, 2))
if (!apply) process.exit(0)

for (const change of changes) {
  const relative = path.relative(destinationRoot, change.destinationFile)
  if (fs.existsSync(change.destinationFile)) {
    const backupFile = path.join(backupRoot, relative)
    fs.mkdirSync(path.dirname(backupFile), { recursive: true })
    fs.copyFileSync(change.destinationFile, backupFile, fs.constants.COPYFILE_EXCL)
  }
  fs.mkdirSync(path.dirname(change.destinationFile), { recursive: true })
  const temporaryFile = `${change.destinationFile}.import-${process.pid}.tmp`
  const content = [...change.merged.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, line]) => line)
    .join('\n')
  fs.writeFileSync(temporaryFile, content, { flag: 'wx' })
  fs.renameSync(temporaryFile, change.destinationFile)
}

console.log(`Import complete. Original destination files backed up at ${backupRoot}`)
