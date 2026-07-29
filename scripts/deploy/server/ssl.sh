#!/usr/bin/env bash
# Apply nginx domain config and obtain/renew Let's Encrypt HTTPS certificate.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
ensure_build_tools
setup_nginx
setup_ssl || true
sync_server_env
restart_services
print_status
