#!/usr/bin/env bash
# Full reinstall from GitHub. Preserves server/data and server/.env (with backup).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
ensure_build_tools
require_node

log "Full reinstall -> $INSTALL_DIR (branch: $GIT_BRANCH)"
log "server/data and server/.env will be preserved"

if [[ -d "$INSTALL_DIR" ]]; then
  backup_data "pre-install"
  backup_env
fi

TMP_DATA=""
TMP_ENV=""
if [[ -d "$INSTALL_DIR/server/data" ]]; then
  TMP_DATA="$(mktemp -d)"
  cp -a "$INSTALL_DIR/server/data" "$TMP_DATA/data"
fi
if [[ -f "$INSTALL_DIR/server/.env" ]]; then
  TMP_ENV="$(mktemp)"
  cp "$INSTALL_DIR/server/.env" "$TMP_ENV"
fi

log "Removing old install at $INSTALL_DIR"
rm -rf "$INSTALL_DIR"

log "Cloning $REPO_URL"
git clone --depth 1 --branch "$GIT_BRANCH" "$REPO_URL" "$INSTALL_DIR"

if [[ -n "$TMP_DATA" && -d "$TMP_DATA/data" ]]; then
  rm -rf "$INSTALL_DIR/server/data"
  cp -a "$TMP_DATA/data" "$INSTALL_DIR/server/data"
  log "Restored server/data"
  rm -rf "$TMP_DATA"
fi

if [[ -n "$TMP_ENV" && -f "$TMP_ENV" ]]; then
  cp "$TMP_ENV" "$INSTALL_DIR/server/.env"
  log "Restored server/.env"
  rm -f "$TMP_ENV"
else
  restore_env
fi

npm_install_all
npm_build
setup_nginx
setup_ssl || true
setup_systemd
restart_services

log "Install complete"
print_status
