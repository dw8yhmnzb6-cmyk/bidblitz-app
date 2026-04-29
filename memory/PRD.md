# BidBlitz Super App — PRD

## Original Problem Statement
BidBlitz ist eine voll-funktionsfähige React + FastAPI + MongoDB Super App mit Auctions, Wallet, Mining, POS/Kassensystem, Stripe-Integration, Loyalty, Crypto, Kids-Modus und vielem mehr. Sprache: Deutsch (Fast Mode). Ziel ist ein produktionsreifes POS-System auf REWE/Aldi-Niveau plus weitere Features.

## Strikte Geschäftsregeln
- **Auctions/Products: max. 2000 € retail_price**
- **Vouchers: max. 2000 €**, **Wallet-Topup: max. 500 €**
- Service Worker Caching ist DEAKTIVIERT (Mobile Cache-Probleme)
- Production DB (bidblitz.ae) ist IP-whitelisted → Preview ist Source of Truth

## Implementiert (April 2026)

### POS-System (Phase 1+2+3+4 abgeschlossen)
- ✅ Modulares POS (Dashboard/Checkout/Products/Inventory Tabs)
- ✅ **Vouchers**: Verkauf, Einlösung, Status-Check, als Zahlungsmethode (Split-Payment)
- ✅ **Wallet-Topup am POS** (Kunde via E-Mail aufladen)
- ✅ **Compliance Tab**: Z-Bon, X-Bon, DSFinV-K Export, Kassenmeldepflicht (§146a AO)
- ✅ **Add-On / Feature-Flag-System**: 18 Features pro Merchant zubuchbar (Tisch-Reservierung, QR-Bestellung, KDS, Loyalty, KI, Compliance, Self-Checkout, …) mit Trial + Admin-Toggle
- ✅ **Public API v1** (`/api/pos/public/v1/*`) mit X-API-Key Auth, Scopes (read/write), Feature-Gating (HTTP 402 wenn Add-On nicht aktiv)
- ✅ **Self-Checkout Customer-Route** (`/selfcheckout?store=...`): Kunde scannt QR → Session → Barcode-Scan → Cart → Wallet-Pay → Beleg. Endpunkte unter `/api/pos/selfcheckout/*`. Feature-Gated via `self_checkout` Add-On.
- ✅ **Offline-Modus**: Cash-Verkäufe in localStorage Queue, Auto-Sync bei Online
- ✅ TSE/Fiskaly, KDS, Tisch-QR, Pfand, Dynamic Pricing, Time-Clock, Tips
- ✅ DATEV/Lexoffice Export, OCR Lieferschein, Voice Commands

### Auctions
- ✅ 30 realistische Auktionen <= 2000 € (Unsplash) mit Auto-Bidding-Bots
- ✅ **Auto-Redirect zu Credits-Kauf-Modal** wenn User keine Bid-Credits hat
- ✅ Auctions Push, Watchlist, AutoBid

### Auth / Wallet / Crypto / Stripe / etc.
Alle bestehenden Features stabil (siehe Code-Architektur in Handoff-Summary).

## Architektur

### Backend (`/app/backend/`)
- `routes/pos_system.py` — Core POS (Merchants, Stores, Carts, Payments, Sales, Refunds)
- `routes/pos_vouchers.py` — Gutscheine + Topup ✱ (Phase 1)
- `routes/pos_features.py` — Feature-Flag-System (18 Add-Ons) ✱
- `routes/pos_public_api.py` — Public API v1 mit X-API-Key Auth ✱
- `routes/pos_kassenmeldung.py` — Kassenmeldepflicht §146a AO ✱
- `routes/pos_extended.py` — Z-Bon/DSFinV-K, Tische, Loyalty, FX
- `routes/pos_pro.py` — TSE, KDS, Pfand, KI, Pricing, Time-Clock, Tips, API-Keys
- `routes/pos_advanced.py` — OCR, Voice, Stocktake, Recipes, Forecast, DATEV
- `routes/pos_inventory.py` — Stock, Suppliers, POs, NFC, Reports
- `routes/pos_payments.py` — Barcode/NFC-Pay, Vouchers (legacy), Receipts
- `core/payment_engine.py` — TransactionType (neu: VOUCHER_REDEMPTION, WALLET_TOPUP_POS)

### Frontend (`/app/frontend/src/`)
- `pages/POSPage.jsx` — POS-Hub mit Tabs: Dashboard, Kasse, Produkte, Bestand, …, **Compliance**, **Add-Ons**, Admin
- `pages/POSComplianceTab.jsx` — Z-Bon/DSFinV-K/Kassenmeldung ✱
- `components/pos/POSCheckoutTab.jsx` — Checkout mit Voucher-Sale/Topup-Toggle, Voucher-Pay, Offline-Queue ✱
- `components/pos/POSVoucherComponents.jsx` — Sell/Topup-UI
- `components/pos/POSFeaturesComponents.jsx` — Merchant + Admin Feature-UI ✱
- `pages/AuctionsPage.jsx` — Auto-Redirect zu Credits-Kauf bei 0 Credits ✱

## Test-Status
- Backend: **29/29 grün** (iteration_21.json) — Voucher Flows, Topup, Redeem-as-Payment, Feature-Catalog/Toggle/Trial, Public API v1 mit Feature-Gating (402), Kassenmeldung, Z-Bon/DSFinV-K, Cart+Cash-Payment Regression
- Frontend: Smoke-Test (Lint OK, kompiliert sauber)

## Known Issues / Backlog

### P1
- Native Mobile Build (Capacitor Node-Konflikt)
- Echte Fiskaly-Cloud Credentials (Mock vorhanden)

### P2
- Per-API-Key Rate-Limiting auf Public API (slowapi)
- Audit-Log Filter Endpoint (Backend) — Frontend filtert client-seitig
- Trial-Workflow: Reset durch Admin
- Self-Service Add-On Buchung mit Stripe-Checkout (statt nur Trial)

## Credentials
- POS Admin: `admin@bidblitz.com` / `BidBlitz2026!` (Merchant `MER-520D937E02F3` "Eiscafe", store_id `S1`, register_id `R1`)
- Siehe `/app/memory/test_credentials.md`

## Stand
**29.04.2026** — Phase 1 (Bug-Fixes), Phase 2 (Compliance), Phase 3 (Add-Ons + API), Phase 4 (Offline + Auto-Redirect) komplett.
