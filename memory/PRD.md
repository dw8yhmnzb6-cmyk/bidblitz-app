# BidBlitz.ae - Product Requirements Document

## Original Problem Statement
BidBlitz ist eine umfassende Zahlungs- und Auktionsplattform mit:
- Penny-Auktionen für Premium-Produkte
- BidBlitz Pay (digitale Wallet für Kunden)
- Staff POS für Händler/Kassensystem
- Bot-System für realistische Auktions-Aktivität

## User Language
German (Deutsch)

## Core Architecture
```
/app
├── backend (FastAPI)
│   ├── routers/
│   │   ├── pos_terminal.py      # POS Zahlungen
│   │   ├── auctions.py          # Auktions-Endpunkte
│   │   └── bidblitz_pay.py      # Wallet-Funktionen
│   ├── services/
│   │   └── websocket.py         # Echtzeit-Updates
│   └── server.py                # Bot-Tasks, WebSocket
├── frontend (React)
│   ├── pages/
│   │   ├── StaffPOS.js          # Kassensystem
│   │   ├── BidBlitzPay.jsx      # Kunden-Wallet
│   │   └── Auctions.js          # Auktions-Übersicht
│   └── components/ui/           # Shadcn UI
└── memory/
    └── PRD.md
```

## Key Credentials
- **Admin:** admin@bidblitz.ae / Admin123!
- **Customer:** kunde@bidblitz.ae / Kunde123!
- **Staff POS:** TS-001 / Test123!

## Database
- **Cloud MongoDB Atlas** (bidblitz)
- Collections: auctions, bots, users, pos_transactions, customer_payment_tokens

---

## Implemented Features (as of 2026-02-25)

### ✅ Kategoriefilter (NEU)
- 5 Produktkategorien: Elektronik, Mode, Haus & Garten, Sport, Kunst
- Filter-Buttons auf der Auktionsseite
- Funktioniert parallel zu Auktionstyp-Filtern

### ✅ Staff POS Hardware-Scanner (NEU - 2026-02-25)
- Automatischer Focus auf Barcode-Eingabefeld
- Enter-Taste nach Betragseingabe aktiviert Scanner-Modus
- Hardware-Scanner (USB/Keyboard-Emulation) unterstützt
- Zahlung wird automatisch bei Enter verarbeitet

### ✅ Auktions-System
- 51 gemischte Auktionen in 5 Kategorien (Elektronik, Mode, Haus & Garten, Sport, Kunst)
- Bot-System aktiv (288 Bots mit Budget €50k-€200k)
- Early Bidder + Last Second Bidder Tasks
- WebSocket-basierte Echtzeit-Updates

### ✅ BidBlitz Pay (Wallet)
- QR-Code + Barcode für Kunden-Identifikation
- Echtzeit-Zahlungsbestätigung via WebSocket
- Guthaben-Anzeige und Top-Up

### ✅ Staff POS
- Betragserfassung
- Barcode-Eingabefeld für Hardware-Scanner (implementiert)
- Transaktionshistorie

### ✅ Backend
- FastAPI mit Motor (async MongoDB)
- WebSocket-Service für Echtzeit-Updates
- Bot-Tasks als Background-Tasks

---

## Pending Issues (Priority Order)

### 🔴 P0 - Hardware Barcode Scanner
- **Status:** Teilweise implementiert
- **Problem:** Barcode-Eingabefeld vorhanden, muss getestet werden
- **Lösung:** Auto-Focus nach Betragseingabe, Enter triggert Zahlung

### 🟡 P1 - Mobile Scanner (iOS)
- **Status:** BLOCKED - User nutzt Hardware-Scanner
- **Problem:** Kamera öffnet nicht auf iPhone
- **Klärung nötig:** Wird mobile Scanning noch benötigt?

### 🟡 P2 - KYC Upload Flow
- **Status:** User-Verifizierung ausstehend
- **Test:** Register → Email-Verify → Login → Dokumente hochladen

### 🟡 P2 - Mobile Layout Issues
- **Status:** Wiederkehrende CSS-Probleme

---

## Upcoming Tasks

### P1 - Push Notifications
- Benachrichtigungen für Zahlungen, Outbids, Gewinner

### P1 - Referral System
- "Kunden werben Kunden" Feature

### P2 - BidBlitz Pay Features
- SpendingStats.jsx → /api/bidblitz-pay/spending-stats
- CardLock.jsx → Lock/Unlock API
- QuickTopUp.jsx → Stripe Apple/Google Pay (benötigt Integration Playbook)

---

## Blocked Tasks

### App Store Submission
- Wartet auf: High-Resolution Logo vom User

### WhatsApp/Tawk.to Integration
- Wartet auf: API Keys vom User

---

## 3rd Party Integrations
- **Resend:** Transaktions-Emails
- **Stripe:** Zahlungen (Test-Key vorhanden)
- **react-barcode:** Kunden-Barcode
- **Capacitor:** Native App Wrapper
- **Wise:** Auszahlungen

---

## Notes for Next Agent
1. User kommuniziert auf Deutsch
2. Hardware-Scanner ist bevorzugte Methode (nicht Kamera)
3. Cloud-DB vs. lokale DB beachten (MONGO_URL in .env)
4. Bots bieten auf `current_bid` nicht `current_price`
