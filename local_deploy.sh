#!/bin/bash
# 🎯 Lokales Script: Upload & Deploy zu bidblitz.ae
# Führe dieses Script auf deinem LOKALEN Rechner aus

set -e

echo "🚀 BidBlitz Upload & Deploy"
echo "═══════════════════════════════════════"
echo ""

# Konfiguration
VPS_HOST="${VPS_HOST:-bidblitz.ae}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
DEPLOY_PACKAGE="bidblitz-deploy-crypto-real.tar.gz"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfe ob Deployment-Paket existiert
if [ ! -f "$DEPLOY_PACKAGE" ]; then
    echo -e "${RED}❌ Deployment-Paket nicht gefunden: $DEPLOY_PACKAGE${NC}"
    echo "Bitte lade das Paket zuerst von Emergent herunter!"
    exit 1
fi

echo -e "${GREEN}✅ Deployment-Paket gefunden:${NC} $DEPLOY_PACKAGE"
PACKAGE_SIZE=$(du -h "$DEPLOY_PACKAGE" | cut -f1)
echo "   Größe: $PACKAGE_SIZE"
echo ""

# Prüfe SSH-Verbindung
echo -e "${YELLOW}🔐 Teste SSH-Verbindung zu $VPS_HOST...${NC}"
if ssh -p "$VPS_PORT" -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ SSH-Verbindung erfolgreich${NC}"
else
    echo -e "${RED}   ❌ SSH-Verbindung fehlgeschlagen${NC}"
    echo "Prüfe:"
    echo "  - Host: $VPS_HOST"
    echo "  - User: $VPS_USER"
    echo "  - Port: $VPS_PORT"
    echo "  - SSH Key ist konfiguriert?"
    exit 1
fi
echo ""

# Upload Deployment-Paket
echo -e "${YELLOW}📤 Uploade Deployment-Paket...${NC}"
scp -P "$VPS_PORT" "$DEPLOY_PACKAGE" "$VPS_USER@$VPS_HOST:/tmp/bidblitz-deploy-latest.tar.gz"
echo -e "${GREEN}   ✅ Upload abgeschlossen${NC}"
echo ""

# Upload Deployment-Script
echo -e "${YELLOW}📤 Uploade Deployment-Script...${NC}"
scp -P "$VPS_PORT" "vps_deploy.sh" "$VPS_USER@$VPS_HOST:/root/deploy.sh"
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "chmod +x /root/deploy.sh"
echo -e "${GREEN}   ✅ Script hochgeladen${NC}"
echo ""

# Führe Deployment aus
echo -e "${YELLOW}🚀 Starte Deployment auf VPS...${NC}"
echo "═══════════════════════════════════════"
ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "/root/deploy.sh"
echo "═══════════════════════════════════════"
echo ""

# Fertig
echo -e "${GREEN}🎉 DEPLOYMENT ABGESCHLOSSEN!${NC}"
echo ""
echo "🌐 Teste deine Website:"
echo "   https://$VPS_HOST"
echo ""
echo "📊 Prüfe Logs bei Problemen:"
echo "   ssh $VPS_USER@$VPS_HOST 'tail -f /var/log/bidblitz-deployments.log'"
echo ""
