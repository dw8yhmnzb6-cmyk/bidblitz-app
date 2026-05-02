#!/bin/bash
# ============================================================================
# BidBlitz Off-Site Backup Script
# ============================================================================
# Backs up MongoDB + uploaded files + .env to a remote target via rsync over SSH.
#
# Designed for Hetzner Storage Box but works with any rsync-capable target
# (S3 with rclone, Backblaze B2 with rclone, plain SSH server, etc).
#
# CONFIG: Read from /etc/bidblitz/backup.env  (see backup.env.example below)
#   BACKUP_REMOTE_HOST     e.g. uXXXXXX.your-storagebox.de
#   BACKUP_REMOTE_USER     e.g. uXXXXXX
#   BACKUP_REMOTE_PORT     e.g. 23 (Hetzner Storage Box uses 23, not 22)
#   BACKUP_REMOTE_PATH     e.g. /home/bidblitz-prod
#   BACKUP_SSH_KEY         e.g. /root/.ssh/bidblitz_backup_ed25519
#   BACKUP_RETAIN_DAYS     default 30
#   BACKUP_LOCAL_DIR       default /var/backups/bidblitz
#   MONGO_URL              required for mongodump
#   DB_NAME                required for mongodump
#
# USAGE:
#   sudo bash deploy/backup_offsite.sh
#
# CRON (daily 03:15):
#   15 3 * * *  /var/www/bidblitz/deploy/backup_offsite.sh >> /var/log/bidblitz-backup.log 2>&1
# ============================================================================
set -euo pipefail

CONFIG_FILE="${BIDBLITZ_BACKUP_CONFIG:-/etc/bidblitz/backup.env}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$CONFIG_FILE"; set +a
fi

# ── Defaults ─────────────────────────────────────────────────────────────────
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/bidblitz}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"
BACKUP_REMOTE_PORT="${BACKUP_REMOTE_PORT:-22}"
APP_DIR="${APP_DIR:-/var/www/bidblitz}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

# ── Sanity checks ───────────────────────────────────────────────────────────
fail() { echo "[BACKUP-ERROR] $*" >&2; exit 1; }
require() { [ -n "${!1:-}" ] || fail "Missing config: $1"; }

require MONGO_URL
require DB_NAME
require BACKUP_REMOTE_HOST
require BACKUP_REMOTE_USER
require BACKUP_REMOTE_PATH

mkdir -p "$BACKUP_LOCAL_DIR"
WORKDIR="$(mktemp -d "${BACKUP_LOCAL_DIR}/run.${TS}.XXXXXX")"
trap 'rm -rf "$WORKDIR"' EXIT

echo "[BACKUP] $(date -Iseconds) starting run $TS"

# ── 1) MongoDB dump ──────────────────────────────────────────────────────────
echo "[BACKUP] dumping MongoDB ($DB_NAME) ..."
mongodump --uri="$MONGO_URL" --db="$DB_NAME" \
  --gzip --archive="${WORKDIR}/mongo-${DB_NAME}-${TS}.archive.gz" \
  --quiet

# ── 2) App-level data (uploads, voucher PDFs, receipts, etc.) ───────────────
APP_DATA_TARGZ="${WORKDIR}/app-data-${TS}.tar.gz"
echo "[BACKUP] archiving app data ..."
tar czf "$APP_DATA_TARGZ" \
  --warning=no-file-changed \
  -C "$APP_DIR" \
  --exclude=node_modules \
  --exclude=venv \
  --exclude=__pycache__ \
  --exclude=.git \
  --exclude=frontend/build \
  --exclude=frontend/.cache \
  --exclude='*.log' \
  backend/.env \
  backend/data 2>/dev/null || true

# Add uploads dir if it exists
if [ -d "$APP_DIR/backend/uploads" ]; then
  tar rzf "$APP_DATA_TARGZ" -C "$APP_DIR" backend/uploads || true
fi

# ── 3) Compute checksums and write manifest ─────────────────────────────────
(
  cd "$WORKDIR"
  sha256sum -- *.gz *.tar.gz 2>/dev/null > "manifest-${TS}.sha256"
  cat > "manifest-${TS}.json" <<EOF
{
  "timestamp": "${TS}",
  "host": "$(hostname -f 2>/dev/null || hostname)",
  "db_name": "${DB_NAME}",
  "files": $(ls -1 *.gz *.tar.gz 2>/dev/null | python3 -c "import sys,json;print(json.dumps([l.strip() for l in sys.stdin]))"),
  "retain_days": ${BACKUP_RETAIN_DAYS}
}
EOF
)

# ── 4) Build SSH options ────────────────────────────────────────────────────
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -p ${BACKUP_REMOTE_PORT}"
if [ -n "${BACKUP_SSH_KEY:-}" ] && [ -f "${BACKUP_SSH_KEY}" ]; then
  SSH_OPTS="$SSH_OPTS -i ${BACKUP_SSH_KEY}"
fi
RSYNC_RSH="ssh ${SSH_OPTS}"

REMOTE_RUN_DIR="${BACKUP_REMOTE_PATH}/${TS}"
REMOTE_TARGET="${BACKUP_REMOTE_USER}@${BACKUP_REMOTE_HOST}:${REMOTE_RUN_DIR}/"

# Hetzner Storage Box doesn't support `mkdir -p`-on-rsync but rsync creates
# missing destination dirs automatically.
echo "[BACKUP] rsyncing to ${REMOTE_TARGET} ..."
rsync -az --partial -e "$RSYNC_RSH" \
  "${WORKDIR}/" "${REMOTE_TARGET}"

# ── 5) Update "latest" pointer (best-effort) ────────────────────────────────
echo "[BACKUP] updating remote 'latest' marker ..."
ssh ${SSH_OPTS} "${BACKUP_REMOTE_USER}@${BACKUP_REMOTE_HOST}" \
  "echo ${TS} > ${BACKUP_REMOTE_PATH}/latest" 2>/dev/null || true

# ── 6) Local retention ──────────────────────────────────────────────────────
echo "[BACKUP] pruning local runs older than ${BACKUP_RETAIN_DAYS} days ..."
find "$BACKUP_LOCAL_DIR" -maxdepth 1 -type d -name 'run.*' \
  -mtime "+${BACKUP_RETAIN_DAYS}" -exec rm -rf {} \; 2>/dev/null || true

# ── 7) Remote retention (best-effort, skip on storagebox if not allowed) ────
echo "[BACKUP] pruning remote runs older than ${BACKUP_RETAIN_DAYS} days ..."
ssh ${SSH_OPTS} "${BACKUP_REMOTE_USER}@${BACKUP_REMOTE_HOST}" \
  "find ${BACKUP_REMOTE_PATH}/ -maxdepth 1 -type d -mtime +${BACKUP_RETAIN_DAYS} -exec rm -rf {} +" \
  2>/dev/null || echo "[BACKUP] (remote prune skipped — restricted shell)"

echo "[BACKUP] $(date -Iseconds) DONE — ${TS} pushed to ${BACKUP_REMOTE_HOST}"
