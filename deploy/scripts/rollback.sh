#!/bin/bash
# ═══════════════════════════════════════════════
# BidBlitz V2 — Rollback Script
# Reverts to the previous release safely
# ═══════════════════════════════════════════════

set -euo pipefail

DEPLOY_ROOT="/var/www/bidblitz-new"
RELEASE_DIR="$DEPLOY_ROOT/releases"
BACKUP_DIR="$DEPLOY_ROOT/backups"
CURRENT_LINK="$DEPLOY_ROOT/current"

echo "══════════════════════════════════════════════"
echo "  BidBlitz V2 — Rollback"
echo "══════════════════════════════════════════════"

# Get current and previous releases
CURRENT_RELEASE=""
if [ -L "$CURRENT_LINK" ]; then
    CURRENT_RELEASE=$(basename "$(readlink -f "$CURRENT_LINK")")
fi

# List available releases
RELEASES=($(ls -dt "$RELEASE_DIR"/*/ 2>/dev/null | head -10))
RELEASE_COUNT=${#RELEASES[@]}

if [ "$RELEASE_COUNT" -lt 2 ]; then
    echo "  ERROR: Not enough releases for rollback"
    echo "  Available: $RELEASE_COUNT"
    
    # Check backups
    BACKUPS=($(ls -dt "$BACKUP_DIR"/*/ 2>/dev/null | head -5))
    if [ ${#BACKUPS[@]} -gt 0 ]; then
        echo "  Backups available:"
        for b in "${BACKUPS[@]}"; do
            echo "    - $(basename "$b")"
        done
        echo "  To restore a backup: cp -r $BACKUP_DIR/<backup_name> $RELEASE_DIR/ && rerun"
    fi
    exit 1
fi

PREVIOUS_RELEASE="${RELEASES[1]}"
PREVIOUS_NAME=$(basename "$PREVIOUS_RELEASE")

echo "  Current:  $CURRENT_RELEASE"
echo "  Rollback: $PREVIOUS_NAME"
echo ""

# Confirm
if [ "${1:-}" != "--force" ]; then
    read -p "  Proceed with rollback? [y/N] " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "  Rollback cancelled."
        exit 0
    fi
fi

# Perform rollback
echo "  Rolling back..."

rm -f "$CURRENT_LINK"
ln -s "$PREVIOUS_RELEASE" "$CURRENT_LINK"

rm -rf "$DEPLOY_ROOT/frontend/"*
cp -r "$PREVIOUS_RELEASE/frontend/"* "$DEPLOY_ROOT/frontend/"

rm -rf "$DEPLOY_ROOT/backend/"*
cp -r "$PREVIOUS_RELEASE/backend/"* "$DEPLOY_ROOT/backend/"

# Restart services
sudo systemctl restart bidblitz-backend 2>/dev/null || echo "  WARNING: Could not restart backend service"
sudo systemctl reload nginx 2>/dev/null || echo "  WARNING: Could not reload nginx"

# Health check
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo "  Health check PASSED"
else
    echo "  WARNING: Health check returned HTTP $HEALTH"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Rollback Complete!"
echo "  Active release: $PREVIOUS_NAME"
echo "══════════════════════════════════════════════"
