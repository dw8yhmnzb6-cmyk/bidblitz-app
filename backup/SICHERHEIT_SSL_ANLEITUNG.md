# BidBlitz V2 — Sicherheitsanleitung (SSL + Server-Haertung)

## 1. SSL/TLS Zertifikat (HTTPS)

SSL verschluesselt ALLE Daten zwischen dem Nutzer und deinem Server.
Ohne SSL koennen Passwoerter und Zahlungsdaten abgefangen werden!

### Kostenlos mit Let's Encrypt:
```bash
# 1. Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# 2. Zertifikat erstellen (deine Domain muss auf den Server zeigen!)
sudo certbot --nginx -d bidblitz.ae -d www.bidblitz.ae

# 3. Auto-Renewal testen
sudo certbot renew --dry-run

# 4. Auto-Renewal Cronjob (laeuft automatisch alle 60 Tage)
echo "0 0 1 */2 * certbot renew --quiet" | sudo crontab -
```

### Nginx HTTPS-Konfiguration (wird automatisch von Certbot erstellt):
```nginx
server {
    listen 443 ssl http2;
    server_name bidblitz.ae www.bidblitz.ae;

    ssl_certificate /etc/letsencrypt/live/bidblitz.ae/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bidblitz.ae/privkey.pem;
    
    # Moderne SSL-Einstellungen
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Frontend
    root /var/www/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP -> HTTPS Redirect
server {
    listen 80;
    server_name bidblitz.ae www.bidblitz.ae;
    return 301 https://$host$request_uri;
}
```

---

## 2. Server-Haertung

### Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (fuer Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSH absichern
```bash
sudo nano /etc/ssh/sshd_config

# Aendere folgende Zeilen:
PermitRootLogin no          # Root-Login verbieten
PasswordAuthentication no   # Nur SSH-Keys erlauben
MaxAuthTries 3              # Max 3 Login-Versuche

sudo systemctl restart sshd
```

### SSH-Key erstellen (auf DEINEM Rechner, nicht auf dem Server):
```bash
ssh-keygen -t ed25519 -C "admin@bidblitz.ae"
ssh-copy-id root@212.227.20.190
# Dann erst PasswordAuthentication deaktivieren!
```

### Fail2Ban (blockiert Brute-Force-Angriffe)
```bash
sudo apt install -y fail2ban
sudo nano /etc/fail2ban/jail.local
```
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true
```
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 3. Datenbank absichern (MongoDB)

```bash
# 1. MongoDB nur lokal erreichbar machen
sudo nano /etc/mongod.conf
# Setze: bindIp: 127.0.0.1

# 2. Auth aktivieren
mongosh
> use admin
> db.createUser({user: "bidblitz_admin", pwd: "SICHERES_PASSWORT_HIER", roles: ["root"]})
> exit

# 3. In /etc/mongod.conf:
# security:
#   authorization: enabled

sudo systemctl restart mongod

# 4. .env anpassen:
# MONGO_URL="mongodb://bidblitz_admin:SICHERES_PASSWORT@localhost:27017"
```

---

## 4. Backend absichern

### Umgebungsvariablen (.env)
```bash
# NIEMALS .env Dateien in Git committen!
echo ".env" >> .gitignore

# Sichere Werte setzen:
SECRET_KEY="$(openssl rand -hex 32)"   # Zufaelliger Secret Key
CORS_ORIGINS="https://bidblitz.ae"      # Nur deine Domain
DEBUG=false                              # Debug AUS in Produktion
```

### Rate Limiting (bereits im Code aktiv)
- Login: Max 5 Versuche, dann 15 Min gesperrt
- API: Rate Limits auf allen Endpoints

---

## 5. Taegliche Backups

```bash
# Backup-Script erstellen
sudo nano /root/backup.sh
```
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# MongoDB Backup
mongodump --out $BACKUP_DIR/mongo_$DATE

# Code Backup
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /root/bidblitz-v2

# Alte Backups loeschen (aelter als 30 Tage)
find $BACKUP_DIR -mtime +30 -delete

echo "Backup fertig: $DATE"
```
```bash
chmod +x /root/backup.sh

# Taeglich um 3:00 Uhr
echo "0 3 * * * /root/backup.sh" | sudo crontab -
```

---

## 6. Monitoring

```bash
# Server-Status pruefen
sudo apt install -y htop

# Disk-Space Warnung
df -h

# Logs pruefen
journalctl -u bidblitz-api -f   # Backend Logs live
tail -f /var/log/nginx/error.log # Nginx Errors
```

---

## Checkliste vor Go-Live:
- [ ] SSL Zertifikat aktiv (https://bidblitz.ae)
- [ ] HTTP -> HTTPS Redirect aktiv
- [ ] Firewall (UFW) aktiv
- [ ] MongoDB nur lokal erreichbar + Auth aktiv
- [ ] SSH Root-Login deaktiviert
- [ ] Fail2Ban installiert
- [ ] Server-Passwort geaendert (!!!)
- [ ] .env Dateien nicht in Git
- [ ] Taegl. Backups eingerichtet
- [ ] CORS nur auf bidblitz.ae beschraenkt
