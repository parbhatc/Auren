/**
 * Copy lightweight-charts into betterweightchart/public/vendor for Vite static serving.
 * Runs from Auren root after npm install (BWC postinstall fails when deps are hoisted).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let bwcRoot
try {
  const sdkPath = require.resolve('betterweightchart')
  bwcRoot = path.resolve(path.dirname(sdkPath), '..', '..')
} catch {
  console.error('[sync-bwc-vendor] betterweightchart is not installed')
  process.exit(1)
}

const vendorDir = path.join(bwcRoot, 'public', 'vendor')
const lcFile = path.join(
  path.dirname(require.resolve('lightweight-charts/package.json')),
  'dist',
  'lightweight-charts.standalone.production.mjs'
)
const dest = path.join(vendorDir, 'lightweight-charts.mjs')

if (!fs.existsSync(lcFile)) {
  console.error('[sync-bwc-vendor] missing', lcFile)
  process.exit(1)
}

fs.mkdirSync(vendorDir, { recursive: true })
fs.copyFileSync(lcFile, dest)

const legacy = path.join(vendorDir, 'lightweight-charts-drawing.js')
if (fs.existsSync(legacy)) {
  fs.unlinkSync(legacy)
}

console.log('[sync-bwc-vendor] wrote', path.relative(process.cwd(), dest))
