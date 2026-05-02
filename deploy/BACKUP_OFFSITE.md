# BidBlitz — Off-Site Backups (Hetzner Storage Box)

Tägliche, automatische Sicherung von **MongoDB + App-Daten + .env** auf eine externe Hetzner Storage Box (oder beliebigen rsync/SSH-Endpunkt).

## Was wird gesichert?

| Inhalt | Quelle | Format |
|---|---|---|
| MongoDB | komplettes `$DB_NAME` via `mongodump` | gzip-komprimierter BSON-Archiv |
| App-Konfiguration | `/var/www/bidblitz/backend/.env`, `data/` | `tar.gz` |
| Uploads (falls vorhanden) | `/var/www/bidblitz/backend/uploads/` | `tar.gz` |
| Manifest | SHA-256 Checksums + JSON-Metadata | `.sha256`, `.json` |

Jeder Run erzeugt einen Ordner `${REMOTE_PATH}/<UTC-timestamp>/` auf der Storage Box. Die Datei `${REMOTE_PATH}/latest` zeigt auf den neuesten erfolgreichen Run.

**Retention:** Default 30 Tage (lokal + remote). Konfigurierbar per `BACKUP_RETAIN_DAYS`.

## Setup (auf Hetzner VPS)

### 1. Hetzner Storage Box bestellen (falls noch nicht vorhanden)

- https://www.hetzner.com/storage/storage-box → BX11 (1 TB, 3,49 €/Mo)
- Robot-Konsole → Storage Box → Sub-account anlegen (optional, empfohlen)
- SSH-Support aktivieren

### 2. SSH-Key erstellen + auf Storage Box hinterlegen

Auf dem **VPS**:
```bash
ssh-keygen -t ed25519 -f /root/.ssh/bidblitz_backup_ed25519 -N ""
# Public Key ausgeben:
cat /root/.ssh/bidblitz_backup_ed25519.pub
```

Public Key in der Hetzner Robot-Konsole bei der Storage Box hinterlegen
(*Storage Box → SSH-Keys → Hinzufügen*).

Verbindung testen:
```bash
ssh -p 23 -i /root/.ssh/bidblitz_backup_ed25519 uXXXXXX@uXXXXXX.your-storagebox.de
# Sollte direkt eine restricted shell öffnen — Ctrl+D zum Verlassen
```

### 3. Backup-Skript installieren

Skript befindet sich im Repo unter `deploy/backup_offsite.sh` (wird vom GitHub-Actions-Deploy automatisch nach `/var/www/bidblitz/deploy/` synct).

Konfiguration:
```bash
sudo mkdir -p /etc/bidblitz
sudo cp /var/www/bidblitz/deploy/backup.env.example /etc/bidblitz/backup.env
sudo chmod 600 /etc/bidblitz/backup.env
sudo nano /etc/bidblitz/backup.env
```

Werte setzen:
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="bidblitz"
BACKUP_REMOTE_HOST="uXXXXXX.your-storagebox.de"
BACKUP_REMOTE_USER="uXXXXXX"
BACKUP_REMOTE_PORT="23"
BACKUP_REMOTE_PATH="/home/bidblitz-prod"
BACKUP_SSH_KEY="/root/.ssh/bidblitz_backup_ed25519"
BACKUP_RETAIN_DAYS="30"
```

### 4. Erste Sicherung manuell auslösen

```bash
sudo bash /var/www/bidblitz/deploy/backup_offsite.sh
```

Erwartete Ausgabe (Auszug):
```
[BACKUP] 2026-… starting run 20260502T040000Z
[BACKUP] dumping MongoDB (bidblitz) ...
[BACKUP] archiving app data ...
[BACKUP] rsyncing to uXXX@uXXX.your-storagebox.de:/home/bidblitz-prod/20260502T040000Z/ ...
[BACKUP] DONE — 20260502T040000Z pushed to uXXX.your-storagebox.de
```

### 5. Cron-Job einrichten

```bash
sudo tee /etc/cron.d/bidblitz-backup >/dev/null <<'EOF'
# BidBlitz: Tägliche Off-Site-Sicherung um 03:15 UTC
15 3 * * * root /var/www/bidblitz/deploy/backup_offsite.sh >> /var/log/bidblitz-backup.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/bidblitz-backup
```

Logs prüfen:
```bash
tail -f /var/log/bidblitz-backup.log
```

### 6. Restore (Notfall)

```bash
# Letzten Run identifizieren
ssh -p 23 -i /root/.ssh/bidblitz_backup_ed25519 uXXX@uXXX.your-storagebox.de \
  "cat /home/bidblitz-prod/latest"
# Gewünschten Run runterladen
TS=20260502T040000Z
mkdir -p /tmp/restore-$TS && cd /tmp/restore-$TS
rsync -az -e "ssh -p 23 -i /root/.ssh/bidblitz_backup_ed25519" \
  "uXXX@uXXX.your-storagebox.de:/home/bidblitz-prod/$TS/" .
# MongoDB wiederherstellen
mongorestore --uri="mongodb://localhost:27017" --gzip \
  --archive="mongo-bidblitz-$TS.archive.gz" --drop
# App-Daten extrahieren
tar xzf "app-data-$TS.tar.gz" -C /var/www/bidblitz/
# Backend neu starten
pm2 restart api
```

## Alternative Targets

Das Skript benötigt nur einen rsync-fähigen SSH-Endpunkt. Funktioniert daher auch mit:

| Target | Anpassung |
|---|---|
| Beliebiger SSH-Server | `BACKUP_REMOTE_PORT=22` setzen, sonst identisch |
| AWS S3 | rclone-Wrapper schreiben (S3 spricht kein rsync nativ) |
| Backblaze B2 | rclone-Wrapper |
| Borg / restic | Skript ersetzen — wir bleiben bei rsync für Einfachheit |

## Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| `Permission denied (publickey)` | Public Key nicht in Storage Box hinterlegt — Robot-Konsole prüfen |
| `mongodump: command not found` | `apt install mongodb-database-tools` auf VPS |
| `[BACKUP-ERROR] Missing config: MONGO_URL` | `/etc/bidblitz/backup.env` fehlt oder Variable nicht gesetzt |
| `(remote prune skipped — restricted shell)` | OK auf Storage Box — Hetzners eingeschränkte Shell erlaubt kein `find -delete`; alte Runs müssen manuell oder via SFTP gelöscht werden |
| Cronjob läuft nicht | Logs in `/var/log/syslog \| grep CRON` und `/var/log/bidblitz-backup.log` |
