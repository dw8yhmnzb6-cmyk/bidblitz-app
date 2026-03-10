#!/bin/bash
# =================================================
# BidBlitz - IONOS Server Quick Fix
# Führt schnelle Reparatur des Deployments durch
# =================================================

set -e

echo "🔧 BidBlitz Quick Deployment Fix"
echo "================================="
echo ""

# Zum Projektverzeichnis wechseln
cd /var/www/bidblitz

# 1. Neueste Version holen
echo "📥 Hole neueste Version..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code aktualisiert"

# 2. Frontend neu bauen
echo ""
echo "🎨 Baue Frontend neu..."
cd /var/www/bidblitz/frontend

# Alte Build-Dateien löschen
rm -rf build node_modules/.cache

# Dependencies installieren
yarn install --frozen-lockfile

# Build mit mehr Speicher
NODE_OPTIONS="--max-old-space-size=2048" yarn build

if [ -d "build" ]; then
    echo "✅ Frontend Build erfolgreich"
    ls -la build/
else
    echo "❌ Frontend Build fehlgeschlagen!"
    exit 1
fi

# 3. Backend aktualisieren
echo ""
echo "📦 Aktualisiere Backend..."
cd /var/www/bidblitz/backend
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
echo "✅ Backend aktualisiert"

# 4. Cache leeren
echo ""
echo "🧹 Leere Caches..."
rm -rf /var/cache/nginx/* 2>/dev/null || true

# 5. Services neustarten
echo ""
echo "🔄 Starte Services neu..."
systemctl restart bidblitz-backend
sleep 2
systemctl reload nginx

# 6. Status prüfen
echo ""
echo "📊 Service Status:"
echo "Backend:"
systemctl is-active bidblitz-backend && echo "  ✅ Läuft" || echo "  ❌ Gestoppt"

echo "Nginx:"
systemctl is-active nginx && echo "  ✅ Läuft" || echo "  ❌ Gestoppt"

# 7. API Test
echo ""
echo "🔍 API Health Check:"
if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
    echo "  ✅ Backend API ist healthy"
else
    echo "  ⚠️ Backend API antwortet nicht"
fi

echo ""
echo "================================="
echo "✅ Quick Fix abgeschlossen!"
echo ""
echo "Bitte Browser-Cache leeren und bidblitz.ae neu laden!"
echo "  - Chrome: Ctrl+Shift+R"
echo "  - Firefox: Ctrl+F5"
echo "================================="
