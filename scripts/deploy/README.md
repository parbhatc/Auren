# Server deployment (local runner)

Scripts to install, update, or manage Auren on a remote Linux server over SSH.

The deployment scripts are tracked. Copy `.env.example` to `.env` and add your
server password; `.env` and `node_modules/` remain ignored and must never be committed.

## One-time setup

```bash
cp scripts/deploy/.env.example scripts/deploy/.env
# Edit scripts/deploy/.env — set DEPLOY_PASSWORD and other values
cd scripts/deploy && npm install ssh2
```

## Commands (from your machine)

Run from the repo root (install `ssh2` once in `scripts/deploy/`: `npm install ssh2`):

| Command | What it does |
|---------|----------------|
| `node scripts/deploy/run.mjs install` | Full reinstall from GitHub — **keeps `server/data` + `server/.env`** |
| `node scripts/deploy/run.mjs update` | Pull latest main, rebuild, restart — **data untouched** |
| `node scripts/deploy/run.mjs build` | Rebuild on server without git pull |
| `node scripts/deploy/run.mjs status` | nginx/API status, health check, git commit |
| `node scripts/deploy/run.mjs restart` | Restart nginx + API |
| `node scripts/deploy/run.mjs gateway` | Install/update the local TradingviewServer gateway and restart Auren |
| `node scripts/deploy/run.mjs logs` | API logs (`node scripts/deploy/run.mjs logs 200`) |
| `node scripts/deploy/run.mjs backup` | Copy `server/data` to `BACKUP_DIR` on the server |
| `node scripts/deploy/run.mjs restore` | Restore `server/data` from latest backup |
| `node scripts/deploy/run.mjs nginx` | Re-apply nginx config (MIME types for chart `.mjs` files) |

Generic form: `node scripts/deploy/run.mjs <command>`

## What is preserved

On **install** and **update**, these are never wiped:

- `server/data/` — SQLite DB, users, config, news cache, etc.
- `server/.env` — JWT secret, port, CORS

Backups are also written to `BACKUP_DIR` (default `/root/auren-backups`) before install/update.

## Run directly on the server

If you are already SSH'd into the server:

```bash
cd /root/Auren
export INSTALL_DIR=/root/Auren PUBLIC_URL=http://your-ip
bash scripts/deploy/server/update.sh
```

## Files

```
scripts/deploy/
  .env.example      # template (committed)
  .env              # your secrets (gitignored)
  run.mjs           # local SSH runner
  server/           # bash scripts executed on the server
    common.sh
    install.sh
    update.sh
    ...
```
