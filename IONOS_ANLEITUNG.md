# 🚀 BidBlitz IONOS Server - Anleitung

## Schritt 1: SSH Verbindung

```bash
ssh root@212.227.20.190
# Passwort: neew7ky3xhyt3H
```

## Schritt 2: Quick Fix ausführen

Sobald verbunden, führen Sie aus:

```bash
cd /var/www/bidblitz
git pull origin main

# Quick Fix Script
chmod +x server-config/quick-fix.sh
./server-config/quick-fix.sh
```

## Schritt 3: PostgreSQL installieren

```bash
# PostgreSQL installieren
apt update
apt install -y postgresql postgresql-contrib

# PostgreSQL starten
systemctl start postgresql
systemctl enable postgresql

# Datenbank erstellen
sudo -u postgres psql -c "CREATE USER bidblitz WITH PASSWORD 'BidBlitz2024SecureDB!';"
sudo -u postgres psql -c "CREATE DATABASE bidblitz_db OWNER bidblitz;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bidblitz_db TO bidblitz;"
```

## Schritt 4: Backend konfigurieren

Fügen Sie zur `/var/www/bidblitz/backend/.env` hinzu:

```
DATABASE_URL=postgresql://bidblitz:BidBlitz2024SecureDB!@localhost:5432/bidblitz_db
```

## Schritt 5: Datenmigration (MongoDB → PostgreSQL)

```bash
cd /var/www/bidblitz/backend
source venv/bin/activate
pip install sqlalchemy[asyncio] asyncpg alembic psycopg2-binary

# Migration starten
python migrate_to_postgres.py
```

## Schritt 6: Services neustarten

```bash
systemctl restart bidblitz-backend
systemctl reload nginx
```

## Schritt 7: Verifizieren

```bash
# Backend Health Check
curl http://localhost:8001/api/health

# Im Browser
# https://bidblitz.ae
```

---

## PostgreSQL Zugangsdaten

- **Host:** localhost
- **Port:** 5432
- **Datenbank:** bidblitz_db
- **Benutzer:** bidblitz
- **Passwort:** BidBlitz2024SecureDB!

## Wichtige Befehle

```bash
# Backend Logs anzeigen
journalctl -u bidblitz-backend -f

# Nginx Logs anzeigen
tail -f /var/log/nginx/access.log

# PostgreSQL Status
systemctl status postgresql

# Backend neustarten
systemctl restart bidblitz-backend
```

## Bei Problemen

1. **Frontend zeigt alte Version:**
   - Browser-Cache leeren: Ctrl+Shift+R
   - Nginx neustarten: `systemctl restart nginx`

2. **API funktioniert nicht:**
   - Backend Logs prüfen: `journalctl -u bidblitz-backend -n 50`
   - Port prüfen: `netstat -tlnp | grep 8001`

3. **PostgreSQL Fehler:**
   - Status prüfen: `systemctl status postgresql`
   - Logs: `journalctl -u postgresql -n 50`
