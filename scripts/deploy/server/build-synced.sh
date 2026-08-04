#!/usr/bin/env bash
# Build files already uploaded by deploy:sync without npm/git refreshing them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
require_node
[[ -d "$INSTALL_DIR" ]] || die "Install not found at $INSTALL_DIR"

log "Building synced frontend source"
(cd "$INSTALL_DIR" && npx tsc && npx vite build)
restart_services
log "Synced build complete"
print_status
