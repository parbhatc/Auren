#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_root
require_node

API_DIR="/root/TradingviewAPI"
GATEWAY_DIR="/root/TradingviewServer"
SESSION_ID="$(sed -n 's/^TRADINGVIEW_SESSION_ID=//p' "$INSTALL_DIR/server/.env" | head -1)"
[[ -n "$SESSION_ID" ]] || die "TRADINGVIEW_SESSION_ID is missing from $INSTALL_DIR/server/.env"

sync_repo() {
  local url="$1" dir="$2"
  if [[ -d "$dir/.git" ]]; then
    git -C "$dir" fetch origin main
    git -C "$dir" reset --hard origin/main
  else
    git clone --branch main "$url" "$dir"
  fi
}

log "Installing TradingviewAPI and TradingviewServer"
sync_repo "https://github.com/parbhatc/TradingviewAPI.git" "$API_DIR"
sync_repo "https://github.com/parbhatc/TradingviewServer.git" "$GATEWAY_DIR"
npm install --prefix "$API_DIR"
npm install --prefix "$GATEWAY_DIR"

cat > "$GATEWAY_DIR/.env" <<ENV
HOST=127.0.0.1
PORT=8532
TRADINGVIEW_SESSION_ID=${SESSION_ID}
TRADINGVIEW_REQUEST_TIMEOUT_MS=20000
TRADINGVIEW_MAX_BARS=5000
LIVE_BAR_POLL_MS=5000
TRADINGVIEW_API_ENTRY=${API_DIR}/src/index.js
WS_ENTRY=${API_DIR}/node_modules/ws/wrapper.mjs
ENV
chmod 600 "$GATEWAY_DIR/.env"

cat > /etc/systemd/system/tradingview-gateway.service <<SERVICE
[Unit]
Description=TradingView Market Data Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${GATEWAY_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --use-system-ca src/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

if grep -q '^TRADINGVIEW_GATEWAY_WS_URL=' "$INSTALL_DIR/server/.env"; then
  sed -i 's|^TRADINGVIEW_GATEWAY_WS_URL=.*|TRADINGVIEW_GATEWAY_WS_URL=ws://127.0.0.1:8532/api/tradingview/stream|' "$INSTALL_DIR/server/.env"
else
  printf '\nTRADINGVIEW_GATEWAY_WS_URL=ws://127.0.0.1:8532/api/tradingview/stream\n' >> "$INSTALL_DIR/server/.env"
fi

systemctl daemon-reload
systemctl enable tradingview-gateway
systemctl restart tradingview-gateway
sleep 2
curl -sf http://127.0.0.1:8532/api/tradingview/health
echo ""
systemctl restart auren-api
sleep 2

log "TradingView gateway is active"
systemctl is-active tradingview-gateway
ss -tlnp 2>/dev/null | grep ':8532 ' || true
curl -sf "${PUBLIC_URL%/}/api/health"
echo ""
