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

### 7. 51+ Neue Auktionen ✅ NEU
- Smartphones, Laptops, Gaming, Audio, TVs, Kameras, Smart Home, Uhren, Gutscheine, Mode, Sport
- Insgesamt jetzt 166+ Live-Auktionen

### 8. Nachtauktionen Logik ✅ NEU
- Nachtauktionen nur zwischen 23:30 und 06:00 Uhr aktiv
- Tagsüber zeigen sie "🌙 NACHTS" statt BIETEN Button
- Halbe Gebote-Kosten während Nachtzeit

### 9. 100 Gebote Gutschein (Gratis-Auktionen) ✅ NEU
- Nur "100 Gebote Gutschein" ist Gratis-Auktion
- "🎁 GRATIS" Badge mit "✓ Kostenlos bieten • Endpreis bezahlen"
- Gewinner erhält 100 Gebote auf sein Konto gutgeschrieben
- 5 aktive Gratis-Auktionen

### 10. Gewinner-E-Mail System ✅ NEU
- Automatische E-Mail an Gewinner wenn Auktion endet
- Enthält: Produktbild, Endpreis, Ersparnis, Zahlungsanleitung
- Hinweis auf 7-Tage Zahlungsfrist
- Link zum Dashboard für Zahlung

### 11. Checkout für gewonnene Auktionen ✅ NEU
- `/checkout/won/{auctionId}` Route
- Für physische Produkte: Stripe-Zahlung
- Für Gebote-Gutscheine: Sofortige Gutschrift
- Backend-APIs: GET/POST `/won-auctions/{id}`

### 12. "Not Found" Toast behoben ✅
- 404-Fehler werden nicht mehr als Toast angezeigt
- Leise Fehlerbehandlung für nicht gefundene Auktionen
- Hilfsfunktion `getErrorMessage()` in `/app/frontend/src/lib/utils.js`

### 13. Admin-Panel Internationalisierung ✅ NEU
- Alle Tab-Namen in DE/EN
- Übersetzungsdatei: `/app/frontend/src/i18n/adminTranslations.js`
- 140+ übersetzte Begriffe

### 14. Filter-Buttons auf Startseite ✅ NEU
- Schnelle Filter: Live, Anfänger, Gratis, Nacht, Ende, VIP
- Zeigt Anzahl in jedem Filter (z.B. "Live (132)")
- Sofortiges Filtern ohne Seitenladen

### 15. Influencer-System ✅ NEU
- Admin kann Influencer mit eigenem Code erstellen
- Provision in % einstellbar (Standard: 10%)
- Tracking: Code-Nutzungen, Umsatz, Verdient
- Soziale Profile: Instagram, YouTube, TikTok
- API: `/api/influencer/admin/list`, `/api/influencer/validate/{code}`
- Admin-Tab: "Influencer verwalten" mit Statistiken

### 16. VPN-Erkennung bei Registrierung ✅ (bereits implementiert)
- Blockiert VPN, Proxy, Datacenter-IPs
- Maximal 2 Konten pro IP-Adresse
- Nutzt ip-api.com für Erkennung

### 17. Influencer-Portal ✅ NEU (24. Januar 2026)
- **Frontend-Seiten:**
  - `/influencer-werden` - Promo-Seite für neue Influencer
  - `/influencer-login` - Dashboard für bestehende Influencer
- **Backend-APIs:**
  - `POST /api/influencer/login` - Login mit Code + E-Mail
  - `GET /api/influencer/stats/{code}` - Statistiken abrufen
  - `POST /api/influencer/apply` - Bewerbung als Influencer
- **Footer "Extras"-Sektion** mit Links zu Influencer-Seiten

### 18. VIP-Auktionen Verbesserungen ✅ NEU (24. Januar 2026)
- **Auto-Refresh:** Alle 10 Sekunden (vorher 30 Sek.)
- **WebSocket:** Echtzeit-Preis-Updates
- **Bieten-Einschränkung:** Nicht-VIP-Nutzer können nicht auf VIP-Auktionen bieten
- **Fehlermeldung:** "Diese Auktion ist nur für VIP-Mitglieder. Werden Sie jetzt VIP, um mitzubieten!"
- **Backend:** VIP-Status-Prüfung in `/api/auctions/{id}/bid`

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
5. ✅ ~~Internationalisierung der Auktionsseite~~
6. 🔄 PayPal Integration
7. 🔄 "Not Found" Toast beheben (Intermittierend)
8. 🔄 Sprachwechsel auf statischen Seiten (AGB, Impressum)
9. 🔄 Zwei-Faktor-Authentifizierung (2FA)
10. 🔄 Inkonsistente Datenpersistenz beheben

---

## Session 25. Januar 2026 - Admin Refactoring, i18n & Bug Fixes

### Admin.js Refactoring ✅
- Neuer Ordner: `/app/frontend/src/components/admin/`
- **6 Komponenten extrahiert:**
  - `AdminDashboard.js` - Dashboard-Tab mit Charts
  - `AdminProducts.js` - Produktverwaltung
  - `AdminUsers.js` - Benutzerverwaltung
  - `AdminBots.js` - Bot-System
  - `AdminVouchers.js` - Gutscheinverwaltung
  - `AdminPayments.js` - Zahlungsübersicht
  - `AdminLogs.js` - Systemlogs
- `index.js` - Export-Datei für alle Admin-Komponenten

### Sprachwechsel für statische Seiten ✅
- Backend `pages.py` unterstützt jetzt Sprachparameter (`?lang=de` oder `?lang=en`)
- Mehrsprachige Default-Inhalte für:
  - Impressum (DE/EN)
  - Datenschutz (DE/EN)
  - AGB (DE/EN)
- Frontend-Seiten (AGB.js, Impressum.js, Datenschutz.js) senden jetzt die aktuelle Sprache
- Sprachwechsel lädt automatisch den Inhalt in der gewählten Sprache

### "Not Found" Toast Fix ✅
- Globaler Axios-Interceptor erstellt: `/app/frontend/src/lib/axiosConfig.js`
- Unterdrückt automatisch "Not Found" und ähnliche technische Fehlermeldungen
- Fehler werden nur in der Konsole geloggt, nicht als Toast angezeigt

### Kosovo-Bots hinzugefügt ✅
- **100 neue Bots** mit kosovarischen Namen

### 50 Auktionen gelöscht ✅
- Die 50 ältesten Auktionen wurden entfernt
- Auktionen: 210 → 160

---

### Vollständige i18n der Auctions.js Seite ✅
- **Alle Texte** auf der Hauptauktionsseite sind jetzt übersetzbar
- **Übersetzt für 23 Sprachen:** DE, EN, FR, ES, IT, PT, NL, PL, TR, RU, AR, AE, ZH, JA, KO, HI, SQ, XK, CS, SV, DA, FI, EL
- **Komponenten aktualisiert:**
  - `AuctionOfTheDay` - Alle Texte dynamisch übersetzt
  - `AuctionCard` - Alle Labels, Buttons und Badges übersetzt
  - `ActivityIndex` - Aktivitätslabel übersetzt
  - `LivePrice` - Startpreis übersetzt
  - `PremiumCard` - Alle Texte übersetzt
  - `TrustBadges` - "SICHER" Label übersetzt
  - `InfoSidebar` - Alle Auktionstypen und Aktivitätslevel übersetzt
- **Neue Übersetzungsschlüssel in `translations.js`:**
  - `auctionPage.auctionOfDay`, `topOffer`, `currentPrice`, `remaining`
  - `auctionPage.bidNow`, `bidsCount`, `lastSoldFor`, `activity`
  - `auctionPage.uvp`, `comparePrice`, `startPrice`, `bid`, `nightOnly`
  - `auctionPage.freeBidPayEnd`, `nightTime`, `secure`, `auctionTypes`
  - `auctionPage.discount`, `beginner`, `free`, `vipLabel`, `night`, `alarm`
  - `auctionPage.activityLow/Medium/High/VeryHigh`
  - `auctionPage.howItWorks`, `step1/2/3`, `priceNote`
  - `auctionPage.pleaseLogin`, `bidPlaced`, `error`
  - `auctionPage.endedAuctions`, `noAuctionsInCategory`, `showAllLive`
- **Memo-Vergleichsfunktion korrigiert:** AuctionCard re-rendert jetzt bei Sprachwechsel
- **Filter-Buttons:** Alle Labels dynamisch übersetzt (Live, Anfänger, Gratis, Nacht, Ende, VIP)
- **Überschriften:** Dynamisch basierend auf aktivem Filter

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
- **Sprachwechsel auf statischen Seiten:** AGB, Impressum etc. benötigen noch Backend-Änderungen
