#!/usr/bin/env bash
set -euo pipefail

SITE_NAME="${SITE_NAME:-cwscx-mystery-public}"
SITE_FILE="/etc/nginx/sites-available/${SITE_NAME}"
LINK_FILE="/etc/nginx/sites-enabled/${SITE_NAME}"
SERVER_NAME="${SERVER_NAME:-mystery.example.com}"
SSL_CERTIFICATE="${SSL_CERTIFICATE:-/etc/ssl/cwscx-mystery-public/cwscx-mystery-public.crt}"
SSL_CERTIFICATE_KEY="${SSL_CERTIFICATE_KEY:-/etc/ssl/cwscx-mystery-public/cwscx-mystery-public.key}"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo bash scripts/linux/deploy_mystery_public_nginx.sh)"
  exit 1
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

    ssl_certificate ${SSL_CERTIFICATE};
    ssl_certificate_key ${SSL_CERTIFICATE_KEY};

    location /api/ {
        proxy_pass http://127.0.0.1:8011/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location ^~ /assets/ {
        alias ${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/assets/;
        try_files \$uri =404;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    location = /favicon.ico {
        try_files ${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/favicon.ico =204;
    }

    location / {
        alias ${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/;
        index index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf "${SITE_FILE}" "${LINK_FILE}"
nginx -t
systemctl restart nginx
echo "Mystery public nginx deployment complete."
