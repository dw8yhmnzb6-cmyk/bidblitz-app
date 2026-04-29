# BidBlitz Super App — PRD

## Original Problem Statement
BidBlitz ist eine voll-funktionsfähige React + FastAPI + MongoDB Super App mit Auctions, Wallet, Mining, POS/Kassensystem, Stripe-Integration, Loyalty, Crypto, Kids-Modus und vielem mehr. Sprache: Deutsch (Fast Mode). Ziel ist ein produktionsreifes POS-System auf REWE/Aldi-Niveau plus weitere Features.

## Strikte Geschäftsregeln
- **Auctions/Products: max. 2000 € retail_price**
- **Vouchers: max. 2000 €**, **Wallet-Topup: max. 500 €**
- Service Worker Caching ist DEAKTIVIERT (Mobile Cache-Probleme)
- Production DB (bidblitz.ae) ist IP-whitelisted → Preview ist Source of Truth

## Implementiert (April 2026)

### POS-System (Phase 1+2+3+4+5+6 abgeschlossen)
- ✅ Modulares POS (Dashboard/Checkout/Products/Inventory Tabs)
- ✅ **Vouchers**: Verkauf, Einlösung, Status-Check, als Zahlungsmethode (Split-Payment)
- ✅ **Wallet-Topup am POS** (Kunde via E-Mail aufladen)
- ✅ **Compliance Tab**: Z-Bon, X-Bon, DSFinV-K Export, Kassenmeldepflicht (§146a AO)
- ✅ **Add-On / Feature-Flag-System**: 18 Features pro Merchant zubuchbar mit Trial + Admin-Toggle
- ✅ **Stripe-Checkout für Add-On-Buchung**: 1/3/6/12 Monate mit 0/5/10/20% Mengenrabatt → Auto-Aktivierung via Webhook (sk_test_emergent)
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
- Backend: **29/29 grün** (POS) — Voucher Flows, Topup, Redeem-as-Payment, Feature-Catalog/Toggle/Trial, Public API v1 mit Feature-Gating (402), Kassenmeldung, Z-Bon/DSFinV-K, Cart+Cash-Payment Regression
- Backend Super-App neue Routes: **41/41 grün** (iteration_24.json) — split_payment, loyalty (+levels/history), reviews, scheduled, subscriptions, safety, promo, filters, group_orders, quick_actions, tips_gifts (+presets), delivery_options, bnpl
- Frontend: Smoke-Test (Lint OK, kompiliert sauber)

## Super-App Feature Parity (Uber/Bolt, Lime/Tier, Lieferando)

### Backend (Stand 29.04.2026)
- ✅ `/api/split-payment/*` — Taxi & Food split-payment
- ✅ `/api/loyalty/*` — Punkte, Stempelkarte, Levels, Leaderboard, Verlauf
- ✅ `/api/reviews/*` — Bewertungen mit Helpful-Count + Foto-Upload
- ✅ `/api/scheduled/*` — Geplante Fahrten/Bestellungen (max 30 Tage)
- ✅ `/api/subscriptions/*` — Scooter Pass, Food Plus, etc.
- ✅ `/api/safety/*` — Notfall-Kontakte, Trip-Sharing, PIN-Verify
- ✅ `/api/promo/*` — Promo-Codes & Voucher
- ✅ `/api/filters/*` — Erweiterte Restaurant-Filter (Cuisine, Diet, Rating)
- ✅ `/api/group/*` — Group Orders & Group Rides (Frontend verkabelt in /food + /taxi)
- ✅ `/api/quick/*` — Reorder, Favoriten, Wishlist
- ✅ `/api/tips/*` — Trinkgeld, Gift Cards, Presets
- ✅ `/api/delivery/*` — Kontaktlose Lieferung, Anweisungen
- ✅ `/api/bnpl/*` — Buy Now Pay Later (Klarna-style)
- ✅ Single-Point Fix: `core/security.py::get_current_user` normalisiert `user_id`/`first_name`/`last_name`
- ✅ `/api/admin/audit-logs` — erweitert um `date_from`/`date_to`/`email`/`search` Filter + `available_events`/`available_severities` Dropdowns
- ✅ `/api/pos/store/{store_id}/qr-poster` — QR-Poster pro Store (PNG/SVG/JSON) für Self-Checkout-Eingang
- ✅ `/api/pos/features/admin/trial-reset` — Admin kann Feature-Trial zurücksetzen
- ✅ `/api/pos/staff/list` + `/staff/update` + `/staff/remove` — Staff-CRUD (Mitarbeiter-Berechtigungen)
- ✅ `/api/pos/timeclock/*` — Zeiterfassung (Clock in/out, break)
- ✅ **`/api/chat/ws/{room_id}` WebSocket** — Live-Chat zwischen Passagier/Fahrer mit History-Replay + Persistenz + Broadcast
- ✅ `/api/chat/messages/{room_id}` REST-Bootstrap & `/api/chat/quick-reply` (arriving/waiting/thank_you Quick-Replies)

### Frontend (Stand 29.04.2026)
- ✅ Komponenten erstellt: `SplitPaymentModal`, `LoyaltyDashboard`, `ReviewModal`, `SubscriptionPlans`, `SafetyButton`, `PromoCodeInput`, `FoodFilters`, `VoiceCommands`, `ARScooterFinder`, `LiveChat`
- ✅ **`SuperAppOverlay`** — globaler Floating-Button-Hub (auf `/taxi`, `/scooter`, `/food`, **kontextabhängig**):
  - SafetyButton (rot, Shield) — **NUR während aktiver Taxi/Scooter-Fahrt** (Polling alle 15s `/api/taxi/rides/active` + `/api/scooter/active`)
  - VoiceCommands (Mic, Deutsch, mit Navigation-Callback)
  - LiveChat Floating-Button — **NUR bei aktiver Fahrt ODER ungelesenen Nachrichten**, mit roter **Unread-Badge** (Polling `/api/chat/unread-count`)
  - LoyaltyDashboard Quick-Access (Trophy)
  - SubscriptionPlans Quick-Access (Crown)
- ✅ **TaxiPage**: ReviewModal, SplitPaymentModal, LiveChat-Button (während aktiver Fahrt), Rate-Button nach Completion + History, **GroupOrderModal** (Group Ride aus dem book-View)
- ✅ **ScooterPage**: ARScooterFinder (Camera-AR mit Geolocation), ReviewModal, History-Review-Button
- ✅ **FoodPage**: FoodFilters (Erweiterte Filter Bottom-Sheet), SplitPaymentModal (Cart), ReviewModal (delivered orders), **GroupOrderModal** (Group Order aus Cart)
- ✅ **GroupOrderModal**: zentrale Komponente (Lieferando/Bolt-Style) mit E-Mail-Einladung, Erfolgsscreen + Copy-Link, "Deine aktiven Gruppen"-Liste

## Known Issues / Backlog

### P0 (next)
- (Frontend-Wiring + Audit-Log + QR-Generator + Live-Chat WS + Group-Orders Frontend: ✅ FERTIG)
- Echte Fiskaly-Cloud Credentials einbauen (User-Input nötig: API_KEY/SECRET/TSS_ID)

### P1
- WS-Auth-Hardening: `/api/chat/ws/{room_id}` validiert derzeit Token nicht — vor Production Pflicht (room-membership-Check)
- Native Mobile Build (Capacitor Node-Konflikt)
- ESLint `react/jsx-no-undef` + `no-undef` in CI verankern (zwei Iterationen lang an undeclared identifiers verloren)

### P2
- Trial-Workflow: Reset durch Admin: ✅ FERTIG (Backend-Endpoint vorhanden)
- Self-Service Add-On Buchung mit Stripe-Checkout (statt nur Trial)
- Response-Contract finalisieren für `/api/loyalty/history` und `/api/tips/presets`

## Credentials
- POS Admin: `admin@bidblitz.com` / `BidBlitz2026!` (Merchant `MER-520D937E02F3` "Eiscafe", store_id `S1`, register_id `R1`)
- Siehe `/app/memory/test_credentials.md`

## Stand
**29.04.2026** — Super-App Backend-Parity (13 neue Modules, 41/41 grün). Frontend-Wiring ausstehend.
