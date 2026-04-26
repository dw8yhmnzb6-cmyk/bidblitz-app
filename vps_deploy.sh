#!/bin/bash
# 🚀 BidBlitz Deployment Script (auf VPS ausführen)
# Automatisches Deployment bei Webhook-Trigger

set -e  # Exit bei Fehler

echo "🚀 BidBlitz Deployment gestartet..."
echo "Zeit: $(date)"
echo "═══════════════════════════════════════"

# Verzeichnisse
DEPLOY_DIR="/var/www/bidblitz"
BACKUP_DIR="/var/www/bidblitz-backups"
TEMP_DIR="/tmp/bidblitz-deploy"

# Erstelle Backup
echo "💾 Erstelle Backup..."
mkdir -p "$BACKUP_DIR"
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"

if [ -d "$DEPLOY_DIR/backend" ]; then
    cp -r "$DEPLOY_DIR/backend" "$BACKUP_DIR/$BACKUP_NAME-backend"
    echo "   ✅ Backend gesichert"
fi

if [ -d "$DEPLOY_DIR/frontend/build" ]; then
    cp -r "$DEPLOY_DIR/frontend/build" "$BACKUP_DIR/$BACKUP_NAME-frontend"
    echo "   ✅ Frontend gesichert"
fi

# Prüfe ob neues Deployment-Paket vorhanden ist
if [ ! -f "/tmp/bidblitz-deploy-latest.tar.gz" ]; then
    echo "❌ Kein Deployment-Paket gefunden in /tmp/bidblitz-deploy-latest.tar.gz"
    echo "Bitte lade das Paket zuerst hoch!"
    exit 1
fi

# Entpacke neues Deployment
echo ""
echo "📦 Entpacke neues Deployment..."
mkdir -p "$TEMP_DIR"
tar -xzf /tmp/bidblitz-deploy-latest.tar.gz -C "$TEMP_DIR"

# Kopiere Backend
echo "🔧 Installiere Backend..."
if [ -d "$TEMP_DIR/backend" ]; then
    rm -rf "$DEPLOY_DIR/backend"
    cp -r "$TEMP_DIR/backend" "$DEPLOY_DIR/"
    echo "   ✅ Backend kopiert"
    
    # Install Dependencies
    cd "$DEPLOY_DIR/backend"
    if [ -d "venv" ]; then
        source venv/bin/activate
        pip install -r requirements.txt -q
        echo "   ✅ Dependencies installiert"
    else
        echo "   ⚠️  Keine venv gefunden - erstelle eine..."
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        echo "   ✅ venv erstellt und Dependencies installiert"
    fi
fi

# Kopiere Frontend
echo ""
echo "🎨 Installiere Frontend..."
if [ -d "$TEMP_DIR/frontend/build" ]; then
    rm -rf "$DEPLOY_DIR/frontend/build"
    mkdir -p "$DEPLOY_DIR/frontend"
    cp -r "$TEMP_DIR/frontend/build" "$DEPLOY_DIR/frontend/"
    echo "   ✅ Frontend kopiert"
fi

# Cleanup
echo ""
echo "🧹 Räume auf..."
rm -rf "$TEMP_DIR"
rm -f /tmp/bidblitz-deploy-latest.tar.gz
echo "   ✅ Temp-Dateien gelöscht"

# Restart Services
echo ""
echo "🔄 Starte Services neu..."

# Backend restart (Systemd)
if systemctl is-active --quiet bidblitz-backend; then
    systemctl restart bidblitz-backend
    echo "   ✅ Backend (systemd) neu gestartet"
elif supervisorctl status bidblitz-backend > /dev/null 2>&1; then
    supervisorctl restart bidblitz-backend
    echo "   ✅ Backend (supervisor) neu gestartet"
else
    echo "   ⚠️  Kein Service Manager gefunden - bitte manuell starten"
fi

# Nginx reload
if command -v nginx > /dev/null; then
    nginx -t && nginx -s reload
    echo "   ✅ Nginx neu geladen"
fi

# Health Check
echo ""
echo "🏥 Health Check..."
sleep 3

if curl -s http://localhost:8001/api/health > /dev/null; then
    echo "   ✅ Backend läuft!"
else
    echo "   ⚠️  Backend antwortet nicht - prüfe Logs!"
fi

if [ -f "$DEPLOY_DIR/frontend/build/index.html" ]; then
    echo "   ✅ Frontend Build vorhanden!"
else
    echo "   ⚠️  Frontend Build fehlt!"
fi

# Fertig
echo ""
echo "═══════════════════════════════════════"
echo "✅ DEPLOYMENT ERFOLGREICH!"
echo "Zeit: $(date)"
echo "Backup: $BACKUP_DIR/$BACKUP_NAME-*"
echo ""
echo "🌐 Teste: https://bidblitz.ae"
echo "═══════════════════════════════════════"

# Log speichern
echo "[$(date)] Deployment erfolgreich" >> /var/log/bidblitz-deployments.log
