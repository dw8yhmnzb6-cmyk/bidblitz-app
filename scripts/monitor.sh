#!/bin/bash
# BidBlitz V2 — Uptime Monitor
# Runs via cron: */5 * * * * /app/scripts/monitor.sh

set -uo pipefail

API_URL="http://localhost:8001/api"
LOG_FILE="/app/backend/logs/uptime.log"
ALERT_FILE="/app/backend/logs/alerts.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
alert() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1" >> "$ALERT_FILE"; log "ALERT: $1"; }

# 1. API health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log "API: UP (200)"
else
    alert "API DOWN (HTTP $HTTP_CODE)"
fi

# 2. MongoDB
if mongosh --eval "db.runCommand({ping:1})" --quiet test_database > /dev/null 2>&1; then
    log "MongoDB: UP"
else
    alert "MongoDB DOWN"
fi

# 3. Disk usage
DISK_PCT=$(df /app | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 90 ]; then
    alert "Disk usage critical: ${DISK_PCT}%"
elif [ "$DISK_PCT" -gt 80 ]; then
    log "Disk usage warning: ${DISK_PCT}%"
else
    log "Disk: ${DISK_PCT}%"
fi

# 4. Memory
MEM_PCT=$(free | awk '/Mem/{printf "%.0f", $3/$2*100}')
log "Memory: ${MEM_PCT}%"
if [ "$MEM_PCT" -gt 90 ]; then
    alert "Memory usage critical: ${MEM_PCT}%"
fi

# 5. Backup freshness
LATEST_BACKUP=$(ls -1t /app/backups/bidblitz_*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
    if [ "$BACKUP_AGE" -gt 25 ]; then
        alert "No backup in ${BACKUP_AGE}h (expected daily)"
    else
        log "Backup: ${BACKUP_AGE}h ago"
    fi
else
    log "Backup: none yet"
fi
