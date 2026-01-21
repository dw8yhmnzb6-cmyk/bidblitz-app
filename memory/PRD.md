# BidBlitz - Penny Auction Platform PRD

## Original Problem Statement
Penny-Auktion-Website ähnlich dealdash.com und snipster.de mit Kunden-App und Admin-Panel.

## User Personas
1. **Kunden**: Registrierte Benutzer, die Gebote kaufen und auf Produkte bieten
2. **Admin**: Verwalter der Plattform mit voller Kontrolle über Produkte, Auktionen, Benutzer

## Core Requirements
- Penny-Auktionssystem wo Benutzer auf Produkte bieten
- Admin-Panel für vollständige Verwaltung
- Multi-Sprachen-Unterstützung (20+ Sprachen inkl. Kosovarisch)
- Zahlungsintegration (Stripe, Coinbase Crypto)
- Echtzeit-Updates via WebSocket

---

## ✅ COMPLETED - Admin Content Management & Auto-Restart (21.01.2026)

### Admin Content Management System (CMS)
- [x] **Backend Router:** `/app/backend/routers/pages.py` erstellt
- [x] **Endpoints:**
  - `GET /api/pages` - Alle bearbeitbaren Seiten abrufen
  - `GET /api/pages/{page_id}` - Einzelne Seite abrufen
  - `PUT /api/admin/pages/{page_id}` - Seite aktualisieren (Admin)
  - `POST /api/admin/pages/{page_id}/reset` - Seite auf Standard zurücksetzen
- [x] **Standard-Seiten:** Impressum, Datenschutz, AGB, FAQ, Kontakt, So funktioniert's
- [x] **Frontend Admin-Tab:** "Seiten" mit Seitenauswahl, HTML-Editor und Live-Vorschau
- [x] **Statische Seiten aktualisiert:** Impressum.js, Datenschutz.js, AGB.js laden Inhalt aus DB

### Automatische Auktions-Wiederholung
- [x] **Endpoint:** `PUT /api/admin/auctions/{id}/auto-restart?duration_minutes=&bot_target_price=`
- [x] **Background Task:** `auction_auto_restart_processor()` prüft alle 10 Sek. beendete Auktionen
- [x] **Admin UI:** Repeat-Button (🔁) in Auktions-Tabelle zum Konfigurieren
- [x] **Status-Badge:** "AUTO" Badge bei Auktionen mit aktivem Auto-Restart
- [x] **Auktions-Erstellung:** Checkbox "Auktion automatisch neu starten" mit Dauer-Eingabe

### Bot-Zuweisung bei Auktionserstellung
- [x] **Bot-Mindestpreis:** Wird bei Auktionserstellung direkt gesetzt
- [x] **Auto-Restart + Bot:** Bei Auto-Restart wird der Bot-Mindestpreis übernommen
- [x] **UI:** Bot-Einstellungen-Sektion im Auktions-Erstellungsformular

---

## ✅ COMPLETED - Neue Seiten & Preise (20.01.2026)

### Neue Seiten erstellt (wie snipster.de)
- [x] **So funktioniert's** (`/how-it-works`) - 4-Schritte-Erklärung mit Beispielrechnung
- [x] **FAQ** (`/faq`) - Kategorisierte Fragen mit Suchfunktion
- [x] **Kontakt** (`/contact`) - Kontaktformular mit E-Mail, Telefon, Adresse

### Aktualisierte Gebotspakete
| Paket | Preis | Gebote | Bonus | Pro Gebot |
|-------|-------|--------|-------|-----------|
| Mini | 5€ | 10 | - | 0,50€ |
| Starter | 10€ | 20 | +2 | 0,45€ |
| Basic | 20€ | 40 | +5 | 0,44€ |
| Pro | 50€ | 100 | +15 | 0,43€ |
| Ultimate | 100€ | 200 | +30 | 0,43€ |

### Aktualisierte Navigation
- Desktop: Auktionen | So funktioniert's | Gebote kaufen | FAQ | Gewinner | Dashboard | Admin
- Mobile: Hamburger-Menü mit allen Seiten

---

## ✅ COMPLETED - Bug Fixes (20.01.2026)

### Kritischer Auktions-Timer Bug behoben
- [x] **Root Cause:** ISO-Datum mit `+00:00` Timezone wurde von JavaScript falsch geparst
- [x] **Lösung:** `parseEndTime()` Helper-Funktion erstellt, die Timezone korrekt normalisiert
- [x] **Fix:** `isEnded` basiert jetzt auf Backend-Status statt lokaler Zeitberechnung
- [x] **Ergebnis:** Alle 85 aktiven Auktionen zeigen korrekte Timer und "BIETEN" Buttons

### Dashboard Null-Pointer Bug behoben
- [x] **Root Cause:** API-Responses können `null` sein wenn Endpoint fehlt oder fehlschlägt
- [x] **Fix 1:** Fehlenden `/api/autobidder/my` Endpoint im Backend hinzugefügt
- [x] **Fix 2:** Alle Array-Zugriffe im Dashboard null-safe gemacht (`data || []`)
- [x] **Ergebnis:** Dashboard lädt ohne Runtime Errors

### Bieten-Erinnerungs-Feature implementiert
- [x] **Backend:** Neue Endpoints in `routers/notifications.py`:
  - `POST /api/notifications/auction-reminder/{auction_id}` - Erinnerung setzen
  - `DELETE /api/notifications/auction-reminder/{auction_id}` - Erinnerung löschen
  - `GET /api/notifications/auction-reminder/{auction_id}` - Status prüfen
  - `GET /api/notifications/my-reminders` - Alle Erinnerungen abrufen
- [x] **Background Task:** `auction_reminder_processor()` prüft alle 30 Sek. fällige Erinnerungen
- [x] **Frontend:** Glocken-Button auf jeder Auktionskarte (nur für eingeloggte User)
- [x] **UX:** Toast-Benachrichtigung bei Setzen/Löschen einer Erinnerung
- [x] **Push Notification:** Automatische Push + In-App Notification 5 Min. vor Auktionsende

---

## ✅ COMPLETED - Push, PDF & 2FA (20.01.2026)

### Push-Benachrichtigungen (Echte Browser-Push)
- [x] Service Worker (`/sw.js`) für Push-Empfang
- [x] VAPID-Keys generiert und konfiguriert
- [x] Push-Subscription im Frontend (`/utils/pushNotifications.js`)
- [x] Backend Push-Senden mit `py_vapid` und `webpush`
- [x] Test-Push Endpoint: `POST /api/notifications/test-push`
- [x] VAPID Public Key Endpoint: `GET /api/notifications/vapid-public-key`
- [x] Frontend: Einstellungen-Panel mit Push-Aktivierung

### In-App Benachrichtigungen
- [x] Benachrichtigungs-Einstellungen pro Benutzer
- [x] Admin: Broadcast an alle/aktive/zahlende Benutzer
- [x] Frontend: `/notifications` Seite mit Settings

### PDF-Rechnungen
- [x] Router `/api/invoices/*` erstellt
- [x] PDF-Generierung mit reportlab
- [x] Rechnungen für Gebots-Käufe: `GET /api/invoices/{transaction_id}`
- [x] Rechnungen für Auktions-Gewinne: `POST /api/invoices/auction-win/{auction_id}`
- [x] Alle Rechnungen abrufen: `GET /api/invoices/user/all`
- [x] Frontend: `/invoices` Seite mit Download-Funktion

### 2FA-Erweiterungen
- [x] Backup-Codes generieren: `POST /api/auth/2fa/backup-codes/generate` (10 Codes)
- [x] Backup-Code verifizieren: `POST /api/auth/2fa/backup-codes/verify`
- [x] Backup-Code Anzahl: `GET /api/auth/2fa/backup-codes/count`
- [x] Umfassender 2FA-Status: `GET /api/auth/2fa/status`
- [x] Code-nur-Verifikation: `POST /api/auth/2fa/verify-only` (für sensible Aktionen)

---

## ✅ COMPLETED - New Features (20.01.2026)

### 100+ Test-Auktionen erstellt
- [x] Batch-Endpoint `/api/admin/auctions/batch` erstellt
- [x] Parameter: `count`, `duration_minutes`, `bot_target_percentage`, `immediate_percent`
- [x] 40 aktive + geplante Auktionen für Bot-Testing

### Buy It Now Feature
- [x] Backend Endpoint: `POST /api/auctions/{id}/buy-now`
- [x] Preis-Check Endpoint: `GET /api/auctions/{id}/buy-now-price`
- [x] Sofortkauf beendet Auktion und erstellt Kaufdatensatz
- [x] Achievement "Sofortkäufer" wird vergeben

### Auto-Bidder Erweiterungen
- [x] `GET /api/autobidders/all` - Alle aktiven Autobidder eines Users
- [x] `PUT /api/autobidder/{id}/settings` - Einstellungen aktualisieren (max_bids, max_price, pause)
- [x] `GET /api/autobidder/{id}/stats` - Statistiken (verbleibende Gebote, wird fortgesetzt?)
- [x] Pause/Resume Funktionalität für Autobidder

### Achievements & Daily Rewards System
- [x] 18 Achievements in 6 Kategorien (Bieten, Gewinnen, Kaufen, Engagement, Sozial, Spezial)
- [x] Bonus-Gebote als Belohnung für Achievements
- [x] Tägliche Belohnungen mit 7-Tage-Streak-System
- [x] Leaderboard (wöchentlich) mit Punktesystem
- [x] Frontend-Seite `/achievements` mit 3 Tabs

---

## ✅ COMPLETED - Admin Panel Crash Fix (20.01.2026)

### Bug Fix
- [x] **Admin Panel TypeError behoben**: Der `/api/admin/stats/detailed` Endpoint fehlte nach dem Backend-Refactoring
- [x] **Root Cause**: Endpoint wurde nicht in `routers/admin.py` migriert (existierte nur im alten Monolithen)
- [x] **Lösung**: Vollständigen `stats/detailed` Endpoint zu `routers/admin.py` hinzugefügt
- [x] **Ergebnis**: Admin Dashboard und Staff Management UI sind wieder funktional

---

## ✅ COMPLETED - Backend Refactoring (20.01.2026)

### Modulare Architektur
- [x] **server.py refaktoriert** von 4571 Zeilen auf 381 Zeilen
- [x] **Router-System** implementiert:
  - `routers/auth.py` - Authentifizierung, 2FA, Password Reset
  - `routers/auctions.py` - Auktionen CRUD, Bieten, Autobidder
  - `routers/products.py` - Produkt-Verwaltung
  - `routers/admin.py` - Dashboard Stats, Email Marketing
  - `routers/checkout.py` - Stripe & Coinbase Payments
  - `routers/affiliate.py` - Affiliate-Programm
  - `routers/user.py` - Profil, Dashboard, Wishlist
  - `routers/bots.py` - Bot-Verwaltung
  - `routers/vouchers.py` - Gutschein-System
- [x] **Services** ausgelagert:
  - `services/websocket.py` - WebSocket Manager
- [x] **Config & Dependencies** zentralisiert:
  - `config.py` - DB, API Keys, Bid Packages
  - `dependencies.py` - Auth, Password, 2FA Utilities
  - `schemas.py` - Pydantic Models

### Bug-Fixes
- [x] **Bot-Seeding** funktioniert jetzt korrekt (erstellt 20 neue Bots mit eindeutigen Namen)
- [x] **Timer-Logik** erweitert Timer um 10-15 Sekunden statt Reset
- [x] **Winners-Seite** NaN-Fix (Daten-Transformation für nested product object)

---

## What's Been Implemented

### Authentifizierung & Benutzer
- [x] JWT-basierte Registrierung und Login
- [x] Admin- und Kundenrollen
- [x] Benutzer sperren/entsperren
- [x] Gebote-Guthaben System
- [x] Passwort vergessen (3-Schritt-Prozess)
- [x] Profilverwaltung
- [x] Two-Factor Authentication (2FA)

### Zahlungen
- [x] **Stripe Integration** (Karte, Klarna, SEPA)
- [x] **Coinbase Commerce** (Krypto-Zahlungen)
- [x] PDF-Rechnungsgenerierung

### Admin-Panel
- [x] Dashboard mit Statistiken
- [x] **Detaillierte Stats/Charts** (revenue_by_day, bids_by_day, users_by_day)
- [x] Produkt-Verwaltung
- [x] Auktions-Verwaltung
- [x] Benutzer-Verwaltung
- [x] Voucher-System
- [x] Bot-System (Seeding, Einzeln, Multi-Bid)
- [x] **E-Mail Marketing** (Resend Integration)
- [x] **Staff Management System** (Mitarbeiter mit Rollen)
- [x] Sicherheits-Dashboard

### Auktions-System
- [x] Penny-Auktionen mit Timer
- [x] Echtzeit-Updates via WebSocket
- [x] Bot-Bidding im Hintergrund
- [x] Autobidder für Benutzer
- [x] Timer-Verlängerung (nicht Reset)

### Internationalisierung
- [x] 20+ Sprachen unterstützt
- [x] Kosovarisch (xk) hinzugefügt
- [x] Mobile-freundliche Sprachauswahl

---

## Test-Ergebnisse (20.01.2026)
- **Backend Tests:** 97% (28/29 bestanden)
- **Frontend Tests:** 90% (alle Seiten funktional)
- **Test-Accounts:**
  - Admin: admin@bidblitz.de / Admin123!
  - Kunde: kunde@bidblitz.de / Kunde123!

---

## Backlog (P2/P3)

### P1 - Nächste Priorität
- [ ] PayPal Integration
- [ ] Outbid Push-Benachrichtigungen (Backend-Logik)

### P2 - Geplante Features
- [ ] Farbenfrohere Auktionsseite (Design-Refresh)
- [ ] Wishlist & Auktion des Tages
- [ ] Winner's Gallery Sektion
- [ ] Produktions-E-Mail-Konfiguration

### P3 - Technische Schulden
- [ ] Daten-Persistenz Review (In-Memory → MongoDB)
- [ ] Backend-Unit-Tests erweitern
- [ ] API-Dokumentation (OpenAPI/Swagger)
- [ ] Admin Panel Internationalisierung (hardcoded German → i18n)

---

## Code-Architektur

```
/app/backend/
├── server.py           # Main entry, WebSocket, Bot Task
├── config.py           # DB, API Keys, Bid Packages
├── dependencies.py     # Auth utilities, Password, 2FA
├── schemas.py          # Pydantic models
├── routers/
│   ├── auth.py         # Login, Register, 2FA, Password Reset
│   ├── auctions.py     # Auctions CRUD, Bidding, Autobidder, Buy It Now
│   ├── products.py     # Products CRUD
│   ├── admin.py        # Stats, Users, Email Marketing
│   ├── checkout.py     # Stripe, Coinbase
│   ├── affiliate.py    # Affiliate Program
│   ├── user.py         # Profile, Dashboard, Wishlist
│   ├── bots.py         # Bot Management
│   ├── vouchers.py     # Voucher System
│   ├── staff.py        # Staff Management
│   └── rewards.py      # Achievements, Daily Rewards, Leaderboard (NEW)
├── services/
│   └── websocket.py    # WebSocket Manager
├── models/
│   └── schemas.py      # Additional models
└── utils/
    └── auth.py         # Legacy auth utilities

/app/frontend/src/
├── pages/
│   ├── Achievements.js # Achievements, Daily Rewards, Leaderboard (UPDATED)
│   └── ...
├── components/         # Reusable components
├── context/            # Language, Auth context
└── i18n/              # Translations
```

---

## Mocked/Test APIs
- **Stripe:** Test API Key (keine echten Zahlungen)
- **Coinbase Commerce:** Test Mode
- **Resend Email:** Sandbox Domain (nur Admin-Email)
