/**
 * Resolve BetterWeightChart root for Vite static serving + vendor sync.
 * Prefers local sibling checkout (or BWC_ROOT env) over node_modules.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const aurenRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const LOCAL_CANDIDATES = [
  process.env.BWC_ROOT,
  path.resolve(aurenRoot, '..', 'BetterWeightChart'),
  'C:\\Users\\parbh\\OneDrive\\Desktop\\projects\\BetterWeightChart',
].filter(Boolean)

function hasBwcSdk(root) {
  return fs.existsSync(path.join(root, 'public', 'js', 'sdk.js'))
}

/** @returns {string} absolute path to BetterWeightChart package root */
export function resolveBwcRoot() {
  for (const candidate of LOCAL_CANDIDATES) {
    const root = path.resolve(candidate)
    if (hasBwcSdk(root)) return root
  }

  try {
    const sdkPath = require.resolve('betterweightchart')
    return path.resolve(path.dirname(sdkPath), '..', '..')
  } catch {
    throw new Error(
      'BetterWeightChart not found. Set BWC_ROOT or clone ../BetterWeightChart, then npm install.'
    )
  }
}
