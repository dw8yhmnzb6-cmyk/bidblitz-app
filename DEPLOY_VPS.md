# BidBlitz V2 — Frontend Deploy zu IONOS VPS

## Quick Deploy (SSH/Termius)

```bash
# 1) SSH zum VPS
ssh root@212.227.20.190

# 2) Auf dem VPS: ins App-Verzeichnis und Code ziehen
cd /var/www/bidblitz
git pull origin main

# 3) Frontend bauen
cd frontend
yarn install --frozen-lockfile
REACT_APP_BACKEND_URL=https://bidblitz.de yarn build

# 4) Build zu Nginx kopieren (Pfad ggf. anpassen)
sudo rm -rf /var/www/html/*
sudo cp -r build/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/

# 5) Nginx neu laden
sudo systemctl reload nginx

# 6) Health Check
curl -I https://bidblitz.de
curl -s https://bidblitz.de/api/osm/categories | head -c 200
```

## Wenn Code lokal liegt (ohne git pull)

```bash
# Auf Emergent-Container
cd /app/frontend
yarn build
tar -czf /tmp/bidblitz-frontend.tar.gz -C build .

# Upload via SCP
scp /tmp/bidblitz-frontend.tar.gz root@212.227.20.190:/tmp/

# Auf VPS:
ssh root@212.227.20.190 << 'EOF'
sudo rm -rf /var/www/html/*
sudo tar -xzf /tmp/bidblitz-frontend.tar.gz -C /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
sudo systemctl reload nginx
echo "Deploy fertig"
EOF
```

## Backend Update (optional)

```bash
# Auf VPS, falls Backend-Änderungen vorhanden
cd /var/www/bidblitz/backend
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart bidblitz-backend
sudo systemctl status bidblitz-backend
```

## Verify nach Deploy

```bash
# Test einer der neuen Endpoints
curl -s https://bidblitz.de/api/pos/registers/create -X POST | head -c 100
# Sollte 401/403 zurückgeben (Auth required) — Endpoint ist live ✅

# OSM live data
curl -s "https://bidblitz.de/api/osm/places?lat=52.52&lng=13.405&radius_m=500&category=food&limit=3" | head -c 300
```
