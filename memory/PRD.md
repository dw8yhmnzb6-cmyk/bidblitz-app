# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional overhaul.

## Core Features Implemented

### User System
- User registration with email verification
- JWT-based authentication
- Customer numbers (8-digit) for gifting
- VIP membership tiers (Standard, Gold, Platinum, Diamond)
- Influencer accounts with free VIP access
- Manager accounts (regional) - 3-tier hierarchy
- Referral System with rankings

### Auction System
- Real-time penny auctions with WebSocket updates
- Bot system (dual-mode: activity & sniper)
- Auction of the Day feature
- VIP-only auctions
- Auto-restart (3s delay)
- Timer extension on bids (10-15s)
- Beginner-Protection Auctions (<10 wins)
- **Bid Buddy / Auto-Bieter** - Automatic bidding system
- **Buy It Now** - Purchase with bid credit after losing
- **Countdown Alarm** - Notifications before auction ends
- **NEW: Team Auctions** - Group bidding with shared bids
- **NEW: Auction Replay** - View bid history and statistics

### Payment Integration
- Stripe (LIVE keys configured)
- Bid packages
- Happy Hour 2x Bids (18:00-20:00 Berlin)
- **Subscription Model** - Monthly bid packages (Basic €19.99, Pro €39.99, Elite €79.99)
- **NEW: Auction Insurance** - €0.50 per auction, 50% bid refund on loss

### Gamification System
- **Glücksrad (Lucky Wheel)**: Daily spin for prizes
- **Wochen-Rangliste (Leaderboard)**: Top 10 win free bids
- **Bieter-Streak Bonus**: Consecutive bid bonuses
- **Achievements & Badges**: 18 achievements across 5 categories
- **Battle Pass System**: 50-tier progression with rewards
- **Mystery Box Auctions**: Hidden premium products
- **Levels System**: Bronze → Diamond progression
- **NEW: Streak Protection**: Protect login streaks with shield
- **NEW: Birthday Bonus**: 10-30 free bids on birthday (VIP-tiered)

### Engagement Features
- **Video Testimonials**: Winner videos with upload rewards
- **Win Notifications**: FOMO-inducing push notifications
- **Referral/Freunde-Bonus**: Invite friends, earn bids
- **Social Share Bonus**: Share wins on social media
- **Price Alerts**: Get notified when auctions drop below target
- **NEW: Favorites with Smart Alerts**: Notification when favorite products go live
- **NEW: Flash Coupons**: Time-limited discounts during auctions
- **NEW: VIP Lounge Chat**: Exclusive chat for VIP members
- **NEW: Product Wishlist**: Vote for products you want auctioned
- **NEW: Bid Refund for VIP**: 10-25% bid refund on losses

### Communication
- Telegram Bot (@BidBlitzBot)
- Push Notifications for ending auctions
- **Live Chat** (Tawk.to placeholder - needs configuration)
- Email notifications via Resend

## Technical Architecture

### Frontend
- React 18 with React Router
- Tailwind CSS + Shadcn/UI
- WebSocket for real-time updates
- i18n context for 10+ languages

### Backend
- FastAPI with async support
- MongoDB database
- JWT authentication
- WebSocket manager

## Completion Status (February 2, 2026)

### ✅ Completed - 20 Customer Features (2 Batches)

**Batch 1 (10 Features):**
1. Bid Buddy / Auto-Bieter
2. Buy It Now with bid credit
3. Subscription Model (3 tiers)
4. Achievements & Badges (18 badges)
5. Referral/Freunde-Bonus
6. Win Notifications
7. Countdown Alarm
8. Video Testimonials
9. Statistics & Insights (MyStatsPage)
10. Live Chat (Tawk.to placeholder)

**Batch 2 (10 Features):**
1. **Auction Favorites with Smart Alerts**
2. **Team Auctions (Group Bidding)**
3. **Bid Refund for VIP** (10-25% back on loss)
4. **Auction Replay & Statistics**
5. **Flash Coupons** (time-limited discounts)
6. **VIP Lounge Chat**
7. **Birthday Bonus** (10-30 bids)
8. **Auction Insurance** (€0.50 for 50% refund)
9. **Product Wishlist Voting**
10. **Streak Protection**

### 📋 Pending Items
- **Live Chat Activation**: Requires user's Tawk.to Property ID
- **Apple Login**: UI button added, needs Apple Developer credentials
- **Auction Duration Bug**: P2 - Admin form calculation issue
- **"Not Found" Toast**: P3 - Recurring issue

## New Routes Added

### Backend API Endpoints
- `/api/favorites/*` - Favorites management
- `/api/teams/*` - Team auctions
- `/api/bid-refund/*` - VIP bid refunds
- `/api/auction-replay/*` - Auction history
- `/api/flash-coupons/*` - Flash coupons
- `/api/vip-lounge/*` - VIP chat
- `/api/birthday/*` - Birthday bonus
- `/api/insurance/*` - Auction insurance
- `/api/wishlist/*` - Product wishlist
- `/api/streak-protection/*` - Login streaks

### Frontend Pages
- `/streak` or `/login-streak` - Streak Protection
- `/birthday` or `/geburtstag` - Birthday Bonus
- `/teams` or `/team-auktionen` - Team Auctions
- `/produkt-wuensche` or `/product-wishlist` - Product Wishlist

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Customer:** kunde@bidblitz.de / Kunde123!
- **Influencer:** Code: demo
- **Manager (Berlin):** manager.berlin@bidblitz.de / Manager123!
- **Manager (Prishtina):** manager.prishtina@bidblitz.de / Prishtina2024!

## Test Reports
- `/app/test_reports/iteration_28.json` - Batch 1 (100% pass)
- `/app/test_reports/iteration_29.json` - Batch 2 (100% pass)

## Database Collections - New
- `favorites` - User favorites with price alerts
- `teams` - Bidding teams
- `team_bids` - Team bid history
- `bid_refunds` - VIP refund records
- `flash_coupons` - Time-limited coupons
- `coupon_redemptions` - Coupon usage
- `user_discounts` - Active discounts
- `vip_chat_messages` - VIP lounge messages
- `birthday_bonuses` - Claimed birthday bonuses
- `auction_insurance` - Insurance policies
- `product_wishes` - Product suggestions
- `streak_protections` - Streak protection records
- `streak_rewards_claimed` - Claimed streak milestones

## Mocked APIs
- **Resend Email**: Mock mode (no production key)
- **Tawk.to Live Chat**: Placeholder (needs user configuration)

## Changelog

### February 2, 2026 - Batch 2: 10 Engagement Features
- ✅ Implemented Favorites with Smart Alerts
- ✅ Implemented Team Auctions (group bidding)
- ✅ Implemented Bid Refund for VIP (10-25%)
- ✅ Implemented Auction Replay & Statistics
- ✅ Implemented Flash Coupons system
- ✅ Implemented VIP Lounge Chat
- ✅ Implemented Birthday Bonus (VIP-tiered)
- ✅ Implemented Auction Insurance
- ✅ Implemented Product Wishlist Voting
- ✅ Implemented Streak Protection with milestones
- ✅ Fixed route conflict in wishlist router
- ✅ Test Report: 100% success (28 backend + 4 frontend tests)

### February 2, 2026 - Batch 1: 10 Customer Features
- ✅ Implemented Bid Buddy, Buy It Now, Subscriptions
- ✅ Implemented Achievements, Testimonials, Win Notifications
- ✅ Test Report: 100% success (23 backend + 4 frontend tests)

### Previous Sessions
- Manager System (3-tier hierarchy)
- Product Database update (72 new 2025/2026 products)
- Stripe payment fix
- Influencer System with tiered commissions
- Admin Voice Commands
- Battle Pass System
- Mystery Box Auctions
- And many more...

## Last Updated
February 2, 2026
