#!/usr/bin/env bash
# =============================================================================
# BidBlitz Native Build Pipeline (iOS + Android)
# =============================================================================
# Usage:
#   ./scripts/build-native.sh                  # Build both platforms
#   ./scripts/build-native.sh ios              # iOS only
#   ./scripts/build-native.sh android          # Android only
#   PLATFORM=ios SKIP_BUILD=1 ./scripts/build-native.sh  # Sync only, no yarn build
#
# Steps:
#   1) Validate REACT_APP_MAPBOX_TOKEN is set and alive
#   2) yarn build (skipping with SKIP_BUILD=1)
#   3) npx cap sync <platform>
#   4) Platform-specific open (interactive)
# =============================================================================
set -euo pipefail

PLATFORM="${1:-both}"
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/frontend"
cd "$FRONTEND_DIR"

# Color output helpers
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step() { echo -e "\n${BLUE}==> $*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}" >&2; }

# ---------------------------------------------------------------------------
# 1. Mapbox token health check
# ---------------------------------------------------------------------------
step "1/4 Mapbox-Token Health Check"

ENV_FILE=".env.production"
[[ -f "$ENV_FILE" ]] || ENV_FILE=".env"
[[ -f "$ENV_FILE" ]] || { err "Keine .env oder .env.production gefunden in $FRONTEND_DIR"; exit 1; }

TOKEN=$(grep -E '^REACT_APP_MAPBOX_TOKEN=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
if [[ -z "$TOKEN" ]]; then
  err "REACT_APP_MAPBOX_TOKEN ist leer in $ENV_FILE"
  exit 1
fi

# Probe Mapbox API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=$TOKEN" \
  --max-time 10 || echo "000")

case "$HTTP_CODE" in
  200) ok "Mapbox-Token gültig (Style-Endpoint 200)";;
  401) err "Mapbox-Token UNGÜLTIG (401). Bitte $ENV_FILE prüfen."; exit 1;;
  403) err "Mapbox-Token gesperrt/eingeschränkt (403)."; exit 1;;
  000) warn "Konnte Mapbox nicht erreichen — überspringe Validierung (offline?)";;
  *)   warn "Unerwarteter Status $HTTP_CODE — fortfahren";;
esac

# ---------------------------------------------------------------------------
# 2. Yarn build (CRA)
# ---------------------------------------------------------------------------
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  step "2/4 Frontend Production-Build (yarn build)"
  yarn build
  ok "Build erfolgreich"
else
  warn "2/4 Build übersprungen (SKIP_BUILD=1)"
fi

# ---------------------------------------------------------------------------
# 3. Capacitor Sync
# ---------------------------------------------------------------------------
step "3/4 Capacitor Sync"

case "$PLATFORM" in
  ios)
    npx cap sync ios
    ok "iOS synchronisiert"
    ;;
  android)
    npx cap sync android
    ok "Android synchronisiert"
    ;;
  both|"")
    npx cap sync
    ok "Beide Plattformen synchronisiert"
    ;;
  *)
    err "Unbekannte Plattform: $PLATFORM (erwartet: ios | android | both)"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# 4. Plugin sanity check
# ---------------------------------------------------------------------------
step "4/4 Plugin Sanity Check"

EXPECTED=("@capacitor/core" "@capacitor/ios" "@capacitor/android"
          "@capacitor-community/bluetooth-le" "@capgo/capacitor-wifi")
for pkg in "${EXPECTED[@]}"; do
  if [[ -d "node_modules/$pkg" ]]; then
    ok "$pkg installiert"
  else
    warn "$pkg fehlt — Plugin wird nicht funktionieren"
  fi
done

echo
ok "Native-Build-Pipeline abgeschlossen."
echo
echo "Nächste Schritte:"
case "$PLATFORM" in
  ios|both)
    echo "  • iOS:     npx cap open ios   → Xcode → Run on Device/Simulator"
    ;;
esac
case "$PLATFORM" in
  android|both)
    echo "  • Android: npx cap open android → Android Studio → Run"
    ;;
esac
echo
