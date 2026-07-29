#!/usr/bin/env bash
# Rebuild frontend + restart (no git pull). Preserves data.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
require_node
[[ -d "$INSTALL_DIR" ]] || die "Install not found at $INSTALL_DIR"

npm_install_all
npm_build
restart_services
log "Build complete"
print_status
