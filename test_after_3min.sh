#!/bin/bash
# Quick Test nach 3 Minuten

echo "🔍 BidBlitz Deployment Status Check"
echo "═══════════════════════════════════════"
echo ""
echo "⏰ Warte 3 Minuten für Deployment..."
echo ""

for i in {3..1}; do
    echo "   ${i} Minuten verbleibend..."
    sleep 60
done

echo ""
echo "✅ 3 Minuten vorbei, teste jetzt..."
echo ""

# Test Crypto Prices API
echo "Test 1: Crypto Prices API"
if curl -s https://bidblitz.ae/api/crypto-prices/ 2>&1 | grep -q "BTC.*88000"; then
    echo "✅ ERFOLG! Neue Version ist LIVE!"
    echo ""
    curl -s https://bidblitz.ae/api/crypto-prices/ | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"   BTC Preis: EUR {d['prices']['BTC']:,.0f}\")
print(f\"   ETH Preis: EUR {d['prices']['ETH']:,.0f}\")
"
else
    echo "❌ Noch alte Version"
    echo ""
    echo "Mögliche Ursachen:"
    echo "  1. Deployment läuft noch (warte weitere 2 Min)"
    echo "  2. GitHub Actions Secrets fehlen"
    echo "  3. Actions nicht aktiviert"
    echo ""
    echo "Prüfe GitHub Actions:"
    echo "  https://github.com/dw8yhmnzb6-cmyk/Bid2/actions"
fi

echo ""
echo "═══════════════════════════════════════"
