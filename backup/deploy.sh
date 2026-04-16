#!/bin/bash
# BidBlitz V2 - Automatisches Deploy & Setup Script
# Ausfuehren auf dem IONOS Server: bash deploy.sh

set -e
echo "=== BidBlitz V2 Deploy ==="

# 1. System updaten
echo "[1/8] System updaten..."
sudo apt update && sudo apt upgrade -y

# 2. Dependencies installieren
echo "[2/8] Dependencies installieren..."
sudo apt install -y nginx certbot python3-certbot-nginx python3 python3-pip python3-venv nodejs npm fail2ban ufw

# 3. MongoDB installieren (falls nicht vorhanden)
echo "[3/8] MongoDB pruefen..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    sudo apt update && sudo apt install -y mongodb-org
    sudo systemctl enable mongod && sudo systemctl start mongod
fi

# 4. Backend Setup
echo "[4/8] Backend Setup..."
cd /root/bidblitz-v2/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# 5. Frontend Build
echo "[5/8] Frontend Build..."
cd /root/bidblitz-v2/frontend
npm install -g yarn 2>/dev/null || true
yarn install
yarn build
sudo rm -rf /var/www/html/*
sudo cp -r build/* /var/www/html/

# 6. Backend Service erstellen
echo "[6/8] Backend Service..."
cat > /etc/systemd/system/bidblitz-api.service << 'EOF'
[Unit]
Description=BidBlitz V2 API
After=network.target mongod.service

[Service]
User=root
WorkingDirectory=/root/bidblitz-v2/backend
Environment="PATH=/root/bidblitz-v2/backend/venv/bin"
ExecStart=/root/bidblitz-v2/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable bidblitz-api
sudo systemctl restart bidblitz-api

# 7. Firewall
echo "[7/8] Firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable

# 8. Fail2Ban
echo "[8/8] Fail2Ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

echo ""
echo "=== Deploy fertig! ==="
echo "Naechste Schritte:"
echo "  1. SSL: sudo certbot --nginx -d bidblitz.ae -d www.bidblitz.ae"
echo "  2. Admin promoten: Logge dich mit admin@bidblitz.com ein und nutze /api/admin/users/{id}/role"
echo "  3. Teste: https://bidblitz.ae"
