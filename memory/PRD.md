# BidBlitz V2 — Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2. Build Revolut-level payment flows, integrate a real backend, add Stripe top-ups, add QR payments, add Admin/Merchant dashboards, and fully support 12 languages with user profiles, notifications, analytics, export tools, feature flags, paywalls, and growth/referral systems.

## Tech Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor), JWT Auth
- **Payments**: Stripe (checkout + saved payment methods + 1-click)
- **Languages**: 12 (EN, DE, SQ, TR, FR, ES, IT, PT, NL, PL, RU, AR)

## What's Been Implemented

### Core Features (Complete)
- Full JWT auth, Wallet, Merchant & Admin dashboards, QR payments
- 12-language i18n, Kids dashboard with paywall + child accounts
- Notifications, activity feed, referral system
- Export tools, Feature flags, Premium card, Transaction history

### Soft Launch (Complete)
- Invite codes, whitelist, dashboard metrics, backups, monitoring, alerts

### Public Browsing & Guest Experience (Complete)
- Homepage public, auth-gated actions, Try Demo mode
- Clear CTAs (Login/Register/Demo), Onboarding hint, Guest homepage sections (products/benefits/trust)
- Conversion tracking (event ingestion, funnel metrics, feature click tracking)

### Saved Payment Methods & 1-Click Top-Up (Complete — April 5, 2026)
**Backend (stripe.py):**
- Checkout sessions now create/reuse Stripe Customer with `setup_future_usage: off_session`
- After successful checkout, payment method details (brand, last4, exp) saved to user document
- `GET /api/stripe/saved-method` — returns saved card info
- `POST /api/stripe/quick-topup` — charges saved payment method off-session (1-click)
- `DELETE /api/stripe/saved-method` — removes saved payment method
- Card declined → auto-removes saved method, forces new checkout

**Frontend (TopUpModal.jsx):**
- On open, fetches saved payment method
- If saved: shows card (brand + last4 + expiry + "Gespeichert" badge) with "Bestätigen & Bezahlen €X" button
- "Neue Zahlungsmethode wählen" fallback → standard Stripe checkout
- "Gespeicherte Karte verwenden" link to switch back
- i18n: `topup.confirm_pay`, `topup.saved`, `topup.new_method`, `topup.use_saved`, `topup.expires` in all 12 languages

**Data model (users collection):**
- `stripe_customer_id`, `stripe_pm_id`, `stripe_card_brand`, `stripe_card_last4`, `stripe_card_exp_month`, `stripe_card_exp_year`, `stripe_pm_saved_at`

### KYC Flow (Complete — April 5, 2026)
**Backend (profile.py):**
- `GET /api/user/kyc` — returns KYC status and data
- `POST /api/user/kyc` — submit KYC data (full_name, date_of_birth, street, city, postal_code, country)
- Validates age (>=16), stores status as `pending`
- Audit logging on submission

**Frontend (MorePage.jsx → KYCView):**
- Accessible via "Sicherheit" menu in Account section
- Status badge: Not Submitted (grey) / Pending (yellow) / Verified (green) / Rejected (red)
- Form: Full Name, Date of Birth, Street, Postal Code, City, Country
- Pre-fills data if already submitted, allows re-submission
- i18n: `kyc.*` keys in EN + DE

**Data model (users collection → `kyc` subdocument):**
- `{full_name, date_of_birth, street, city, postal_code, country, status, submitted_at, reviewed_at}`
- `kyc_level` field on user: `basic` / `pending` / `verified`

### Penny Auction System (Complete — April 5, 2026)
**Backend (routes/auctions.py):**
- `GET /api/auctions` — list all auctions (auto-ends expired ones)
- `GET /api/auctions/{auction_id}` — auction detail + last 30 bids + unique bidder count
- `POST /api/auctions/bid` — place bid (costs 1 credit, +0.01, extends timer +10s, triggers auto-bids)
- `POST /api/auctions/buy-credits` — buy bid credits with wallet balance (4 packages)
- `GET /api/auctions/credits/balance` — user's credit balance
- `POST /api/auctions/auto-bid` — set auto-bid (max bids limit)
- `GET /api/auctions/auto-bid/{id}` — check auto-bid status
- `DELETE /api/auctions/auto-bid/{id}` — cancel auto-bid
- `POST /api/auctions/daily-reward` — claim 3 free credits per day
- `GET /api/auctions/daily-reward` — check daily reward availability
- `POST /api/auctions/admin/create` — admin creates auctions
- `POST /api/auctions/admin/refresh` — admin refreshes all auctions from catalog
- Auto-seeds 6 demo auctions, 13 products in catalog with images

**Frontend (pages/AuctionsPage.jsx) — Futuristic Premium Design:**
- Ultra-premium dark glassmorphism design (#040610 base, backdrop-blur-xl panels)
- Responsive grid: 2 cols mobile, 3 md, 4 xl
- Grid cards: product image, countdown overlay with urgency glow, "FREE SHIPPING" badge, cyan price with text-shadow, "Bieten" button
- Auction detail: hero image, "FREE WORLDWIDE SHIPPING" + "Brand New" badges, glassmorphism price panel with cyan glow, countdown with pulse on last seconds
- Trust bar: Secure Payments | Real-Time Bids | Free Shipping + recent winners ticker
- Daily Reward: claim 3 free credits/day with countdown timer
- Auto-Bid: set max bids modal, active indicator, cancel button
- Engagement: "You are leading" (green) / "You are outbid" (red) status, unique bidder count, bid count
- Category filters, "How it works" section
- i18n: all `auction.*` keys in EN + DE

**Frontend (pages/AuctionsPage.jsx):**
- Responsive grid layout: 2 cols mobile, 3 cols md, 4 cols xl
- Grid cards with: product image, countdown timer overlay, "FREE SHIPPING" badge, title, price, "Bieten" button, activity indicator (bid count flame icon)
- Trust bar: Secure Payments | Real-Time Bids | Free Shipping + recent winners ticker
- "How it works" section
- Category filter tabs (All, Phones, Gaming, Audio, Wearables, Laptops, Tablets, XR, Home)
- Auction detail: hero product image (full-width), "FREE WORLDWIDE SHIPPING" + "Brand New — Factory Sealed" badges, title, description, price ticker, countdown timer, bid button, live bid history, key features (6 items with checkmarks), shipping info (worldwide, delivery times, secure packaging, buyer protection)
- Buy Credits modal with 4 packages
- Route: `/auctions`, accessible from Homepage via purple banner
- i18n: `auction.*` keys in EN + DE
- Product images from Unsplash (mapped per product in PRODUCT_IMAGES dict)

**Product Catalog (2026 trending):**
- Samsung Galaxy S26 Ultra, iPhone 17 Pro Max, Google Pixel 10 Pro
- Nintendo Switch 2, PlayStation 5 Pro
- AirPods Pro 3, Sony WH-1000XM6
- Apple Watch Ultra 3, Samsung Galaxy Ring 2
- MacBook Pro 16" M5 Pro, iPad Pro 13" M5
- Meta Quest 4, Dyson Airstrait Pro
- Each product includes: detailed description, 6 key features, condition badge, category
- Easy to update: edit `PRODUCT_CATALOG` list in `routes/auctions.py`
- Admin endpoints: `POST /api/auctions/admin/refresh` (restart all), `GET /api/auctions/admin/catalog` (view catalog)

**Product Details & Shipping (Complete — April 5, 2026):**
- Product detail view: description, condition badge (Brand New), key features list with checkmarks
- Shipping section: Worldwide (190+ countries), estimated delivery (EU 3-5d, US/UK 5-7d, Rest 7-14d), secure packaging, buyer protection
- i18n: All shipping/feature keys in EN + DE

**Data model:**
- `auctions` collection: `{auction_id, title, description, retail_price, current_price, ends_at, status, winner_id, total_bids, ...}`
- `auction_bids` collection: `{bid_id, auction_id, user_id, user_name, bid_price, created_at}`
- `users.bid_credits`: integer credit balance

**Credit packages:**
- 10 credits = €5, 25 credits = €10, 50 credits = €18, 100 credits = €30

### Child Accounts (Complete)
- Backend CRUD (`/api/kids/children`), frontend persistent child management
- Add/select/remove children, weekly limit slider, progress bars

## Key Files
- `/app/backend/routes/stripe.py` — Stripe checkout + saved methods + 1-click
- `/app/backend/routes/auctions.py` — Penny auction system + engagement features
- `/app/backend/routes/profile.py` — User profile + KYC
- `/app/frontend/src/pages/AuctionsPage.jsx` — Auction UI + watchlist, referral, win/lose, notifications
- `/app/frontend/src/components/TopUpModal.jsx` — Top-up modal with 1-click UI
- `/app/frontend/src/services/api.js` — API service
- `/app/backend/routes/kids.py` — Child accounts
- `/app/backend/routes/analytics.py` — Conversion tracking
- `/app/frontend/src/services/tracker.js` — Frontend event tracker
- `/app/frontend/src/pages/HomePage.jsx` — Guest homepage

### Engagement Features (Complete — April 5, 2026)
**Backend:**
- Watchlist toggle (`POST /api/auctions/{id}/watchlist`, `GET /api/auctions/user/watchlist`)
- Bid Streak tracking (auto-increments on daily bids, `GET /api/auctions/user/streak`)
- Auction notifications (outbid, win alerts: `GET /api/auctions/user/notifications`)
- Auction referral system (`GET /api/auctions/user/referral`, `POST /api/auctions/user/apply-referral`)
- Win notifications auto-created when auctions end
- Outbid notifications auto-created on new bids
- Referral leaderboard (`GET /api/auctions/referral-leaderboard`)
- First purchase bonus check (`GET /api/auctions/first-purchase-check`)
- Direct card payment for bid credits (`POST /api/auctions/buy-credits-direct`)
- Saved payment method retrieval (`GET /api/auctions/saved-method`)

**Frontend:**
- Watchlist heart icon on all active auction cards (toggle on/off)
- Referral panel with WhatsApp/Email/Copy Link share buttons, earned rewards stats, and leaderboard
- Bid Streak counter shown in Daily Reward section
- Win/Lose celebration modal (detects when auctions transition active→ended)
- Notification toast system (outbid, won alerts)
- Added missing categories: TVs, Robots, Smart Home
- Full DE + EN translations for all new features
- One-Click Checkout: "Bestätigen & Bezahlen" confirmation screen with saved card selection, wallet balance option, secure badge, discount percentages on packages, first-purchase bonus
- Low Credits Popup: "Du bist nah am Gewinn!" prompt when credits ≤ 3
- Discount badges on credit packages: -20%, -28%, BESTER WERT

## Backlog (P0/P1 — Phase 1)
- Saved Cards Management Seite (P0 — UI to view/delete saved cards)
- Stripe Connect for Merchant Payouts (P0)
- Email Notifications — Resend/SendGrid (P0)
- Push Notifications — WebPush (P1)
- 2FA Integration (P1)
- Kids Wallet System with real transactions (P1)

## Backlog (P2/P3 — Not Started)
- Apple Pay / Google Pay
- User Streaks/Milestones tracking
- Auctions, Taxi, Scooter, Food features

## Credentials
- See `/app/memory/test_credentials.md`
