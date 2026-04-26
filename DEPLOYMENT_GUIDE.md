# 🚀 BidBlitz V2 - Live Deployment Anleitung

## Voraussetzungen
- VPS mit Ubuntu 20.04+ (bidblitz.ae)
- SSH-Zugang zum Server
- Root oder sudo Rechte

## Schritt 1: Deployment-Paket herunterladen
```bash
# Von deinem lokalen Rechner aus:
scp root@bidblitz.ae:/pfad/zur/datei/bidblitz-deploy-latest.tar.gz .
```

## Schritt 2: Auf den Server hochladen
```bash
# Lade das Paket auf deinen VPS hoch
scp bidblitz-deploy-latest.tar.gz root@bidblitz.ae:/root/
```

## Schritt 3: Auf dem Server entpacken
```bash
# SSH in deinen Server
ssh root@bidblitz.ae

# Navigiere zum Deployment-Verzeichnis
cd /var/www/bidblitz  # oder dein Deployment-Pfad

# Backup der aktuellen Version (Optional aber empfohlen)
cp -r frontend/build frontend/build.backup.$(date +%Y%m%d_%H%M%S)
cp -r backend backend.backup.$(date +%Y%m%d_%H%M%S)

# Entpacke das neue Paket
tar -xzf /root/bidblitz-deploy-latest.tar.gz -C /var/www/bidblitz/
```

## Schritt 4: Backend Dependencies aktualisieren
```bash
cd /var/www/bidblitz/backend

# Virtuelle Umgebung aktivieren (falls vorhanden)
source venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt
```

## Schritt 5: Services neu starten
```bash
# Wenn du systemd verwendest:
sudo systemctl restart bidblitz-backend
sudo systemctl restart nginx

# Wenn du supervisor verwendest:
sudo supervisorctl restart bidblitz-backend

# Nginx neu laden
sudo nginx -t && sudo nginx -s reload
```

## Schritt 6: Überprüfung
```bash
# Backend Status prüfen
curl http://localhost:8001/api/health

# Logs überprüfen
tail -f /var/log/bidblitz/backend.log  # oder dein Log-Pfad
tail -f /var/log/nginx/error.log
```

## 📋 Nginx Konfiguration (Referenz)
Stelle sicher, dass deine Nginx-Config ungefähr so aussieht:

```nginx
server {
    listen 80;
    server_name bidblitz.ae www.bidblitz.ae;

    # Frontend (React Build)
    location / {
        root /var/www/bidblitz/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Files (Uploads, Bilder)
    location /static {
        alias /var/www/bidblitz/backend/static;
    }

    location /uploads {
        alias /var/www/bidblitz/backend/uploads;
    }
}
```

## 🔒 SSL (Optional aber empfohlen)
```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx

# SSL-Zertifikat generieren
sudo certbot --nginx -d bidblitz.ae -d www.bidblitz.ae
```

## ✅ Neue Features in diesem Deployment
- ✅ Admin Panel Navigation Fix (Produkte, Auktionen, etc.)
- ✅ AI Chatbot, Content Generator, Smart Recommendations
- ✅ 30 neue Auktionsartikel mit Auto-Restart & Bot-System
- ✅ AI-Übersetzungen (DE, EN, SQ, TR)
- ✅ Light Mode für alle Karten (CartoDB Voyager)
- ✅ KYC Modal Z-Index Fix
- ✅ Spin Wheel History
- ✅ BidBlitz Kids Premium (11 neue Features)
- ✅ Instant Credit (0% Zinsen, 100 EUR in 3 Minuten)
- ✅ Mobility Modul (Taxi, Scooter, Supercharger)

## 🆘 Troubleshooting
**Problem: Backend startet nicht**
```bash
# Logs prüfen
journalctl -u bidblitz-backend -n 50

# Port prüfen
sudo netstat -tulpn | grep 8001
```

**Problem: Frontend zeigt 404**
```bash
# Nginx Config prüfen
sudo nginx -t

# Dateipfade prüfen
ls -la /var/www/bidblitz/frontend/build
```

**Problem: API-Calls schlagen fehl**
```bash
# CORS oder Proxy Issue - Nginx Logs prüfen
tail -f /var/log/nginx/error.log
```

## 📞 Support
Falls du Hilfe brauchst, schicke mir:
1. Die Backend-Logs
2. Die Nginx Error Logs
3. Einen Screenshot des Problems

---
**Letzte Aktualisierung**: April 2025
**Version**: BidBlitz V2 Super App - Production Ready
