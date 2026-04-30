# 🚀 BidBlitz Production Deployment Guide

## Hetzner VPS Setup (€5/Monat)

### Schritt 1: VPS bestellen

1. **Gehe zu:** https://www.hetzner.com/cloud
2. **Wähle:** CPX11 (2 vCPU, 2GB RAM, 40GB SSD) - **€4.51/Monat**
3. **Location:** Falkenstein, Germany (oder Nürnberg)
4. **Image:** Ubuntu 22.04 LTS
5. **SSH Key:** Erstelle einen SSH Key (oder verwende Passwort)
6. **Firewall:**
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
7. **Klick:** "Create & Buy now"

### Schritt 2: DNS konfigurieren

1. **Gehe zu deinem Domain-Provider** (wo du bidblitz.ae gekauft hast)
2. **Füge A-Records hinzu:**
   ```
   Type: A
   Name: @
   Value: [DEINE_SERVER_IP]
   TTL: 3600

   Type: A
   Name: www
   Value: [DEINE_SERVER_IP]
   TTL: 3600
   ```
3. **Warte 5-10 Minuten** bis DNS propagiert ist

### Schritt 3: Per SSH verbinden

```bash
ssh root@DEINE_SERVER_IP
```

Beim ersten Mal: "yes" eingeben

### Schritt 4: Repository hochladen

**Option A: GitHub (Empfohlen)**
```bash
# Auf deinem PC (nicht auf dem Server!)
cd /pfad/zu/bidblitz
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN_USERNAME/bidblitz.git
git push -u origin main
```

**Option B: Direkt per SCP**
```bash
# Auf deinem PC
scp -r /app root@DEINE_SERVER_IP:/var/www/bidblitz
```

### Schritt 5: Deployment ausführen

**Auf dem Server:**
```bash
cd /var/www/bidblitz

# Deployment-Script ausführen
sudo bash deploy.sh
```

Das Script fragt dich nach:
- GitHub Repository URL (falls Option A)
- Email für SSL-Zertifikat

**Dann automatisch:**
- Installiert Docker
- Installiert Docker Compose
- Holt SSL-Zertifikat (Let's Encrypt)
- Baut Container
- Startet BidBlitz

**Dauer: ~5-10 Minuten**

### Schritt 6: .env anpassen

```bash
nano /var/www/bidblitz/.env
```

**Ändere:**
```bash
# MongoDB Passwort (stark!)
MONGO_PASSWORD=DeinStarkesPasswort123!

# JWT Secret (random string)
JWT_SECRET_KEY=abc123def456ghi789...

# Stripe Live Keys
STRIPE_API_KEY=sk_live_DEIN_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_DEIN_KEY

# Domain
REACT_APP_BACKEND_URL=https://bidblitz.ae
```

**Speichern:** CTRL+X, dann Y, dann Enter

### Schritt 7: Container neustarten

```bash
cd /var/www/bidblitz
docker-compose down
docker-compose up -d
```

### Schritt 8: Überprüfen

```bash
# Logs anschauen
docker-compose logs -f

# Service Status
docker-compose ps

# Sollte zeigen:
# backend    running
# mongodb    running
# frontend   running
# nginx      running
```

**Öffne Browser:** https://bidblitz.ae

---

## 🔧 Wartung & Management

### Logs anschauen
```bash
# Alle Logs
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend

# Nur Fehler
docker-compose logs -f | grep ERROR
```

### App aktualisieren
```bash
cd /var/www/bidblitz
git pull origin main
docker-compose up -d --build
```

### Restart
```bash
docker-compose restart

# Nur Backend
docker-compose restart backend
```

### Ressourcen-Monitoring
```bash
# Container Stats
docker stats

# System Stats
htop

# Disk Space
df -h

# Memory
free -h
```

### Backup erstellen
```bash
# MongoDB Backup
docker-compose exec mongodb mongodump \
  --username bidblitz_admin \
  --password DEIN_PASSWORT \
  --db bidblitz \
  --out /backups

# Backup herunterladen
scp -r root@DEINE_SERVER_IP:/var/www/bidblitz/backups ./backups
```

---

## 💰 Kosten-Übersicht

### Monatlich:
- **Hetzner VPS:** €4.51
- **Domain (.ae):** ~€10/Jahr = €0.83/Monat
- **SSL:** €0 (Let's Encrypt kostenlos)
- **Backups:** €0-2 (optional)

**TOTAL: ~€5-7/Monat**

### Bei Wachstum (>1000 Users):
Upgrade zu CPX21:
- **4GB RAM, 3 vCPU:** €9.18/Monat
- **Einfach:** `Hetzner Console → Resize → CPX21`

---

## 🆘 Troubleshooting

### Problem: "502 Bad Gateway"
```bash
# Backend läuft nicht
docker-compose logs backend

# Neustart
docker-compose restart backend
```

### Problem: "Connection refused"
```bash
# MongoDB läuft nicht
docker-compose logs mongodb
docker-compose restart mongodb
```

### Problem: SSL-Fehler
```bash
# Zertifikat erneuern
certbot renew
cp /etc/letsencrypt/live/bidblitz.ae/fullchain.pem /var/www/bidblitz/nginx/ssl/
cp /etc/letsencrypt/live/bidblitz.ae/privkey.pem /var/www/bidblitz/nginx/ssl/
docker-compose restart nginx
```

### Problem: Zu wenig Speicher
```bash
# Disk Space freigeben
docker system prune -a

# Alte Logs löschen
find /var/log -type f -name "*.log" -mtime +30 -delete
```

---

## 📊 Performance-Optimierung

### 1. Enable Swap (bei 2GB RAM wichtig!)
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 2. Nginx Caching aktivieren
Bereits in `nginx.conf` konfiguriert ✅

### 3. MongoDB Indexes
Bereits im Deployment-Script ✅

### 4. Frontend Static Files Compression
Bereits in Docker-Config ✅

---

## ✅ Deployment-Checkliste

- [ ] Hetzner VPS bestellt (CPX11, €4.51/Monat)
- [ ] DNS A-Records gesetzt (@ und www)
- [ ] Per SSH verbunden
- [ ] Repository auf Server
- [ ] `deploy.sh` ausgeführt
- [ ] `.env` angepasst (Passwörter, Stripe Keys)
- [ ] Container gestartet (`docker-compose up -d`)
- [ ] https://bidblitz.ae öffnet sich
- [ ] Login funktioniert
- [ ] Stripe Test-Zahlung funktioniert
- [ ] SSL-Zertifikat gültig (grünes Schloss im Browser)

---

## 🚀 Go Live!

Sobald alle Punkte ✅ sind:

1. **Stripe Live-Keys aktivieren**
2. **Test-Bestellung durchführen**
3. **Marketing starten**
4. **First User akquirieren**

**Break-Even:** 1-2 aktive User = Kosten gedeckt!

Bei Fragen: Ich helfe dir! 🎯
