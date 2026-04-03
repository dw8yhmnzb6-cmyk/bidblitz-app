#!/bin/bash
# ═══════════════════════════════════════════════
# BidBlitz V2 — Production Deployment Script
# Deploys to /var/www/bidblitz-new with rollback safety
# ═══════════════════════════════════════════════

set -euo pipefail

# ── Config ──
APP_NAME="bidblitz-v2"
DEPLOY_ROOT="/var/www/bidblitz-new"
RELEASE_DIR="$DEPLOY_ROOT/releases"
BACKUP_DIR="$DEPLOY_ROOT/backups"
LOG_DIR="$DEPLOY_ROOT/logs"
CURRENT_LINK="$DEPLOY_ROOT/current"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_PATH="$RELEASE_DIR/$TIMESTAMP"

# Source directory (where the code lives)
SOURCE_DIR="${SOURCE_DIR:-/app}"

echo "══════════════════════════════════════════════"
echo "  BidBlitz V2 — Deployment"
echo "  Release: $TIMESTAMP"
echo "══════════════════════════════════════════════"

# ── 1. Create directory structure ──
echo "[1/8] Creating directory structure..."
mkdir -p "$DEPLOY_ROOT"/{frontend,backend,releases,backups,logs}
mkdir -p "$RELEASE_PATH"/{frontend,backend}

# ── 2. Backup current release ──
if [ -L "$CURRENT_LINK" ] && [ -e "$CURRENT_LINK" ]; then
    echo "[2/8] Backing up current release..."
    CURRENT_TARGET=$(readlink -f "$CURRENT_LINK")
    BACKUP_NAME="backup_${TIMESTAMP}"
    cp -r "$CURRENT_TARGET" "$BACKUP_DIR/$BACKUP_NAME"
    echo "  Backup saved: $BACKUP_DIR/$BACKUP_NAME"
else
    echo "[2/8] No current release to backup (first deploy)"
fi

# ── 3. Build frontend ──
echo "[3/8] Building frontend..."
cd "$SOURCE_DIR/frontend"

if [ ! -f .env.production ]; then
    echo "  ERROR: /frontend/.env.production not found!"
    echo "  Create it from deploy/env-templates/frontend.env.production"
    exit 1
fi

cp .env.production .env
yarn install --frozen-lockfile --production=false 2>/dev/null || yarn install
yarn build

cp -r build/* "$RELEASE_PATH/frontend/"
echo "  Frontend build copied to $RELEASE_PATH/frontend/"

# ── 4. Prepare backend ──
echo "[4/8] Preparing backend..."
cd "$SOURCE_DIR/backend"

if [ ! -f .env.production ]; then
    echo "  ERROR: /backend/.env.production not found!"
    echo "  Create it from deploy/env-templates/backend.env.production"
    exit 1
fi

# Copy backend code
cp -r *.py routes/ core/ schemas/ "$RELEASE_PATH/backend/" 2>/dev/null || true
cp requirements.txt "$RELEASE_PATH/backend/"
cp .env.production "$RELEASE_PATH/backend/.env"

# Install dependencies in venv
echo "[5/8] Installing backend dependencies..."
cd "$RELEASE_PATH/backend"
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
pip install -q emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
deactivate

# ── 6. Symlink new release ──
echo "[6/8] Activating new release..."
if [ -L "$CURRENT_LINK" ]; then
    rm "$CURRENT_LINK"
fi
ln -s "$RELEASE_PATH" "$CURRENT_LINK"

# Copy to serving directories
rm -rf "$DEPLOY_ROOT/frontend/"*
cp -r "$RELEASE_PATH/frontend/"* "$DEPLOY_ROOT/frontend/"

rm -rf "$DEPLOY_ROOT/backend/"*
cp -r "$RELEASE_PATH/backend/"* "$DEPLOY_ROOT/backend/"

echo "  Active release: $RELEASE_PATH"

# ── 7. Restart services ──
echo "[7/8] Restarting services..."
sudo systemctl restart bidblitz-backend || echo "  WARNING: systemd service not found (install with: sudo cp deploy/systemd/bidblitz-backend.service /etc/systemd/system/ && sudo systemctl enable bidblitz-backend)"
sudo systemctl reload nginx || echo "  WARNING: nginx reload failed"

# ── 8. Health check ──
echo "[8/8] Running health check..."
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo "  Health check PASSED (HTTP 200)"
else
    echo "  WARNING: Health check returned HTTP $HEALTH"
    echo "  Check logs: journalctl -u bidblitz-backend -f"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Deployment Complete!"
echo "  Release: $TIMESTAMP"
echo "  Path: $RELEASE_PATH"
echo "  Rollback: ./deploy/scripts/rollback.sh"
echo "══════════════════════════════════════════════"

# ── Cleanup: keep last 5 releases ──
cd "$RELEASE_DIR"
ls -dt */ | tail -n +6 | xargs rm -rf 2>/dev/null || true
echo "  Cleaned old releases (keeping last 5)"
