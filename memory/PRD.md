# BidBlitz - Penny Auction Platform PRD

## Original Problem Statement
Penny-Auktion-Website ähnlich dealdash.com mit Kunden-App und Admin-Panel.

## User Personas
1. **Kunden**: Registrierte Benutzer, die Gebote kaufen und auf Produkte bieten
2. **Admin**: Verwalter der Plattform mit voller Kontrolle über Produkte, Auktionen, Benutzer

## Core Requirements
- Penny-Auktionssystem wo Benutzer auf Produkte bieten
- Admin-Panel für vollständige Verwaltung
- Multi-Sprachen-Unterstützung (DE, EN, AL)
- Zahlungsintegration (Stripe)

---

## What's Been Implemented (18.01.2026)

### Authentifizierung & Benutzer
- [x] JWT-basierte Registrierung und Login
- [x] Admin- und Kundenrollen
- [x] Benutzer sperren/entsperren
- [x] Gebote-Guthaben System
- [x] **Passwort vergessen (3-Schritt-Prozess)**
- [x] **Profilverwaltung (Name, Email ändern)**
- [x] **Passwort ändern**
- [x] **Two-Factor Authentication (2FA)** - TOTP-basiert mit QR-Code
- [x] **Auto-Login** bei gespeicherten Anmeldedaten (Browser autofill)

### Öffentliche Seiten (2.1)
- [x] **Startseite** (Hero, Live-Auktionen, Countdown, Call-to-Action)
- [x] **Auktionsübersicht** mit Filter, Sortierung, Kategorien (snipster-Stil)
- [x] **Auktionsdetailseite** mit Timer und Bieten
- [x] **Login / Registrierung**
- [x] **Passwort vergessen**
- [x] **Impressum / Datenschutz / AGB**
- [x] **Gewinner-Galerie** (/winners) mit Statistiken

### Nutzerbereich (2.2)
- [x] **Dashboard** (Aktive Auktionen, Guthaben, Historie, Autobidder)
- [x] **Profilverwaltung**
- [x] **Gebots-Historie**
- [x] **Gekaufte Gebotspakete**
- [x] **2FA-Verwaltung** - Aktivieren/Deaktivieren
- [x] **Freunde einladen** - Mit €5-Aufladung-Bedingung

### Produkt-Management
- [x] CRUD für Produkte
- [x] Kategorien-System
- [x] Bild-URLs
- [x] UVP-Tracking

### Auktions-System
- [x] Penny-Auktionen mit Timer
- [x] Auktions-Terminplanung (3 Modi)
- [x] Live-Countdown
- [x] Automatische Status-Updates
- [x] Bieten nur bei aktiven Auktionen
- [x] **Sofort Kaufen (Buy It Now)** - Mit Gebots-Guthaben (€0.15 pro Gebot)
- [x] **Autobidder** - Automatisches Bieten bis Maximalpreis
- [x] **Countdown-Timer-Alarm** - Benachrichtigung bei <60 Sekunden

### Admin-Panel
- [x] Dashboard mit Statistiken (Charts)
- [x] Produkt-Verwaltung
- [x] Auktions-Verwaltung mit Scheduling
- [x] Benutzer-Verwaltung
- [x] Voucher/Gutschein-System
- [x] Admin-Bot-System
- [x] **Zahlungsübersicht (Umsatz, Transaktionen)**
- [x] **Systemlogs (Aktivitäten-Tracking)**
- [x] **Sicherheits-Dashboard** (Login-Versuche, VPN-Blocks, 2FA-Stats)

### Kunden-Features
- [x] Bieten auf aktive Auktionen
- [x] Autobidder
- [x] Gutschein einlösen
- [x] Gebotspaket-Kauf
- [x] **Gebots-Historie**
- [x] **Gekaufte Gebotspakete**
- [x] **Sofort Kaufen** - Mit Modal und Preisberechnung

### Sicherheit
- [x] **Starke Passwort-Richtlinien** (8+ Zeichen, Groß/Klein, Zahl, Sonderzeichen)
- [x] **VPN/Proxy-Blockierung** bei Registrierung
- [x] **IP-Beschränkung** (ein Konto pro Haushalt)
- [x] **Rate-Limiting** für Login-Versuche
- [x] **Security-Logs** in MongoDB

### UI/UX
- [x] **Footer Jahr dynamisch** (© 2026 statt 2024)
- [x] **Referral €5-Bedingung angezeigt**

### Öffentliche Seiten
- [x] **Impressum** (§ 5 TMG, Kontakt, Register)
- [x] **Datenschutz** (DSGVO, Cookies, Stripe)
- [x] **AGB** (Auktionsregeln, Widerrufsrecht)

### UI/UX
- [x] **Cookie-Consent Banner**
- [x] **Footer mit rechtlichen Links**
- [x] **Neues Farbschema** (Gold #FFD700, Rot #FF4D4D)
- [x] **Inter/Poppins Fonts**
- [x] Multi-Sprachen (DE, EN, AL)

### Internationalisierung
- [x] Deutsch (DE)
- [x] Englisch (EN)
- [x] Albanisch (SQ)

---

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - API-Endpoints
- MongoDB für Datenpersistenz
- JWT für Authentifizierung

### Frontend (React)
- `/app/frontend/src/` - React-App
- Tailwind CSS + shadcn/ui
- React Context für Auth & Language

### Database Collections
- `users` - Benutzer mit Guthaben
- `products` - Produktkatalog
- `auctions` - Auktionen mit Scheduling
- `vouchers` - Gutscheincodes
- `autobidders` - Auto-Bieter
- `bots` - Admin-Bots
- `payment_transactions` - Zahlungen
- `password_resets` - Reset-Codes

---

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-code`
- `POST /api/auth/reset-password`
- `POST /api/auth/2fa/setup`
- `POST /api/auth/2fa/enable`
- `POST /api/auth/2fa/disable`

### User
- `PUT /api/user/profile`
- `PUT /api/user/change-password`
- `GET /api/user/bid-history`
- `GET /api/user/purchases`

### Auctions
- `GET /api/auctions`
- `GET /api/auctions/{id}`
- `POST /api/auctions/{id}/bid`
- `GET /api/auctions/{id}/buy-now-price` - Preis mit Gebots-Guthaben
- `POST /api/auctions/{id}/buy-now` - Sofort kaufen

### Autobidder
- `POST /api/autobidder/create`
- `GET /api/autobidder/my`
- `DELETE /api/autobidder/{id}`
- `PUT /api/autobidder/{id}/toggle`

### Admin
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/payments`
- `GET /api/admin/logs`
- `POST /api/admin/products`
- `POST /api/admin/auctions`
- `POST /api/admin/vouchers`
- `POST /api/admin/bots`
- `GET /api/admin/security-logs`
- `GET /api/admin/security-stats`

---

## Prioritized Backlog

### P0 (Critical) - COMPLETED ✅
- [x] Auktions-Terminplanung
- [x] Öffentliche Seiten (Impressum, Datenschutz, AGB)
- [x] Passwort vergessen
- [x] Profilverwaltung
- [x] Gebots-Historie & Käufe
- [x] Admin Zahlungsübersicht & Logs
- [x] Cookie-Consent
- [x] Design-Anpassung
- [x] **Admin Dashboard Charts (17.01.2026)** - Recharts: Umsatz, Gebote, Nutzer, Auktionsstatus, Top-Produkte
- [x] **Sicherheitsfix: API-Key in .env** (17.01.2026)
- [x] **Datenpersistenz: In-Memory → MongoDB** (17.01.2026)

### P1 (High Priority)
- [x] E-Mail-Benachrichtigungen (Gewinner, Passwort-Reset) - Resend Integration
- [x] **WebSockets für Echtzeit-Updates (17.01.2026)** - Live-Gebote, Viewer-Zähler, Toast-Benachrichtigungen
- [x] **Mobile-Optimierung (17.01.2026)** - Responsive Navigation, Touch-optimierte UI, Sticky Bid-Button
- [x] **Gebotsverlauf auf Auktionsseite (18.01.2026)** - Live-Tabelle mit Bieter, Preis, Zeit
- [x] **"Sofort Kaufen" Feature (18.01.2026)** - Mit Gebots-Guthaben (€0.15/Gebot)

### P2 (Medium Priority)
- [x] Admin-Statistiken & Berichte (Charts) ✅
- [x] **Kategorien-Filter auf Auktionsseite (18.01.2026)** - Quick-Filter Buttons
- [x] **Gewinner-Galerie (18.01.2026)** - /winners Seite mit Statistiken und Winner-Cards
- [ ] User-Referral-System erweitern
- [ ] PayPal Integration

### P3 (Low Priority)
- [x] Two-Factor Authentication ✅
- [ ] PDF-Rechnungen
- [ ] Push-Benachrichtigungen
- [ ] VIP-Mitgliedschaft
- [ ] Achievements/Gamification

---

## Test Credentials
- **Admin**: admin@bidblitz.de / Admin123!
- **Kunde**: kunde@bidblitz.de / Kunde123!

---

## Test Reports
- `/app/test_reports/iteration_1.json` - Neue Features Tests (22 bestanden)
- `/app/test_reports/iteration_2.json` - Admin Dashboard Charts Tests (11 bestanden)
- `/app/test_reports/iteration_3.json` - WebSocket Real-time Tests (13 bestanden)
- `/app/test_reports/iteration_4.json` - Full Features Tests (20 bestanden)
- `/app/test_reports/iteration_5.json` - New Features v2 Tests (13 bestanden)
- `/app/test_reports/iteration_6.json` - **Buy It Now + Autobidder Tests (15 bestanden)**
- `/app/tests/test_buy_now_autobidder.py` - Test-Suite für Sofort Kaufen und Autobidder

---

## Mocked APIs
- **E-Mail-Versand**: Passwort-Reset-Code wird in API-Response (demo_code) zurückgegeben. RESEND_API_KEY ist Platzhalter
- **Stripe**: Test-Key (sk_test_emergent) - echte Zahlungen nicht möglich
- **Admin Payments/Logs**: Mock-Daten für Demo

---

## Last Updated
18.01.2026 - "Sofort Kaufen" (Buy It Now) Feature implementiert mit Gebots-Guthaben-System
