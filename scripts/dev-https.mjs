/**
 * Dev server with HTTPS (self-signed) for iOS PWA / phone testing.
 * Usage: npm run dev:https
 */
import { spawn } from 'node:child_process'

process.env.VITE_DEV_HTTPS = '1'

const child = spawn('npx', ['vite', '--port', '3000'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

child.on('exit', (code) => process.exit(code ?? 0))
