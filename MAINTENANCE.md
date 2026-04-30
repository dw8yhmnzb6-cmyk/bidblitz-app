# BidBlitz Maintenance Guide

## 🔄 Daily Operations

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100

# Only errors
docker-compose logs | grep ERROR
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
docker-compose restart nginx

# Full rebuild
docker-compose down
docker-compose up -d --build
```

### Update Application
```bash
cd /var/www/bidblitz
git pull origin main
docker-compose up -d --build
```

---

## 📊 Monitoring

### Resource Usage
```bash
# Container stats
docker stats

# System resources
htop

# Disk space
df -h

# Memory
free -h

# Network
nethogs
```

### Health Check
```bash
bash /var/www/bidblitz/scripts/health-check.sh
```

### Database Status
```bash
# Connect to MongoDB
docker-compose exec mongodb mongosh -u bidblitz_admin -p

# Show databases
show dbs

# Use database
use bidblitz

# Show collections
show collections

# Count documents
db.users.countDocuments()
db.rides.countDocuments()
db.food_orders.countDocuments()
```

---

## 💾 Backup & Restore

### Manual Backup
```bash
bash /var/www/bidblitz/scripts/backup.sh
```

### Automated Backup (Cron)
```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * bash /var/www/bidblitz/scripts/backup.sh
```

### Restore from Backup
```bash
cd /var/www/bidblitz/backups

# Extract backup
tar -xzf bidblitz_backup_20260430_030000.tar.gz

# Restore to MongoDB
docker-compose exec -T mongodb mongorestore \
  --username bidblitz_admin \
  --password YOUR_PASSWORD \
  --db bidblitz \
  --drop \
  /backups/bidblitz_backup_20260430_030000/bidblitz
```

---

## 🔐 Security

### Update SSL Certificate
```bash
# Renew certificate
certbot renew

# Copy to nginx
cp /etc/letsencrypt/live/bidblitz.ae/fullchain.pem /var/www/bidblitz/nginx/ssl/
cp /etc/letsencrypt/live/bidblitz.ae/privkey.pem /var/www/bidblitz/nginx/ssl/

# Restart nginx
docker-compose restart nginx
```

### Change MongoDB Password
```bash
# 1. Update .env file
nano /var/www/bidblitz/.env
# Change MONGO_PASSWORD

# 2. Update MongoDB user
docker-compose exec mongodb mongosh -u bidblitz_admin -p
db.changeUserPassword("bidblitz_admin", "NEW_PASSWORD")
exit

# 3. Restart all services
docker-compose down
docker-compose up -d
```

### View Failed Login Attempts
```bash
docker-compose logs backend | grep "login failed"
```

---

## ⚡ Performance Optimization

### Clear Logs
```bash
# Docker logs
docker system prune -a

# System logs
find /var/log -type f -name "*.log" -mtime +30 -delete

# Application logs
rm -rf /var/www/bidblitz/backend/logs/*.log
```

### Optimize MongoDB
```bash
docker-compose exec mongodb mongosh -u bidblitz_admin -p

# Rebuild indexes
db.users.reIndex()
db.rides.reIndex()
db.food_orders.reIndex()

# Compact database
db.runCommand({ compact: 'users' })
```

### Enable Swap (if not done)
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 🆘 Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs SERVICE_NAME

# Remove and recreate
docker-compose rm -f SERVICE_NAME
docker-compose up -d SERVICE_NAME
```

### Out of disk space
```bash
# Clean Docker
docker system prune -a --volumes

# Clean old backups
rm /var/www/bidblitz/backups/bidblitz_backup_*.tar.gz

# Clean logs
truncate -s 0 /var/log/nginx/*.log
```

### Database connection failed
```bash
# Check MongoDB is running
docker-compose ps mongodb

# Check credentials in .env
cat /var/www/bidblitz/.env | grep MONGO

# Restart MongoDB
docker-compose restart mongodb
```

### SSL not working
```bash
# Check certificate
ls -la /var/www/bidblitz/nginx/ssl/

# Test nginx config
docker-compose exec nginx nginx -t

# Check certificate expiry
openssl x509 -enddate -noout -in /var/www/bidblitz/nginx/ssl/fullchain.pem
```

---

## 📈 Scaling

### Upgrade to CPX21 (4GB RAM)
1. **Hetzner Console:** Server → Resize → CPX21
2. **Wait 2-3 minutes** for resize
3. **Restart:** `reboot`
4. **Verify:** `free -h`

### Add More Workers
Edit `docker-compose.yml`:
```yaml
backend:
  command: uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

Restart: `docker-compose up -d`

### Add Load Balancer (>5000 users)
1. Create second VPS
2. Install app on both
3. Add Hetzner Load Balancer
4. Point domain to Load Balancer

---

## 🔔 Monitoring & Alerts

### Setup Uptime Monitoring
Use free services:
- **UptimeRobot** (https://uptimerobot.com)
- **Pingdom** (https://www.pingdom.com)

Monitor: `https://bidblitz.ae/health`

### Email Alerts on Failure
Install mailutils:
```bash
apt-get install -y mailutils

# Test
echo "Test" | mail -s "Test from BidBlitz" your@email.com
```

Add to health check cron:
```bash
0 * * * * bash /var/www/bidblitz/scripts/health-check.sh || echo "Health check failed" | mail -s "BidBlitz Alert" your@email.com
```

---

## 💰 Cost Monitoring

### Check Data Transfer
```bash
# Total network usage
vnstat -d

# Monthly usage
vnstat -m
```

### Optimize Costs
- **Images:** Use WebP format (smaller)
- **CDN:** Cloudflare for static files (free)
- **Database:** Archive old orders (>6 months)
- **Logs:** Rotate and compress

---

## 📞 Support Checklist

When asking for help, provide:
```bash
# System info
uname -a
docker --version
docker-compose --version

# Container status
docker-compose ps

# Recent logs
docker-compose logs --tail=50 backend

# Health check
bash /var/www/bidblitz/scripts/health-check.sh
```
