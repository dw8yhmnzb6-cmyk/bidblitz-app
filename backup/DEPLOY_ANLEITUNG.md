# BidBlitz V2 — Deploy-Anleitung fuer IONOS Server

## Voraussetzungen auf dem Server
```bash
# 1. System updaten
sudo apt update && sudo apt upgrade -y

# 2. Docker & Docker Compose installieren
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker && sudo systemctl start docker

# 3. Node.js 18+ installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Python 3.10+ installieren
sudo apt install -y python3 python3-pip python3-venv

# 5. MongoDB installieren
# Option A: Docker (empfohlen)
docker run -d --name mongodb -p 27017:27017 --restart always mongo:7

# Option B: Native
# https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
```

## Code auf Server bringen
```bash
# Option 1: Via Github (empfohlen — nutze "Save to Github" im Chat)
git clone https://github.com/DEIN_REPO/bidblitz-v2.git
cd bidblitz-v2

# Option 2: Via SCP vom lokalen Rechner
# scp -r ./bidblitz-v2 root@212.227.20.190:/root/bidblitz-v2
```

## Backend Setup
```bash
cd /root/bidblitz-v2/backend

# Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt

# .env Datei anpassen
cp .env .env.backup
nano .env
# Aendere folgende Werte:
# MONGO_URL="mongodb://localhost:27017"
# DB_NAME="bidblitz"
# Alle API-Keys (Mapbox, Stripe, etc.) eintragen

# Server starten (fuer Test)
uvicorn server:app --host 0.0.0.0 --port 8001

# Fuer Produktion: mit systemd oder pm2
```

## Frontend Setup
```bash
cd /root/bidblitz-v2/frontend

# Dependencies installieren
yarn install

# .env anpassen
nano .env
# REACT_APP_BACKEND_URL=http://212.227.20.190
# oder mit Domain: REACT_APP_BACKEND_URL=https://deine-domain.de

# Build erstellen
yarn build

# Build-Dateien servieren (via Nginx)
sudo cp -r build/* /var/www/html/
```

## Nginx Konfiguration
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/bidblitz
```

```nginx
server {
    listen 80;
    server_name 212.227.20.190;  # oder deine-domain.de

    # Frontend (React Build)
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bidblitz /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

## Datenbank importieren
```bash
# Kopiere die db_export Dateien auf den Server
# scp -r ./backup/db_export root@212.227.20.190:/root/db_export

cd /root/db_export
for f in *.json; do
    collection="${f%.json}"
    mongoimport --db bidblitz --collection "$collection" --file "$f" --jsonArray
    echo "Imported: $collection"
done
```

## Backend als Service (systemd)
```bash
sudo nano /etc/systemd/system/bidblitz-api.service
```

```ini
[Unit]
Description=BidBlitz V2 API
After=network.target mongodb.service

[Service]
User=root
WorkingDirectory=/root/bidblitz-v2/backend
Environment="PATH=/root/bidblitz-v2/backend/venv/bin"
ExecStart=/root/bidblitz-v2/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable bidblitz-api
sudo systemctl start bidblitz-api
sudo systemctl status bidblitz-api
```

## SSL (HTTPS) mit Let's Encrypt
```bash
# Nur wenn du eine Domain hast
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de
```

## Firewall
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

## Fertig!
Deine App laeuft dann auf:
- http://212.227.20.190 (Frontend)
- http://212.227.20.190/api/docs (API Dokumentation)
