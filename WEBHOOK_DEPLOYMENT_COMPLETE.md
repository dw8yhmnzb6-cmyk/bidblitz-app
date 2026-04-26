# 🎯 WEBHOOK DEPLOYMENT - KOMPLETTE ANLEITUNG

## Übersicht

Mit diesem Setup kannst du mit **EINEM BEFEHL** von deinem Rechner aus auf bidblitz.ae deployen!

```
┌──────────────┐    SSH/SCP    ┌──────────────┐    Execute    ┌─────────┐
│ DEIN RECHNER │ ───────────>  │  DEIN VPS    │ ──────────>  │ DEPLOY  │
│  (lokal)     │  Upload Code  │ bidblitz.ae  │   Script     │ FERTIG! │
└──────────────┘               └──────────────┘              └─────────┘
```

**Zeit:** ~2-3 Minuten pro Deployment

---

## 🛠️ EINRICHTUNG (Einmalig - 5 Minuten)

### Schritt 1: SSH Key einrichten (für passwortloses Login)

Auf deinem **lokalen Rechner**:

```bash
# SSH Key generieren (falls noch nicht vorhanden)
ssh-keygen -t ed25519 -f ~/.ssh/bidblitz

# Public Key auf VPS kopieren
ssh-copy-id -i ~/.ssh/bidblitz.pub root@bidblitz.ae

# Teste die Verbindung
ssh -i ~/.ssh/bidblitz root@bidblitz.ae "echo 'SSH OK!'"
```

**✅ Wenn "SSH OK!" erscheint, funktioniert es!**

### Schritt 2: SSH Config erstellen (Optional aber praktisch)

```bash
# Auf deinem lokalen Rechner:
nano ~/.ssh/config
```

Füge hinzu:

```
Host bidblitz
    HostName bidblitz.ae
    User root
    IdentityFile ~/.ssh/bidblitz
    Port 22
```

Jetzt kannst du einfach `ssh bidblitz` nutzen!

### Schritt 3: Dateien von Emergent herunterladen

Lade diese 4 Dateien herunter:

1. ✅ `bidblitz-deploy-crypto-real.tar.gz` (31 MB) - Der Code
2. ✅ `local_deploy.sh` - Lokales Deploy-Script  
3. ✅ `vps_deploy.sh` - VPS Deploy-Script
4. ✅ `setup_crypto_data_vps.sh` - Daten-Setup-Script

Speichere sie in einem Ordner, z.B. `~/bidblitz-deploy/`

---

## 🚀 DEPLOYMENT AUSFÜHREN

### Variante A: Automatisches Script (Empfohlen)

Auf deinem **lokalen Rechner**:

```bash
cd ~/bidblitz-deploy/

# Mache Scripts ausführbar
chmod +x local_deploy.sh vps_deploy.sh setup_crypto_data_vps.sh

# DEPLOYMENT STARTEN (alles automatisch!)
./local_deploy.sh
```

**Das war's!** Das Script macht:
1. ✅ Uploaded Code auf VPS
2. ✅ Macht Backup
3. ✅ Installiert neuen Code
4. ✅ Startet Services neu
5. ✅ Macht Health Check

### Variante B: Manuelle Schritte

Falls das Script nicht funktioniert:

```bash
# 1. Upload Code
scp bidblitz-deploy-crypto-real.tar.gz root@bidblitz.ae:/tmp/

# 2. Upload Deploy-Script
scp vps_deploy.sh root@bidblitz.ae:/root/deploy.sh

# 3. SSH zum VPS
ssh root@bidblitz.ae

# 4. Deploy ausführen
chmod +x /root/deploy.sh
/root/deploy.sh

# 5. Fertig!
exit
```

---

## 🎯 WEBHOOK-SERVER EINRICHTEN (Optional - für HTTP-Trigger)

Falls du per HTTP-Request deployen willst:

### 1. Webhook Tool installieren (auf VPS)

```bash
ssh root@bidblitz.ae

# Installiere webhook
sudo apt update
sudo apt install -y webhook

# Erstelle Webhook-Config
sudo mkdir -p /etc/webhook
```

### 2. Webhook Config hochladen

Von deinem **lokalen Rechner**:

```bash
scp webhook.json root@bidblitz.ae:/etc/webhook/hooks.json
scp vps_deploy.sh root@bidblitz.ae:/root/deploy.sh
ssh root@bidblitz.ae "chmod +x /root/deploy.sh"
```

### 3. Webhook Server starten (auf VPS)

```bash
ssh root@bidblitz.ae

# Webhook Server starten
webhook -hooks /etc/webhook/hooks.json -port 9000 -verbose &

# Als Service einrichten (optional)
sudo nano /etc/systemd/system/webhook.service
```

Inhalt:

```ini
[Unit]
Description=Webhook Server for BidBlitz
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/webhook -hooks /etc/webhook/hooks.json -port 9000 -verbose
Restart=always

[Install]
WantedBy=multi-user.target
```

Aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable webhook
sudo systemctl start webhook
sudo systemctl status webhook
```

### 4. Deployment via HTTP-Request triggern

Von deinem **lokalen Rechner** oder **überall**:

```bash
# Upload Code zuerst
scp bidblitz-deploy-crypto-real.tar.gz root@bidblitz.ae:/tmp/

# Trigger Deployment via HTTP
curl -X POST http://bidblitz.ae:9000/hooks/bidblitz-deploy \
  -H "Content-Type: application/json" \
  -d '{"action": "deploy"}'
```

**✅ Deployment startet automatisch!**

---

## 📊 VERGLEICH DER METHODEN

| Methode | Schritte | Zeit | Automatisch |
|---------|----------|------|-------------|
| **local_deploy.sh** | 1 Befehl | ~2 Min | ✅ Ja |
| **Manuelle SSH** | 5 Befehle | ~5 Min | ❌ Nein |
| **HTTP Webhook** | 2 Befehle | ~1 Min | ✅ Ja |

**Empfohlen:** `local_deploy.sh` für tägliches Deployment

---

## 🔄 WORKFLOW FÜR ZUKÜNFTIGE DEPLOYMENTS

### Jedes Mal wenn du Code änderst:

```bash
# 1. In Emergent: Code fertig entwickeln
# 2. Download neues Deployment-Paket
# 3. Auf deinem Rechner:
cd ~/bidblitz-deploy/
./local_deploy.sh

# Fertig! 🎉
```

**Zeit:** ~2 Minuten

---

## 🆘 TROUBLESHOOTING

### Problem: "Permission denied (publickey)"

**Lösung:**
```bash
ssh-copy-id -i ~/.ssh/bidblitz.pub root@bidblitz.ae
```

### Problem: "Deployment-Paket nicht gefunden"

**Lösung:**
```bash
# Stelle sicher, dass du im richtigen Ordner bist
ls -la bidblitz-deploy-crypto-real.tar.gz

# Falls nicht vorhanden, lade es von Emergent herunter
```

### Problem: "Backend startet nicht"

**Lösung:**
```bash
ssh root@bidblitz.ae

# Logs prüfen
tail -f /var/log/bidblitz-deployments.log

# Backend manuell starten
cd /var/www/bidblitz/backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001
```

### Problem: "Nginx 502 Bad Gateway"

**Lösung:**
```bash
ssh root@bidblitz.ae

# Prüfe ob Backend läuft
systemctl status bidblitz-backend

# Prüfe Nginx Config
nginx -t

# Restart beide
systemctl restart bidblitz-backend
nginx -s reload
```

---

## ✅ DATEN SETUP (Einmalig)

Nach dem ERSTEN Deployment, erstelle Crypto-Daten:

```bash
ssh root@bidblitz.ae
cd /root
chmod +x setup_crypto_data_vps.sh
./setup_crypto_data_vps.sh

# Oder für anderen User:
USER_EMAIL="deine@email.com" ./setup_crypto_data_vps.sh
```

---

## 🎉 FERTIG!

Du hast jetzt:
- ✅ **One-Command-Deployment** via `local_deploy.sh`
- ✅ **Automatische Backups** bei jedem Deployment
- ✅ **Health Checks** nach jedem Deployment
- ✅ **Deployment-Logs** in `/var/log/bidblitz-deployments.log`

**Nächstes Deployment:**
```bash
./local_deploy.sh
```

**Das war's!** 🚀
