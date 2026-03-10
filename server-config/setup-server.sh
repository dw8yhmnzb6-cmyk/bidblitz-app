#!/bin/bash
# BidBlitz IONOS Server Setup Script
# Run as root on the IONOS server

set -e

echo "🚀 BidBlitz Server Setup Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==================== 1. System Update ====================
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# ==================== 2. Install PostgreSQL ====================
echo -e "${YELLOW}🐘 Installing PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create BidBlitz database and user
echo -e "${YELLOW}🔧 Creating BidBlitz database...${NC}"
sudo -u postgres psql << EOF
CREATE USER bidblitz WITH PASSWORD 'BidBlitz2024SecureDB!';
CREATE DATABASE bidblitz_db OWNER bidblitz;
GRANT ALL PRIVILEGES ON DATABASE bidblitz_db TO bidblitz;
\q
EOF

echo -e "${GREEN}✅ PostgreSQL installed and configured${NC}"
echo "   Database: bidblitz_db"
echo "   User: bidblitz"
echo "   Password: BidBlitz2024SecureDB!"

# ==================== 3. Install Node.js & Yarn ====================
echo -e "${YELLOW}📦 Installing Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g yarn

# ==================== 4. Install Python & Dependencies ====================
echo -e "${YELLOW}🐍 Installing Python 3.11...${NC}"
apt install -y python3.11 python3.11-venv python3-pip

# ==================== 5. Install Nginx ====================
echo -e "${YELLOW}🌐 Installing Nginx...${NC}"
apt install -y nginx

# ==================== 6. Setup SSL with Certbot ====================
echo -e "${YELLOW}🔒 Installing Certbot for SSL...${NC}"
apt install -y certbot python3-certbot-nginx

# ==================== 7. Create Log Directory ====================
mkdir -p /var/log/bidblitz
chmod 755 /var/log/bidblitz

# ==================== 8. Setup BidBlitz Directory ====================
echo -e "${YELLOW}📁 Setting up BidBlitz directory...${NC}"
mkdir -p /var/www/bidblitz
cd /var/www/bidblitz

# Clone if not exists
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/YOUR_REPO/bidblitz.git .
fi

# ==================== 9. Setup Backend ====================
echo -e "${YELLOW}⚙️ Setting up Backend...${NC}"
cd /var/www/bidblitz/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Add PostgreSQL connection to .env
echo "" >> .env
echo "# PostgreSQL Database" >> .env
echo "DATABASE_URL=postgresql://bidblitz:BidBlitz2024SecureDB!@localhost:5432/bidblitz_db" >> .env

deactivate

# ==================== 10. Setup Frontend ====================
echo -e "${YELLOW}🎨 Setting up Frontend...${NC}"
cd /var/www/bidblitz/frontend
yarn install
yarn build

# ==================== 11. Configure Nginx ====================
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
cp /var/www/bidblitz/server-config/nginx.conf /etc/nginx/sites-available/bidblitz
ln -sf /etc/nginx/sites-available/bidblitz /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# ==================== 12. Setup Systemd Services ====================
echo -e "${YELLOW}🔧 Setting up Systemd services...${NC}"
cp /var/www/bidblitz/server-config/bidblitz-backend.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable bidblitz-backend
systemctl start bidblitz-backend

# ==================== 13. Start Services ====================
echo -e "${YELLOW}🚀 Starting services...${NC}"
systemctl restart nginx
systemctl restart bidblitz-backend

# ==================== 14. Setup SSL ====================
echo -e "${YELLOW}🔒 Setting up SSL certificate...${NC}"
certbot --nginx -d bidblitz.ae -d www.bidblitz.ae --non-interactive --agree-tos -m admin@bidblitz.ae || echo "SSL setup may need manual intervention"

# ==================== Done ====================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ BidBlitz Server Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "PostgreSQL:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: bidblitz_db"
echo "  User: bidblitz"
echo "  Password: BidBlitz2024SecureDB!"
echo ""
echo "Services:"
echo "  Backend: systemctl status bidblitz-backend"
echo "  Nginx: systemctl status nginx"
echo ""
echo "Logs:"
echo "  Backend: /var/log/bidblitz/backend.log"
echo "  Nginx: /var/log/nginx/access.log"
echo ""
