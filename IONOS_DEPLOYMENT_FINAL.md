# 🎯 IONOS VPS + AUTOMATISCHES DEPLOYMENT

## Übersicht

```
┌──────────────────────────────────────────────────────┐
│  DEIN SETUP (Perfekt für IONOS!)                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📝 CODE in Emergent                                │
│       ↓ "Save to GitHub"                            │
│  🐙 GitHub Repository                               │
│       ↓ GitHub Actions (automatisch)                │
│  🚀 IONOS VPS (bidblitz.ae)                         │
│       • Frontend (React Build)                      │
│       • Backend (FastAPI)                           │
│       • MongoDB (BLEIBT HIER! Keine Migration!)     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## ✅ WAS BLEIBT AUF IONOS:

- ✅ **MongoDB Datenbank** (komplett unberührt)
- ✅ **Alle User-Daten** (1.376.980 EUR Balance, etc.)
- ✅ **Uploads & Dateien** (KYC-Dokumente, etc.)
- ✅ **`.env` Datei mit Secrets** (Stripe Keys, etc.)
- ✅ **Nginx Configuration**
- ✅ **SSL Zertifikate**

---

## 🚀 WAS DEPLOYED WIRD:

Nur der **CODE**:
- ✅ Frontend (React Build)
- ✅ Backend (Python Code)
- ✅ Dependencies (requirements.txt, package.json)

**KEINE Daten!**

---

## 📋 EINRICHTUNG (10 Minuten)

### Methode 1: Interaktives Script (Einfach!)

Auf deinem **lokalen Rechner**:

```bash
# 1. Download ionos_deploy_setup.sh von Emergent
# 2. Ausführen:
bash ionos_deploy_setup.sh
```

Das Script führt dich Schritt-für-Schritt durch!

### Methode 2: Manuelle Einrichtung

#### Schritt 1: SSH Key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ionos_deploy
ssh-copy-id -i ~/.ssh/ionos_deploy.pub root@bidblitz.ae
cat ~/.ssh/ionos_deploy  # Kopieren für GitHub
```

#### Schritt 2: GitHub Secrets

In deinem GitHub Repo → Settings → Secrets:

- `VPS_HOST` = `bidblitz.ae`
- `VPS_USER` = `root`
- `VPS_SSH_KEY` = *Private Key*

#### Schritt 3: Workflow Datei

Die Datei `.github/workflows/deploy-to-vps.yml` ist bereits erstellt!

Einfach "Save to GitHub" in Emergent klicken.

---

## 🎯 WORKFLOW (Ab jetzt)

### Jeden Tag, wenn du Code änderst:

```
1. ✏️  Code in Emergent ändern
2. 💾 "Save to GitHub" klicken
3. ⏱️  Warte ~3 Minuten
4. ✅ LIVE auf bidblitz.ae!
```

**Das war's!** Keine SSH-Befehle, kein SCP, kein manuelles Deployment mehr!

---

## 📊 DEPLOYMENT VERFOLGEN

Nach "Save to GitHub":

1. Gehe zu **GitHub** → Dein Repo
2. Klicke **Actions** Tab
3. Sieh den Deployment-Progress:
   - ✅ Build Frontend
   - ✅ Create Package
   - ✅ Upload to IONOS
   - ✅ Deploy & Restart
   - ✅ Health Check

Bei Erfolg: 🟢 Grünes Häkchen  
Bei Fehler: 🔴 Rotes X (+ Logs zum Debuggen)

---

## 🔒 SICHERHEIT

### Was passiert mit der Datenbank?

**NICHTS!** Die MongoDB auf IONOS wird:
- ❌ NICHT gelöscht
- ❌ NICHT überschrieben
- ❌ NICHT migriert
- ✅ Komplett unberührt gelassen

### Backup-Strategie

Bei jedem Deployment wird automatisch ein Backup erstellt:
- Backup-Ordner: `/var/www/bidblitz-backups/`
- Format: `backup_YYYYMMDD_HHMMSS-backend/frontend`

Bei Problemen: Einfach zurückkopieren!

---

## 🆘 TROUBLESHOOTING

### "GitHub Actions schlägt fehl"

**Prüfe:**
1. Sind alle 3 Secrets korrekt eingefügt?
2. Funktioniert SSH: `ssh -i ~/.ssh/ionos_deploy root@bidblitz.ae`?
3. Gibt es genug Speicher auf IONOS: `df -h`?

**Logs anschauen:**
GitHub → Actions → Klick auf failed run → Siehe Details

### "Deployment erfolgreich, aber alte Version läuft"

**Lösung:**
```bash
ssh root@bidblitz.ae
sudo systemctl restart bidblitz-backend
sudo nginx -s reload
```

### "Datenbank-Verbindung nach Deployment kaputt"

**Ursache:** `.env` Datei überschrieben?

**Lösung:**
```bash
ssh root@bidblitz.ae
cd /var/www/bidblitz/backend
nano .env
# Stelle sicher, dass MONGO_URL korrekt ist
```

---

## 💡 TIPPS

### Schneller deployen

Falls GitHub Actions zu langsam ist (3-4 Min):

**Option:** Lokales Deploy-Script nutzen (30 Sekunden!)
```bash
./local_deploy.sh  # Das Script, das ich erstellt habe
```

### Deployment nur bei bestimmten Branches

Ändere in `.github/workflows/deploy-to-vps.yml`:

```yaml
on:
  push:
    branches:
      - production  # Nur bei Push auf production-Branch
```

### Benachrichtigungen

Füge zu `.github/workflows/deploy-to-vps.yml` hinzu:

```yaml
- name: Notify via Email
  if: always()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.ionos.de
    server_port: 465
    username: ${{ secrets.EMAIL_USER }}
    password: ${{ secrets.EMAIL_PASS }}
    subject: Deployment ${{ job.status }}
    to: deine@email.com
    from: github@bidblitz.ae
    body: Deployment zu bidblitz.ae ${{ job.status }}!
```

---

## ✅ CHECKLISTE

Vor dem ersten Deployment:

- [ ] SSH Key erstellt und auf IONOS kopiert
- [ ] 3 GitHub Secrets eingetragen
- [ ] `.github/workflows/deploy-to-vps.yml` gepusht
- [ ] IONOS VPS läuft und erreichbar
- [ ] MongoDB läuft auf IONOS
- [ ] Nginx läuft auf IONOS
- [ ] Backup-Ordner existiert: `mkdir -p /var/www/bidblitz-backups`

Nach erstem Deployment:

- [ ] GitHub Actions zeigt grünes Häkchen
- [ ] bidblitz.ae lädt neue Version
- [ ] Backend antwortet: `curl https://bidblitz.ae/api/health`
- [ ] Frontend lädt korrekt
- [ ] Datenbank funktioniert (Login testen)
- [ ] Crypto Balance zeigt korrekt an

---

## 🎉 FERTIG!

Du hast jetzt:
- ✅ **1-Klick Deployment** ("Save to GitHub")
- ✅ **Automatische Backups**
- ✅ **Datenbank bleibt auf IONOS** (sicher!)
- ✅ **Deployment Logs** in GitHub
- ✅ **Schnelle Rollbacks** möglich

**Zeit pro Deployment:** ~3 Minuten (automatisch!)

---

**Fragen?**
- Schau in die GitHub Actions Logs
- Prüfe IONOS VPS Logs: `ssh root@bidblitz.ae journalctl -u bidblitz-backend -f`
- Teste Backend: `curl https://bidblitz.ae/api/wallet/balance/total`

**Viel Erfolg! 🚀**
