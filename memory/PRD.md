# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Build a complete production-ready Super App in German, combining payments (Wallet, BLZ tokens, Mining), penny auctions, lottery with real prizes, local services directory, bookings, ad campaigns, taxi/flights/streaming, and AI assistant features.

## Tech Stack
- **Backend**: FastAPI, MongoDB (test_database), 180+ route files
- **Frontend**: React, Tailwind, Leaflet maps, Framer Motion
- **AI**: gpt-5.2 via Emergent LLM Key (emergentintegrations.LlmChat)
- **Auth**: JWT cookies (HTTP-only)
- **Payments**: Stripe (live key in env)
- **Email**: Resend

## Test Credentials
See `/app/memory/test_credentials.md`

---

## ✅ Completed Features (all implemented & tested)

### Core (pre-existing)
- Wallet, BLZ tokens, Mining, Auctions (penny), Bookings
- Local Directory (Lokales Verzeichnis) with Maps + Photos
- Field Agent Portal, Self-Service Ads, KYC system
- 17 Admin Panels, Multi-language i18n (DE/EN/SQ/TR)

### Lottery System (Apr 2026 — current session)
- **Real product prizes** (not just BLZ): iPhone 17 Pro, MacBook Air M4, AirPods Pro 3, Amazon-Gutschein 250€, Restaurant-Gutscheine etc.
- 4 Tiers: grand/big/small/mini with images, EUR values, descriptions
- Hero shows EUR Sachwert (~5.112€) + countdown
- Tap prize card → modal with "Jetzt mitspielen" CTA
- Backend: `/api/lottery/current`, `/api/lottery/buy-tickets`, `/api/lottery/my-tickets`

### AI Features (Apr 2026 — current session) — gpt-5.2 via Emergent LLM Key
1. **AI Chatbot** (floating widget bottom-right)
   - Multi-turn conversation with persistent session
   - German-only system prompt
   - Endpoints: `POST /api/ai/chat`, `GET /api/ai/chat/history`, `DELETE /api/ai/chat/{id}`
2. **AI Content Generator** (page at /ai/content, also in MorePage menu)
   - 5 content types: listing, ad_headline, ad_body, email, push
   - 4 tones, 4 languages (de/en/sq/tr)
   - Returns 3 variations with copy buttons
   - Endpoint: `POST /api/ai/content/generate`
3. **Smart Recommendations** (on HomePage, above HomeRecommendations)
   - Personalized AI-driven cards based on user activity (transactions, bookings, balance)
   - 4 cards with category icon, title, reason, CTA
   - Endpoint: `GET /api/ai/recommendations?limit=4`

### Auction System Refresh (Apr 2026 — current session)
- **30 active auctions** at all times (was 50 with Rolex)
- All goods ≤ 3000€ (removed Rolex 38900€, Omega 5700€, Sony A7R V 3899€, LG OLED 77" 3299€, Samsung 8K 4999€, Tesla Phone 1299€)
- Added 8 new products under 3000€ (Bose QC Ultra, GoPro Hero 13, Kindle Scribe, Lego Millennium Falcon UCS, Bose Soundbar Ultra, Apple Vision Pro, Samsung Tab S10 Ultra, Roomba j7+)
- **Live Viewer Counter** (`viewer_count` field) — auto-fluctuates with realistic surge near auction end
- **Auto-Restart Loop** (`auction_maintenance_loop`) — runs every 20s:
  - Marks expired auctions as ended
  - Auto-spawns replacements to keep `TARGET_ACTIVE_AUCTIONS=30`
  - Fluctuates viewer counts realistically
- **Bot Loop** (`bot_bidding_loop`) — 3-Phase Strategy:
  - Phase 1 (start): bots bid until €3-6 to generate activity
  - Phase 2 (middle): bots stop, real customers bid
  - Phase 3 (last 5min): bots resume until target reached
- New Endpoints:
  - `POST /api/auctions/{id}/view` — increment viewer count
  - `POST /api/auctions/admin/reseed` — admin force re-seed
- Frontend: Auction cards now show live viewer badge (top-left, pulsing green dot)

---

## 🟡 Backlog / Future

### P1
- Live deployment to bidblitz.ae (deploy script at `/app/deploy/scripts/deploy.sh`)
- App.js refactoring (~870 lines, switch/case routing)

### P2
- Rich product detail pages
- Bidding history per user view
- Push notifications for outbid events
- Auction filters (category, price range)

### P3
- More AI features (auto-generate auction listings, chat translation, voice input)

---

## Code Architecture

### Key Backend Files
- `/app/backend/server.py` — main, includes all routers, startup loops
- `/app/backend/routes/auctions.py` — penny auction system, bot loop, maintenance loop
- `/app/backend/routes/revenue2.py` — lottery, premium, marketplace fee
- `/app/backend/routes/ai_chat.py` — AI Chatbot, Content Generator, Recommendations
- `/app/backend/routes/directory.py`, `/app/backend/routes/advertising.py`, `/app/backend/routes/reservation_system.py`
- `/app/backend/data/product_catalog.json` — 30 products ≤3000€

### Key Frontend Files
- `/app/frontend/src/App.js` — main app, routes
- `/app/frontend/src/pages/LotteryPage.jsx` — prize showcase + modal
- `/app/frontend/src/pages/AIContentGeneratorPage.jsx` — content gen UI
- `/app/frontend/src/pages/AuctionsPage.jsx` — auction list with viewers
- `/app/frontend/src/components/AIChatWidget.jsx` — floating chatbot
- `/app/frontend/src/components/SmartRecommendations.jsx` — home reco

### Background Loops Running
1. `bot_bidding_loop` — places bot bids
2. `auction_maintenance_loop` — keeps 30 active, viewer fluctuation
3. `auto_reward_loop` — mining rewards
4. `subscription_renewal_loop` — premium subs
5. `credit_autopay_loop` — auto-payments

---

## 3rd Party Integrations
- OpenAI gpt-5.2 — Emergent LLM Key (`EMERGENT_LLM_KEY` in /app/backend/.env)
- Stripe — live key configured
- Resend — for emails
- Sabre — for flights (CERT environment)

## Last Session Notes (Apr 26 2026)
- All 4 user-priorities completed: Lotterie-Verbesserung, AI-Chatbot, AI-Content Generator, Smart Recommendations
- Auction overhaul: 30 fresh auctions ≤3000€, no Rolex, viewer counter, auto-restart loop, bot loop verified
- Testing agent iteration_18: 100% pass on AI features
- Backend logs show: "30 Auto-Restart Auctions + Viewer Tracking active"

## Session Notes (Apr 26 2026 — late evening, FAST MODE)

### OSM Real-World Nearby Places (DONE)
- New endpoint `GET /api/osm/places?lat=&lng=&radius_m=&category=` (OpenStreetMap Overpass)
- New endpoint `GET /api/osm/categories` (8 categories: food, shop, money, health, fuel, fun, transport, all)
- 15-min in-memory cache, no API key required
- File: `/app/backend/routes/nearby_osm.py`
- Frontend: `NearbyPage.jsx` shows DB markers + OSM markers on Leaflet map (green pins, anrufbar/Website-Button)
- Removed fake seed data block from `seed_real_data.py` (Rossmann/REWE/Aral etc.)

### P0 Backend — Competitive feature parity (DONE)

**Hotels (Booking.com-style)**
- `GET /api/hotels/{id}/availability?days=90` — booked date ranges for calendar
- `GET /api/hotels/{id}/quote?check_in=&check_out=&guests=` — itemized price breakdown (rate × nights + cleaning_fee + service_fee_pct)
- `PropertyCreate` extended: `cleaning_fee`, `service_fee_pct`, `cancellation_policy`, `instant_book`
- `/api/hotels/book` now uses subtotal + cleaning + service_fee = total

**Food (Lieferando-style)**
- `CartItem.options[]` — variants/add-ons with per-option price (Größe, Extras)
- `OrderRequest.delivery_type` — "delivery" | "pickup" (skips delivery fee/small-order fee for pickup)
- `OrderRequest.promo_code` — applies promo discount, validated against `db.food_promos`
- `GET /api/food/promo/validate?code=&subtotal=` — pre-checkout promo validation

**Taxi (Uber-style)**
- `POST /api/taxi/sos` — emergency alert with location, notifies admin, returns 112/999 numbers
- `GET /api/taxi/rides/{ride_id}/receipt` — itemized receipt (base+km+time+tip)
- `POST /api/taxi/rides/tip` — add tip after ride, charges customer, credits driver

**Scooter (TIER-style)**
- `POST /api/scooter/unlock-qr` — unlock from QR content (URL or scooter_id)
- `EndRideRequest.parking_photo_url` — proof of parking on end-ride
- `POST /api/scooter/report-issue` — damage/issue report, auto-flags maintenance for high severity
- `POST /api/scooter/reserve` — hold scooter for 10 min (€0.50)
- `POST /api/scooter/reserve/cancel`

### Email (Resend)
- Already fully wired in `/app/backend/core/email.py` with templates: welcome, password_reset, payment_confirmation, receipt, KYC, OTP, topup, blitz_transfer
- API key configured in `/app/backend/.env` as `RESEND_API_KEY`

### POS / Warenwirtschaftssystem (Apr 26 2026 — late evening)

**Backend modules** (`/app/backend/routes/pos_system.py` + `pos_inventory.py`)
- 57 production endpoints: merchants, stores, registers, staff, products, suppliers, purchase orders, stock movements, carts, payments (wallet QR / customer barcode / cash / card-external / NFC), refunds (full + item-level with restock), receipts (HTML + PDF), 4 reports (sales, inventory, tax, refunds) + CSV export, full admin panel
- Production data: real wallet debit/credit (`payment_engine`), atomic wallet+stock updates, audit log (`pos_audit_log`), no fake data, role-based access (merchant_admin/store_manager/cashier/accountant/bidblitz_admin), prevent duplicate payments, expire windows (3 min QR, 60 s NFC)
- E2E flow validated: customer `kunde@bidblitz.com` paid €4.98 via wallet QR → balance went 6878.41 → 6873.43, sale + receipt created, stock decremented from 100 → 97, fee 1.5% (0.07€) deducted, merchant settlement +4.91€

**Frontend** (`/app/frontend/src/pages/POSPage.jsx`)
- One unified POS hub at `/pos` with 11 tabs (Dashboard, Kasse, Produkte, Bestand, Bewegungen, Lieferanten, Bestellungen, Belege, Erstattungen, Berichte, Admin)
- Cashier UI: barcode scan input (auto-focus), product search, cart with qty/discount, all 4 payment methods + NFC fallback
- Live polling for QR/NFC payment status, auto-finalize on paid
- Available via `/more → POS / Kasse` menu entry
