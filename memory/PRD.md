# BidBlitz V2 — Product Requirements Document

## Vision
Ultra-premium fintech web app (year 2040 design) for payments, penny auctions, crypto mining, wallet management, and merchant POS.

## Tech Stack
- Frontend: React, TailwindCSS, Framer Motion, ShadCN/UI
- Backend: FastAPI, MongoDB (Motor), JWT Auth
- Payments: Stripe / Stripe Connect
- Design: Dark glassmorphism, cyan/gold glow accents

## Production Status: LAUNCH READY ✅ (2026-04-07)

### Core Flows Status

| Flow | Status | Notes |
|------|--------|-------|
| Auth (Login) | ✅ DONE | Works |
| Auth (Register) | ✅ DONE | Invite code required |
| Password Reset | ✅ DONE | Token-based flow |
| Wallet Balance | ✅ DONE | Real-time |
| Wallet Top-Up (Stripe) | ✅ DONE | Checkout + webhook |
| Receipt PDF | ✅ DONE | JSON + PDF download |
| KYC Status | ✅ DONE | Verification endpoint |
| KYC Upload | ✅ DONE | Multipart form |
| Mining Dashboard | ✅ DONE | Stats + miners |
| Mining Buy | ✅ DONE | Balance check |
| Auction List | ✅ DONE | 7 active |
| Auction Credits | ✅ DONE | 5 packages |
| Auction Buy Credits | ✅ DONE | Wallet deduction |
| Referral Code | ✅ DONE | Auto-generated |
| Merchant QR | ✅ DONE | Creates payment |
| Barcode Payment | ✅ DONE | Dynamic codes |
| Kids Subscription | ✅ DONE | Trial + plans |
| Influencer Dashboard | ✅ DONE | Stats + share |

### 1. Stripe Wallet Top-Up ✅
- Checkout session creation working
- Quick top-up with saved cards
- Webhook integration for balance credit
- Return URL polling for instant updates

### 2. Receipt PDF System ✅
- JSON receipt endpoint: `/api/payments/receipt/{id}`
- PDF download: `/api/payments/receipt/{id}/pdf`
- Print button in transaction detail modal
- Includes: amount, fee, date, reference, merchant

### 3. KYC Verification Flow ✅
- Status endpoint with `is_verified`, `can_high_value_txn`
- Upload support for ID documents
- Admin approve/reject workflow
- High-value transaction restrictions

### 4. Mining Purchase Flow ✅
- 5 packages: Starter (€49) to Titan (€9,999)
- Billing: Onetime / Monthly (-30%) / Yearly (-40%)
- ROI badges (316%-894%)
- Auto-rewards system (daily BLZ distribution)

### 5. Wallet UI ✅
- Prominent balance display
- Primary "Guthaben aufladen" button
- Quick stats: Ausgegeben / Einnahmen
- 4 quick actions: Aufladen, Bezahlen, Senden, Verlauf
- Premium card display
- Transaction filters

### 6. Security Hardening ✅
- Rate limiting: auth (10/min), payments (20/min)
- Fraud detection: duplicates, rapid requests, card testing
- HTTPS-only cookies in production
- Input validation via Pydantic
- JWT rotation (15min access, 7d refresh)

### 7. Production Deployment ✅
- Database indexes created (54 collections)
- Migration scripts ready
- Environment template configured
- Pre-launch checklist script

### All Systems Verified:
- ✅ Auth (login/register)
- ✅ Wallet balance + top-up
- ✅ Stripe checkout
- ✅ Mining dashboard + purchase
- ✅ Auctions + bidding
- ✅ Receipt PDF
- ✅ KYC status
- ✅ Barcode/QR payments
- ✅ Referral system
- ✅ 15-language i18n

## Completed Features
- JWT Auth, Wallet with Stripe, Penny auctions, 15-language i18n (flag emojis)
- Stripe Top-Up FIXED: Checkout → Redirect → Status Poll → Wallet Credit → Saved Card (2026-04-07)
- Influencer payouts, Gamified Rewards, Role requests, Identity verification
- Merchant Hierarchy, Barcode/QR/NFC payment flows
- POS Terminal, Admin Fee Config, Reports, Merchant Landing Page
- Auction Bot Admin (auto-bidding, target price, 30 bot names)
- Home Screen: "Available Now" + "Coming Soon" feature sections

## Launch-Critical Updates (2026-04-07)

### Receipt PDF System (DONE)
- PDF receipt generation using FPDF2
- `/api/payments/receipt/{id}` - JSON receipt data
- `/api/payments/receipt/{id}/pdf` - Downloadable PDF
- Transaction detail modal with Download PDF + Print buttons
- Includes: amount, fee, date, transaction ID, merchant, reference

### KYC Verification Flow (ENHANCED)
- `/api/verification/my-status` returns: is_verified, verification_required, can_high_value_txn
- `/api/verification/status` alias for backwards compatibility
- High-value transaction restrictions for unverified users (>€1000 or merchant roles)

### Wallet UI Improvements (DONE)
- Prominent balance display (EUR 89,36)
- Primary "Guthaben aufladen" top-up button
- Quick stats: Ausgaben (spent) + Einnahmen (income) with trend
- 4-grid quick actions: Aufladen, Bezahlen, Senden, Verlauf
- Premium card display with holder name + expiry
- Transaction filter tabs: All, Payments, Top-ups, Transfers

### Mining Purchase Flow (VERIFIED)
- Shop with Einmalig/Monatlich/Jährlich billing toggle
- ROI% badges per package (316%-894%)
- Price tiers: €49 - €9,999
- Dashboard shows active miners, BLZ balance, hashrate, auto-rewards

### Auction System (VERIFIED)
- 7+ live auctions with countdown timers
- Credit purchase system
- Referral sharing (WhatsApp, E-Mail, Link)
- Category filters (Phones, Gaming, Laptops, Tablets, TVs, Robots)

## Crypto Mining Module — COMPLETE

### Phase 1 (DONE)
- Mining Dashboard: BLZ balance, hashrate, earnings, streak, referral boost
- Daily Rewards: Claim with abuse prevention, streak tracking
- Wallet Tab: BLZ→EUR, send, history with Today/All filter + type badges
- Package Comparison Table: 5 packages with BEST badge
- Purchase Flow: Select → Confirm (balance check) → Buy → Success animation
- Upgrade System: Power & Efficiency (10 levels each)
- VIP Levels: Bronze→Diamond with mining bonuses (0-15%)
- Referral System: Unique codes, 5% bonus

### Phase 2 (DONE - 2026-04-05)
- **Marketplace**: List miners for sale (BLZ price), browse listings, buy from other users, cancel own listings. Transfers miner ownership + BLZ between wallets.
- **Card**: Virtual BLZ spending card with 4 tiers (Standard/Gold/Platinum/Black). Features: daily spending limits (€100-€10,000), cashback (1-5%), freeze/unfreeze, upgrade with BLZ, card transaction history.
- **Launchpad**: 3 exclusive limited-edition miner launches (Fusion X1/Neural V2/Solar MK3) with bonus hashrate, supply tracking, progress bars, VIP requirements, and "Mint Now" purchase flow. One purchase per user per project.

### Auto-Rewards System (DONE - 2026-04-05)
- **Background Loop**: Runs every 60s in `server.py`, processes all users with active miners
- **Automatic Distribution**: Calculates daily BLZ rewards (hashrate × base_rate × efficiency × VIP bonus) and credits wallets automatically
- **Duplicate Prevention**: Checks `mining_claims` for today's date before distributing; stores `type: "auto"` on claims
- **Transaction Logging**: Each auto-reward logged in `mining_transactions` with type `mining_reward`
- **Referral Bonus**: Auto-distributes 5% referral bonus to referrers
- **Dashboard UI**: Shows countdown timer to next reward (midnight UTC), auto-collected amount, streak
- **i18n**: German + English translation keys for auto-reward UI

### GoMining-Style Shop Redesign (DONE - 2026-04-05)
- **Billing Toggle**: Einmalig / Monatlich (-30%) / Jährlich (-40%) subscription options
- **Package Cards**: TH/s, daily BLZ earnings, ROI%, discount badges (MINUS 30%/40%), original vs discounted price
- **Inline Buy Flow**: Package selection → Earnings summary (daily/monthly/yearly) → "Heute fällig" price → Balance check → Buy/Subscribe button (replaces old modal)
- **Subscription Billing**: Monthly/yearly contracts with `next_payment` date stored on miner; auto-renewal labels
- **Enhanced Dashboard**: New "Ertragsübersicht" section (daily/monthly/yearly earnings in BLZ + EUR), "Meine Miner" section showing per-miner earnings with subscription badges
- **Backend**: Updated packages API with pricing tiers, ROI calc, enriched miner data with per-miner earnings
- **i18n**: Full German + English translations for all new labels

### Mining API Endpoints
Phase 1: /api/mining/dashboard (inkl. next_reward_at), /packages, /upgrade-costs, /vip-levels, /claim-history, /transactions, /admin/reward-logs
Phase 1 POST: /buy-miner, /upgrade, /claim-daily, /withdraw, /send, /apply-referral
Phase 2: GET /marketplace, /card, /launchpad
Phase 2 POST: /marketplace/list, /marketplace/buy, /marketplace/cancel, /card/spend, /card/upgrade, /card/freeze, /launchpad/buy
Background: Auto-reward loop (60s interval in server.py)

### Backend Files
- `/app/backend/routes/mining.py` — Phase 1
- `/app/backend/routes/mining_phase2.py` — Marketplace, Card, Launchpad
- `/app/backend/routes/pos_payments.py` — Receipt PDF system

## Upcoming Tasks
- 2FA Integration (P1)
- Kids Wallet with real UI (P1)
- Email Notifications (P1)

## Backlog (P2)
- Apple/Google Pay, Developer SDK, Chat/Support, NFC Tap-to-Pay

## Credentials
- See /app/memory/test_credentials.md
