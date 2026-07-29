#!/usr/bin/env node
/**
 * Run deploy scripts on the remote server via SSH.
 * Usage: node scripts/deploy/run.mjs <command> [args...]
 *
 * Commands: install | update | build | status | restart | logs | backup | restore
 */
import { Client } from 'ssh2'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEPLOY_DIR = __dirname
const SERVER_SCRIPTS_DIR = path.join(DEPLOY_DIR, 'server')
const ENV_PATH = path.join(DEPLOY_DIR, '.env')

const COMMANDS = {
  install: 'install.sh',
  update: 'update.sh',
  build: 'build-only.sh',
  status: 'status.sh',
  restart: 'restart.sh',
  logs: 'logs.sh',
  backup: 'backup-data.sh',
  restore: 'restore-data.sh',
  nginx: 'nginx.sh',
  ssl: 'ssl.sh',
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${filePath}`)
    console.error(`Copy scripts/deploy/.env.example to scripts/deploy/.env and fill in credentials.`)
    process.exit(1)
  }
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

function execRemote(conn, command, timeoutMs = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) return reject(err)
      const timer = setTimeout(() => {
        stream.close()
        reject(new Error(`Remote command timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      stream.on('data', (data) => {
        const text = data.toString('utf8')
        stdout += text
        process.stdout.write(text)
      })
      stream.stderr.on('data', (data) => {
        const text = data.toString('utf8')
        stderr += text
        process.stderr.write(text)
      })
      stream.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve({ stdout, stderr })
        else reject(new Error(`Remote exit code ${code}`))
      })
    })
  })
}

function openSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)))
  })
}

function sftpUpload(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const body = fs.readFileSync(localPath).toString('utf8').replace(/\r\n/g, '\n')
    const write = sftp.createWriteStream(remotePath, { mode: 0o755 })
    write.on('close', resolve)
    write.on('error', reject)
    write.end(body, 'utf8')
  })
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!command || command === 'help' || command === '--help') {
    console.log(`Usage: npm run deploy -- <command>

Commands:
  install   Full reinstall from GitHub (keeps server/data + server/.env)
  update    Pull latest GitHub, rebuild, restart (keeps data)
  build     Rebuild app on server without git pull
  status    Service health and git commit
  restart   Restart nginx + API
  logs      API logs (optional: npm run deploy -- logs 100)
  backup    Backup server/data to BACKUP_DIR on server
  restore   Restore server/data from latest backup
  nginx     Re-apply nginx config (MIME types, proxies)
  ssl       Enable HTTPS (Let's Encrypt) for APP_DOMAIN
`)
    process.exit(0)
  }

  const script = COMMANDS[command]
  if (!script) {
    console.error(`Unknown command: ${command}`)
    process.exit(1)
  }

  const env = loadEnv(ENV_PATH)
  const host = env.DEPLOY_HOST
  const port = Number(env.DEPLOY_PORT || 22)
  const username = env.DEPLOY_USER || 'root'
  const password = env.DEPLOY_PASSWORD

  if (!host) {
    console.error('DEPLOY_HOST is required in scripts/deploy/.env')
    process.exit(1)
  }
  if (!password) {
    console.error('DEPLOY_PASSWORD is required in scripts/deploy/.env')
    process.exit(1)
  }

  const exportVars = [
    'INSTALL_DIR',
    'REPO_URL',
    'GIT_BRANCH',
    'PUBLIC_URL',
    'APP_DOMAIN',
    'API_PORT',
    'BACKUP_DIR',
  ]
    .filter((k) => env[k])
    .map((k) => `export ${k}=${shellQuote(env[k])}`)
    .join('; ')

  const conn = new Client()
  const remoteDir = `/tmp/auren-deploy-${Date.now()}`

  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host, port, username, password, readyTimeout: 30000 })
  })

  try {
    const sftp = await openSftp(conn)
    await execRemote(conn, `mkdir -p ${shellQuote(remoteDir)}`, 60000)

    const files = fs.readdirSync(SERVER_SCRIPTS_DIR).filter((f) => f.endsWith('.sh'))
    for (const file of files) {
      const local = path.join(SERVER_SCRIPTS_DIR, file)
      const remote = `${remoteDir}/${file}`
      await sftpUpload(sftp, local, remote)
    }

    const extraArgs = args.map(shellQuote).join(' ')
    const remoteCmd = [
      exportVars,
      `cd ${shellQuote(remoteDir)}`,
      `chmod +x *.sh`,
      `bash ${shellQuote(`${remoteDir}/${script}`)} ${extraArgs}`,
      `rm -rf ${shellQuote(remoteDir)}`,
    ]
      .filter(Boolean)
      .join(' && ')

    console.log(`\n>>> deploy:${command} on ${username}@${host}\n`)
    await execRemote(conn, remoteCmd)
    console.log(`\n>>> deploy:${command} finished\n`)
  } finally {
    conn.end()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
