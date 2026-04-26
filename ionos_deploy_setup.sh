#!/bin/bash
# 🚀 Quick Setup Script für GitHub Actions → IONOS Deployment

echo "🔧 GitHub Actions Setup für IONOS VPS"
echo "======================================"
echo ""

# Schritt 1: SSH Key erstellen
echo "📝 Schritt 1: SSH Key erstellen"
echo ""
echo "Führe diese Befehle auf DEINEM RECHNER aus:"
echo ""
echo "ssh-keygen -t ed25519 -C 'github-deploy@bidblitz.ae' -f ~/.ssh/ionos_deploy"
echo "ssh-copy-id -i ~/.ssh/ionos_deploy.pub root@bidblitz.ae"
echo ""
echo "Drücke Enter wenn fertig..."
read

# Schritt 2: Private Key anzeigen
echo ""
echo "📋 Schritt 2: Private Key kopieren"
echo ""
echo "Führe diesen Befehl aus und kopiere die KOMPLETTE Ausgabe:"
echo ""
echo "cat ~/.ssh/ionos_deploy"
echo ""
echo "Drücke Enter wenn kopiert..."
read

# Schritt 3: GitHub Secrets
echo ""
echo "🔐 Schritt 3: GitHub Secrets einrichten"
echo ""
echo "Gehe zu: https://github.com/DEIN_USERNAME/DEIN_REPO/settings/secrets/actions"
echo ""
echo "Füge diese 3 Secrets hinzu:"
echo ""
echo "1. VPS_HOST = bidblitz.ae"
echo "2. VPS_USER = root"
echo "3. VPS_SSH_KEY = <Der Private Key von oben (KOMPLETT!)>"
echo ""
echo "Drücke Enter wenn fertig..."
read

# Schritt 4: Workflow aktivieren
echo ""
echo "✅ Schritt 4: Workflow aktivieren"
echo ""
echo "In Emergent:"
echo "  1. Klicke 'Save to GitHub'"
echo "  2. Die Workflow-Datei wird automatisch mit gepusht"
echo "  3. Gehe zu GitHub → Actions Tab"
echo "  4. Sieh zu wie das Deployment läuft! 🚀"
echo ""
echo "🎉 SETUP ABGESCHLOSSEN!"
echo ""
echo "Ab jetzt: Jeder 'Save to GitHub' deployed automatisch zu bidblitz.ae"
echo "Deine MongoDB Daten bleiben komplett unberührt auf IONOS!"
