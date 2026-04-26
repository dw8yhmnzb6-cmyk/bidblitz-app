# 🚀 BidBlitz Crypto Earn - LIVE DEPLOYMENT ANLEITUNG

## ⚠️ WICHTIG: Container vs. VPS

```
┌─────────────────────────┐         ┌──────────────────────┐
│  EMERGENT CONTAINER     │         │  DEIN VPS            │
│  (wo du gerade bist)    │  ≠≠≠≠≠  │  (bidblitz.ae)       │
├─────────────────────────┤         ├──────────────────────┤
│  ✅ Neuer CODE          │         │  ❌ Alter CODE       │
│  ✅ Test-Daten (55 BTC) │         │  ❌ Keine Daten      │
│  ✅ Neue APIs           │         │  ❌ Alte APIs        │
└─────────────────────────┘         └──────────────────────┘
```

**PROBLEM:** Daten die du hier speicherst, sind NICHT auf bidblitz.ae!

**LÖSUNG:** CODE deployen + DATEN auf VPS erstellen

---

## 📦 SCHRITT 1: CODE DEPLOYMENT

### A) Dateien herunterladen von Emergent

Du brauchst 3 Dateien:
1. **`bidblitz-deploy-crypto-real.tar.gz`** (31 MB) - Der neue Code
2. **`setup_crypto_data_vps.sh`** - Script für Daten-Setup
3. **`DEPLOYMENT_GUIDE.md`** - Detaillierte Anleitung

**Wo finden:** `/app/` Ordner in Emergent

### B) Auf deinen VPS hochladen

```bash
# Auf deinem lokalen Rechner:
scp bidblitz-deploy-crypto-real.tar.gz root@bidblitz.ae:/tmp/
scp setup_crypto_data_vps.sh root@bidblitz.ae:/root/
```

### C) Code deployen

```bash
# SSH zum Server
ssh root@bidblitz.ae

# Backup erstellen (wichtig!)
cd /var/www/bidblitz
cp -r backend backend.backup.$(date +%Y%m%d)
cp -r frontend/build frontend/build.backup.$(date +%Y%m%d)

# Neuen Code entpacken
tar -xzf /tmp/bidblitz-deploy-crypto-real.tar.gz -C /var/www/bidblitz/

# Backend Dependencies installieren
cd /var/www/bidblitz/backend
source venv/bin/activate  # falls du venv nutzt
pip install -r requirements.txt

# Services neu starten
sudo systemctl restart bidblitz-backend  # oder supervisorctl
sudo nginx -s reload
```

---

## 💾 SCHRITT 2: DATEN ERSTELLEN

**Jetzt hast du den CODE, aber noch keine Crypto-Daten!**

### A) Setup-Script ausführen

```bash
# Auf bidblitz.ae VPS:
cd /root
chmod +x setup_crypto_data_vps.sh

# Script ausführen (erstellt 55 BTC für admin@bidblitz.ae)
./setup_crypto_data_vps.sh
```

### B) Für anderen User

Falls du nicht `admin@bidblitz.ae` bist:

```bash
# Mit deiner Email:
USER_EMAIL="deine@email.com" ./setup_crypto_data_vps.sh
```

### C) Manuell via MongoDB

Falls das Script nicht funktioniert:

```bash
# MongoDB öffnen
mongosh

# Wechsle zur DB
use bidblitz_production  # oder dein DB-Name

// Finde deinen User
db.users.findOne({ email: "deine@email.com" })

// Kopiere die _id (z.B. ObjectId("abc123..."))

// Erstelle Crypto Wallet
db.crypto_wallets.insertOne({
    user_id: "DEINE_USER_ID_HIER",
    coin: "BTC",
    balance: 0.0,
    locked_balance: 55.0,
    total_earned: 0.5,
    created_at: new Date().toISOString()
})

// Erstelle Crypto Earn Deposit
db.crypto_earn_deposits.insertOne({
    deposit_id: "earn_demo_55btc",
    user_id: "DEINE_USER_ID_HIER",
    user_email: "deine@email.com",
    product_id: "btc_flex",
    coin: "BTC",
    amount: 55.0,
    apy: 3.0,
    term: "Flexibel",
    lock_days: 0,
    earned: 0.5,
    status: "active",
    created_at: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
    last_interest_calc: new Date().toISOString()
})

// Beende MongoDB
exit
```

---

## ✅ SCHRITT 3: TESTEN

1. **Öffne bidblitz.ae** in deinem Browser
2. **Logout** (falls eingeloggt)
3. **Login wieder ein**
4. **Homepage prüfen**:
   - Du solltest **€4.840.000+** als Gesamtguthaben sehen
   - Breakdown zeigt: EUR Wallet + Crypto (1 Coins)

### Falls nicht sichtbar:

```bash
# Backend Logs prüfen
tail -f /var/log/bidblitz/backend.log

# Test API direkt
curl -X POST https://bidblitz.ae/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"deine@email.com","password":"deinpasswort"}'

# Mit Token testen
curl -X GET https://bidblitz.ae/api/wallet/balance/total \
  -H "Authorization: Bearer DEIN_TOKEN"
```

---

## 🎯 ZUSAMMENFASSUNG

### Was du gemacht hast:

✅ **CODE**: Neues Crypto Earn System deployed
✅ **DATEN**: 55 BTC in deiner VPS-Datenbank erstellt
✅ **APIS**: Neue `/api/wallet/balance/total` verfügbar

### Was du siehst:

🏠 **Homepage**:
```
┌────────────────────────────┐
│  EUR  4.850.000,00         │
│                            │
│  EUR Wallet     10.000,00  │
│  Crypto (1 Coins) 4.840k   │
└────────────────────────────┘
```

🪙 **Crypto Breakdown**:
- 55 BTC @ 88.000 EUR = 4.840.000 EUR
- Status: Gesperrt in Crypto Earn
- Zinsen: 3% APY (0.5 BTC bereits verdient)

---

## ❓ TROUBLESHOOTING

### Problem: "Sehe nur 10.000 EUR, keine Crypto"

**Ursache:** Frontend holt alte API oder Daten nicht in DB

**Lösung:**
```bash
# 1. Browser Cache leeren (Strg+Shift+R)
# 2. Prüfe ob neue API existiert:
curl https://bidblitz.ae/api/wallet/balance/total

# 3. Prüfe DB:
mongosh
use bidblitz_production
db.crypto_wallets.find({ coin: "BTC" }).pretty()
```

### Problem: "API gibt 404"

**Ursache:** Backend nicht neu gestartet oder Code nicht deployed

**Lösung:**
```bash
sudo systemctl restart bidblitz-backend
sudo nginx -s reload
```

### Problem: "Script funktioniert nicht"

**Ursache:** MongoDB nicht installiert oder falscher DB-Name

**Lösung:**
```bash
# Prüfe MongoDB
sudo systemctl status mongod

# Prüfe DB-Namen
mongosh --eval "db.adminCommand('listDatabases')"
```

---

## 📞 NEXT STEPS

Nachdem alles funktioniert:

1. ✅ Teste Crypto Earn Deposits (sollte prüfen ob genug BTC vorhanden)
2. ✅ Teste Withdrawals (sollte BTC + Zinsen zurückgeben)
3. ✅ Admin Panel für Approvals bauen (nächster Task)
4. ✅ P1 Auction Features (Push Notifications)

---

**Letzte Aktualisierung**: 26. April 2025  
**Version**: BidBlitz V2 - Crypto Earn REAL
