# Resend DNS Setup für bidblitz.ae — Schritt-für-Schritt

## Status (08.05.2026)

| Record | Status | Wert |
|---|---|---|
| MX `bidblitz.ae` | ✅ OK | `mx00.ionos.de`, `mx01.ionos.de` |
| TXT `bidblitz.ae` (SPF) | ⚠️ unvollständig | `v=spf1 include:_spf-eu.ionos.com ~all` (Resend fehlt) |
| TXT `_dmarc.bidblitz.ae` | ✅ OK | `v=DMARC1; p=none;` |
| TXT `resend._domainkey.bidblitz.ae` (DKIM) | ✅ OK | RSA Public Key vorhanden |
| TXT `send.bidblitz.ae` (SPF Subdomain) | ❌ **FEHLT** | `v=spf1 include:amazonses.com ~all` |
| MX `send.bidblitz.ae` | ✅ OK | `feedback-smtp.us-east-1.amazonses.com` |

**Resend API-Test ergibt:**
```
"The bidblitz.ae domain is not verified. Please, add and verify your domain on https://resend.com/domains"
```

## Was du tun musst

### 1. Resend Dashboard öffnen
https://resend.com/domains → Domain `bidblitz.ae` auswählen → "Verify DNS Records"

### 2. Im IONOS DNS-Manager folgende Einträge ergänzen

**SPF auf der Subdomain `send`** (KRITISCH — fehlt aktuell):
```
Typ: TXT
Name: send
Wert: v=spf1 include:amazonses.com ~all
TTL: 3600
```

### 3. Alternative: Direktes Versenden VON `noreply@send.bidblitz.ae`

Aktuell sendet der Code von `noreply@bidblitz.ae`. Wenn du ohne IONOS-SPF-Konflikt arbeiten willst, ändere `SENDER_EMAIL` in `/app/backend/.env`:

```
SENDER_EMAIL=noreply@send.bidblitz.ae
```

Dann nutzt Resend ausschließlich die Subdomain — IONOS Email für Empfang bleibt unberührt.

### 4. DNS-Propagation prüfen (nach IONOS-Änderung)

```bash
python3 -c "import dns.resolver; print(list(dns.resolver.resolve('send.bidblitz.ae', 'TXT')))"
```

Erwartetes Ergebnis: `'v=spf1 include:amazonses.com ~all'`

DNS-Propagation dauert üblicherweise 15–60 Minuten.

### 5. Verifizierung in Resend triggern

Im Resend-Dashboard auf "Verify Records" klicken — sobald alle 4 Records (DKIM/SPF/MX/Return-Path) grün sind, ist die Domain freigeschaltet.

### 6. Live-Smoketest

```bash
curl -X POST "$REACT_APP_BACKEND_URL/api/admin/test-email" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"to":"deine@email.com"}'
```

Erwartung: `{"sent": true, "via": "resend"}`

## Warum die aktuelle Konfiguration noch nicht reicht

Resend funktioniert nur, wenn:
1. ✅ DKIM-Public-Key auf `resend._domainkey.<domain>` veröffentlicht ist (✓ erledigt)
2. ❌ SPF-Record auf der **send-Subdomain** AmazonSES erlaubt (FEHLT)
3. ✅ MX-Record auf send-Subdomain auf SES-Bounce-Endpoint zeigt (✓ erledigt)
4. ❌ Domain im Resend-Dashboard als "Verified" markiert ist (FEHLT — User-Aktion)

Schritt 2 + 4 sind die einzigen verbleibenden Aktionen.
