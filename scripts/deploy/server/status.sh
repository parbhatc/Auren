#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

log "Auren deploy status"
echo "install:   $INSTALL_DIR"
echo "branch:    $GIT_BRANCH"
echo "public:    $PUBLIC_URL"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  cd "$INSTALL_DIR"
  echo "commit:    $(git rev-parse --short HEAD 2>/dev/null) $(git log -1 --format='%s' 2>/dev/null)"
fi
print_status

echo ""
echo "nginx config test:"
nginx -t 2>&1 || true
echo ""
echo "nginx service:"
systemctl status nginx --no-pager -l 2>&1 | tail -40 || true
echo ""
echo "nginx journal:"
journalctl -u nginx --no-pager -n 80 2>&1 || true
