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

### Backend (Stand 29.04.2026 — Iter 28: 17/17 grün)
- ✅ `/api/split-payment/*` — Taxi & Food split-payment
- ✅ `/api/loyalty-superapp/*` — Punkte (Bronze/Silver/Gold/Platinum), Stempelkarte, Levels, Leaderboard, Verlauf (history+count)
  - Prefix umbenannt von `/api/loyalty/*` (Collision mit `loyalty_system.py` aufgelöst)
- ✅ `/api/reviews/*` — Bewertungen mit Helpful-Count + Foto-Upload
- ✅ `/api/scheduled/*` — Geplante Fahrten/Bestellungen (max 30 Tage)
- ✅ `/api/subscriptions/*` — Scooter Pass, Food Plus, etc.
- ✅ `/api/safety/*` — Notfall-Kontakte, Trip-Sharing, PIN-Verify
- ✅ `/api/promo/*` — Promo-Codes & Voucher
- ✅ `/api/filters/*` — Erweiterte Restaurant-Filter (Cuisine, Diet, Rating)
- ✅ `/api/group/*` — Group Orders & Group Rides (jetzt idempotent + participant._id Fix)
- ✅ `/api/quick/*` — Reorder, Favoriten, Wishlist
- ✅ `/api/superapp-tips/*` — Trinkgeld, Gift Cards, Presets (Prefix umbenannt von `/api/tips`)
- ✅ `/api/delivery/*` — Kontaktlose Lieferung, Anweisungen
- ✅ `/api/bnpl/*` — Buy Now Pay Later (Klarna-style)
- ✅ `/api/admin/audit-logs` — Filter `date_from`/`date_to`/`email`/`search` + dropdowns
- ✅ `/api/pos/store/{id}/qr-poster` (PNG/SVG/JSON) für Self-Checkout-Eingang
- ✅ `/api/pos/features/admin/trial-reset` (Admin-only)
- ✅ `/api/pos/staff/list|update|remove` — Staff-CRUD
- ✅ `/api/pos/timeclock/*` — Zeiterfassung
- ✅ **`/api/chat/ws/{room_id}` WebSocket** — JWT-Auth + Room-Membership-Check + accept-then-close für korrekte 4401/4403 Close-Codes
- ✅ `/api/chat/messages/{room_id}` REST-Bootstrap & `/api/chat/quick-reply` (DE)
- ✅ **`/api/voice/parse`** — LLM-basiert (Gemini gemini-2.5-flash) Multi-Step-Intent-Parser für Voice-Commands
- ✅ `/api/auth/ws-token` — Kurzlebiges JWT (300s) für WebSocket-Auth

### Frontend (Stand 29.04.2026 — Iter 28)
- ✅ Komponenten erstellt: `SplitPaymentModal`, `LoyaltyDashboard`, `ReviewModal`, `SubscriptionPlans`, `SafetyButton`, `PromoCodeInput`, `FoodFilters`, `VoiceCommands`, `ARScooterFinder`, `LiveChat`, `GroupOrderModal`, `GroupTrackerBanner`
- ✅ `SuperAppOverlay` (kontextabhängig) auf `/taxi`, `/scooter`, `/food`
- ✅ TaxiPage / ScooterPage / FoodPage: alle Modals + Group-Order/Rental + GroupTrackerBanner mit One-Click-Confirm
- ✅ **VoiceCommands LLM-Multi-Step**: ruft `/api/voice/parse` (Gemini), Multi-Step-Intents werden mit 800ms-Stagger ausgeführt; Fallback lokale Heuristik
- ✅ **GroupTrackerBanner One-Click-Confirm**: "Beitreten"-Button für eingeladene User direkt aus dem Banner
- ✅ **POSAdminFeatures Trial-Reset-UI**: "↺ Trial"-Button erscheint pro Feature wenn `trial_used=true`
- ✅ **Z-Index-Fix**: alle Super-App-Modals jetzt `z-[10010]` (war `z-50`/`z-[60]`, kollidierte mit BarcodeModal `z-[10000]`)
- ✅ **ESLint Hardening**: `.eslintrc.json` mit `no-undef: error` + `react/jsx-no-undef: error`
- ✅ **Capacitor 7** vollständig konfiguriert (`capacitor.config.ts`, Android/iOS Plattformen) — `yarn cap sync` ready
- ✅ **`android/` + `ios/` Plattformen initialisiert** (29.04.2026) via `npx cap add android/ios` — Build-Output `android/app/build/outputs/apk/`. Anleitung: `/app/MOBILE_BUILD.md`
- ✅ **App-Icons + Splash-Screens generiert** — 100 Android + 13 iOS Assets via `@capacitor/assets`. Source: `resources/icon.png` (1024×1024 stylisiertes "B" Logo, Cyan #00C2FF + Lightning-Bolt-Akzent auf #060810). PWA-Icons synchronisiert.
- ✅ **Capacitor Live-Reload Modus** — `capacitor.config.live.ts` für Mobile-Dev ohne build-Loop (Server-URL → kassensystem-preview)
- ✅ **Mobile UI-Fix iOS Safari**: Bottom-Nav `padding-bottom` jetzt `max(1.25rem, safe-area-inset)` damit URL-Bar nicht überlappt; KYC-Modal nutzt `100dvh` statt `100vh` (Dynamic Viewport Height)
- ✅ **Production Build erfolgreich**: `yarn build` läuft sauber durch (TypeScript installiert, eslint-config korrigiert)

## Known Issues / Backlog

### P0 (next)
- (Frontend-Wiring + Audit-Log + QR-Generator + Live-Chat WS + Group-Orders Frontend + One-Click-Confirm Banner + WS-Auth + Voice-Multi-Step + ESLint-Hardening + Loyalty/Tips Contract + Trial-Reset-UI + Z-Index Fix + Group-Rental Scooter: ✅ FERTIG)
- Echte Fiskaly-Cloud Credentials einbauen (User-Input nötig: API_KEY/SECRET/TSS_ID/ENV)
- Native Mobile App Build & Deploy (Capacitor `yarn cap sync` + Android Studio / Xcode lokal — Setup ready, Build manuell)

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
**01.05.2026 (4)** — **Händler-Landing** um branchen-spezifische Sales-Section erweitert + in Production deployed.

### 01.05.2026 (4) Changes
**Neu**: `/app/frontend/src/components/MerchantIndustriesSection.jsx` (361 LOC)
- **6 Branchen-Cards** mit klickbaren Tabs: Gastronomie, Einzelhandel, Dienstleistung, Fitness, Tankstelle, Bäckerei
  - Pro Branche: 5 Feature-Bullets, konkrete Kostenrechnung (z.B. Restaurant 380€→47€, spart 88%), eigener CTA-Button
- **Tisch-QR-Flow**: 5 nummerierte Schritte (Scan → Menü → Küche → Zahlung → Trinkgeld-Split) mit Icons + Farben
- **Gutschein-Baukasten (interaktiv)**: Live-Preview-Card reagiert auf Eingaben — Typ-Switcher (%, €, ×Punkte), Wert-Input, Min-Input, QR-Code-Preview
- **Stats-Strip**: 142+ Händler, 8.2K Tx/Tag, 0.29% Gebühr, 3 Min Onboarding
- Alle Elemente mit `data-testid` (stat-0..3, industry-tab-<id>, qr-step-0..4, vb-*)

**Geändert**:
- `/app/frontend/src/pages/MerchantLandingPage.jsx`: Section zwischen Pricing (6) und Trust (7) eingefügt
- `/app/frontend/src/App.js`: Onboarding-Splash-Overlay wird auf Marketing-Routes (`/merchant-landing`, `/merchant-pricing`, `/partners`, `/landing`) unterdrückt → Besucher sehen Inhalt sofort ohne blockierenden Modal

**Testing (Iter 37)**: Frontend **14/14 PASS (100%)**. Alle 6 Industry-Tabs wechseln Content reaktiv, VoucherBuilder Preview aktualisiert live (Value 25 + Type=amount → "25€ geschenkt"). 0 JS-Console-Errors.

**Production deployed**:
- Backup: `/var/www/bidblitz-backups/industries-20260501_171923/`
- Build: `main.bf95a83e.js` (5.4 MB)
- Live auf https://bidblitz.ae/merchant-landing (HTTP 200 verified)
- App.js auf Production minimal-gepatcht (sed statt full replace wegen AIChatWidget-Abwesenheit)

## Stand

### 01.05.2026 (3) Changes
**Neu**: `/app/frontend/src/components/AdminTabRouter.jsx` (861 LOC)
- Kapselt alle 14 verbleibenden Tab-Bodies (overview, users, merchants, payouts, transactions, settings, merchant-fees, promos, flags, audit, compliance, analytics, roles, verification)
- CreatePromoForm migriert in Router-Datei
- Erhält `ctx`-Prop mit ~30 state vars + handlers (Pattern: implizites Interface vermeidet Prop-Drilling)

`AdminPage.jsx` jetzt 672 LOC = nur State-Verwaltung, Tab-Switcher, 3 Lazy-Wrapper (auctions/scooters/gutscheine) + ein `<AdminTabRouter ctx={...} />`.

**Testing (Iter 36)**: Frontend **100% PASS**.
- 17/17 Tabs gerendert, 0 Page-Errors, 0 JS-Console-Errors
- Alle data-testids verifiziert: promo-name, add-scooter-btn, compliance Sub-Tabs (flags+checks), 7 merchant-fee labels, role/verification filter chips, analytics retention day_1/7/30
- Hinweis Tester: AdminTabRouter.jsx (861 LOC) selbst über 700 — kann später weiter gesplittet werden (Users/Merchants/Payouts in eigene Files), aber funktional sauber.

**Modul-Reduction Sprint Total** (alle Refactor-Schritte zusammen):
- AuctionsPage 1800+ → 787 LOC
- FoodPage 1300+ → 526 LOC
- AdminPage 2094 → 672 LOC
- Total entfernt: ~3200 LOC aus 3 monolithischen Dateien

## Backlog (P0/P1/P2)
### P0
- Stripe Live Keys / Fiskaly TSE / Coinbase Commerce — User muss API-Keys liefern
- AdminTabRouter.jsx (861 LOC) weiter splitten — optional

### P1
- Live-Video-Provider (Agora/Mux/LiveKit) — `/live` aktuell metadata-only
- Card-Issuer (Weavr/Marqeta) — Waitlist → echte Karten
- WS-Auth Hardening Group-Chat (5s Polling → real Broadcast)

### P2
- Off-Site Backup-Replikation (Hetzner Storage Box + rclone)
- Hetzner-Server Migration (aktuell IONOS 212.227.20.190 — der "Hetzner"-Plan war Misnomer)
- AdminPage `/admin` (= AdminPanelFullPage) ebenfalls modularisieren — anderer Code-Pfad
- Insurance Photo-Upload (S3 statt base64)
- i18n `admin.loyalty` Key

## Stand

### 01.05.2026 (2) Changes
**Neue Komponenten** (`/app/frontend/src/components/admin/`):
- `adminHelpers.jsx` (58 LOC) — Skeleton, StatCard, adminApi, slide, statusColors (DRY-Extrakt)
- `AdminAuctionsTab.jsx` (~260 LOC, lazy) — Bot-Control, Strategie/Aggression/Final-Battle Selector, Revenue-Rechner
- `AdminScootersTab.jsx` (~175 LOC, lazy) — Fleet-Stats, Add-Form, Status-Toggle, Delete
- `AdminGutscheineTab.jsx` (~130 LOC, lazy) — Coupon-Create, Balance-Grant

`AdminPage.jsx` verwendet `React.lazy` + `<Suspense fallback={<LazyFallback/>}>` in `<LazyErrorBoundary>` — identisches Pattern wie Food/Auctions Refactor.

**Testing (Iter 35)**: Frontend **100% PASS**. Admin-Login → alle 19 Tabs durchgeklickt, 0 kritische JS-Errors, 0 LazyErrorBoundary-Retries. 25 Bot-Toggles geprüft, alle Formulare öffnen korrekt.

**Hinweis vom Testing Agent**: Route `/admin` rendert `AdminPanelFullPage`, der refaktorierte `AdminPage.jsx` ist unter `/admin/old` erreichbar — bereits so bestehend, keine Regression.

**Known Minor**: i18n-Key `admin.loyalty` fehlt Übersetzung (kosmetisch).

## Stand

### 01.05.2026 Changes
**Backend (insurance.py)**:
- `POST /api/insurance/quote` — Schnellrechner für 8 Kategorien (auto/travel/phone/household/liability/health/life/pet) mit kategoriespezifischen Parametern (driver_age, vehicle_age, trip_days, device_value, living_sqm, age, coverage_amount, pet_age).
- `POST /api/insurance/claim` — Schaden melden mit policy_id, claim_type (accident/theft/damage/illness/other), description (≥10 chars), incident_date, amount_estimate, photos[]. Reference `CLM-XXXX`.
- `GET /api/insurance/my-claims` + `GET /api/insurance/claim/{id}` (Ownership).
- `POST /api/insurance/admin/claim/{id}/review` (admin) — status approved/rejected/in_review/paid; bei `paid` automatische Wallet-Gutschrift + Transaction.
- Seed: 9 Demo-Versicherungsprodukte (Kfz Basis/Premium, Reise, Handy, Hausrat, Haftpflicht, Zahn, Risikoleben, Hund OP) — auto-insert if collection empty.

**Backend (telemedizin.py)**:
- `GET /api/telemedizin/slots/{doctor_id}?date=` — verfügbare Time-Slots (16 Standard-Slots, blockiert wenn bereits gebucht).
- `POST /api/telemedizin/cancel/{appointment_id}` — Patient-Cancel.
- `POST /api/telemedizin/prescription` (admin/doctor) — E-Rezept mit medications[], diagnosis, notes.
- `GET /api/telemedizin/my-prescriptions`.

**Frontend**:
- `InsurancePage.jsx`: 4 Tabs (Markt/Rechner/Policen/Schäden) + neuer Claim-Flow + Quote-Calculator UI.
- `TelemedizinPage.jsx` rewritten: 3 Tabs (Ärzte/Termine/Rezepte) + Slot-Picker (date-bound, real-time-availability) + Cancel-Button + Video-Beitreten-Link.

**Removed**: `backend/routes/reservation_system.py` (war Stub, 53 Zeilen, nie gemounted; Restaurant-Funktion läuft komplett über `restaurants.py`).

**Testing (Iter 34)**: Backend 28/28 PASS — Insurance Quote (8 Kategorien + invalid 400), Insurance Products + Purchase + Cancel, Insurance Claim Create + List + Detail + Admin Review/Payout (Wallet-Credit verifiziert), Telemedizin Slots + Booking + Cancel + Prescription. `retest_needed: false`.

**Frontend nicht getestet** (nur Backend-Endpoints neu) — TelemedizinPage komplett umgeschrieben, manuelles smoke recommended.

## Backlog (P0/P1/P2)
### P0
- Stripe Live Keys, Fiskaly TSE, Coinbase Commerce — User muss API-Keys liefern
- AdminPage.jsx (~2000 LOC) modularisieren — letzte Monolith-Datei

### P1
- Live-Video-Provider (Agora/Mux/LiveKit) für /live (aktuell metadata-only)
- Card-Issuer (Weavr/Marqeta) — Waitlist → echte Karten-Ausgabe
- WS-Auth Hardening für Group-Chat Real-time-Broadcast (aktuell 5s Polling)

### P2
- Hetzner-VPS Deploy (deploy.sh ready, SSH-Access nötig)
- Insurance Photo-Upload (S3/Object Storage statt base64)
- Telemedizin: Doktor verifiziert Appointment-Ownership beim Rezept

## Stand

### 30.04.2026 (5) — Letzter Feature-Sprint
**Neue Backend-Routen**:
- `/api/groupchat/*` — Create/Invite/List/Messages/Read/Leave. Collections `chat_groups` + `chat_group_messages` mit Indexes. Broadcast-Hook via `broadcast_group_message` (chat_ws optional).
- `/api/roundup/*` — Config (enabled, round_to 1/5/10, multiplier 1-10, goal), Preview (stateless), Process-tx (idempotent on tx_id), History. Collections `roundup_config` + `roundup_entries`.
- `/api/apartments/*` — Host listings CRUD, Search (city/country/price/guests/type), Detail, Book (atomic wallet-debit via payment_engine), My-Bookings, My-Hosting. Collections `apartments` + `apartment_bookings`.

**Bereits vorhanden** (nur in Tiles verlinkt):
- Stocks: `/api/stocks/*` (Universe, Quote, Portfolio, Order, Orders, Watchlist — DEMO-Prices)
- Budget: `/api/budget/*` (Summary stateless + AI-Insights via Emergent LLM)

**Neue Frontend-Pages**:
- `GroupChatPage.jsx` — List + Chat + Create, @handle-Invites, Real-time-Polling 5s
- `RoundupPage.jsx` — Toggle, Round-to-Buttons, Multiplier-Buttons, Goal (Name + Amount + Progress-Bar), Verlauf
- `ApartmentsPage.jsx` — Search + City-Filter, Grid, Detail mit Check-In/Out + Guest-Form + Book

**MorePage-Tiles**: Gruppenchat (MessageSquare #00E89D), Round-up Sparen (PiggyBank #FF6B9D), Apartments (Home #F4A261).

**Bonus-Fixes**:
- MorePage lucide-import duplicate `PiggyBank` gefixt (bereits in Zeile 9 vorhanden).
- ESLint config aus package.json entfernt (conflicted with react-scripts internal config).

**Testing (Iter 33)**: Backend 29/29 PASS pytest. Frontend alle 6 MorePage-Tiles sichtbar (Senden&Empfangen, BidBlitz Card, Live Shopping, Gruppenchat, Round-up Sparen, Apartments). Routes `/groupchat`, `/roundup`, `/apartments` laden ohne Errors. `retest_needed: false`.

## Stand
**30.04.2026 (4)** — Revolut-Killer-Suite (P2P + Card + Live Shopping).

### 30.04.2026 (4) — 3 Super-App-Features
**Backend (neue Routen)**:
- `/api/p2p/*` — claim handle (a-z0-9_.- 3-20 chars), lookup, send (1-5000€, rate-lim 10/min), history. Collection `users.handle` (unique sparse index).
- `/api/card/*` — tiers (virtual_free, physical_standard €9.99, metal_premium €14.99/mo), apply, status, cancel. `is_demo=true` bis BaFin-Issuer live. Collection `card_applications`.
- `/api/live/*` — create, start, join, leave, end, pin product, react. Viewer-count atomic. Room-key für Video-Provider (Agora/Mux/LiveKit-agnostisch). Collection `live_streams`.

**Frontend (3 neue Pages)**:
- `P2PPage.jsx` — home/send/receive/history mit handle-claim, lookup-preview, €-amount-input, note, Verlauf
- `CardPage.jsx` — tier-selection mit Gradient-Karten, Shipping-Form (für physical), Consent-Gate, DEMO-Badge
- `LivePage.jsx` — grid mit LIVE-badge + viewer-count, watch-view mit floating hearts animation, host-view, create-flow

**MorePage.jsx**: 3 neue Tiles (AtSign/CreditCard/Radio icons).

**Bonus-Fixes**:
- `Heart is not defined` in MorePage (pre-existing, nie bemerkt weil tile lazy-rendered). Fixed by adding Heart to lucide-react import.
- ESLint config in package.json: `no-undef: error` + `react/jsx-no-undef: error` gating future extractions.

**Still MOCKED**: Card physical issuance (kein BaFin-Partner), Live-Video-Stream-Transport.

## Stand
**30.04.2026 (3)** — Refactor deep-dive + lazy-load.

### 30.04.2026 (3) Changes
**New extracted components** (`/app/frontend/src/components/auctions/`):
- `Countdown.jsx` (70 LOC) — shared timer with final-battle pulse
- `AuctionGridCard.jsx` (230 LOC) — fixed button-in-button hydration (watchlist heart is now `<motion.div role="button">`)
- `AuctionDetail.jsx` (314 LOC) — includes inline BidRow + AutoBidModal; full lucide-react imports (+Package, +Gavel, +Clock, +TrendingUp, +Wallet)

**New `LazyErrorBoundary.jsx`** (`/app/frontend/src/components/`) — wraps all Suspense lazy chunks with retry UI (`data-testid="lazy-error-boundary"` + `lazy-error-retry-btn`). Validated in production (caught missing-import crash, showed retry UI with German message "Ein Fehler ist aufgetreten / Erneut versuchen").

**React.lazy boundaries**:
- FoodPage: `RestaurantDetailView`, `MenuItemExtrasModal`, `CartView`, `CheckoutView`, `OrderTrackingView`, `OrderHistoryView` (only RestaurantListView is eager)
- AuctionsPage: `AuctionDetail`, `BuyCreditsModal`

**Consolidated poll constants** in `atoms.js`:
- `POLL_MS = 2500` — AuctionDetail bid polling (fast)
- `LIST_POLL_MS = 5000` — AuctionsPage list polling (relaxed)

**Fixed**:
- Bid optimistic key collisions (`bid_id: "opt-{ts}-{random}"` instead of raw timestamp)
- All img tags with possibly-empty src guarded with ternary fallback
- Removed duplicate watchlist heart (was `auction-watch-*` AND `watchlist-btn-*` rendered simultaneously)
- Cleared admin's blocking in-flight group order for testing

**Testing (iter 31)**: All 3 iter29 warnings confirmed zero. LazyErrorBoundary validated organically. Food flow end-to-end works (RestaurantList→Detail→Cart→Checkout all lazy-load). Auctions detail + buy-credits lazy-load clean. Remaining: AnimatePresence mode="wait" cosmetic warnings (10x), non-blocking.

## Stand
**30.04.2026 (2)** — Refactor complete: FoodPage 1319→515, AuctionsPage 1817→1388.

### 30.04.2026 (2) — Modular Refactor
**New components**:
- `/app/frontend/src/components/food/foodConstants.js` — shared constants & getFoodImage helper
- `/app/frontend/src/components/food/RestaurantListView.jsx` (197 LOC)
- `/app/frontend/src/components/food/RestaurantDetailView.jsx` (144 LOC)
- `/app/frontend/src/components/food/MenuItemExtrasModal.jsx` (98 LOC)
- `/app/frontend/src/components/food/CartView.jsx` (86 LOC)
- `/app/frontend/src/components/food/CheckoutView.jsx` (190 LOC)
- `/app/frontend/src/components/food/OrderTrackingView.jsx` (127 LOC)
- `/app/frontend/src/components/food/OrderHistoryView.jsx` (54 LOC)
- `/app/frontend/src/components/auctions/atoms.js` — POLL_MS, glass, panelBg, accent*, PKGS, localized
- `/app/frontend/src/components/auctions/BuyCreditsModal.jsx` (268 LOC) — 3-step select→confirm→success
- `/app/frontend/src/components/auctions/ReferralPanel.jsx` (158 LOC) — referral + leaderboard

**Backend test (iter 29): 15/15 PASS**
- `POST /api/fcm/subscribe` → 404 (removed) ✅
- `POST /api/sms/send` → 404 (removed) ✅
- `GET /api/push/vapid-public-key` → 200 ✅
- `POST /api/payments/create-payment-intent`: unauth→401, valid+10→200 (client_secret), >500→422, <1→400, =0→422 ✅

**Known pre-existing frontend warnings** (not introduced by refactor; to fix in next iteration):
- HIGH: `<button>` nested inside `<button>` hydration error in AuctionsPage (in untouched AuctionGridCard or similar action row)
- MEDIUM: duplicate React keys in auction list
- MEDIUM: empty string `img src=""` causes browser re-download

## Stand
**30.04.2026** — Cheap Architecture Pivot executed. Apple/Google Pay hardened.

### 30.04.2026 Changes
**Removed:**
- `backend/routes/push.py` (Firebase FCM) — replaced by `web_push.py` (VAPID)
- `backend/routes/sms.py` (Twilio) — replaced by `email_service.py` (Resend)
- `backend/firebase-service-account-demo.json`
- `frontend/src/services/fcm.js`
- `frontend/src/components/PushNotificationPrompt.jsx` (FCM-based)
- `frontend/src/components/GoogleMapsLiveTracking.jsx` (unused, demo key)
- Deps: `firebase_admin`, `twilio` (backend), `firebase` (frontend)

**Hardened:**
- `routes/apple_google_pay.py`: real JWT auth (was `demo_user`), amount 1–500 €, Stripe webhook signature verification (`STRIPE_PI_WEBHOOK_SECRET`), atomic `credit_wallet` with idempotency key `pi:{id}`, rate-limit 10/min
- `components/AppleGooglePayButton.jsx`: removed hardcoded Stripe publishable fallback key
- External Google-Maps `href` links → OpenStreetMap / Nominatim in `KidsGPSModal`, `OrderTrackingPage`, `DirectoryPage`

**Added env key (optional):** `STRIPE_PI_WEBHOOK_SECRET` (set in Stripe Dashboard for `/api/payments/webhook/stripe-payment`)

## Stand (previous)
**29.04.2026** — Super-App Backend-Parity (13 neue Modules, 41/41 grün). Frontend-Wiring ausstehend.
