#!/bin/bash

###############################################################################
# BidBlitz Production Deployment Script
# For Hetzner VPS (Ubuntu 22.04)
###############################################################################

set -e  # Exit on error

echo "🚀 BidBlitz Deployment Script"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Configuration
DOMAIN="bidblitz.ae"
EMAIL="your-email@example.com"  # Change this!
DEPLOY_DIR="/var/www/bidblitz"

echo -e "${GREEN}Step 1: System Update${NC}"
apt-get update
apt-get upgrade -y

echo -e "${GREEN}Step 2: Install Docker${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

echo -e "${GREEN}Step 3: Install Docker Compose${NC}"
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed"
fi

echo -e "${GREEN}Step 4: Install Certbot (Let's Encrypt)${NC}"
apt-get install -y certbot
echo "✅ Certbot installed"

echo -e "${GREEN}Step 5: Create deployment directory${NC}"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

echo -e "${GREEN}Step 6: Clone repository${NC}"
if [ ! -d ".git" ]; then
    read -p "Enter your GitHub repository URL: " REPO_URL
    git clone $REPO_URL .
else
    echo "Repository already cloned, pulling latest changes..."
    git pull origin main
fi

echo -e "${GREEN}Step 7: Setup environment${NC}"
if [ ! -f ".env" ]; then
    cp .env.production .env
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env file with your actual credentials!${NC}"
    echo "Run: nano .env"
    read -p "Press Enter after editing .env file..."
else
    echo "✅ .env file already exists"
fi

echo -e "${GREEN}Step 8: Create SSL directories${NC}"
mkdir -p nginx/ssl

echo -e "${GREEN}Step 9: Get SSL Certificate${NC}"
if [ ! -f "nginx/ssl/fullchain.pem" ]; then
    # Stop any running nginx
    docker-compose down || true
    
    # Get certificate
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # Copy certificates
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/
    
    echo "✅ SSL Certificate obtained"
else
    echo "✅ SSL Certificate already exists"
fi

echo -e "${GREEN}Step 10: Setup auto-renewal for SSL${NC}"
cat > /etc/cron.d/certbot-renew << EOF
0 0 * * * root certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $DEPLOY_DIR/nginx/ssl/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $DEPLOY_DIR/nginx/ssl/ && docker-compose -f $DEPLOY_DIR/docker-compose.yml restart nginx"
EOF
echo "✅ SSL auto-renewal configured"

echo -e "${GREEN}Step 11: Build and start containers${NC}"
docker-compose down || true
docker-compose build --no-cache
docker-compose up -d

echo -e "${GREEN}Step 12: Wait for services to start${NC}"
sleep 10

echo -e "${GREEN}Step 13: Check service status${NC}"
docker-compose ps

echo -e "${GREEN}Step 14: Create MongoDB indexes${NC}"
docker-compose exec -T backend python -c "
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os

async def create_indexes():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME')]
    
    # Create indexes
    await db.users.create_index('email', unique=True)
    await db.users.create_index('user_id', unique=True)
    await db.rides.create_index('ride_id', unique=True)
    await db.food_orders.create_index('order_id', unique=True)
    await db.auctions.create_index('auction_id', unique=True)
    
    print('✅ MongoDB indexes created')

asyncio.run(create_indexes())
" || echo "⚠️  Index creation skipped (may already exist)"

echo -e "${GREEN}Step 15: Setup monitoring${NC}"
# Install basic monitoring
apt-get install -y htop iotop nethogs

# Setup Docker resource limits
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker
sleep 5
docker-compose up -d

echo ""
echo "=============================="
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "=============================="
echo ""
echo "Your BidBlitz app is now running at:"
echo -e "${GREEN}🌐 https://$DOMAIN${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Restart:       docker-compose restart"
echo "  Stop:          docker-compose down"
echo "  Update:        git pull && docker-compose up -d --build"
echo ""
echo "Monitor resources:"
echo "  docker stats"
echo "  htop"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "  1. Point your domain DNS to this server IP"
echo "  2. Edit .env with production credentials"
echo "  3. Setup backups (see scripts/backup.sh)"
echo ""
