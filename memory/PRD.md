# BidBlitz.ae - Product Requirements Document

## Original Problem Statement
BidBlitz ist eine umfassende Zahlungs- und Auktionsplattform mit:
- Penny-Auktionen für Premium-Produkte
- BidBlitz Pay (digitale Wallet für Kunden)
- Staff POS für Händler/Kassensystem
- Bot-System für realistische Auktions-Aktivität
- Merchant Portal für kleine und große Händler
- Kunden-Loyalty-System mit VIP-Stufen, Cashback und Empfehlungen
- BNPL (Buy Now Pay Later) für Gebotepakete und gewonnene Auktionen

## User Language
German (Deutsch)

## 🚀 IONOS Server Deployment (2026-02-26)
**Server erfolgreich eingerichtet und live!**

### Server-Informationen
- **IP:** `212.227.20.190`
- **OS:** Ubuntu 24.04 LTS
- **User:** root

### Installierte Software
- MongoDB 7.0 (läuft als systemd service)
- Node.js v20.20.0
- Python 3.12.3 mit venv
- Nginx als Reverse Proxy
- Yarn, Certbot

### Services (systemd)
- `bidblitz-backend.service` - Backend auf Port 8001
- `bidblitz-frontend.service` - Frontend auf Port 3000 (serve -s build)
- `mongod.service` - MongoDB
- `nginx.service` - Reverse Proxy

### Dateipfade auf dem Server
- App: `/var/www/bidblitz/`
- Backend venv: `/var/www/bidblitz/backend/venv/`
- Frontend build: `/var/www/bidblitz/frontend/build/`
- Nginx config: `/etc/nginx/sites-available/bidblitz`
- Deploy script: `/var/www/bidblitz/scripts/deploy.sh`

### CI/CD Pipeline (GitHub Actions)
- Workflow-Datei: `.github/workflows/deploy.yml`
- **WICHTIG:** GitHub Secret `SERVER_PASSWORD` muss gesetzt werden!
- Automatisches Deployment bei Push auf `main` Branch

## Core Architecture
```
/app
├── backend (FastAPI)
│   ├── routers/
│   │   ├── pos_terminal.py           # POS Zahlungen + Loyalty-Integration
│   │   ├── auctions.py               # Auktions-Endpunkte
│   │   ├── bidblitz_pay.py           # Wallet-Funktionen
│   │   ├── bnpl_system.py            # NEU: Buy Now Pay Later System
│   │   ├── merchant_features.py      # Händler-Produkte, Dashboard, Coupons
│   │   └── loyalty_system.py         # VIP-Tiers, Cashback, Empfehlungen
│   ├── services/
│   │   └── websocket.py              # Echtzeit-Updates
│   └── server.py                     # Bot-Tasks, WebSocket, Router-Registrierung
├── frontend (React)
│   ├── pages/
│   │   ├── StaffPOS.js               # Kassensystem
│   │   ├── BidBlitzPay.jsx           # Kunden-Wallet
│   │   ├── Auctions.js               # Auktions-Übersicht mit Kategoriefiltern
│   │   ├── BuyBids.js                # Gebote kaufen + BNPL-Integration
│   │   ├── WholesaleDashboard.js     # Händler-Dashboard
│   │   ├── MyInstallments.jsx        # Benutzer Ratenzahlungsübersicht
│   │   └── CustomerLoyaltyDashboard.jsx # Kunden-Loyalty-Dashboard
│   ├── components/
│   │   ├── BNPLModal.jsx             # NEU: Ratenzahlung Modal
│   │   └── DailyLoginPopup.jsx       # Tägliche Belohnung Popup
│   └── components/ui/                # Shadcn UI
└── memory/
    └── PRD.md
```

## Key Credentials
- **Admin:** admin@bidblitz.ae / Admin123!
- **Customer:** kunde@bidblitz.ae / Kunde123!
- **Staff POS:** TS-001 / Test123!

### ✅ Daily Login Popup Dev-Mode (2026-02-26)
- Popup kann für Tests deaktiviert werden via:
  `localStorage.setItem('disableDailyLoginPopup', 'true')`

- **Merchant:** demo@grosshandel.de / Haendler123!

## Database
- **Cloud MongoDB Atlas** (bidblitz)
- Collections: auctions, bots, users, pos_transactions, customer_payment_tokens, user_loyalty, merchant_products, merchant_coupons, installment_plans

---

## Implemented Features (as of 2026-02-26)

### ✅ BNPL System (NEU - 2026-02-26)
**Backend APIs vollständig implementiert und getestet (100% Pass Rate):**
- 3, 6 oder 12 Raten (0%, 2.9%, 5.9% Zinsen)
- Bonitätsprüfung basierend auf Kaufhistorie
- Kreditlimit berechnet aus: Basis (€100) + Kaufhistorie-Bonus + VIP-Multiplikator
- Max. 3 offene Ratenzahlungen pro Benutzer
- Frontend-Button in BuyBids.js für Pakete >= €50
- **Frontend-Button in WonAuctionCheckout.js** für gewonnene Auktionen >= €50
- Modal-Komponente für Planauswahl
- **Admin Dashboard** unter `/admin/bnpl` mit:
  - Statistik-Übersicht (Gesamt, Aktiv, Abgeschlossen, Überfällig)
  - Finanzübersicht (Gesamtvolumen, Ausstehend, Eingezogen)
  - Tabellenansicht aller Pläne mit Filterung
  - **Mahnung-Button mit E-Mail-Versand via Resend**
- **"Meine Ratenzahlungen" Link** im Dashboard Quick Access Bereich

### ✅ Merchant Dashboard Fixes (2026-02-26)
- Feld-Mapping korrigiert (API: title → Frontend: name)
- Produkte zeigen jetzt: Titel, Bild, Preis, Status
- Coupons zeigen jetzt: Code, Rabatt, Status, Verwendung

### ✅ Enterprise Portal Filter Update (2026-02-26)
- **Datums-/Filialfilter** für Dashboard und Reports hinzugefügt:
  - Schnellauswahl: Heute, Woche, Monat, Jahr
  - Benutzerdefinierter Zeitraum mit Von-/Bis-Datumsauswahl
  - Schnellauswahl-Presets: Gestern, Letzte 7 Tage, Letzte 30 Tage, Dieser Monat
  - Filialfilter-Dropdown zum Filtern nach spezifischer Filiale
  - Backend-APIs unterstützen `date_from` und `date_to` Parameter
- **Test-Account:** edeka@test.de / Test123!

### ✅ Merchant & Loyalty Features (2026-02-25)
**Backend APIs vollständig implementiert und getestet:**

#### Customer Loyalty System (`/api/customer-loyalty/*`)
- VIP-Stufen: Bronze (1% Cashback), Silber (2%), Gold (3%), Platin (5%)
- Punkte-System: 10 Punkte pro Euro, Multiplikator je nach Stufe
- Cashback automatisch bei jeder POS-Zahlung
- Empfehlungssystem: €5 für Werber, €2 für Geworbene
- Digitale Wallet-Karte für Apple/Google Wallet

#### Merchant Dashboard (`/api/merchant/*`)
- Filial-Dashboard mit Tages/Wochen/Monats-Statistiken
- Händler können eigene Produkte/Auktionen erstellen
- Gutschein-System (Prozent oder Festbetrag)
- Mitarbeiter-Verwaltung
- Provisions-Übersicht (5% auf Gebote-Käufe)

### ✅ Staff POS Scanner (2026-02-25)
- Hardware-Scanner (Keyboard-Wedge) als primäre Eingabe
- Manuelle Barcode-Eingabe als Backup
- Live-Kamera-Scanner als Fallback
- Automatisches Schließen nach Transaktion
- Echtzeit-Benachrichtigung an Kunden via WebSocket

### ✅ Sicherheits-Fix: Dynamische Barcodes (2026-02-25)
- QR/Barcodes sind jetzt Single-Use mit Ablaufzeit

### ✅ Auktions-System
- 58 gemischte Auktionen in 5 Kategorien (inkl. VIP, Nacht, Anfänger)
- Bot-System aktiv (100+ Bots)
- Early Bidder + Last Second Bidder Tasks
- €0.01 Inkrement-Bidding

---

## API Endpoints

### BNPL (Buy Now Pay Later)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/bnpl/eligibility` | GET | Yes | Berechtigung prüfen |
| `/api/bnpl/calculate` | GET | No | Raten berechnen |
| `/api/bnpl/create-plan` | POST | Yes | Plan erstellen |
| `/api/bnpl/my-plans` | GET | Yes | Eigene Pläne |
| `/api/bnpl/pay-installment` | POST | Yes | Rate bezahlen |
| `/api/bnpl/admin/overview` | GET | Admin | Admin-Übersicht aller Pläne |
| `/api/bnpl/admin/plan/{id}` | GET | Admin | Plan-Details |
| `/api/bnpl/admin/send-reminder` | POST | Admin | Zahlungserinnerung senden |

### Customer Loyalty
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/customer-loyalty/status` | GET | Yes | VIP-Status, Punkte, Cashback |
| `/api/customer-loyalty/points/history` | GET | Yes | Punkte-Verlauf |
| `/api/customer-loyalty/points/redeem` | POST | Yes | Punkte einlösen (100 = €1) |
| `/api/customer-loyalty/cashback/history` | GET | Yes | Cashback-Verlauf |
| `/api/customer-loyalty/referral` | GET | Yes | Empfehlungs-Info |
| `/api/customer-loyalty/referral/apply` | POST | Yes | Code einlösen |
| `/api/customer-loyalty/wallet-card` | GET | Yes | Digitale Kundenkarte |

### Merchant Features
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/merchant/dashboard` | GET | Merchant | Statistiken |
| `/api/merchant/products` | GET/POST | Merchant | Produkte |
| `/api/merchant/coupons` | GET/POST/DELETE | Merchant | Gutscheine |
| `/api/merchant/staff` | GET/POST/PUT/DELETE | Merchant | Mitarbeiter |
| `/api/merchant/commissions` | GET | Merchant | Provisionen |

---

## Upcoming Tasks

### P0 - Server Migration (ERLEDIGT ✅)
- [x] IONOS Server eingerichtet
- [x] MongoDB, Node.js, Python, Nginx installiert
- [x] App deployed und läuft unter http://212.227.20.190
- [x] GitHub Actions CI/CD Workflow erstellt
- [x] **Frontend-Build repariert (2026-02-27)** - Build-Ordner war unvollständig
- [x] **2GB Swap-Datei erstellt (2026-02-27)** - Server-Stabilität verbessert
- [x] **SSL-Zertifikat aktiv** - https://bidblitz.ae funktioniert
- [x] **Login funktioniert** - Admin-Login erfolgreich getestet

### P1 - Noch zu erledigen
- [x] ~~SSL-Zertifikat einrichten~~ (ERLEDIGT - Let's Encrypt aktiv)
- [x] ~~Domain `bidblitz.ae` DNS auf `212.227.20.190` ändern~~ (ERLEDIGT)
- [ ] GitHub Secret `SERVER_PASSWORD` setzen

### Health-Check & User Status (2026-02-27)
- [x] **Health-Check-Endpunkt** `/api/health` - Prüft DB, E-Mail-Service, Umgebung
- [x] **Benutzer-Status-Anzeige verbessert** - Zeigt jetzt:
  - ✓ Aktiv (E-Mail verifiziert + KYC approved)
  - 📧 E-Mail ausstehend
  - ⚠ KYC fehlt (Dokumente nicht hochgeladen)
  - 🕐 KYC prüfen (Dokumente hochgeladen, wartet auf Admin)
  - 🚫 Gesperrt
- [x] **E-Mail-Versand funktioniert** - Resend API korrekt konfiguriert
- [x] **Automatische E-Mail-Erinnerungen** - Benutzer werden nach 24h erinnert, wenn sie ihre E-Mail nicht verifiziert haben
  - Hintergrund-Task läuft stündlich
  - Max. 1 Erinnerung pro 48h
  - Admin-Endpunkt: `POST /api/health/send-reminders`
- [x] ✅ Datenbank mit Auktionen, Benutzern, Bots befüllen (2026-02-26)
  - 50 Auktionen (verschiedene Kategorien: Elektronik, Gaming, Haushalt, Luxus, Gutscheine)
  - 100 Bots mit deutschen Namen
  - 6 Gebotspakete
  - Test-Benutzer: admin@bidblitz.ae, kunde@bidblitz.ae, demo@grosshandel.de, edeka@test.de

### P2 - Frontend Verbesserungen
- [ ] Push-Benachrichtigungen (FCM)
- [ ] Händler-Finder mit Kartenansicht

### P2 - Refactoring
- [ ] StaffPOS.js aufteilen (>3500 Zeilen)
- [ ] Auctions.js aufteilen
- [ ] WholesaleDashboard.js in Sub-Komponenten

---

## Test Reports
- Latest: `/app/test_reports/iteration_113.json` (9/9 passed - BNPL & Merchant)
- Previous: `/app/test_reports/iteration_112.json` (21/21 passed)
- Test files: `/app/backend/tests/test_bnpl_merchant_features.py`

---

## Blocked Items
- WhatsApp Integration: Benötigt API-Keys
- App Store Submission: Benötigt hochauflösendes Logo
- SSL: Domain muss zuerst auf neue IP zeigen
