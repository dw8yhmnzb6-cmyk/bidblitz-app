#!/bin/bash
# 🎯 ONE-TIME SETUP: Auto-Deploy von Emergent → IONOS
# Nach diesem Setup: "Save to GitHub" = Automatisch deployed!

set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  BidBlitz Auto-Deploy Setup                      ║"
echo "║  Einmal einrichten, dann immer automatisch!      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📋 Was wird eingerichtet:${NC}"
echo "   1. SSH Key für GitHub Actions"
echo "   2. GitHub Secrets"
echo "   3. Automatisches Deployment bei jedem Push"
echo ""
echo "⏱️  Dauer: 5 Minuten"
echo ""
read -p "Bereit? [Enter] " dummy

# ═══════════════════════════════════════════════════════════════
# SCHRITT 1: SSH KEY
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}🔐 SCHRITT 1: SSH Key erstellen${NC}"
echo ""

SSH_KEY="$HOME/.ssh/bidblitz_github_deploy"

if [ -f "$SSH_KEY" ]; then
    echo "✅ SSH Key existiert bereits: $SSH_KEY"
else
    ssh-keygen -t ed25519 -C "github-deploy@bidblitz.ae" -f "$SSH_KEY" -N ""
    echo -e "${GREEN}✅ SSH Key erstellt!${NC}"
fi

# Public Key auf Server kopieren
echo ""
echo "📤 Kopiere Public Key auf IONOS VPS..."
echo "   (Du wirst nach dem Server-Passwort gefragt)"
echo ""

if ssh-copy-id -i "${SSH_KEY}.pub" root@bidblitz.ae; then
    echo -e "${GREEN}✅ SSH Key auf Server kopiert!${NC}"
else
    echo -e "${RED}❌ Fehler beim Kopieren${NC}"
    echo "Bitte führe manuell aus:"
    echo "  ssh-copy-id -i ${SSH_KEY}.pub root@bidblitz.ae"
    exit 1
fi

# Teste Verbindung
echo ""
echo "🧪 Teste SSH-Verbindung..."
if ssh -i "$SSH_KEY" -o ConnectTimeout=5 root@bidblitz.ae "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH-Verbindung funktioniert!${NC}"
else
    echo -e "${RED}❌ SSH-Verbindung fehlgeschlagen${NC}"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
# SCHRITT 2: GITHUB SECRETS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}🔐 SCHRITT 2: GitHub Secrets${NC}"
echo ""
echo "Du musst jetzt 3 Secrets in GitHub eintragen:"
echo ""
echo "1. Gehe zu: https://github.com/dw8yhmnzb6-cmyk/Bid2/settings/secrets/actions"
echo "2. Klicke: 'New repository secret'"
echo ""

# Secret 1: VPS_HOST
echo -e "${YELLOW}Secret 1: VPS_HOST${NC}"
echo "────────────────────────────────"
echo "Name:  VPS_HOST"
echo "Value: bidblitz.ae"
echo ""
read -p "✓ Secret 1 hinzugefügt? [Enter] " dummy

# Secret 2: VPS_USER
echo ""
echo -e "${YELLOW}Secret 2: VPS_USER${NC}"
echo "────────────────────────────────"
echo "Name:  VPS_USER"
echo "Value: root"
echo ""
read -p "✓ Secret 2 hinzugefügt? [Enter] " dummy

# Secret 3: VPS_SSH_KEY
echo ""
echo -e "${YELLOW}Secret 3: VPS_SSH_KEY${NC}"
echo "────────────────────────────────"
echo "Name:  VPS_SSH_KEY"
echo ""
echo "Value: Kopiere den KOMPLETTEN Text hierunter:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$SSH_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  WICHTIG: Kopiere ALLES, inkl. '-----BEGIN' und '-----END' Zeilen!"
echo ""
read -p "✓ Secret 3 hinzugefügt? [Enter] " dummy

# ═══════════════════════════════════════════════════════════════
# SCHRITT 3: GITHUB ACTIONS AKTIVIEREN
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}🎬 SCHRITT 3: GitHub Actions aktivieren${NC}"
echo ""
echo "1. Gehe zu: https://github.com/dw8yhmnzb6-cmyk/Bid2/actions"
echo "2. Falls 'Actions disabled': Klicke 'I understand, enable them'"
echo ""
read -p "✓ Actions aktiviert? [Enter] " dummy

# ═══════════════════════════════════════════════════════════════
# SCHRITT 4: WORKFLOW DATEI PRÜFEN
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}📄 SCHRITT 4: Workflow-Datei prüfen${NC}"
echo ""
echo "Die Datei '.github/workflows/deploy-to-vps.yml' sollte existieren."
echo ""
echo "Prüfe in GitHub:"
echo "https://github.com/dw8yhmnzb6-cmyk/Bid2/blob/main/.github/workflows/deploy-to-vps.yml"
echo ""
read -p "✓ Datei existiert? [Enter] " dummy

# ═══════════════════════════════════════════════════════════════
# FERTIG!
# ═══════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ SETUP ABGESCHLOSSEN!                         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🎉 Ab jetzt ist alles AUTOMATISCH!${NC}"
echo ""
echo "So funktioniert es:"
echo ""
echo "  1. Code in Emergent ändern"
echo "  2. 'Save to GitHub' klicken"
echo "  3. ☕ Warte 3 Minuten"
echo "  4. ✅ Live auf bidblitz.ae!"
echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "🔍 Deployment verfolgen:"
echo "   https://github.com/dw8yhmnzb6-cmyk/Bid2/actions"
echo ""
echo "💡 Erstes Deployment starten:"
echo "   1. In Emergent: 'Save to GitHub' klicken"
echo "   2. Merge zu 'main' Branch (wenn nötig)"
echo "   3. GitHub Actions startet automatisch"
echo ""
echo "🆘 Bei Problemen:"
echo "   - Prüfe GitHub Actions Logs"
echo "   - Prüfe dass alle 3 Secrets eingetragen sind"
echo "   - Prüfe SSH: ssh -i $SSH_KEY root@bidblitz.ae"
echo ""
