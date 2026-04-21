# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (async MongoDB)
- Production: IONOS Server (212.227.20.190), PM2, Nginx, MongoDB Atlas

## Production Status: LIVE ✅ | All 41+ V2 Modules Running

## Deployed Features (2026-04-19 — Taxi Mode + Admin Panel)

### 🚕 Fahrer-Modus (Driver Mode) — LIVE
- Route: `/driver-dashboard` (nur sichtbar für verifizierte Fahrer via `/api/driver-dashboard/eligibility`)
- 3 Tabs: Start / Verlauf / Profil
- Online/Offline, Requests annehmen/ablehnen, Fahrt-Status-Flow (accepted→arriving→started→completed)
- **Wallet-Integration:** Fahrer-Verdienst (80%) wird automatisch in `users.balance` gutgeschrieben + Transaction geloggt (`TAXI_EARNING`)
- Kunde zahlt automatisch (`TAXI_RIDE` Transaction)
- E2E getestet: Fahrer €500→€512.40 (+€12.40), Kunde €6889→€6873.91 (-€15.50)
- Backend: `/app/backend/routes/driver_dashboard.py` (new endpoints: eligibility, profile)
- Frontend: `/app/frontend/src/pages/DriverDashboardPage.jsx` (komplett neu)
- MorePage-Eintrag (Mobility-Gruppe) nur für Driver sichtbar

### 🛠️ Admin Taxi-Panel — LIVE
- Route: `/admin/taxi` (nur Admin)
- 4 Tabs: Übersicht · Fahrer · Fahrten · Preise
- **Fare Settings** admin-konfigurierbar pro Fahrzeug-Typ (standard/premium/van) mit Auto-Seed
- **Driver Management:** Approve/Reject/Suspend/Reactivate
- **Ride Management:** Admin kann laufende Fahrten stornieren
- **Activity Logs:** Alle Admin-Aktionen in `taxi_activity_logs`
- **Overview Stats:** Revenue (today/week/month), aktive Fahrer, Fahrten
- Backend: `/app/backend/routes/taxi_admin.py` (NEU)
- Frontend: `/app/frontend/src/pages/AdminTaxiPage.jsx` (NEU)

### 🏢 Taxi-Unternehmen Fahrzeug-Verwaltung — LIVE
- Operator-Dashboard (`/taxi-dashboard`) erweitert um "Fahrzeuge"-Tab
- CRUD für `taxi_company_vehicles`: Add/Update/Delete, Status (active/maintenance/inactive)
- Kennzeichen-Duplikat-Schutz pro Company
- Endpoints: `GET/POST/PATCH/DELETE /api/taxi/operator/vehicles`

### 👑 BidBlitz Premium Launch-Event (50% Rabatt) — LIVE
- 7-Tage Launch-Event bis 26.04.2026: €2,50 statt €4,99 / 250 statt 499 BLZ
- HomePage-Banner (`PremiumLaunchBanner`) — nur Nicht-Premium, dismissible
- PremiumPage zeigt Strikethrough + Countdown
- Backend: `_launch_info()` in `revenue2.py`

## Deployed Features (2026-04-19 — Revenue Batch 2)

### 👑 BidBlitz Premium Abo — LIVE
- Route: `/premium` (ersetzt alte Dummy-Seite)
- Preis: **€4,99 / Monat** oder **499 BLZ / Monat**
- Benefits: 2× Mining Rate · 0€ Auktions-Gebühren · +50 BLZ/Monat · 5% Cashback · Premium Badge · Priority Support
- 30-Tage Laufzeit, Extend verlängert stattdessen (Stapel-Logik)
- Backend: `/app/backend/routes/revenue2.py` (`/api/premium/status`, `/api/premium/purchase`, `/api/premium/cancel`)
- Frontend: `/app/frontend/src/pages/PremiumPage.jsx`

### 🎰 BLZ Lotterie — LIVE
- Route: `/lottery`
- Preis: **10 BLZ / Los**, 4 Gewinnklassen (Jackpot 5000 · Big 500 · Small 50 · Mini 15 BLZ)
- Tägliche Ziehung (via Admin `/api/lottery/draw` — Cron-ready)
- Countdown zur UTC-Mitternacht, meine Lose Historie
- Backend: `/api/lottery/current`, `/api/lottery/buy-tickets`, `/api/lottery/my-tickets`, `/api/lottery/draw`
- Frontend: `/app/frontend/src/pages/LotteryPage.jsx`

### 💸 Marketplace Fee (2,9% + 0,30€) — LIVE
- `/api/marketplace/fee-info` (public) — zeigt Gebühren-Berechnung
- `/api/marketplace/transfer` — P2P mit Fee-Abzug (Fee bleibt bei BidBlitz)
- Log in `marketplace_fees` Collection für Admin-Reporting
- Backend: `/app/backend/routes/revenue2.py`

### 🚀 Deployment (2026-04-19)
- `revenue2.py` auf Live-Server `/var/www/bidblitz/backend/routes/`
- `server.py` registriert `revenue2_router`
- Frontend neu gebaut (`yarn build` — 66s)
- `pm2 restart api` — alle Endpoints live auf `https://bidblitz.ae`
- MorePage: Neue Einträge `Premium` + `Lotterie` in Finance-Gruppe

## Deployed Features (2026-04-18 — Mega Batch)

### 🎁 Welcome Bonus on Registration
- New users receive **5,00 € + 10 BLZ** automatic welcome bonus
- Transaction logged in wallet history with ref `WELCOME-xxxxx`
- Toast notification on success
- Backend: `/app/backend/routes/auth.py` (register endpoint)

### 🔐 Auth Page UI/UX Fix
- Placeholder contrast fixed (`white/35` instead of `#2A2A2A`)
- iOS Autofill yellow background removed via CSS
- Overflow-x-hidden container prevents mobile horizontal scroll
- Fixed in `/app/frontend/src/pages/AuthPage.jsx`

### 🎭 Demo Mode Bug Fixed
- Root cause: SendMoneyModal ignored `isOpen` prop → always rendered
- Fixed with proper AnimatePresence + conditional render
- Demo mode now navigates to home with toast hint, not stuck modal
- Fixed in `/app/frontend/src/components/SendMoneyModal.jsx`

### 📱 PWA Install Prompt
- Component: `/app/frontend/src/components/PWAInstallPrompt.jsx`
- Android/Chrome: native `beforeinstallprompt` handler with custom UI
- iOS Safari: manual install hint after 20s delay
- Dismissal stored in localStorage

### 🔔 Push Notification Permission
- Component: `/app/frontend/src/components/PushPermissionPrompt.jsx`
- Delayed prompt (30s after login) so users see value first
- Only shows when `Notification.permission === "default"`

### ₿ Coinbase Commerce Integration (PARTIAL — API key only)
- Endpoint: `POST /api/coinbase/charge` creates hosted checkout → BTC/ETH/USDC
- Webhook: `POST /api/coinbase/webhook` (HMAC-SHA256 signature verified)
- Credits user wallet on `charge:confirmed` event (idempotent)
- Backend: `/app/backend/routes/coinbase_commerce.py`
- Frontend: `/app/frontend/src/components/CryptoTopUpModal.jsx`
- **STATUS: API Key deployed, Webhook Secret MISSING — payments can be created but confirmation webhook won't verify until user provides COINBASE_COMMERCE_WEBHOOK_SECRET**

### 🚀 SMM Provider Integration (PARTIAL — URL only, API key missing)
- Backend: `/app/backend/routes/smm_provider.py`
- Default provider: `https://justanotherpanel.com/api/v2` (JAP)
- Compatible with all major SMM panels (same standard API)
- Auto-forwards orders to real provider when `SMM_PROVIDER_API_KEY` is set
- Admin endpoints: `/admin/provider/status`, `/balance`, `/services`, `/mapping`
- Order sync endpoint for status updates
- **STATUS: Code deployed, API key MISSING — orders currently stored locally only, not forwarded to provider**

## Earlier Deployed Features (prior days)

### Admin Wallet Tool — NEU
- Route: `/admin/wallet` (admin-only)
- 3 Tabs: Senden/Abziehen, Self-Topup, Log
- User-Suche mit Live-Filter (Email/Username/FullName)
- Credit/Debit in EUR **und** BLZ parallel
- Quick-Amount Buttons (+10/50/100/500 EUR, +100/500/1000 BLZ)
- Reason-Field für Audit-Log
- Self-Topup mit aktueller Balance-Anzeige
- Transaction-History mit User-Email-Enrichment
- Backend: `/app/backend/routes/admin_wallet.py`
- Frontend: `/app/frontend/src/pages/AdminWalletPage.jsx`

### Resend Email Integration — LIVE + Domain VERIFIED
- `bidblitz.ae` verified on Resend (EU-West-1 region)
- 7 transactional templates: Welcome, Outbid, Win, New Auction, Booking Confirmation, Streak Milestone, Password Reset
- Trigger-Hooks in auth.py (welcome), bookings.py (confirmation), blitz_mine.py (milestone)
- From: `noreply@bidblitz.ae`
- Test emails delivered (IDs: 88e1f13e, 4ba0ad6d, fee271e5)

## Deployed Features (2026-04-18)

### MorePage Redesign — NEU
- Search bar at top with live filter
- Accordion groups (collapsible), localStorage remembers state
- 2-column grid per group (50% less scroll)
- 8 groups: Mobility, Finance, Account, Growth, App, Support, Legal, Admin
- Color-coded group indicators

### Termine-Buchen V2 — NEU
- Date picker (14 days forward) + slot-based time selection
- Real-time slot availability check (`GET /api/bookings/providers/{id}/slots?date=X&service_id=Y`)
- Weekly opening hours + block dates per provider
- Provider-Admin endpoints (services, hours, blocks, appointments)
- Customer flow: Service → Date → Slot → Form → Confirm
- Backend: `/app/backend/routes/bookings.py` (fully rewritten)
- Frontend: `/app/frontend/src/pages/BookingsPage.jsx` (new 3-step flow)

### Daily Streak Reward — NEU (BlitzMine)
- 6 milestones: Bronze (3d) → Silver (7d) → Gold (14d) → Diamond (30d) → Legend (60d) → Mythic (100d)
- Permanent rate bonus: +5% → +60% (capped at +100%)
- One-time BLZ bonus on milestone hit: 1 → 120 BLZ
- Celebration modal with confetti animation on unlock
- Backend: `STREAK_MILESTONES` in `blitz_mine.py`, new `/api/blitz-mine/streak` endpoint

### Legal Admin Editor — NEU
- `/admin/legal` with tabs for AGB, Datenschutz, Impressum, Sicherheit
- Section editor: add/remove/reorder sections, edit heading + text
- Reset to default button
- DB-backed (seeds from hardcoded defaults on first load)
- Backend: `admin_router` in `legal.py`
- Frontend: `AdminLegalPage.jsx`

### Resend Email Integration — LIVE
- API key installed, test email successfully sent (id: 88e1f13e-6856-4f8d-9af9-e00db0880412)
- Uses `email_service.py` (already existed)
- ⚠️ Domain `bidblitz.ae` not yet verified → can only send to afrimk007@gmail.com for now
- User to verify DNS TXT records at IONOS later

## Deployed Features (2026-04-17 22:40 UTC)

### BlitzMine (Pi-Network Tap-to-Earn) — NEU
- Route: `/blitz-mine`
- Daily 24h tap session, auto-claim after 24h
- Security Circle (max 5 members, +20% per member)
- Roles: Pioneer → Contributor → Ambassador → Node (×1.0 → ×1.5)
- Referral bonus (+5% per active direct referral, cap 50%)
- Lockup (14d / 6m / 1y / 3y, +10% – +120%)
- Leaderboard (Top 20 Pioneers)
- **QR-Code + Share-Modal** for referral link (qrcode.react)
- Earnings in BLZ (same wallet as `/mining`)
- Backend: `/app/backend/routes/blitz_mine.py`
- Frontend: `/app/frontend/src/pages/BlitzMinePage.jsx`
- Seed: 30 pioneers (max.weber 12.4k, lina.kaiser 9.8k, jonas.ott 7.3k, …) in prod DB

### Legal Pages (AGB / Datenschutz / Impressum / Sicherheit) — NEU
- Route: `/legal/{agb|datenschutz|impressum|sicherheit}`
- Tabbed navigation between all 4 pages
- Linked in MorePage under new "Rechtliches" group
- Company: BidBlitz LLC, Dubai UAE (generic placeholders)
- Backend: `/app/backend/routes/legal.py`
- Frontend: `/app/frontend/src/pages/LegalPage.jsx`

### Mobility Seed-Daten — NEU (production DB)
- 10 Taxi drivers (Berlin, Muenchen, Hamburg, Koeln, Frankfurt)
- 20 Scooters (TIER, Lime, Bolt, Voi, Bird) across 3 cities with real coords
- 8 Hotels
- 175 Flights (25 routes)
- 8 Rental Cars
- 10 Nearby Places
- Script: `scripts/seed_real_data.py` (run on prod with DB_NAME=bidblitz)

### App.js Code-Splitting — NEU
- 20+ heavy pages now lazy-loaded via `React.lazy`
- Admin cluster, DeFi/Crypto complex, BlitzMine/Boost/Transfer, Legal
- Suspense fallback with spinner
- Bundle now split into 19+ chunks (from 1 monolithic bundle)
- Main bundle: `main.bb5a5234.js`

### BlitzBoost Navigation Fix
- Added to MorePage, AllServicesPage, QuickAccessBar

### Auctions Bot Fix (Production)
- Legacy `end_time`/`id` schema migrated to new `ends_at`/`auction_id`
- Embedded `product._id` ObjectId removed (was breaking `/api/auctions/list`)
- 80 auctions reactivated with fresh bot targets
- 3-phase bot bidding strategy active

## Deployed Features (2026-04-16)

### Server Monitoring Dashboard (/admin/monitoring)
- Real-time system health (CPU, RAM, Disk, Uptime)
- API metrics (Requests/h, Errors/h, Avg Response, P95/P99)
- RPM chart (Requests per Minute, letzte 10 Min)
- Database stats (Collections, Objects, Data Size, Latency)
- User statistics (New today/week/month, Active 7d, Role distribution)
- Slow endpoint tracking (>500ms)
- Error code breakdown
- Auto-refresh every 15 seconds
- Middleware tracks all requests automatically

### Haendler-Verwaltung (/admin/merchants)
- Haendler-ID System (BZ-M-XXXX format)
- Bulk-ID-Vergabe fuer alle Haendler ohne ID
- Remote Neustart (force re-login via force_restart flag)
- Sperren/Aktivieren von Haendlern
- Fehler-Log pro Haendler (24h)
- Session-Tracking (Online/Offline, Device Info)
- Detail-Modal mit Umsatz, Transaktionen, Errors, Sessions
- Heartbeat-Endpoint fuer Geraete-Monitoring
- Search & Filter (Name, Email, ID)

### Multi-Mode System (Personal/Kids/Merchant)
- ModeSwitcher in header
- Mode-aware BottomNav
- Auto-switch on navigation

## Credentials
- Admin (Production): admin@bidblitz.ae / BidBlitz2026!
- Admin (Preview): admin@bidblitz.com / BidBlitz2026!
- SSH: root@212.227.20.190

## Backlog
- P1: APK-Build fuer Android (TWA)
- P2: App.js Code Splitting
- P2: Server Security (Fail2Ban, SSH keys)

## Feb 2026 – Session Updates
- ✅ Frontend Build unbricked (TaxiPage.jsx Mapbox→Leaflet migration completed)
- ✅ Professional dark map (CartoDB Dark Matter) replaces generic OSM look
- ✅ Map Style Switcher (Dark/Hell/Satellit) – customer can choose, persisted in localStorage
- ✅ Professional SVG vehicle icons (replaced emoji 🚗🚙🚐) for Standard/Premium/Van
- ✅ LeafletMobilityMap.jsx replaces MapboxMap (Live Map at /mobility-map now works)
- ✅ Admin Auction Image Editor: click thumbnail → edit URL OR upload file
  - New endpoints: PATCH /api/auctions/admin/auction/{id}, POST /admin/auction/{id}/upload-image
  - 14 auction images replaced with official CDN (Apple, Samsung, Sony, Nintendo, Rolex, DJI)
- ✅ LIVE server bidblitz.ae 502 blocker fixed (missing backend/data/product_catalog.json)
- ✅ Admin Unternehmer/Privat Mode Panel (/admin/taxi → "Modi" tab)
  - On/off toggle per mode, editable labels/descriptions
  - Adjustable commission rate (0-30%), price multiplier (0.5-2.0×)
  - New backend: GET/POST /api/admin/taxi/mode-settings, public GET /public/mode-settings
  - TaxiPage respects settings: hidden modes won't show as selectable
- ✅ Web-Push Notifications UI (/notifications)
  - Service worker at /push-sw.js, VAPID subscribe/unsubscribe/test flow
  - Accessible via More → App section
- ✅ Friends Map (/friends-map)
  - Opt-in location sharing, visibility chips (Freunde/Öffentlich/Privat)
  - Friend markers with initials, auto-fit bounds, distance display
  - Accessible via More → Mobility section

## Known Issues / Backlog
- P2: Manual deployment script → consider CI/CD pipeline
- P2: Product catalog JSON should ship with backend, not live-server side-load

## Last working item
- Part A (Unternehmer/Privat Admin) ✅
- Part D (Web-Push + Friends Map) ✅
- All deployed to LIVE server bidblitz.ae

