#!/usr/bin/env bash
# Shared helpers for on-server deploy scripts.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/root/Auren}"
REPO_URL="${REPO_URL:-https://github.com/parbhatc/Auren.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
PUBLIC_URL="${PUBLIC_URL:-http://localhost}"
APP_DOMAIN="${APP_DOMAIN:-}"
API_PORT="${API_PORT:-3001}"
BACKUP_DIR="${BACKUP_DIR:-/root/auren-backups}"

resolve_app_domain() {
  if [[ -n "$APP_DOMAIN" ]]; then
    printf '%s' "$APP_DOMAIN"
    return 0
  fi
  if [[ "$PUBLIC_URL" =~ ^https?://([^/:]+) ]]; then
    local host="${BASH_REMATCH[1]}"
    host="${host#www.}"
    printf '%s' "$host"
    return 0
  fi
  printf ''
}

cors_origin_value() {
  local domain
  domain="$(resolve_app_domain)"
  if [[ -n "$domain" && "$PUBLIC_URL" =~ ^https:// ]]; then
    printf 'https://%s,https://www.%s' "$domain" "$domain"
    return 0
  fi
  printf '%s' "$PUBLIC_URL"
}

sync_server_env() {
  [[ -d "$INSTALL_DIR/server" ]] || return 0
  local cors
  cors="$(cors_origin_value)"
  if [[ ! -f "$INSTALL_DIR/server/.env" ]]; then
    write_default_env
    return 0
  fi
  if grep -q '^CORS_ORIGIN=' "$INSTALL_DIR/server/.env"; then
    sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${cors}|" "$INSTALL_DIR/server/.env"
  else
    printf '\nCORS_ORIGIN=%s\n' "$cors" >> "$INSTALL_DIR/server/.env"
  fi
  log "Updated server/.env CORS_ORIGIN -> $cors"
}

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Run as root (or via npm run deploy:* which SSHs as root)."
  fi
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    die "Node.js not found. Install Node 18+ on the server."
  fi
}

ensure_build_tools() {
  if ! command -v git >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq git curl nginx build-essential openssl
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq nginx
  fi
}

backup_data() {
  local tag="${1:-manual}"
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"

  if [[ -d "$INSTALL_DIR/server/data" ]]; then
    local dest="$BACKUP_DIR/data-${tag}-${stamp}"
    log "Backing up server/data -> $dest"
    cp -a "$INSTALL_DIR/server/data" "$dest"
    echo "$dest"
    return 0
  fi

  log "No server/data to back up at $INSTALL_DIR"
  return 0
}

backup_env() {
  if [[ -f "$INSTALL_DIR/server/.env" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp "$INSTALL_DIR/server/.env" "$BACKUP_DIR/server.env.latest"
    log "Backed up server/.env -> $BACKUP_DIR/server.env.latest"
  fi
}

restore_data_from_latest() {
  local latest
  latest="$(ls -dt "$BACKUP_DIR"/data-* 2>/dev/null | head -1 || true)"
  if [[ -n "$latest" && -d "$latest" ]]; then
    log "Restoring server/data from $latest"
    rm -rf "$INSTALL_DIR/server/data"
    cp -a "$latest" "$INSTALL_DIR/server/data"
  fi
}

restore_env() {
  if [[ -f "$BACKUP_DIR/server.env.latest" ]]; then
    cp "$BACKUP_DIR/server.env.latest" "$INSTALL_DIR/server/.env"
    log "Restored server/.env from backup"
  elif [[ ! -f "$INSTALL_DIR/server/.env" ]]; then
  write_default_env
  fi
}

write_default_env() {
  local secret
  secret="$(openssl rand -hex 32)"
  cat > "$INSTALL_DIR/server/.env" <<EOF
PORT=${API_PORT}
CORS_ORIGIN=$(cors_origin_value)
JWT_SECRET=${secret}
EOF
  log "Created new server/.env"
}

npm_install_all() {
  log "npm install (frontend)"
  cd "$INSTALL_DIR"
  npm install

  log "npm install (server)"
  cd "$INSTALL_DIR/server"
  npm install
}

npm_build() {
  log "npm run build"
  cd "$INSTALL_DIR"
  npm run build
}

free_api_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${API_PORT}/tcp" 2>/dev/null || true
  fi
  if command -v pm2 >/dev/null 2>&1; then
    pm2 kill 2>/dev/null || true
  fi
}

setup_nginx() {
  local domain server_names
  domain="$(resolve_app_domain)"
  if [[ -n "$domain" ]]; then
    server_names="${domain} www.${domain} 74.208.46.161"
    log "Configuring nginx for ${server_names}"
  else
    server_names="_"
    log "Configuring nginx on port 80 (no APP_DOMAIN)"
  fi

  cat > /etc/nginx/sites-available/auren <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${server_names};

    root ${INSTALL_DIR}/dist;
    index index.html;
    client_max_body_size 50m;

    # Default mime.types omits .mjs — required for chart ES modules
    include /etc/nginx/mime.types;
    # Resolve optional external upstreams at request time. A transient DNS
    # failure must not prevent nginx (and the entire Auren site) from starting.
    resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;
    resolver_timeout 5s;
    types {
        application/javascript mjs;
    }

    location ~* \.mjs$ {
        types { }
        default_type application/javascript;
        try_files \$uri =404;
        add_header Cache-Control "public, max-age=60, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    location /news {
        proxy_pass http://127.0.0.1:${API_PORT}/api/news;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /tradesea-mds-ws {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    location /tradesea-trades-ws {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    location /practice-account-ws {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    location /tradesea-instruments/ {
        set \$tradesea_instruments_upstream api-instruments-delayed.tradesea.ai;
        rewrite ^/tradesea-instruments/(.*)\$ /\$1 break;
        proxy_pass https://\$tradesea_instruments_upstream;
        proxy_ssl_server_name on;
        proxy_ssl_name \$tradesea_instruments_upstream;
        proxy_set_header Host \$tradesea_instruments_upstream;
    }

    # Chart SDK static assets (BetterweightChart)
    location ~* ^/(chart|js|vendor|css|testing)/ {
        try_files \$uri =404;
        add_header Cache-Control "public, max-age=60, must-revalidate";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/auren /etc/nginx/sites-enabled/auren
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

setup_ssl() {
  local domain
  domain="$(resolve_app_domain)"
  [[ -n "$domain" ]] || return 0
  [[ "$PUBLIC_URL" =~ ^https:// ]] || return 0

  if ! command -v certbot >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx
  fi

  if [[ -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
    log "Re-installing existing certificate for ${domain}"
    certbot install --cert-name "${domain}" --nginx --redirect --non-interactive || true
  else
    log "Requesting Let's Encrypt certificate for ${domain} and www.${domain}"
    if ! certbot --nginx \
      -d "${domain}" \
      -d "www.${domain}" \
      --non-interactive \
      --agree-tos \
      --register-unsafely-without-email \
      --redirect; then
      log "certbot failed — DNS may still be propagating; retry: npm run deploy -- ssl"
      return 1
    fi
  fi

  # Certbot's HTTP block returns 404 for bare-IP hits — redirect to canonical HTTPS URL.
  if [[ -f /etc/nginx/sites-available/auren ]]; then
    sed -i "s|return 404; # managed by Certbot|return 301 https://${domain}\$request_uri; # managed by Certbot|" \
      /etc/nginx/sites-available/auren
    nginx -t
    systemctl reload nginx
  fi

  log "HTTPS enabled (HTTP redirects to HTTPS)"
}

setup_systemd() {
  log "Configuring auren-api systemd service"
  cat > /etc/systemd/system/auren-api.service <<SERVICE
[Unit]
Description=Auren API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable auren-api
}

restart_services() {
  free_api_port
  sleep 1
  sync_server_env
  systemctl restart auren-api
  systemctl restart nginx
  sleep 2
}

print_status() {
  local domain health_url front_url
  domain="$(resolve_app_domain)"
  if [[ -n "$domain" && -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
    health_url="https://${domain}/api/health"
    front_url="https://${domain}/"
  else
    health_url="http://127.0.0.1/api/health"
    front_url="http://127.0.0.1/"
  fi
  echo ""
  echo "nginx:     $(systemctl is-active nginx 2>/dev/null || echo unknown)"
  echo "auren-api: $(systemctl is-active auren-api 2>/dev/null || echo unknown)"
  ss -tlnp 2>/dev/null | grep -E ":80 |:443 |:${API_PORT} " || true
  curl -sf "$health_url" && echo "" || echo "health: FAILED"
  curl -sf -o /dev/null -w "frontend: %{http_code}\n" "$front_url" || echo "frontend: FAILED"
  echo "data dir:  $INSTALL_DIR/server/data"
  [[ -n "$domain" ]] && echo "site:      ${PUBLIC_URL}"
}
