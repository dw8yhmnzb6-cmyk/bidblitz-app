# BidBlitz Penny Auction Platform - PRD

## Letztes Update: 24. Januar 2026

## Firmeninformationen
- **Firma:** BidBlitz FZCO
- **Standort:** Dubai Silicon Oasis, DDP Building A1, Dubai, VAE
- **CEO:** Afrim Krasniqi
- **E-Mail:** info@bidblitz.ae
- **Telefon:** +971 4 501 2345

## Original-Anforderung
Penny-Auktions-Website nach dem Vorbild von `dealdash.com` und `snipster.de`.

---

## Session 24. Januar 2026 - Neue Features

### 1. Auktion des Tages ✅ NEU
- **Frontend:** Goldene Highlight-Sektion oben auf der Startseite
- **Design:** Goldgradient-Rahmen, 👑 Kronen-Icon, "-100%" Badge
- **Features:** Produktname, UVP durchgestrichen, aktueller Preis, Timer, "🔥 JETZT BIETEN" Button
- **Admin:** Crown-Button im Admin-Panel zum manuellen Setzen
- **Automatisch:** Wenn nicht manuell gesetzt, wird automatisch die höchstwertige aktive Auktion gewählt
- **API:** `GET /api/auction-of-the-day`, `POST /api/admin/auction-of-the-day/{auction_id}`

### 2. Live-Chat Support (Platzhalter) ✅ NEU
- **Integration:** Tawk.to Script in `index.html` eingebettet
- **Status:** Platzhalter - Admin muss Property ID von tawk.to eintragen
- **Konfiguration:** In `/app/frontend/public/index.html`, Zeile 178-205

### 3. Benutzerstatistik-Seite ✅ NEU
- **Route:** `/stats`
- **Features:**
  - Level-System mit Fortschrittsbalken (Level = Gebote/100)
  - Gebote insgesamt
  - Gewonnene Auktionen
  - Gewinnrate (%)
  - Login-Streak
  - Verfügbare Gebote
  - Mitglied seit
  - Achievements Preview
  - Letzte Aktivitäten
- **Link:** Dashboard hat neuen "Statistiken" Button

### 4. Social Sharing ✅ NEU
- **Ort:** Auktionsdetailseite
- **Plattformen:** WhatsApp, Telegram, Facebook, Twitter/X, E-Mail, Link kopieren
- **Design:** Dropdown-Menü mit Icons

### 5. BIETEN Button Bug behoben ✅

### 6. Referral-Bonus-System ✅ NEU
- 10 Gebote für den Einladenden
- 5 Gebote für den Neukunden
- Bedingung: Freund muss €5+ aufladen

### 7. 51 Neue Auktionen ✅ NEU
- Smartphones, Laptops, Gaming, Audio, TVs, Kameras, Smart Home, Uhren, Gutscheine, Mode, Sport
- Insgesamt jetzt 152+ Live-Auktionen

### 8. Nachtauktionen Logik ✅ NEU
- Nachtauktionen nur zwischen 23:30 und 06:00 Uhr aktiv
- Tagsüber zeigen sie "🌙 NACHTS" statt BIETEN Button
- Halbe Gebote-Kosten während Nachtzeit

### 9. Gratis-Auktionen Beschreibung ✅ NEU
- "🎁 GRATIS" Badge mit Hinweis
- "✓ Kostenlos bieten • Endpreis bezahlen" Banner
- Besonders für Gutscheine geeignet

### 10. Gewinner-E-Mail System ✅ NEU
- Automatische E-Mail an Gewinner wenn Auktion endet
- Enthält: Produktbild, Endpreis, Ersparnis, Zahlungsanleitung
- Hinweis auf 7-Tage Zahlungsfrist
- Link zum Dashboard für Zahlung

### 11. Dashboard Zahlungs-Integration ✅ NEU
- Gewonnene Auktionen mit Status "Ausstehende Zahlung"
- "Bezahlen" Button direkt im Dashboard
- Zahlungsfrist-Anzeige
- Gratis-Auktion Hinweis bei Gutscheinen

### 12. VPN-Erkennung bei Registrierung ✅ (bereits implementiert)
- Blockiert VPN, Proxy, Datacenter-IPs
- Maximal 2 Konten pro IP-Adresse
- Nutzt ip-api.com für Erkennung
- **Problem:** Falscher API-Endpunkt `/api/auctions/place-bid/{id}`
- **Lösung:** Korrigiert zu `/api/auctions/{id}/bid`

---

## Frühere Features (22-23. Januar 2026)

### Gratis-Auktionen ✅
- Auktionen ohne Gebote-Abzug mit 🎁 GRATIS Badge

### Daily Login Rewards ✅
- 1-5 Gratis-Gebote pro Tag mit Streak-System

### Achievements System ✅
- 12 Achievements mit Bonus-Geboten

### 62 Produkte & Auktionen ✅
- Kategorien: Smartphones, Audio, TV, Laptops, Gaming, etc.

### Admin-Managed Ad Banner ✅
- CRUD für Werbebanner zwischen Premium und Live-Auktionen

---

## Zugangsdaten

| Rolle | E-Mail | Passwort |
|-------|--------|----------|
| Admin | admin@bidblitz.de | Admin123! |
| Kunde | kunde@bidblitz.de | Kunde123! |

---

## API Endpoints

### Auction of the Day (NEU)
- `GET /api/auction-of-the-day` - AOTD abrufen
- `POST /api/admin/auction-of-the-day/{auction_id}` - AOTD setzen (Admin)

### Auth
- `POST /auth/claim-daily-reward` - Tägliche Belohnung
- `GET /auth/daily-reward-status` - Status prüfen
- `GET /auth/achievements` - Achievements anzeigen

### Auktionen
- `GET /api/auctions` - Alle Auktionen
- `POST /api/auctions/{id}/bid` - Gebot platzieren
- Filter: `is_beginner_only`, `is_free_auction`, `is_vip_only`, `is_night_auction`

---

## Datenbank Collections

- `game_config` - Spieleinstellungen
- `daily_rewards` - Tägliche Belohnungen
- `user_achievements` - Benutzer-Achievements
- `products` - 62 Produkte
- `auctions` - 62+ Auktionen
- `auction_of_the_day` - AOTD-Einstellungen
- `banners` - Werbe-Banner

---

## Code-Architektur

```
/app/
├── backend/
│   ├── routers/
│   │   ├── admin.py       # Banner + AOTD Management
│   │   └── auctions.py    # AOTD API (Zeile 386-454)
│   └── server.py
├── frontend/
│   ├── public/
│   │   └── index.html     # Tawk.to Live-Chat (Zeile 178-205)
│   └── src/
│       ├── pages/
│       │   ├── Auctions.js      # AOTD Component (Zeile 10-85)
│       │   ├── AuctionDetail.js # Social Sharing (Zeile 38-89)
│       │   ├── UserStats.js     # Statistik-Seite (NEU)
│       │   ├── Dashboard.js     # Statistiken-Button (Zeile 226)
│       │   └── Admin.js         # AOTD Crown Button (Zeile 492)
│       └── App.js               # Route /stats
```

---

## Nächste Schritte

1. ✅ ~~Auktion des Tages Feature~~
2. ✅ ~~Live-Chat Support (Platzhalter)~~
3. ✅ ~~Benutzerstatistik-Seite~~
4. ✅ ~~Social Sharing Features~~
5. 🔄 PayPal Integration
6. 🔄 "Not Found" Toast beheben (Intermittierend)
7. 🔄 Sprachwechsel auf allen Seiten
8. 🔄 Admin-Panel Internationalisierung
9. 🔄 Zwei-Faktor-Authentifizierung (2FA)
10. 🔄 Inkonsistente Datenpersistenz beheben

---

## Testing Status

- **Backend Tests:** 16/16 bestanden (100%)
- **Frontend Features:** 7/7 verifiziert (100%)
- **Test Report:** `/app/test_reports/iteration_14.json`

---

## 3rd Party Integrations

- **Stripe (Payments):** LIVE Keys konfiguriert
- **Resend (Email):** Sandbox Mode
- **Tawk.to (Live-Chat):** Platzhalter eingerichtet
- **ip-api.com:** Geo-Blocking
- **reportlab:** PDF Rechnungen
- **pywebpush:** Web Push Notifications

---

## Bekannte Einschränkungen

- **Live-Chat:** Tawk.to Platzhalter - Property ID muss eingegeben werden
- **"Not Found" Toast:** Intermittierendes Problem (404 von unbekannter Quelle)
- **Sprachwechsel:** Funktioniert nicht auf allen Seiten
