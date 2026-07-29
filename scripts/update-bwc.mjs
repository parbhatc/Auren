import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aurenRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localRoots = [
  process.env.BWC_ROOT,
  path.resolve(aurenRoot, '..', 'BetterweightChartPro'),
].filter(Boolean)

const localRoot = localRoots.find((root) =>
  fs.existsSync(path.join(path.resolve(root), 'public', 'js', 'sdk.js'))
)

if (localRoot) {
  const root = path.resolve(localRoot)
  if (!fs.existsSync(path.join(root, '.git'))) {
    throw new Error(`BetterweightChartPro at ${root} is not a Git checkout and cannot be updated automatically.`)
  }

  console.log(`Updating BetterweightChartPro checkout at ${root}`)
  execFileSync('git', ['-C', root, 'pull', '--ff-only', 'origin', 'main'], {
    stdio: 'inherit',
  })
} else {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  console.log('Updating the installed BetterweightChartPro package from main')
  execFileSync(
    npm,
    [
      'install',
      '--save',
      '--no-audit',
      '--no-fund',
      'betterweightchartpro@github:parbhatc/BetterweightChartPro#main',
    ],
    { cwd: aurenRoot, stdio: 'inherit' }
  )
}
