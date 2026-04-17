# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (async MongoDB)
- Production: IONOS Server (212.227.20.190), PM2, Nginx, MongoDB Atlas

## Production Status: LIVE & ALL V2 MODULES RUNNING ✅
- Server: 212.227.20.190 | Domain: bidblitz.ae
- PM2 Process: "api" (PID stable, 146MB RAM)
- All 41+ API endpoint groups verified working

## Deployed & Verified (2026-04-16)

### All V2 Modules on Production (41/41 ✅):
- Auth, Wallet, Transactions
- Mining, Crypto Baskets, Crypto Earn, Supercharger, DeFi Wallet, Derivatives, BlitzCard, LevelUp, Predictions
- Restaurants, Food Delivery, Tierbetreuung, Bookings, Skills, Live Shopping, Creators, Marketplace, Invoicing, Contracts, P2P Lending, Crypto Loans, Trading Bot
- Taxi (Pricing, Nearby, Estimate), Scooter
- Kids (Subscription, Children, Quiz)
- Viral (Clips, Daily Spin, Challenges, Surveys)
- Abo Boxes, Micro Tasks, Card Compare
- Admin (Stats, Users)

### Key Fixes Applied:
- Killed zombie V1 uvicorn process hogging port 8001
- Removed old PM2 processes (bidblitz, bidblitz-api)
- Uploaded missing route files (derivatives, blitzcard, blitz_features, quiz)
- Fixed get_current_user to handle both V1 (UUID/Bearer) and V2 (ObjectId/Cookie) auth
- Fixed serialize_user to handle both DB formats
- Added wallet payment for Kids subscription
- Fixed TaxiPage endpoint paths
- Fixed MiningPage Promise.all crash
- Auto-refresh tokens (45min silent refresh)
- Mobile UI fixes (no horizontal scroll)

## Credentials
- Admin (Production): admin@bidblitz.ae / BidBlitz2026!
- Admin (Preview): admin@bidblitz.com / BidBlitz2026!
- SSH: root@212.227.20.190

## Backlog
- P2: App.js Code Splitting (130+ Routes need lazy loading)
- P2: Server Security (Fail2Ban, SSH keys)
- P3: Valid Stripe key for card payments (current mk_ key invalid)
