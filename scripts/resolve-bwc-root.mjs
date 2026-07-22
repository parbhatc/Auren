/**
 * Resolve BetterweightChartPro root for Vite static serving.
 * Uses BWC_ROOT when explicitly set, otherwise the installed npm package.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const aurenRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const LOCAL_CANDIDATES = [
  process.env.BWC_ROOT,
  path.resolve(aurenRoot, '..', 'BetterweightChartPro'),
].filter(Boolean)

function hasBwcSdk(root) {
  return fs.existsSync(path.join(root, 'public', 'js', 'sdk.js'))
}

/** @returns {string} absolute path to BetterweightChartPro package root */
export function resolveBwcRoot() {
  for (const candidate of LOCAL_CANDIDATES) {
    const root = path.resolve(candidate)
    if (hasBwcSdk(root)) return root
  }

  try {
    const sdkPath = require.resolve('betterweightchartpro')
    return path.resolve(path.dirname(sdkPath), '..', '..')
  } catch {
    throw new Error(
      'BetterweightChartPro not found. Set BWC_ROOT or install betterweightchartpro.'
    )
  }
}
