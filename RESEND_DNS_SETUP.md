# BidBlitz — Resend DNS Setup für `bidblitz.ae`

Stand: 04.05.2026

---

## ⚠️ Wichtiger Hinweis: `bidblitz.ae` Apex-Domain bereits registriert

Beim Versuch, `bidblitz.ae` über die Resend-API zur Verifizierung hinzuzufügen, gibt Resend zurück:

```json
{ "statusCode": 403, "message": "The bidblitz.ae domain has been registered already." }
```

Resend erlaubt **eine Domain global nur in einem Account**. Drei Lösungswege:

### Option A (empfohlen): Subdomain `mail.bidblitz.ae`
Bereits in Resend angelegt (`id: 9bd2361b-f481-40d3-bc9b-92ba27089da8`).
**Sende-Adresse:** `noreply@mail.bidblitz.ae`
DNS-Records siehe unten.

### Option B: Apex `bidblitz.ae` aus dem alten Resend-Account löschen
Login bei dem alten Resend-Konto, das die Domain hält → "Remove Domain" → danach kann sie hier neu hinzugefügt werden.
Falls Zugriff verloren: Resend-Support kontaktieren (`support@resend.com`) mit Domain-Ownership-Beweis.

### Option C: Sandbox-Sender (Testbetrieb)
`FROM_EMAIL=BidBlitz <onboarding@resend.dev>` — funktioniert sofort, aber Spam-Risiko + "via resend.dev"-Anzeige.

---

## DNS-Records für `mail.bidblitz.ae` (Option A)

Beim `.ae`-Registrar (z.B. Etisalat / du / GoDaddy / Cloudflare) folgende Records eintragen:

### Record 1: DKIM (TXT)
```
Type:     TXT
Name:     resend._domainkey.mail
Value:    p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGjYQxh3rSrrvtMOhZWL70sqCCiWkEbRIdZ39Bb8J6ITraewwdLlxA1cCwSirJL6D0SSWu6CIVPhQfG1QJ5q8fik6POeweQr6lWfy79KetMV12O0he6ayxeQna/+kMcFehIvu+oejA6XKT+ZvEu4i0L+s2VE9T2j3Gujxbv/xT+wIDAQAB
TTL:      Auto / 3600
```

### Record 2: SPF Bounce-MX
```
Type:     MX
Name:     send.mail
Value:    feedback-smtp.eu-west-1.amazonses.com
Priority: 10
TTL:      Auto / 3600
```

### Record 3: SPF (TXT)
```
Type:     TXT
Name:     send.mail
Value:    v=spf1 include:amazonses.com ~all
TTL:      Auto / 3600
```

### Record 4 (empfohlen): DMARC (TXT)
```
Type:     TXT
Name:     _dmarc.mail
Value:    v=DMARC1; p=none; rua=mailto:dmarc@bidblitz.ae
TTL:      Auto / 3600
```

---

## Verifizierung

### 1. DNS-Propagation prüfen (5–60 Min)
```bash
dig TXT resend._domainkey.mail.bidblitz.ae +short
dig MX  send.mail.bidblitz.ae +short
dig TXT send.mail.bidblitz.ae +short
```
Online-Tool: https://dnschecker.org/

### 2. Resend-Verifizierung anstoßen (API)
```bash
curl -X POST "https://api.resend.com/domains/9bd2361b-f481-40d3-bc9b-92ba27089da8/verify" \
  -H "Authorization: Bearer $RESEND_API_KEY"
```

### 3. Test-Email senden
```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "BidBlitz <noreply@mail.bidblitz.ae>",
    "to": ["DEINE-EMAIL@example.com"],
    "subject": "Domain verified ✓",
    "html": "<p>Wenn du diese Email siehst, läuft Resend live!</p>"
  }'
```

→ Erfolg: `{"id":"..."}`
→ Fehler: `"...domain is not verified..."` → 5 Min warten + nochmal Step 2.

---

## Backend-Anpassung (nach DNS-Setup)

In `/app/backend/.env`:
```bash
FROM_EMAIL=BidBlitz <noreply@mail.bidblitz.ae>
```
Dann: `sudo supervisorctl restart backend`.

---

## Häufige `.ae`-Registrar Probleme

| Registrar | Hinweis |
|-----------|---------|
| **Etisalat / du** | Nur 1 TXT pro Hostname → SPF + DMARC auf separaten Hostnames eintragen |
| **GoDaddy `.ae`** | Hostname **ohne** `.bidblitz.ae`-Suffix eintragen (System hängt es automatisch dran) |
| **Cloudflare** | Bei DKIM-TXT **Proxy-Modus deaktivieren** (graues Wölkchen) — sonst broken |
| **AE Domain Administration** | Ggf. Cloudflare als Nameserver setzen — dann sind Records einfacher |
