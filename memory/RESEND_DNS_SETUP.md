# 📧 Resend E-Mail DNS-Konfiguration

**Domain:** `bidblitz.ae`  
**E-Mail-Absender:** `noreply@bidblitz.ae` (via `send.bidblitz.ae`)  
**Status:** ⚠️ **DNS SPF-Record fehlt** → E-Mails werden als Spam markiert

---

## ❌ Aktuelles Problem

- Resend API-Key ist in `.env` konfiguriert: ✅
- E-Mails werden versendet, aber landen im Spam ❌
- **Grund:** SPF-Record für `send.bidblitz.ae` fehlt in IONOS DNS

---

## ✅ Lösung: SPF-Record hinzufügen

### Schritt 1: IONOS DNS-Manager öffnen

1. Gehe zu [IONOS Login](https://www.ionos.de/login)
2. Einloggen mit deinem Account
3. **Domains & SSL** → `bidblitz.ae` auswählen
4. **DNS** → **DNS-Einstellungen verwalten**

### Schritt 2: SPF TXT-Record erstellen

Füge einen **neuen TXT-Record** hinzu:

| Feld | Wert |
|------|------|
| **Hostname/Subdomain** | `send` |
| **Typ** | `TXT` |
| **Wert** | `v=spf1 include:amazonses.com ~all` |
| **TTL** | `3600` (1 Stunde) |

**Wichtig:** 
- Hostname muss `send` sein (nicht `send.bidblitz.ae`)
- Wert MUSS genau `v=spf1 include:amazonses.com ~all` sein
- Keine Leerzeichen am Anfang/Ende

### Schritt 3: DNS-Propagation abwarten

- DNS-Änderungen brauchen **15-60 Minuten**
- Prüfe DNS-Status mit: `dig TXT send.bidblitz.ae`

### Schritt 4: Verifizierung

Nach DNS-Propagation:

```bash
# DNS-Check (Linux/macOS)
dig TXT send.bidblitz.ae +short

# Erwartete Ausgabe:
# "v=spf1 include:amazonses.com ~all"
```

**Windows PowerShell:**
```powershell
nslookup -type=TXT send.bidblitz.ae
```

---

## 🧪 E-Mail-Zustellung testen

### Test 1: Backend API testen

```bash
# Admin-Token holen
API_URL=https://floorplan-wizard-8.preview.emergentagent.com

TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bidblitz.ae","password":"BidBlitz2026!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Test-E-Mail senden (z.B. Password-Reset)
curl -X POST "$API_URL/api/auth/password-reset-request" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bidblitz.ae"}'
```

### Test 2: Resend Dashboard prüfen

1. Gehe zu [Resend Dashboard](https://resend.com/emails)
2. Login mit deinem Resend-Account
3. Prüfe **Email Logs** → sollte "delivered" zeigen (nicht "bounced")

---

## 📊 Resend-Konfiguration (Backend)

**Datei:** `/app/backend/.env`

```ini
RESEND_API_KEY=re_GfVbS3eF_MWWk7iq37YTMFVBiDYCCpsS7
FROM_EMAIL=BidBlitz <noreply@bidblitz.ae>
```

**E-Mail-Service:** `/app/backend/core/email.py`

Alle E-Mail-Funktionen:
- ✅ `send_password_reset_email()` - Passwort zurücksetzen
- ✅ `send_welcome_email()` - Willkommens-E-Mail
- ✅ `send_payment_confirmation_email()` - Zahlungsbestätigung
- ✅ `send_receipt_email()` - Quittungen
- ✅ `send_kyc_status_email()` - KYC-Status
- ✅ `send_otp_email()` - 2FA-Codes
- ✅ `send_topup_confirmation_email()` - Wallet-Aufladung
- ✅ `send_transfer_notification()` - BlitzTransfer

---

## 🔧 Troubleshooting

### Problem: E-Mails landen weiterhin im Spam

**Lösung 1: DKIM hinzufügen (optional)**

Resend bietet automatische DKIM-Signierung. Prüfe in Resend Dashboard ob Domain verifiziert ist.

**Lösung 2: Domain verifizieren**

1. Gehe zu [Resend Domains](https://resend.com/domains)
2. Füge `bidblitz.ae` hinzu
3. Folge Verifizierungs-Anweisungen (zusätzliche TXT-Records)

**Lösung 3: DMARC-Policy (optional)**

Füge DMARC TXT-Record hinzu:

| Hostname | Typ | Wert |
|----------|-----|------|
| `_dmarc` | `TXT` | `v=DMARC1; p=none; rua=mailto:admin@bidblitz.ae` |

---

## ✅ Checklist

- [ ] SPF TXT-Record für `send.bidblitz.ae` in IONOS hinzugefügt
- [ ] DNS-Propagation abgewartet (15-60 Min)
- [ ] DNS-Record verifiziert (`dig TXT send.bidblitz.ae`)
- [ ] Test-E-Mail versendet und Inbox geprüft
- [ ] Resend Dashboard auf "delivered" Status geprüft
- [ ] (Optional) Domain in Resend verifiziert
- [ ] (Optional) DMARC-Record hinzugefügt

---

## 📞 Support

- **Resend Support:** https://resend.com/support
- **IONOS DNS-Hilfe:** https://www.ionos.de/hilfe/domains/dns-einstellungen/

**Letzte Aktualisierung:** 2026-05-11
