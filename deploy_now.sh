#!/bin/bash
# 🚀 SOFORT-DEPLOYMENT zu bidblitz.ae
# Führe dieses Script auf deinem LOKALEN Rechner aus

set -e

VPS="bidblitz.ae"
USER="root"

echo "🚀 BidBlitz Sofort-Deployment"
echo "════════════════════════════════"
echo ""

# 1. Prüfe SSH-Verbindung
echo "🔐 Teste SSH-Verbindung..."
if ssh -o ConnectTimeout=5 ${USER}@${VPS} "echo 'SSH OK'" > /dev/null 2>&1; then
    echo "✅ SSH funktioniert"
else
    echo "❌ SSH-Verbindung fehlgeschlagen!"
    echo "Lösung: ssh-copy-id ${USER}@${VPS}"
    exit 1
fi

# 2. Upload Deployment-Paket
echo ""
echo "📤 Uploade Deployment-Paket..."
if [ -f "bidblitz-deploy-crypto-real.tar.gz" ]; then
    scp bidblitz-deploy-crypto-real.tar.gz ${USER}@${VPS}:/tmp/
    echo "✅ Upload abgeschlossen"
else
    echo "❌ bidblitz-deploy-crypto-real.tar.gz nicht gefunden!"
    echo "Bitte lade die Datei zuerst von Emergent herunter."
    exit 1
fi

# 3. Deploy auf VPS
echo ""
echo "🚀 Starte Deployment auf VPS..."
echo "════════════════════════════════"

ssh ${USER}@${VPS} << 'ENDSSH'
set -e

# Backup
echo "💾 Erstelle Backup..."
BACKUP_DIR="/var/www/bidblitz-backups"
mkdir -p "$BACKUP_DIR"
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"

if [ -d "/var/www/bidblitz/backend" ]; then
    cp -r /var/www/bidblitz/backend "$BACKUP_DIR/$BACKUP_NAME-backend"
    echo "   ✅ Backend gesichert"
fi

if [ -d "/var/www/bidblitz/frontend/build" ]; then
    cp -r /var/www/bidblitz/frontend/build "$BACKUP_DIR/$BACKUP_NAME-frontend"
    echo "   ✅ Frontend gesichert"
fi

# Entpacken
echo ""
echo "📦 Entpacke neues Deployment..."
cd /var/www/bidblitz
tar -xzf /tmp/bidblitz-deploy-crypto-real.tar.gz

# Backend Dependencies
echo ""
echo "🔧 Installiere Backend Dependencies..."
cd /var/www/bidblitz/backend
if [ -d "venv" ]; then
    source venv/bin/activate
    pip install -r requirements.txt -q
    echo "   ✅ Dependencies installiert"
fi

# Services neu starten
echo ""
echo "🔄 Starte Services neu..."
if systemctl is-active --quiet bidblitz-backend; then
    systemctl restart bidblitz-backend
    echo "   ✅ Backend (systemd) neu gestartet"
elif command -v supervisorctl > /dev/null; then
    supervisorctl restart bidblitz-backend 2>/dev/null || echo "   ⚠️ Supervisor restart"
fi

# Nginx reload
if command -v nginx > /dev/null; then
    nginx -t && nginx -s reload
    echo "   ✅ Nginx neu geladen"
fi

# Cleanup
rm /tmp/bidblitz-deploy-crypto-real.tar.gz

# Health Check
echo ""
echo "🏥 Health Check..."
sleep 3
if curl -s http://localhost:8001/api/crypto-prices/ > /dev/null 2>&1; then
    echo "   ✅ Backend läuft (neue APIs vorhanden)!"
else
    echo "   ⚠️ Backend antwortet nicht auf neue APIs"
fi

echo ""
echo "════════════════════════════════"
echo "✅ DEPLOYMENT ABGESCHLOSSEN!"
echo "════════════════════════════════"

ENDSSH

# 4. Test von außen
echo ""
echo "🌐 Teste Live-Seite..."
sleep 2

if curl -s https://${VPS}/api/crypto-prices/ | grep -q "BTC"; then
    echo "✅ Crypto Prices API funktioniert!"
else
    echo "⚠️ API noch nicht erreichbar - warte 10 Sekunden..."
    sleep 10
fi

echo ""
echo "════════════════════════════════"
echo "🎉 FERTIG!"
echo "════════════════════════════════"
echo ""
echo "🌐 Teste jetzt:"
echo "   https://${VPS}"
echo ""
echo "   Erwarte:"
echo "   • EUR Wallet + Crypto Breakdown"
echo "   • Gesamt-Balance mit Crypto"
echo ""
echo "💡 Falls alte Version:"
echo "   → Hard Refresh: Strg + Shift + R"
echo "   → Browser Cache leeren"
echo ""
