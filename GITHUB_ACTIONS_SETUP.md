# 🚨 WICHTIG: GitHub Actions Setup für bidblitz.ae

## Status: GitHub Actions Workflow erstellt! ✅

Die Datei `.github/workflows/deploy-to-vps.yml` ist bereit!

---

## 📋 SETUP (Einmalig - 5 Minuten)

### Schritt 1: SSH Key für GitHub Actions erstellen

Auf deinem **lokalen Rechner**:

```bash
# SSH Key generieren
ssh-keygen -t ed25519 -C "github-actions@bidblitz.ae" -f ~/.ssh/github_deploy_bidblitz

# Public Key auf VPS kopieren
ssh-copy-id -i ~/.ssh/github_deploy_bidblitz.pub root@bidblitz.ae

# Private Key anzeigen (für GitHub Secrets)
cat ~/.ssh/github_deploy_bidblitz
```

Kopiere den **KOMPLETTEN** Private Key (inkl. `-----BEGIN` und `-----END` Zeilen)!

### Schritt 2: GitHub Secrets einrichten

1. Gehe zu deinem GitHub Repo (wo du gerade gepusht hast)
2. Klicke: **Settings** → **Secrets and variables** → **Actions**
3. Klicke: **"New repository secret"**

Füge diese 3 Secrets hinzu:

| Name | Value |
|------|-------|
| `VPS_HOST` | `bidblitz.ae` |
| `VPS_USER` | `root` (oder dein User) |
| `VPS_SSH_KEY` | *Dein Private Key von oben (komplett!)* |

### Schritt 3: Workflow-Datei zu GitHub pushen

Die Datei `.github/workflows/deploy-to-vps.yml` muss im Repo sein.

**In Emergent:**
1. Klicke wieder auf **"Save to GitHub"**
2. Die Workflow-Datei wird automatisch mit gepusht
3. GitHub Actions startet automatisch!

### Schritt 4: VPS vorbereiten (falls noch nicht geschehen)

```bash
ssh root@bidblitz.ae

# Stelle sicher, dass das Verzeichnis existiert
mkdir -p /var/www/bidblitz/backend
mkdir -p /var/www/bidblitz/frontend
mkdir -p /var/www/bidblitz-backups

# Python venv (falls nicht vorhanden)
cd /var/www/bidblitz/backend
python3 -m venv venv
```

---

## 🚀 WIE ES FUNKTIONIERT (AB JETZT)

```
1. Du klickst "Save to GitHub" in Emergent
              ↓
2. Code wird zu GitHub gepusht
              ↓
3. GitHub Actions startet AUTOMATISCH
              ↓
4. Baut Frontend
              ↓
5. Uploaded auf bidblitz.ae
              ↓
6. Installiert & startet Services neu
              ↓
7. ✅ FERTIG! (in ~3-4 Minuten)
```

---

## 📊 ERSTES DEPLOYMENT (JETZT)

Da du gerade gepusht hast, aber Secrets noch nicht eingerichtet sind:

**Option A: GitHub Actions Setup machen** (siehe oben, dann auto-deploy)

**Option B: Manuell deployen** (schneller JETZT):

```bash
# 1. Lade Deployment-Paket herunter (von Emergent)
#    bidblitz-deploy-crypto-real.tar.gz

# 2. Auf deinem Rechner:
scp bidblitz-deploy-crypto-real.tar.gz root@bidblitz.ae:/tmp/

# 3. SSH zum VPS
ssh root@bidblitz.ae

# 4. Deploy
cd /var/www/bidblitz
tar -xzf /tmp/bidblitz-deploy-crypto-real.tar.gz
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart bidblitz-backend
sudo nginx -s reload

# 5. Fertig!
```

---

## ✅ NACH DEPLOYMENT TESTEN

```bash
# 1. Öffne bidblitz.ae
# 2. Hard Refresh: Strg + Shift + R
# 3. Logout + Login
# 4. Homepage prüfen:
#    - Siehst du "EUR Wallet" + "Crypto (X Coins)" Breakdown?
#    - Zeigt es die NEUE Balance mit Crypto?
```

Falls JA: ✅ Deployment erfolgreich!
Falls NEIN: ❌ Alte Version läuft noch

---

## 🆘 WENN ALTE VERSION LÄUFT

```bash
ssh root@bidblitz.ae

# Prüfe welche Version läuft
cat /var/www/bidblitz/backend/routes/crypto_wallet.py
# Falls Datei nicht existiert → Alte Version!

# Prüfe wann zuletzt deployed
ls -la /var/www/bidblitz/backend/
```

---

## 🎯 EMPFEHLUNG

**JETZT SOFORT:**
→ Mache **Option B** (Manuell deployen), um es SOFORT live zu haben

**DANACH:**
→ Richte **GitHub Actions** ein, damit es ab dann automatisch geht

---

## ❓ FRAGEN?

- **"Wie sehe ich GitHub Actions Logs?"** → Repo → Actions Tab
- **"Secrets richtig eingefügt?"** → Settings → Secrets → sollte 3 haben
- **"Deployment fehlgeschlagen?"** → Actions Tab → Klick auf failed run → siehe Logs

---

**Bereit?** Sage mir:
- **"GitHub"** → Ich helfe dir GitHub Actions einzurichten
- **"Manuell"** → Ich gebe dir genaue Befehle für sofortiges Deployment
- **"Beides"** → Jetzt manuell + dann GitHub Actions

Was möchtest du? 🚀
