#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

lines="${1:-80}"
follow="${FOLLOW_LOGS:-0}"
if [[ "$follow" == "1" ]]; then
  journalctl -u auren-api -n "$lines" --no-pager -f
else
  journalctl -u auren-api -n "$lines" --no-pager
fi
