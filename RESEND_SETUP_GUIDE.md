# 📧 Resend Email Setup Guide für BidBlitz

## 🎯 Überblick

Resend ist der Email-Service für transaktionale und Marketing-Emails. Diese Anleitung zeigt, wie du deine Domain `bidblitz.ae` für Resend konfigurierst.

---

## 📋 Schritt 1: Resend Account & API Key

1. **Account erstellen:** https://resend.com/signup
2. **API Key generieren:**
   - Dashboard → API Keys → "Create API Key"
   - Name: `BidBlitz Production`
   - Permissions: **Full Access**
   - **Key kopieren** (wird nur einmal angezeigt!)

3. **API Key in Backend `.env` hinzufügen:**
   ```bash
   RESEND_API_KEY=re_...your_key...
   ```

---

## 🌐 Schritt 2: Domain Verification (IONOS DNS)

### Domain hinzufügen in Resend:
1. Dashboard → Domains → "Add Domain"
2. Domain eingeben: `bidblitz.ae`
3. Resend zeigt dir **4 DNS Records** zum Hinzufügen

### DNS Records in IONOS hinzufügen:

#### 1️⃣ **DKIM Record** (Domain Keys Identified Mail)
```
Type:    TXT
Host:    resend._domainkey.bidblitz.ae
Value:   p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC... (langer String von Resend)
TTL:     3600 (1 Stunde)
```

#### 2️⃣ **SPF Record** (Sender Policy Framework)
```
Type:    TXT  
Host:    bidblitz.ae
Value:   v=spf1 include:_spf.resend.com ~all
TTL:     3600
```

**Hinweis:** Wenn bereits ein SPF Record existiert, füge `include:_spf.resend.com` hinzu:
```
v=spf1 include:_spf.existingprovider.com include:_spf.resend.com ~all
```

#### 3️⃣ **DMARC Record** (Domain-based Message Authentication)
```
Type:    TXT
Host:    _dmarc.bidblitz.ae
Value:   v=DMARC1; p=none; rua=mailto:dmarc@bidblitz.ae
TTL:     3600
```

#### 4️⃣ **MX Record** (Mail Exchange - Optional für Empfang)
```
Type:      MX
Host:      bidblitz.ae
Value:     feedback-smtp.eu-west-1.amazonses.com
Priority:  10
TTL:       3600
```

---

## ⏱️ Schritt 3: DNS Propagation abwarten

- **DNS Änderungen dauern:** 5 Minuten bis 48 Stunden
- **Schnellere Propagation:** Meistens 15-30 Minuten

### DNS Records verifizieren:

**Terminal (macOS/Linux):**
```bash
# DKIM prüfen
dig TXT resend._domainkey.bidblitz.ae +short

# SPF prüfen
dig TXT bidblitz.ae +short | grep spf

# DMARC prüfen
dig TXT _dmarc.bidblitz.ae +short
```

**Windows PowerShell:**
```powershell
nslookup -type=TXT resend._domainkey.bidblitz.ae
nslookup -type=TXT bidblitz.ae
nslookup -type=TXT _dmarc.bidblitz.ae
```

**Online Tool:**
- https://mxtoolbox.com/SuperTool.aspx
- Domain eingeben: `resend._domainkey.bidblitz.ae`

---

## ✅ Schritt 4: Verification in Resend

1. Resend Dashboard → Domains → `bidblitz.ae`
2. Klick auf **"Verify DNS Records"**
3. Status sollte **"Verified" ✅** werden

---

## 📤 Schritt 5: Test-Email senden

### Option A: Backend API Test (curl)
```bash
API_URL="https://bidblitz.ae"

curl -X POST "$API_URL/api/admin/test-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "deine-email@example.com",
    "subject": "BidBlitz Test Email",
    "html": "<h1>Test erfolgreich!</h1><p>Resend ist konfiguriert.</p>"
  }' \
  --cookie "session=..."
```

### Option B: Admin Panel
1. Admin Dashboard → Email Settings
2. "Test Email senden" Button
3. Email-Adresse eingeben → Absenden

---

## 🔧 Troubleshooting

### ❌ "Domain not verified"
- **Lösung:** DNS Records nochmal prüfen (Tippfehler?)
- **TTL zu hoch?** Setze TTL auf 300 (5 Minuten) für schnellere Updates

### ❌ "550 Sender rejected"
- **SPF Record fehlt oder falsch**
- Prüfe: `dig TXT bidblitz.ae +short` sollte `v=spf1 include:_spf.resend.com ~all` enthalten

### ❌ Emails landen im Spam
- **DKIM oder DMARC fehlt**
- **Warmup Period:** Sende erste Tage nur wenige Emails (Resend Reputation aufbauen)
- **Authentifiziere Sender-Domain**

### 📊 DNS Check Tool:
https://dmarcian.com/dmarc-inspector/

---

## 📧 Email Templates

### Fahrer-Bewerbung Genehmigt:
```
Von:      no-reply@bidblitz.ae
Betreff:  Deine Fahrer-Bewerbung wurde genehmigt! 🚕
Body:     Willkommen bei BidBlitz Taxi! Du kannst jetzt Fahrten annehmen...
```

### Fahrer-Bewerbung Abgelehnt:
```
Von:      no-reply@bidblitz.ae
Betreff:  Update zu deiner Fahrer-Bewerbung
Body:     Vielen Dank für dein Interesse. Leider können wir deine Bewerbung...
```

---

## 🚀 Production Checklist

- [ ] Resend API Key in `.env` gespeichert
- [ ] 4 DNS Records in IONOS hinzugefügt
- [ ] DNS Propagation abgewartet (15-30 Min)
- [ ] Domain in Resend verifiziert ✅
- [ ] Test-Email erfolgreich gesendet
- [ ] Email Templates konfiguriert
- [ ] Rate Limits geprüft (Resend Free: 100 Emails/Tag, 3000/Monat)

---

## 💰 Resend Pricing (Stand 2026)

| Plan       | Emails/Monat | Preis/Monat |
|------------|--------------|-------------|
| Free       | 3,000        | $0          |
| Starter    | 50,000       | $20         |
| Pro        | 100,000      | $50         |
| Enterprise | Custom       | Custom      |

**Empfehlung für BidBlitz:** Start mit **Free Plan**, upgrade zu **Starter** sobald >3000 Emails/Monat benötigt werden.

---

## 📚 Resend Dokumentation

- **Official Docs:** https://resend.com/docs
- **Node.js SDK:** https://resend.com/docs/sdks/node
- **Email Best Practices:** https://resend.com/docs/knowledge-base

---

## ✅ Status Check

Nach Setup:
```bash
# DNS Records prüfen
dig TXT resend._domainkey.bidblitz.ae +short
dig TXT bidblitz.ae +short | grep spf
dig TXT _dmarc.bidblitz.ae +short

# API Test
curl -X POST "https://bidblitz.ae/api/admin/test-email" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}' \
  --cookie "session=..."
```

---

**Letzte Aktualisierung:** 2026-05-07  
**Support:** Falls Probleme auftreten, prüfe die Resend Dashboard Logs oder kontaktiere Resend Support.
