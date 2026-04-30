# 🚀 BidBlitz Production Checklist

## Pre-Deployment

### 1. Environment Setup
- [ ] `.env` file configured with production values
- [ ] MongoDB password changed from default
- [ ] JWT_SECRET_KEY generated (random 32+ characters)
- [ ] Stripe Live API keys obtained
- [ ] Domain DNS configured (A records)
- [ ] Email configured in deploy.sh for SSL

### 2. Code Review
- [ ] All console.log() removed from production code
- [ ] Error messages don't leak sensitive info
- [ ] API rate limiting configured
- [ ] CORS origins set to production domain only

### 3. Security
- [ ] SSH key authentication (no password login)
- [ ] Firewall configured (ports 22, 80, 443 only)
- [ ] MongoDB not exposed to public internet
- [ ] Strong passwords everywhere (20+ characters)
- [ ] .env files not in git repository

---

## Deployment Day

### 1. VPS Setup
- [ ] Hetzner VPS ordered (CPX11 or higher)
- [ ] SSH access working
- [ ] System updated (`apt-get update && apt-get upgrade`)

### 2. Deploy Application
- [ ] Code pushed to GitHub
- [ ] `deploy.sh` executed successfully
- [ ] SSL certificate obtained (green lock in browser)
- [ ] All Docker containers running
- [ ] Health check passing (`curl https://bidblitz.ae/health`)

### 3. Testing
- [ ] Homepage loads correctly
- [ ] User registration works
- [ ] User login works
- [ ] Taxi booking flow complete
- [ ] Food ordering flow complete
- [ ] Payment processing works (test transaction)
- [ ] Admin dashboard accessible
- [ ] Mobile responsive design verified

---

## Post-Deployment

### 1. Monitoring Setup
- [ ] UptimeRobot configured (https://bidblitz.ae/health)
- [ ] Email alerts configured
- [ ] Backup cron job scheduled
- [ ] Health check cron job scheduled

### 2. Performance
- [ ] Swap enabled (if 2GB RAM)
- [ ] Cloudflare CDN configured
- [ ] Images optimized (WebP format)
- [ ] Gzip compression enabled (already in nginx)

### 3. Documentation
- [ ] Admin credentials stored securely
- [ ] API keys documented (not in code!)
- [ ] Backup procedure documented
- [ ] Emergency contacts defined

---

## Week 1 Operations

### Daily Tasks
- [ ] Check health status (`bash scripts/health-check.sh`)
- [ ] Review error logs (`docker-compose logs | grep ERROR`)
- [ ] Monitor disk space (`df -h`)
- [ ] Check SSL expiry (`openssl x509 -enddate -noout -in nginx/ssl/fullchain.pem`)

### Weekly Tasks
- [ ] Full backup (`bash scripts/backup.sh`)
- [ ] Review analytics (user growth, revenue)
- [ ] Update dependencies if needed
- [ ] Performance review (`docker stats`)

---

## Emergency Procedures

### Site Down
```bash
# 1. Check container status
docker-compose ps

# 2. Check logs
docker-compose logs --tail=100

# 3. Restart services
docker-compose restart

# 4. If still down, full rebuild
docker-compose down
docker-compose up -d --build
```

### Database Corruption
```bash
# 1. Stop services
docker-compose down

# 2. Restore from backup
tar -xzf backups/bidblitz_backup_LATEST.tar.gz
docker-compose up -d mongodb
# Wait for MongoDB to start
docker-compose exec -T mongodb mongorestore --drop /backups/...

# 3. Restart all services
docker-compose up -d
```

### SSL Certificate Expired
```bash
# 1. Renew certificate
certbot renew --force-renewal

# 2. Copy new certificate
cp /etc/letsencrypt/live/bidblitz.ae/fullchain.pem /var/www/bidblitz/nginx/ssl/
cp /etc/letsencrypt/live/bidblitz.ae/privkey.pem /var/www/bidblitz/nginx/ssl/

# 3. Restart nginx
docker-compose restart nginx
```

---

## Scaling Triggers

### When to Upgrade VPS

**CPX11 → CPX21 (€4.51 → €9.18)**
- Memory usage consistently >85%
- Response time >2 seconds
- 500-1000 concurrent users

**CPX21 → CPX31 (€9.18 → €18.71)**
- Memory usage consistently >90%
- CPU usage >80%
- 1000-2000 concurrent users

**CPX31 → Multiple Servers**
- 2000+ concurrent users
- Need redundancy
- Load balancer required

---

## Cost Optimization

### Monthly Review
- [ ] Check Hetzner bill (should be ~€5)
- [ ] Review data transfer (included: 20TB)
- [ ] Optimize database size (archive old data)
- [ ] Review and delete old backups (keep last 30 days)
- [ ] Check for unused Docker images (`docker system df`)

### Revenue Tracking
- [ ] Total revenue this month: €_____
- [ ] Hosting cost: €_____
- [ ] Net profit: €_____
- [ ] Break-even achieved: YES / NO

---

## Success Metrics

### Week 1 Goals
- [ ] 10+ registered users
- [ ] 5+ completed transactions
- [ ] 0 critical errors
- [ ] 99%+ uptime

### Month 1 Goals
- [ ] 100+ registered users
- [ ] 50+ completed transactions
- [ ] €100+ revenue
- [ ] Break-even achieved

### Month 3 Goals
- [ ] 500+ registered users
- [ ] 200+ transactions
- [ ] €500+ revenue
- [ ] Ready to scale

---

## ✅ Final Check Before Going Live

**Critical:**
- [ ] SSL certificate working (green lock)
- [ ] Payment processing tested with real transaction
- [ ] Backup system working
- [ ] Monitoring configured
- [ ] All .env secrets changed from defaults
- [ ] Admin access secured

**Important:**
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Contact/support page
- [ ] Social media links
- [ ] Analytics tracking (optional)

**Nice to have:**
- [ ] Blog/news section
- [ ] FAQ page
- [ ] Mobile apps (iOS/Android)
- [ ] Email marketing setup

---

## 🎉 Launch Day!

When everything is checked:

1. **Announce on social media**
2. **Send to early testers**
3. **Monitor closely for 24 hours**
4. **Respond to user feedback quickly**
5. **Celebrate your launch! 🎊**

---

**Remember:** Done is better than perfect. 
Launch, learn, iterate! 🚀
