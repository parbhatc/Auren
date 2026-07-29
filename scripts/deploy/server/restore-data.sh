#!/usr/bin/env bash
# Restore server/data from latest backup in BACKUP_DIR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
[[ -d "$INSTALL_DIR" ]] || die "Install not found at $INSTALL_DIR"

latest="$(ls -dt "$BACKUP_DIR"/data-* 2>/dev/null | head -1 || true)"
[[ -n "$latest" ]] || die "No data backups in $BACKUP_DIR"

log "Restoring from $latest"
rm -rf "$INSTALL_DIR/server/data"
cp -a "$latest" "$INSTALL_DIR/server/data"
restore_env
restart_services
log "Restore complete"
print_status
