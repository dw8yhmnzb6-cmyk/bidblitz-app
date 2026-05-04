# BidBlitz — IONOS DNS Setup für Resend (`mail.bidblitz.ae`)

Stand: 04.05.2026 · Domain: `bidblitz.ae` bei IONOS · Subdomain: `mail.bidblitz.ae`

---

## Schritt 1: IONOS Login
https://login.ionos.de → **Domains & SSL** → **bidblitz.ae** → **DNS**

## Schritt 2: 4 DNS-Records eintragen

### Record 1/4: DKIM (TXT)
- **Typ:** `TXT`
- **Hostname:** `resend._domainkey.mail`  *(IONOS hängt `.bidblitz.ae` automatisch dran)*
- **Wert:**
  ```
  p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGjYQxh3rSrrvtMOhZWL70sqCCiWkEbRIdZ39Bb8J6ITraewwdLlxA1cCwSirJL6D0SSWu6CIVPhQfG1QJ5q8fik6POeweQr6lWfy79KetMV12O0he6ayxeQna/+kMcFehIvu+oejA6XKT+ZvEu4i0L+s2VE9T2j3Gujxbv/xT+wIDAQAB
  ```
- **TTL:** 1 Stunde (3600)

⚠️ **IONOS zeigt oft "Wert zu lang"** — das ist OK. IONOS akzeptiert TXT-Records bis 2048 Zeichen. Den gesamten Wert in einer Zeile einfügen (kein Zeilenumbruch!).

### Record 2/4: MX Bounce (für SPF)
- **Typ:** `MX`
- **Hostname:** `send.mail`
- **Wert:** `feedback-smtp.eu-west-1.amazonses.com`
- **Priorität:** `10`
- **TTL:** 1 Stunde

### Record 3/4: SPF (TXT)
- **Typ:** `TXT`
- **Hostname:** `send.mail`
- **Wert:** `v=spf1 include:amazonses.com ~all`
- **TTL:** 1 Stunde

### Record 4/4 (optional): DMARC (TXT)
- **Typ:** `TXT`
- **Hostname:** `_dmarc.mail`
- **Wert:** `v=DMARC1; p=none; rua=mailto:dmarc@bidblitz.ae`
- **TTL:** 1 Stunde

## Schritt 3: Speichern & warten
IONOS propagiert in 5–30 Min. Status prüfen:
```
Emergent-Chat → "Resend DNS check" schreiben
```
→ Ich verifiziere die Records + trigger Resend-Verify + aktiviere `FROM_EMAIL=BidBlitz <noreply@mail.bidblitz.ae>` in Production.

---

## IONOS UI-Hinweise
- Manche Versionen nennen "Hostname" → "Host" oder "Name"
- Bei "Hostname" den Punkt am Ende **weglassen** (IONOS hängt Domain auto dran)
- Beim Speichern: grüner Haken ✅ = OK, roter ❌ = Format falsch

## Troubleshooting
| Fehler | Lösung |
|--------|--------|
| "Hostname bereits vorhanden" | Existierenden Record editieren statt neu anlegen |
| "Wert ungültig / zu lang" | TXT-Wert ohne Anführungszeichen einfügen; bei >255 Zeichen teilt IONOS automatisch |
| "Nach 24h kein Verify" | IONOS-Cache refreshen: Domain löschen + neu hinzufügen (Wert bleibt erhalten) |

---

## Alternativ: Cloudflare (falls du migrieren willst)
Wenn IONOS DNS schwierig ist, kannst du kostenlos auf Cloudflare umziehen:
1. https://cloudflare.com → "Add site" → `bidblitz.ae`
2. Cloudflare scannt automatisch alle existierenden Records
3. Bei IONOS: Nameserver ändern zu den von Cloudflare angegebenen 2 Servern
4. Danach DNS-Records via Cloudflare-UI (viel einfacher)

Vorteile: schnellere Propagation (<5 Min), bessere Security, DDoS-Schutz gratis.
