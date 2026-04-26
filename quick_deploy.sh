#!/bin/bash
# 🚀 BidBlitz V2 - Quick Deployment Script
# Dieses Script automatisiert das Deployment auf deinem VPS

set -e  # Exit bei Fehlern

echo "🚀 BidBlitz V2 Deployment Script"
echo "================================"
echo ""

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Konfiguration - BITTE ANPASSEN!
SERVER_USER="root"
SERVER_HOST="bidblitz.ae"
DEPLOY_PATH="/var/www/bidblitz"
BACKUP_DIR="/var/www/bidblitz-backups"

echo -e "${YELLOW}📋 Konfiguration:${NC}"
echo "   Server: $SERVER_USER@$SERVER_HOST"
echo "   Deploy Path: $DEPLOY_PATH"
echo ""

# Schritt 1: Deployment-Paket hochladen
echo -e "${YELLOW}📦 Schritt 1: Lade Deployment-Paket hoch...${NC}"
scp bidblitz-deploy-latest.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

# Schritt 2: Auf dem Server entpacken und installieren
echo -e "${YELLOW}🔧 Schritt 2: Installiere auf dem Server...${NC}"
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
set -e

# Backup erstellen
echo "💾 Erstelle Backup..."
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p /var/www/bidblitz-backups
if [ -d "/var/www/bidblitz/frontend/build" ]; then
    cp -r /var/www/bidblitz/frontend/build /var/www/bidblitz-backups/$BACKUP_NAME-frontend
    echo "   ✅ Frontend Backup: $BACKUP_NAME-frontend"
fi
if [ -d "/var/www/bidblitz/backend" ]; then
    cp -r /var/www/bidblitz/backend /var/www/bidblitz-backups/$BACKUP_NAME-backend
    echo "   ✅ Backend Backup: $BACKUP_NAME-backend"
fi

# Entpacken
echo "📂 Entpacke neue Version..."
cd /var/www/bidblitz
tar -xzf /tmp/bidblitz-deploy-latest.tar.gz

# Backend Dependencies
echo "📦 Installiere Backend Dependencies..."
cd /var/www/bidblitz/backend
if [ -d "venv" ]; then
    source venv/bin/activate
    pip install -r requirements.txt -q
    echo "   ✅ Dependencies installiert"
else
    echo "   ⚠️  Keine venv gefunden - überspringe pip install"
fi

# Services neu starten
echo "🔄 Starte Services neu..."
if command -v supervisorctl &> /dev/null; then
    sudo supervisorctl restart bidblitz-backend 2>/dev/null || echo "   ⚠️  Supervisor restart fehlgeschlagen"
fi

if command -v systemctl &> /dev/null; then
    sudo systemctl restart bidblitz-backend 2>/dev/null || echo "   ⚠️  Systemd restart fehlgeschlagen"
fi

# Nginx neu laden
if command -v nginx &> /dev/null; then
    sudo nginx -t && sudo nginx -s reload
    echo "   ✅ Nginx neu geladen"
fi

# Aufräumen
rm /tmp/bidblitz-deploy-latest.tar.gz

echo ""
echo "✅ Deployment abgeschlossen!"
echo ""
echo "🔍 Überprüfe die Installation:"
echo "   curl http://localhost:8001/api/health"
echo ""

ENDSSH

# Schritt 3: Überprüfung
echo -e "${GREEN}✅ Deployment erfolgreich!${NC}"
echo ""
echo -e "${YELLOW}🔍 Überprüfe die Website:${NC}"
echo "   https://bidblitz.ae"
echo ""
echo -e "${YELLOW}📊 Backend Health Check:${NC}"
ssh $SERVER_USER@$SERVER_HOST "curl -s http://localhost:8001/api/health || echo 'Backend nicht erreichbar'"
echo ""
echo -e "${GREEN}🎉 Fertig!${NC}"
