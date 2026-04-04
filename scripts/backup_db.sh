#!/bin/bash
# BidBlitz V2 — Daily MongoDB Backup Script
# Runs via cron: 0 2 * * * /app/scripts/backup_db.sh

set -euo pipefail

BACKUP_DIR="/app/backups"
DB_NAME="test_database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/bidblitz_${TIMESTAMP}"
LOG_FILE="/app/backend/logs/backup.log"
RETAIN_DAYS=7

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

log "=== Backup started ==="

# Run mongodump
if mongodump --db "$DB_NAME" --out "$BACKUP_PATH" --quiet 2>>"$LOG_FILE"; then
    # Compress
    tar -czf "${BACKUP_PATH}.tar.gz" -C "$BACKUP_DIR" "bidblitz_${TIMESTAMP}" 2>>"$LOG_FILE"
    rm -rf "$BACKUP_PATH"

    SIZE=$(du -h "${BACKUP_PATH}.tar.gz" | cut -f1)
    log "Backup OK: bidblitz_${TIMESTAMP}.tar.gz ($SIZE)"
else
    log "ERROR: mongodump failed"
    exit 1
fi

# Prune old backups
DELETED=$(find "$BACKUP_DIR" -name "bidblitz_*.tar.gz" -mtime +$RETAIN_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    log "Pruned $DELETED backup(s) older than ${RETAIN_DAYS} days"
fi

# Verify backup integrity
if tar -tzf "${BACKUP_PATH}.tar.gz" > /dev/null 2>&1; then
    log "Integrity check: PASS"
else
    log "ERROR: Backup archive corrupted"
    exit 1
fi

TOTAL=$(ls -1 "$BACKUP_DIR"/bidblitz_*.tar.gz 2>/dev/null | wc -l)
log "=== Backup complete ($TOTAL backups stored) ==="
