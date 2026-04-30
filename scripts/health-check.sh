#!/bin/bash

###############################################################################
# System Health Check & Monitoring
# Run: bash /var/www/bidblitz/scripts/health-check.sh
###############################################################################

echo "🏥 BidBlitz Health Check"
echo "========================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Check if containers are running
echo -e "\n📦 Container Status:"
CONTAINERS=(bidblitz-mongodb bidblitz-backend bidblitz-frontend bidblitz-nginx)

for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo -e "${GREEN}✅ $container: Running${NC}"
    else
        echo -e "${RED}❌ $container: Not running${NC}"
        ((ERRORS++))
    fi
done

# Check disk space
echo -e "\n💾 Disk Space:"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo -e "${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
else
    echo -e "${YELLOW}⚠️  Disk usage: ${DISK_USAGE}% (Warning: >80%)${NC}"
fi

# Check memory
echo -e "\n🧠 Memory:"
MEMORY_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ $MEMORY_USAGE -lt 90 ]; then
    echo -e "${GREEN}✅ Memory usage: ${MEMORY_USAGE}%${NC}"
else
    echo -e "${YELLOW}⚠️  Memory usage: ${MEMORY_USAGE}% (Warning: >90%)${NC}"
fi

# Check SSL certificate expiry
echo -e "\n🔒 SSL Certificate:"
if [ -f "/etc/letsencrypt/live/bidblitz.ae/cert.pem" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/bidblitz.ae/cert.pem | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -gt 30 ]; then
        echo -e "${GREEN}✅ SSL expires in $DAYS_LEFT days${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL expires in $DAYS_LEFT days (Renew soon!)${NC}"
    fi
else
    echo -e "${RED}❌ SSL certificate not found${NC}"
    ((ERRORS++))
fi

# Check API health
echo -e "\n🌐 API Health:"
if curl -f -s https://bidblitz.ae/health > /dev/null; then
    echo -e "${GREEN}✅ API responding${NC}"
else
    echo -e "${RED}❌ API not responding${NC}"
    ((ERRORS++))
fi

# Check MongoDB connection
echo -e "\n🗄️  Database:"
if docker-compose exec -T mongodb mongosh --quiet --eval "db.runCommand('ping').ok" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB responding${NC}"
else
    echo -e "${RED}❌ MongoDB not responding${NC}"
    ((ERRORS++))
fi

# Summary
echo -e "\n========================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All systems operational${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS issue(s)${NC}"
    exit 1
fi
