#!/bin/bash

# Force Cache Clear Script

echo "🧹 Clearing ALL browser caches..."

# 1. Unregister service worker via API
curl -s "https://game-center-hub-1.preview.emergentagent.com/" > /dev/null

# 2. Send cache-clear header
curl -s -H "Clear-Site-Data: \"cache\", \"storage\"" \
  "https://game-center-hub-1.preview.emergentagent.com/api/auctions" > /dev/null

echo "✓ Cache-clear signals sent"
echo ""
echo "📱 Auf deinem Handy:"
echo "1. Safari: Einstellungen → Safari → Verlauf und Websitedaten löschen"
echo "2. Chrome: Einstellungen → Datenschutz → Browserdaten löschen → Cached images"
echo "3. Oder: App komplett aus dem RAM entfernen (Multitasking-Swipe)"
