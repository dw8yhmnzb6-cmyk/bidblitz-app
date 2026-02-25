# BidBlitz.ae - Product Requirements Document

## Original Problem Statement
BidBlitz ist eine umfassende Zahlungs- und Auktionsplattform mit:
- Penny-Auktionen für Premium-Produkte
- BidBlitz Pay (digitale Wallet für Kunden)
- Staff POS für Händler/Kassensystem
- Bot-System für realistische Auktions-Aktivität
- Merchant Portal für kleine und große Händler
- Kunden-Loyalty-System mit VIP-Stufen, Cashback und Empfehlungen

## User Language
German (Deutsch)

## Core Architecture
```
/app
├── backend (FastAPI)
│   ├── routers/
│   │   ├── pos_terminal.py           # POS Zahlungen + Loyalty-Integration
│   │   ├── auctions.py               # Auktions-Endpunkte
│   │   ├── bidblitz_pay.py           # Wallet-Funktionen
│   │   ├── merchant_features.py      # NEU: Händler-Produkte, Dashboard, Coupons
│   │   └── loyalty_system.py         # NEU: VIP-Tiers, Cashback, Empfehlungen
│   ├── services/
│   │   └── websocket.py              # Echtzeit-Updates
│   └── server.py                     # Bot-Tasks, WebSocket, Router-Registrierung
├── frontend (React)
│   ├── pages/
│   │   ├── StaffPOS.js               # Kassensystem
│   │   ├── BidBlitzPay.jsx           # Kunden-Wallet
│   │   ├── Auctions.js               # Auktions-Übersicht mit Kategoriefiltern
│   │   ├── WholesaleDashboard.js     # Händler-Dashboard
│   │   └── CustomerLoyaltyDashboard.jsx # NEU: Kunden-Loyalty-Dashboard
│   └── components/ui/                # Shadcn UI
└── memory/
    └── PRD.md
```

## Key Credentials
- **Admin:** admin@bidblitz.ae / Admin123!
- **Customer:** kunde@bidblitz.ae / Kunde123!
- **Staff POS:** TS-001 / Test123!
- **Merchant:** demo@grosshandel.de / Haendler123!

## Database
- **Cloud MongoDB Atlas** (bidblitz)
- Collections: auctions, bots, users, pos_transactions, customer_payment_tokens, user_loyalty, merchant_products, merchant_coupons

---

## Implemented Features (as of 2026-02-25)

### ✅ Merchant & Loyalty Features (NEU - 2026-02-25)
**Backend APIs vollständig implementiert und getestet (100% Pass Rate):**

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
- Push-Benachrichtigungen an Kunden

### ✅ Tutorial-Modal deaktiviert (2026-02-25)
- Onboarding-Tour temporär deaktiviert zur Entwicklungsbeschleunigung
- Kann in OnboardingTour.js wieder aktiviert werden

### ✅ Kategoriefilter
- 5 Produktkategorien: Elektronik, Mode, Haus & Garten, Sport, Kunst
- Filter-Buttons auf der Auktionsseite

### ✅ Staff POS Scanner (2026-02-25)
- Hardware-Scanner (Keyboard-Wedge) als primäre Eingabe
- Manuelle Barcode-Eingabe als Backup
- Live-Kamera-Scanner als Fallback
- Automatisches Schließen nach Transaktion
- Echtzeit-Benachrichtigung an Kunden via WebSocket

### ✅ Sicherheits-Fix: Dynamische Barcodes (2026-02-25)
- QR/Barcodes sind jetzt Single-Use mit Ablaufzeit
- Alte/statische Barcodes können nicht mehr wiederverwendet werden

### ✅ Auktions-System
- 51 gemischte Auktionen in 5 Kategorien
- Bot-System aktiv (288 Bots)
- Early Bidder + Last Second Bidder Tasks

### ✅ BidBlitz Pay
- QR-Code + Barcode für Kunden-Identifikation
- Echtzeit-Zahlungsbestätigung via WebSocket

---

## Pending Issues (Priority Order)

### 🟡 P1 - Frontend für Merchant-Features
- **Status:** Backend fertig, Frontend-Integration ausstehend
- **TODO:** WholesaleDashboard.js erweitern mit:
  - Produkt-Erstellung UI
  - Gutschein-Verwaltung UI
  - Push-Benachrichtigungen UI

### 🟡 P2 - KYC Upload Flow
- **Status:** User-Verifizierung ausstehend

### 🟡 P2 - Mobile Layout Issues
- **Status:** Wiederkehrende CSS-Probleme

---

## API Endpoints (New)

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
| `/api/merchant/notifications/send` | POST | Merchant | Push senden |
| `/api/merchant/public/find` | GET | Public | Händler finden |

---

## Upcoming Tasks

### P0 - Continue Merchant & Loyalty Implementation
1. Frontend-UI für Händler-Produkte in WholesaleDashboard
2. Frontend-UI für Gutschein-Erstellung
3. Link zu Loyalty-Dashboard in Navbar hinzufügen

### P1 - Additional Features
- Händler-Finder mit Kartenansicht
- Push-Benachrichtigungen (FCM)
- WhatsApp-Integration (blockiert - API-Keys benötigt)

### P2 - Refactoring
- StaffPOS.js aufteilen (>3500 Zeilen)
- Auctions.js aufteilen

---

## Test Reports
- Latest: `/app/test_reports/iteration_112.json` (21/21 passed)
- Test files: `/app/backend/tests/test_loyalty_merchant_features.py`

---

## Blocked Items
- WhatsApp Integration: Benötigt API-Keys
- App Store Submission: Benötigt hochauflösendes Logo
- Tawk.to Chat: Benötigt API-Keys
