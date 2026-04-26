#!/bin/bash
# 🚀 MINI DEPLOYMENT - Nutze kleinere Dateien

echo "🚀 BidBlitz Mini-Deployment"
echo "═══════════════════════════════════════"
echo ""

# Download Backend (569KB)
echo "📥 Download Backend..."
wget https://EMERGENT_LINK/backend-only.tar.gz -O /tmp/backend-only.tar.gz

# Download Frontend (1.4MB)  
echo "📥 Download Frontend..."
wget https://EMERGENT_LINK/frontend-only.tar.gz -O /tmp/frontend-only.tar.gz

# Backup
echo ""
echo "💾 Backup..."
mkdir -p /var/www/bidblitz-backups
cp -r /var/www/bidblitz/backend /var/www/bidblitz-backups/backup_$(date +%Y%m%d_%H%M%S)-backend

# Deploy Backend
echo ""
echo "🔧 Deploy Backend..."
cd /var/www/bidblitz/backend
tar -xzf /tmp/backend-only.tar.gz
source venv/bin/activate
pip install -r requirements.txt -q

# Deploy Frontend
echo ""
echo "🎨 Deploy Frontend..."
cd /var/www/bidblitz/frontend
tar -xzf /tmp/frontend-only.tar.gz

# Restart
echo ""
echo "🔄 Restart Services..."
systemctl restart bidblitz-backend
nginx -s reload

# Test
echo ""
echo "🧪 Test..."
sleep 3
curl http://localhost:8001/api/crypto-prices/ | grep -q "BTC" && \
  echo "✅ DEPLOYMENT ERFOLGREICH!" || \
  echo "⚠️ Test fehlgeschlagen"

# Cleanup
rm /tmp/backend-only.tar.gz /tmp/frontend-only.tar.gz

echo ""
echo "═══════════════════════════════════════"
echo "✅ FERTIG!"
