# Stripe Issuing Aktivierung — BidBlitz Schritt-für-Schritt

Diese Anleitung führt dich durch die Aktivierung von **echten virtuellen Debit-Karten** über Stripe Issuing. Der Backend-Code ist bereits production-ready und gegated über das Feature-Flag `STRIPE_ISSUING_ENABLED`. Nach Abschluss dieser Schritte werden alle neuen Karten via `/api/virtual-cards` automatisch echte Stripe-Karten statt Mock-Daten.

---

## 0. Voraussetzungen-Check

| | Status |
|---|---|
| Stripe-Konto in **Live-Mode** | Pflicht — du brauchst dein Live-Dashboard, kein Test |
| Verifiziertes Geschäftsprofil | Pflicht — Stripe verlangt KYC für Issuing |
| Geschäftssitz in EU/UK/US/CA/AU | Stripe Issuing ist regional begrenzt |
| Funding-Source vorhanden | Bankkonto oder Stripe Treasury Balance |
| Live API Key | Bereits in `/var/www/bidblitz/backend/.env` ✓ |

---

## 1. Stripe Issuing im Dashboard beantragen

1. Login bei https://dashboard.stripe.com (Live-Mode, oben rechts umschalten)
2. Linke Sidebar → **More** → **Issuing**
3. Falls noch nicht aktiv: Button **"Apply for Stripe Issuing"** klicken
4. Antrag-Formular ausfüllen:
   - **Business model**: "Wallet/PSP for our customers"
   - **Card use case**: "Spend management — virtuelle Karten für Online-Käufe der App-Nutzer"
   - **Estimated monthly volume**: realistische Schätzung (z.B. €5.000)
   - **Funding mechanism**: "From issuing balance" (oder Stripe Treasury wenn vorhanden)
5. Antrag absenden — **Stripe braucht 1-5 Werktage zur Prüfung**

Bei Fragen oder beschleunigter Bearbeitung: support@stripe.com mit "Issuing application — BidBlitz" im Betreff.

---

## 2. Funding-Source einrichten (nach Freigabe)

Sobald der Antrag genehmigt ist:

1. Dashboard → **Issuing** → **Balance**
2. Klick **"Add funds"** → SEPA-Überweisung von deinem Geschäftskonto
3. Mindestbetrag empfohlen: €1.000 (Mathepuffer für 20 Karten à €50 Limit)
4. Warten bis "Available balance" > 0 (1-2 Werktage SEPA)

Alternativ: Stripe Treasury einrichten (komplexer, eigene IBAN) — nur wenn du US-Banking brauchst.

---

## 3. Webhook-Endpoint registrieren

Stripe muss authorization-requests in Echtzeit an unseren Server schicken (sonst werden alle Transaktionen abgelehnt).

1. Dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL**:
   ```
   https://bidblitz.ae/api/webhooks/stripe-issuing
   ```
3. **Events to send** (exakt diese 6):
   - `issuing_authorization.request` ⚠️ KRITISCH
   - `issuing_authorization.created`
   - `issuing_authorization.updated`
   - `issuing_transaction.created`
   - `issuing_card.updated`
   - `issuing_cardholder.updated`
4. **API version**: latest (default)
5. Klick **"Add endpoint"**
6. Auf der Detailseite des Endpoints: **"Reveal signing secret"** → Wert beginnt mit `whsec_...`
   → kopieren, wird in Schritt 4 gebraucht.

---

## 4. Feature-Flag aktivieren auf VPS

SSH in den Server:
```bash
ssh root@212.227.20.190
nano /var/www/bidblitz/backend/.env
```

Folgende Zeilen hinzufügen / setzen:
```
STRIPE_ISSUING_ENABLED=true
STRIPE_ISSUING_WEBHOOK_SECRET=whsec_DEIN_WERT_AUS_SCHRITT_3
STRIPE_ISSUING_DAILY_LIMIT_CENTS=50000
```

> `50000` Cent = €500 default Tageslimit pro Cardholder. Anpassbar pro Karte über das Limit-Feld.

Speichern (Ctrl-O, Enter, Ctrl-X), dann Backend neu starten:
```bash
pm2 restart api
sleep 3
pm2 logs api --lines 30 --nostream | grep -i stripe
```

Du solltest **keine** Fehler sehen.

---

## 5. Erste Karte testen

### A) Cardholder mit vollständiger Adresse anlegen (empfohlen)

Erforderlich vor erster Karte. Per curl als angemeldeter User:

```bash
COOKIE=$(curl -sk -i -X POST https://bidblitz.ae/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@bidblitz.ae","password":"BidBlitz2026!"}' \
  | grep -i 'set-cookie:' | head -1 | sed 's/^[Ss]et-[Cc]ookie: //; s/;.*//')

curl -sk -X POST https://bidblitz.ae/api/issuing/cardholders \
  -H 'Content-Type: application/json' \
  -H "Cookie: $COOKIE" \
  -d '{
    "name": "Max Mustermann",
    "email": "max@example.com",
    "billing": {
      "line1": "Hauptstr. 1",
      "city": "Berlin",
      "postal_code": "10115",
      "country": "DE"
    }
  }'
```

Antwort: `{"ok":true, "cardholder_id":"ich_...", ...}`

### B) Karte erstellen (über die App-UI)

1. Auf bidblitz.ae einloggen
2. Navigation → Karten/Wallet → "Neue Karte" klicken
3. Label "Test" + Limit €25 wählen → Erstellen
4. Stripe Dashboard → **Issuing → Cards** prüfen — muss neue Karte zeigen

### C) Webhook testen mit Stripe CLI (optional, lokal)

```bash
# Auf deinem lokalen Rechner:
stripe listen --forward-to https://bidblitz.ae/api/webhooks/stripe-issuing
stripe trigger issuing_authorization.created
```

---

## 6. Mock-Karten zu Stripe migrieren (optional)

Bestehende `db.virtual_cards` (Mock-Karten mit 4...-Prefix) bleiben unverändert in der DB. Sie werden nicht mehr angezeigt sobald `STRIPE_ISSUING_ENABLED=true` ist (das `/api/virtual-cards` GET liest dann ausschließlich aus `db.issuing_cards`).

Wenn du sie löschen willst:
```bash
ssh root@212.227.20.190
mongosh
> use bidblitz
> db.virtual_cards.drop()
```

---

## 7. Rollback (bei Problemen)

Flag deaktivieren und Backend zurück auf Mock-Modus:
```bash
ssh root@212.227.20.190
sed -i 's/^STRIPE_ISSUING_ENABLED=true/STRIPE_ISSUING_ENABLED=false/' /var/www/bidblitz/backend/.env
pm2 restart api
```

Bestehende Stripe-Karten in `db.issuing_cards` bleiben erhalten und werden nach Reaktivierung wieder angezeigt.

---

## Architektur-Übersicht

```
Frontend                      Backend                          Stripe
────────                      ───────                          ──────
VirtualCardsPage   →   GET/POST /api/virtual-cards   →   stripe.issuing.Card.create()
                       (premium_finance.py)
                              │
                              ├─ if STRIPE_ISSUING_ENABLED=true:
                              │  ├─ ensure cardholder
                              │  ├─ create real card
                              │  └─ store in db.issuing_cards
                              └─ else:
                                 └─ random PAN in db.virtual_cards (Demo)

Stripe Authorization Request   →   POST /api/webhooks/stripe-issuing   (synchron, <2s)
                                   ├─ Wallet-Coverage-Check
                                   ├─ Daily-Limit-Check
                                   └─ Response: {approved: bool}
```

---

## Endpunkt-Übersicht (alle gegated wenn nicht aktiviert → 503)

| Method | Path | Zweck |
|---|---|---|
| POST | `/api/issuing/cardholders` | Cardholder anlegen mit voller Adresse |
| GET  | `/api/issuing/cardholders/me` | Eigenen Cardholder abrufen |
| POST | `/api/issuing/cards` | Direkte Issuing-Karte (Stripe-pure) |
| GET  | `/api/issuing/cards` | Eigene Issuing-Karten |
| POST | `/api/issuing/cards/{id}/ephemeral-key` | Mint Stripe-Elements key für PAN-Anzeige |
| POST | `/api/issuing/cards/{id}/status` | active / inactive / canceled |
| POST | `/api/webhooks/stripe-issuing` | Stripe Webhook (signiert) |
| GET  | `/api/virtual-cards` | **Frontend-kompatibler Endpunkt** — gibt Stripe oder Mock je nach Flag |
| POST | `/api/virtual-cards` | **Frontend-kompatibler Endpunkt** — siehe oben |

---

## Häufige Stripe-Fehler

| Fehler | Ursache | Fix |
|---|---|---|
| `Issuing is not enabled for this account` | Antrag noch nicht genehmigt | Auf Stripe-Freigabe warten |
| `Cardholder requires a phone_number for ...` | Manche Länder verlangen Telefon | Zu `_ensure_stripe_cardholder` `phone_number` hinzufügen |
| `Insufficient funds in Issuing balance` | Funding-Source leer | SEPA-Überweisung ans Issuing Balance |
| `Webhook signature verification failed` | falsches `STRIPE_ISSUING_WEBHOOK_SECRET` | Secret aus Dashboard kopieren, neu setzen |
| 503 von `/api/issuing/*` | Flag steht auf false | `.env` prüfen + `pm2 restart api` |
