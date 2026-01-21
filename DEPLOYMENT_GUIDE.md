# 🚀 BidBlitz Deployment Guide - Eigener Server

## Voraussetzungen

### Server-Anforderungen:
- **OS:** Ubuntu 22.04 LTS (empfohlen)
- **RAM:** Mindestens 2 GB
- **CPU:** 2 vCPUs
- **Speicher:** 20 GB SSD
- **Anbieter:** Hetzner, DigitalOcean, AWS, Contabo, etc.

### Domain:
- Eine Domain (z.B. `bidblitz.ae`)
- Zugang zu DNS-Einstellungen

---

## Schritt 1: Server vorbereiten

```bash
# Als root einloggen
ssh root@IHRE_SERVER_IP

# System aktualisieren
apt update && apt upgrade -y

# Benötigte Pakete installieren
apt install -y curl git nginx certbot python3-certbot-nginx nodejs npm python3 python3-pip python3-venv

# Node.js 18 installieren (falls ältere Version)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# MongoDB installieren
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org

# MongoDB starten
systemctl start mongod
systemctl enable mongod
```

---

## Schritt 2: Code herunterladen

```bash
# Projektverzeichnis erstellen
mkdir -p /var/www/bidblitz
cd /var/www/bidblitz

# Code von GitHub klonen (nachdem Sie es exportiert haben)
git clone https://github.com/IHR-USERNAME/bidblitz.git .

# ODER: Dateien manuell hochladen via SFTP/SCP
```

---

## Schritt 3: Backend einrichten

```bash
cd /var/www/bidblitz/backend

# Python Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate

# Dependencies installieren
pip install --upgrade pip
pip install -r requirements.txt

# Environment-Datei erstellen
cat > .env << 'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="bidblitz_production"
CORS_ORIGINS="https://bidblitz.ae,https://www.bidblitz.ae"
JWT_SECRET="IHR_GEHEIMER_SCHLUESSEL_HIER_AENDERN_123456789"
STRIPE_API_KEY="sk_live_IHRE_STRIPE_KEY"
STRIPE_WEBHOOK_SECRET="whsec_IHRE_WEBHOOK_SECRET"
COINBASE_COMMERCE_API_KEY="IHRE_COINBASE_KEY"
RESEND_API_KEY="re_IHRE_RESEND_KEY"
VAPID_PUBLIC_KEY_PATH=/var/www/bidblitz/backend/vapid_public.pem
VAPID_PRIVATE_KEY_PATH=/var/www/bidblitz/backend/vapid_private.pem
VAPID_CLAIMS_EMAIL=mailto:support@bidblitz.ae
EOF

# VAPID Keys generieren (für Push-Benachrichtigungen)
openssl ecparam -genkey -name prime256v1 -out vapid_private.pem
openssl ec -in vapid_private.pem -pubout -out vapid_public.pem
```

---

## Schritt 4: Frontend einrichten

```bash
cd /var/www/bidblitz/frontend

# Dependencies installieren
npm install

# Environment-Datei erstellen
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://bidblitz.ae
EOF

# Production Build erstellen
npm run build
```

---

## Schritt 5: Systemd Services erstellen

### Backend Service:
```bash
cat > /etc/systemd/system/bidblitz-backend.service << 'EOF'
[Unit]
Description=BidBlitz Backend API
After=network.target mongod.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/bidblitz/backend
Environment=PATH=/var/www/bidblitz/backend/venv/bin
ExecStart=/var/www/bidblitz/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

### Services aktivieren:
```bash
# Berechtigungen setzen
chown -R www-data:www-data /var/www/bidblitz

# Services starten
systemctl daemon-reload
systemctl enable bidblitz-backend
systemctl start bidblitz-backend

# Status prüfen
systemctl status bidblitz-backend
```

---

## Schritt 6: Nginx konfigurieren

```bash
cat > /etc/nginx/sites-available/bidblitz << 'EOF'
server {
    listen 80;
    server_name bidblitz.ae www.bidblitz.ae;

    # Frontend (React Build)
    location / {
        root /var/www/bidblitz/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket für Live-Updates
    location /ws {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
EOF

# Aktivieren
ln -s /etc/nginx/sites-available/bidblitz /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Nginx testen und neustarten
nginx -t
systemctl restart nginx
```

---

## Schritt 7: SSL-Zertifikat (HTTPS)

```bash
# Certbot für SSL
certbot --nginx -d bidblitz.ae -d www.bidblitz.ae

# Automatische Erneuerung testen
certbot renew --dry-run
```

---

## Schritt 8: DNS konfigurieren

Bei Ihrem Domain-Anbieter (z.B. Namecheap, GoDaddy, Cloudflare):

| Typ | Name | Wert | TTL |
|-----|------|------|-----|
| A | @ | IHRE_SERVER_IP | 3600 |
| A | www | IHRE_SERVER_IP | 3600 |

---

## Schritt 9: Firewall einrichten

```bash
# UFW Firewall
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw enable
```

---

## Schritt 10: Testdaten erstellen

```bash
cd /var/www/bidblitz/backend
source venv/bin/activate

# Admin-Benutzer erstellen
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['bidblitz_production']
    
    admin = {
        "id": str(uuid.uuid4()),
        "email": "admin@bidblitz.ae",
        "name": "Administrator",
        "password": pwd_context.hash("IhrSicheresPasswort123!"),
        "role": "admin",
        "is_vip": True,
        "bids_balance": 10000,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin)
    print("✅ Admin erstellt: admin@bidblitz.ae")

asyncio.run(create_admin())
EOF
```

---

## Wartung & Updates

### Logs anzeigen:
```bash
# Backend Logs
journalctl -u bidblitz-backend -f

# Nginx Logs
tail -f /var/log/nginx/error.log
```

### Backend neustarten:
```bash
systemctl restart bidblitz-backend
```

### Code aktualisieren:
```bash
cd /var/www/bidblitz
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart bidblitz-backend

# Frontend
cd ../frontend
npm install
npm run build
```

---

## Wichtige Sicherheitshinweise

1. **JWT_SECRET ändern** - Generieren Sie einen sicheren Schlüssel
2. **Stripe Live-Keys** - Wechseln Sie von Test zu Live
3. **MongoDB sichern** - Authentifizierung aktivieren
4. **Regelmäßige Backups** - MongoDB Dumps erstellen
5. **VPN-Blocking prüfen** - In `routers/auth.py` ggf. deaktivieren

---

## Kosten-Übersicht (ca.)

| Anbieter | Server | Preis/Monat |
|----------|--------|-------------|
| Hetzner | CX21 (2 vCPU, 4GB RAM) | ~5€ |
| DigitalOcean | Basic Droplet | ~$12 |
| Contabo | VPS S | ~5€ |

**Empfehlung:** Hetzner Cloud - Günstig und Server in Deutschland/EU

---

## Support

Bei Fragen oder Problemen:
- Logs prüfen: `journalctl -u bidblitz-backend -f`
- MongoDB Status: `systemctl status mongod`
- Nginx Status: `systemctl status nginx`

Viel Erfolg mit Ihrer Penny-Auktion! 🎉
