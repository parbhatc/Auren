#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

[[ -d "$INSTALL_DIR" ]] || die "Install not found at $INSTALL_DIR"

dest="$(backup_data "manual")"
backup_env

if [[ -n "$dest" ]]; then
  log "Backup complete: $dest"
  ls -la "$BACKUP_DIR" | tail -10
else
  log "Nothing to back up"
fi
