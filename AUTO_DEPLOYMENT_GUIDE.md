# 🚀 AUTOMATISCHES DEPLOYMENT ZU BIDBLITZ.AE

## Übersicht

Dieses Setup ermöglicht **automatisches Deployment** von Emergent zu deinem VPS bei jedem Code-Push.

```
┌──────────┐    Push     ┌────────┐    GitHub      ┌──────────┐
│ EMERGENT │ ────────> │ GITHUB │    Actions    │ DEIN VPS │
│          │  zu Repo    │        │ ───────────> │bidblitz.ae│
└──────────┘             └────────┘    Deploy     └──────────┘
```

---

## 🛠️ EINRICHTUNG (Einmalig)

### Schritt 1: GitHub Repository erstellen

1. Gehe zu Emergent Chat
2. Klicke auf **"Save to GitHub"** Button
3. Autorisiere GitHub (falls nötig)
4. Erstelle neues Repo: `bidblitz-v2`

### Schritt 2: SSH Key für VPS erstellen

Auf deinem **lokalen Rechner**:

```bash
# SSH Key generieren
ssh-keygen -t ed25519 -C "github-actions@bidblitz.ae" -f ~/.ssh/bidblitz_deploy

# Public Key auf VPS kopieren
ssh-copy-id -i ~/.ssh/bidblitz_deploy.pub root@bidblitz.ae

# Private Key anzeigen (für GitHub Secrets)
cat ~/.ssh/bidblitz_deploy
# Kopiere den KOMPLETTEN Inhalt (inkl. -----BEGIN/END-----)
```

### Schritt 3: GitHub Secrets einrichten

1. Gehe zu deinem GitHub Repo
2. **Settings** → **Secrets and variables** → **Actions**
3. Klicke **"New repository secret"**

Füge hinzu:

| Secret Name | Value |
|-------------|-------|
| `VPS_HOST` | `bidblitz.ae` |
| `VPS_USERNAME` | `root` |
| `VPS_SSH_KEY` | *Dein Private Key von oben* |

### Schritt 4: GitHub Actions Workflow aktivieren

Die Datei `.github/workflows/deploy.yml` ist bereits erstellt!

1. Committe sie zu deinem Repo (via "Save to GitHub")
2. GitHub Actions startet automatisch

### Schritt 5: VPS vorbereiten

Auf deinem **VPS** (einmalig):

```bash
# SSH zum Server
ssh root@bidblitz.ae

# Git Repository clonen
cd /var/www
git clone https://github.com/DEIN_USERNAME/bidblitz-v2.git bidblitz
cd bidblitz

# Python venv erstellen
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend bauen
cd ../frontend
yarn install
yarn build

# Services einrichten (falls noch nicht geschehen)
# siehe DEPLOYMENT_GUIDE.md
```

---

## ✅ WIE ES FUNKTIONIERT

### Automatischer Workflow:

1. **Du änderst Code** in Emergent
2. **"Save to GitHub"** klicken
3. **GitHub Actions** startet automatisch:
   - ✅ Code auf VPS pullen
   - ✅ Dependencies installieren
   - ✅ Frontend bauen
   - ✅ Services neu starten
4. **Fertig!** bidblitz.ae ist aktualisiert 🎉

### Zeit: ~2-3 Minuten

---

## 🎯 ALTERNATIVE: WEBHOOK (Einfacher)

Falls GitHub Actions zu komplex ist:

### 1. Webhook Script auf VPS erstellen

```bash
# Auf bidblitz.ae
sudo nano /root/deploy_webhook.sh
```

Inhalt:

```bash
#!/bin/bash
cd /var/www/bidblitz
git pull origin main
cd backend
source venv/bin/activate
pip install -r requirements.txt
cd ../frontend
yarn install
yarn build
sudo systemctl restart bidblitz-backend
sudo nginx -s reload
echo "✅ Deployed at $(date)"
```

Ausführbar machen:
```bash
chmod +x /root/deploy_webhook.sh
```

### 2. Webhook Server einrichten

```bash
# Installiere webhook
sudo apt install webhook

# Config erstellen
sudo nano /etc/webhook.conf
```

Inhalt:
```json
[
  {
    "id": "bidblitz-deploy",
    "execute-command": "/root/deploy_webhook.sh",
    "command-working-directory": "/var/www/bidblitz",
    "response-message": "Deployment started"
  }
]
```

Starten:
```bash
webhook -hooks /etc/webhook.conf -verbose
```

### 3. In GitHub einrichten

1. Repo → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**: `http://bidblitz.ae:9000/hooks/bidblitz-deploy`
3. **Content type**: `application/json`
4. **Events**: Push events
5. Save

---

## 📊 VERGLEICH

| Methode | Komplexität | Automatisch | Sicherheit |
|---------|-------------|-------------|------------|
| **GitHub Actions** | Mittel | ✅ Ja | ⭐⭐⭐⭐⭐ |
| **Webhook** | Einfach | ✅ Ja | ⭐⭐⭐ |
| **Manuell** | Sehr einfach | ❌ Nein | ⭐⭐⭐⭐⭐ |

---

## 🆘 SCHNELLE LÖSUNG: JETZT SOFORT

Falls du GitHub nicht nutzen willst, mache ich dir ein **One-Click Deploy Script**:

```bash
# Auf deinem LOKALEN Rechner:
curl -s https://bidblitz.ae/deploy.sh | bash
```

Dieses Script:
1. ✅ Lädt neuesten Code von Emergent
2. ✅ Uploaded zu bidblitz.ae
3. ✅ Deployed automatisch
4. ✅ Testet ob alles läuft

**Soll ich das erstellen?**

---

## ❓ WELCHE OPTION MÖCHTEST DU?

**A) GitHub Actions** - Automatisch bei jedem Push (Empfohlen)  
**B) Webhook** - Einfacher, auch automatisch  
**C) One-Click Script** - Manuell aber sehr schnell  
**D) Ich mache manuell** - Du bekommst nur die Dateien

Was passt besser für dich? 🚀
