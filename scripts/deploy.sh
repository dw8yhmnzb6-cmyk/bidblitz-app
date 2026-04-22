#!/usr/bin/env bash
# BidBlitz Live Deployment Script
# Builds frontend with PRODUCTION .env (relative /api) and deploys to bidblitz.ae
set -euo pipefail

# --- CONFIG ---
LIVE_HOST="${LIVE_HOST:-212.227.20.190}"
LIVE_USER="${LIVE_USER:-root}"
LIVE_PATH="${LIVE_PATH:-/var/www/bidblitz/frontend/build}"
FRONTEND_DIR="$(cd "$(dirname "$0")"/../frontend && pwd)"
PKG_FILE="/tmp/bidblitz-frontend-$(date +%Y%m%d_%H%M%S).tar.gz"

echo "==> Frontend dir: $FRONTEND_DIR"
echo "==> Building with .env.production (REACT_APP_BACKEND_URL must be empty)..."

if ! grep -q "^REACT_APP_BACKEND_URL=$" "$FRONTEND_DIR/.env.production"; then
  echo "!! WARN: .env.production should have 'REACT_APP_BACKEND_URL=' (empty) for relative URLs."
  echo "   Current value:"
  grep "^REACT_APP_BACKEND_URL=" "$FRONTEND_DIR/.env.production" || true
fi

cd "$FRONTEND_DIR"
rm -rf build
REACT_APP_BACKEND_URL="" NODE_ENV=production yarn build

echo "==> Verifying build has no preview URL..."
if grep -r "preview.emergentagent.com" build/static/js/ >/dev/null 2>&1; then
  echo "!! ABORT: preview URL leaked into build!"
  exit 1
fi
echo "   Build is clean."

echo "==> Packaging..."
tar -czf "$PKG_FILE" -C build .
ls -la "$PKG_FILE"

if [ -z "${LIVE_PASS:-}" ]; then
  echo "!! Set LIVE_PASS env var to deploy. Example:"
  echo "   LIVE_PASS='xxx' $0"
  exit 1
fi

echo "==> Uploading to $LIVE_USER@$LIVE_HOST..."
sshpass -p "$LIVE_PASS" scp -o StrictHostKeyChecking=no "$PKG_FILE" "$LIVE_USER@$LIVE_HOST:/tmp/"

REMOTE_PKG="/tmp/$(basename "$PKG_FILE")"
echo "==> Deploying on server..."
sshpass -p "$LIVE_PASS" ssh -o StrictHostKeyChecking=no "$LIVE_USER@$LIVE_HOST" bash -se <<EOF
set -e
TS=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/bidblitz/frontend/build_backup_\$TS"
if [ -d "$LIVE_PATH" ]; then
  cp -r "$LIVE_PATH" "\$BACKUP_DIR"
  echo "  Backup: \$BACKUP_DIR"
fi
rm -rf "$LIVE_PATH"/*
mkdir -p "$LIVE_PATH"
tar -xzf "$REMOTE_PKG" -C "$LIVE_PATH"
rm -f "$REMOTE_PKG"
systemctl reload nginx
echo "  Nginx reloaded."
# Keep only last 5 backups
ls -1dt /var/www/bidblitz/frontend/build_backup_* 2>/dev/null | tail -n +6 | xargs -r rm -rf
EOF

rm -f "$PKG_FILE"
echo "==> DONE. Live at https://bidblitz.ae"
