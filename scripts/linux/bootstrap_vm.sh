#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo bash scripts/linux/bootstrap_vm.sh)"
  exit 1
fi

apt update
apt install -y nginx postgresql postgresql-contrib python3 python3-venv python3-pip nodejs npm git rsync

mkdir -p /opt/cwscx/backend/app
mkdir -p /opt/cwscx/backend/logs
mkdir -p /opt/cwscx/backend/venv
mkdir -p /opt/cwscx/frontends-src/public/mystery-shopper
mkdir -p /opt/cwscx/frontends-src/dashboard
mkdir -p /opt/cwscx/frontends-src/internal-surveys/b2b
mkdir -p /opt/cwscx/frontends-src/internal-surveys/installation
mkdir -p /opt/cwscx/shared

chown -R cxadmin:www-data /opt/cwscx

echo "VM bootstrap complete."
