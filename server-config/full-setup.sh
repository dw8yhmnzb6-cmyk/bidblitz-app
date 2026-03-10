#!/bin/bash
# ============================================
# BidBlitz - Komplettes Server Setup
# Führen Sie dieses Script auf dem IONOS Server aus
# ============================================

set -e

echo "🚀 BidBlitz Server Setup"
echo "========================"
echo ""

# 1. System Update
echo "📦 System wird aktualisiert..."
apt update -y

# 2. PostgreSQL Installation
echo ""
echo "🐘 PostgreSQL wird installiert..."
apt install -y postgresql postgresql-contrib

# PostgreSQL starten
systemctl start postgresql
systemctl enable postgresql

# Warte bis PostgreSQL bereit ist
sleep 3

# 3. Datenbank erstellen
echo ""
echo "🗄️ Datenbank wird erstellt..."
sudo -u postgres psql << 'EOSQL'
-- Benutzer erstellen (falls nicht existiert)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bidblitz') THEN
        CREATE USER bidblitz WITH PASSWORD 'BidBlitz2024SecureDB!';
    END IF;
END
$$;

-- Datenbank erstellen (falls nicht existiert)
SELECT 'CREATE DATABASE bidblitz_db OWNER bidblitz'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bidblitz_db')\gexec

-- Berechtigungen setzen
GRANT ALL PRIVILEGES ON DATABASE bidblitz_db TO bidblitz;
EOSQL

echo "✅ PostgreSQL Datenbank erstellt"

# 4. Backend .env aktualisieren
echo ""
echo "⚙️ Backend Konfiguration wird aktualisiert..."
cd /var/www/bidblitz/backend

# DATABASE_URL hinzufügen falls nicht vorhanden
if ! grep -q "DATABASE_URL" .env; then
    echo "" >> .env
    echo "# PostgreSQL Database" >> .env
    echo "DATABASE_URL=postgresql://bidblitz:BidBlitz2024SecureDB!@localhost:5432/bidblitz_db" >> .env
    echo "✅ DATABASE_URL zu .env hinzugefügt"
else
    echo "ℹ️ DATABASE_URL bereits vorhanden"
fi

# 5. Python Dependencies installieren
echo ""
echo "📦 Python Dependencies werden installiert..."
source venv/bin/activate
pip install sqlalchemy[asyncio] asyncpg alembic psycopg2-binary --quiet
pip freeze > requirements.txt

# 6. Datenmigration
echo ""
echo "🔄 Datenmigration wird gestartet..."
if [ -f "migrate_to_postgres.py" ]; then
    python migrate_to_postgres.py
else
    echo "⚠️ Migrationsskript nicht gefunden - bitte zuerst git pull ausführen"
fi

deactivate

# 7. Services neustarten
echo ""
echo "🔄 Services werden neugestartet..."
systemctl restart bidblitz-backend
sleep 2
systemctl reload nginx

# 8. Status prüfen
echo ""
echo "📊 Status:"
echo "=========="
echo ""
echo "PostgreSQL:"
systemctl is-active postgresql && echo "  ✅ Läuft" || echo "  ❌ Gestoppt"

echo ""
echo "Backend:"
systemctl is-active bidblitz-backend && echo "  ✅ Läuft" || echo "  ❌ Gestoppt"

echo ""
echo "Nginx:"
systemctl is-active nginx && echo "  ✅ Läuft" || echo "  ❌ Gestoppt"

# API Health Check
echo ""
echo "API Health:"
if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
    echo "  ✅ Backend API ist healthy"
else
    echo "  ⚠️ Backend API antwortet nicht"
    echo "  Logs prüfen: journalctl -u bidblitz-backend -n 30"
fi

echo ""
echo "========================================"
echo "✅ Setup abgeschlossen!"
echo "========================================"
echo ""
echo "PostgreSQL Zugangsdaten:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Datenbank: bidblitz_db"
echo "  Benutzer: bidblitz"
echo "  Passwort: BidBlitz2024SecureDB!"
echo ""
echo "🌐 Besuchen Sie: https://bidblitz.ae"
echo ""
