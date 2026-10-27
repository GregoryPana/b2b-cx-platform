#!/usr/bin/env bash
set -euo pipefail

SITE_NAME="${SITE_NAME:-cwscx-mystery-public}"
SERVER_NAME="${SERVER_NAME:-}"
TLS_MODE="${TLS_MODE:-prepublic}"
ENABLE_HSTS="${ENABLE_HSTS:-0}"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
SSL_CERTIFICATE="${SSL_CERTIFICATE:-/etc/ssl/cwscx-mystery-public/cwscx-mystery-public.crt}"
SSL_CERTIFICATE_KEY="${SSL_CERTIFICATE_KEY:-/etc/ssl/cwscx-mystery-public/cwscx-mystery-public.key}"
SITE_FILE="/etc/nginx/sites-available/${SITE_NAME}"
LINK_FILE="/etc/nginx/sites-enabled/${SITE_NAME}"
LIMIT_FILE="/etc/nginx/conf.d/${SITE_NAME}-limits.conf"
HEADERS_FILE="/etc/nginx/snippets/${SITE_NAME}-security-headers.conf"

[[ "${EUID}" -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ "${SERVER_NAME}" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "SERVER_NAME must be an explicit DNS name" >&2; exit 1; }
[[ "${TLS_MODE}" == "prepublic" || "${TLS_MODE}" == "trusted" ]] || { echo "TLS_MODE must be prepublic or trusted" >&2; exit 1; }
if [[ "${ENABLE_HSTS}" == "1" && "${TLS_MODE}" != "trusted" ]]; then
  echo "HSTS is prohibited until TLS_MODE=trusted" >&2
  exit 1
fi
[[ -f "${SSL_CERTIFICATE}" && -f "${SSL_CERTIFICATE_KEY}" ]] || { echo "TLS certificate/key missing" >&2; exit 1; }
[[ -f "${TARGET_ROOT}/current/frontends/public/mystery-shopper/dist/index.html" ]] || { echo "Current frontend artifact missing" >&2; exit 1; }

cat >"${LIMIT_FILE}" <<'EOF'
limit_req_zone $binary_remote_addr zone=mystery_public_general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=mystery_public_auth:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=mystery_public_perip:10m;
EOF

cat >"${HEADERS_FILE}" <<EOF
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'" always;
EOF
if [[ "${ENABLE_HSTS}" == "1" ]]; then
  echo 'add_header Strict-Transport-Security "max-age=31536000" always;' >>"${HEADERS_FILE}"
fi

cat >"${SITE_FILE}" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${SERVER_NAME};
    server_tokens off;

    ssl_certificate ${SSL_CERTIFICATE};
    ssl_certificate_key ${SSL_CERTIFICATE_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MysteryPublicTLS:10m;
    ssl_session_tickets off;

    client_max_body_size 1m;
    client_body_timeout 15s;
    client_header_timeout 15s;
    client_header_buffer_size 1k;
    large_client_header_buffers 2 8k;
    keepalive_timeout 30s;
    send_timeout 30s;
    limit_conn mystery_public_perip 20;
    limit_req_status 429;
    limit_conn_status 429;

    include ${HEADERS_FILE};

    location ^~ /api/auth/ {
        limit_req zone=mystery_public_general burst=20 nodelay;
        limit_req zone=mystery_public_auth burst=3 nodelay;
        rewrite ^/api/(.*)$ /\$1 break;
        proxy_pass http://127.0.0.1:8011;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        include ${HEADERS_FILE};
    }

    location /api/ {
        limit_req zone=mystery_public_general burst=20 nodelay;
        proxy_pass http://127.0.0.1:8011/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        include ${HEADERS_FILE};
    }

    location ^~ /assets/ {
        alias ${TARGET_ROOT}/current/frontends/public/mystery-shopper/dist/assets/;
        try_files \$uri =404;
        expires 365d;
        add_header Cache-Control "public, immutable" always;
        include ${HEADERS_FILE};
    }

    location = /favicon.ico {
        alias ${TARGET_ROOT}/current/frontends/public/mystery-shopper/dist/favicon.ico;
        access_log off;
        include ${HEADERS_FILE};
    }

    location / {
        root ${TARGET_ROOT}/current/frontends/public/mystery-shopper/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        include ${HEADERS_FILE};
    }
}
EOF

ln -sfn "${SITE_FILE}" "${LINK_FILE}"
nginx -t
systemctl reload nginx
echo "NGINX configuration installed for ${SERVER_NAME} (${TLS_MODE}); HSTS=${ENABLE_HSTS}."
