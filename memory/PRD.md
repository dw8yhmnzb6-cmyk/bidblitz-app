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
**30.04.2026 (2)** — **Refactor complete**: FoodPage 1319→515 lines (+ 7 modular components). AuctionsPage 1817→1388 lines (+ BuyCreditsModal, ReferralPanel, atoms.js). Backend 15/15 pass. Apple/Google Pay production-hardened with JWT auth + Stripe webhook signature + atomic wallet credit.

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
