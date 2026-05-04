# BidBlitz — DNS Setup für bidblitz.ae auf Resend

## Schritte beim `.ae`-Registrar (vermutlich Etisalat / du / GoDaddy)

### 1. Resend Dashboard öffnen
https://resend.com/domains → "Add Domain" → `bidblitz.ae` → "Add"

### 2. Resend zeigt 4-5 DNS-Records. Diese eintragen:

#### Record 1: SPF (TXT)
```
Type:   TXT
Name:   @  (oder leer / bidblitz.ae)
Value:  v=spf1 include:amazonses.com ~all
TTL:    Auto / 3600
```

#### Record 2-4: DKIM (3× CNAME)
Resend liefert dir 3 eindeutige Selectors wie z.B. `resend._domainkey`, `s1._domainkey`, `s2._domainkey`. Beispiel:
```
Type:   CNAME
Name:   resend._domainkey
Value:  resend._domainkey.us-east-1.amazonses.com
TTL:    Auto

Type:   CNAME
Name:   s1._domainkey
Value:  s1.domainkey.u123456.xx.amazonses.com
TTL:    Auto

Type:   CNAME
Name:   s2._domainkey
Value:  s2.domainkey.u123456.xx.amazonses.com
TTL:    Auto
```

#### Record 5: DMARC (TXT, empfohlen)
```
Type:   TXT
Name:   _dmarc
Value:  v=DMARC1; p=none; rua=mailto:dmarc@bidblitz.ae
TTL:    Auto / 3600
```

### 3. DNS-Propagation prüfen (5-60 Min)
```bash
dig TXT bidblitz.ae +short
dig CNAME resend._domainkey.bidblitz.ae +short
dig TXT _dmarc.bidblitz.ae +short
```
Online-Tool: https://dnschecker.org/#TXT/bidblitz.ae

### 4. Resend Verifizierung anstoßen
Resend Dashboard → bidblitz.ae → "Verify DNS Records" → grüner Haken

### 5. Test-Email senden
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_GfVbS3eF_MWWk7iq37YTMFVBiDYCCpsS7" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "BidBlitz <noreply@bidblitz.ae>",
    "to": ["DEINE-EMAIL@example.com"],
    "subject": "Domain verified ✓",
    "html": "<p>Wenn du diese Email siehst, läuft alles!</p>"
  }'
```
→ Erfolg: `{"id":"..."}` zurück
→ Fehler: `{"name":"validation_error","message":"...domain is not verified..."}` → 5 Min warten und nochmal verifizieren

---

## Häufige `.ae`-Registrar Probleme

| Registrar | Hinweis |
|-----------|---------|
| **Etisalat / du** | Nur 1 TXT pro Hostname → DMARC + SPF auf separaten Hostnames eintragen (`@` für SPF, `_dmarc` für DMARC) |
| **GoDaddy `.ae`** | DKIM-CNAMEs ohne `bidblitz.ae`-Suffix einfügen — System hängt es automatisch dran |
| **Cloudflare** | Bei DKIM CNAMEs **Proxy-Modus deaktivieren** (graues Wölkchen) — sonst broken |
| **AE Domain Administration** | Nutze ein Self-Service-Tool wie Cloudflare als Nameserver, dort sind Records einfacher |

---

## Schnelltest mit Sandbox-Sender (sofort)

Wenn du noch keine Domain verifizierst, kannst du JETZT schon Resend nutzen mit:
```
FROM: BidBlitz <onboarding@resend.dev>
```

Setze in `/app/backend/.env`:
```
FROM_EMAIL=BidBlitz <onboarding@resend.dev>
```

Sales-Invites kommen damit sofort raus, aber:
- Sender-Reputation ist generisch (Spam-Risiko)
- DKIM/SPF auf `resend.dev` (nicht deine Domain)
- Empfänger sehen "via resend.dev" im Email-Header

→ NUR für Tests / Demo / interne Beta. Für Production unbedingt eigene Domain verifizieren.
