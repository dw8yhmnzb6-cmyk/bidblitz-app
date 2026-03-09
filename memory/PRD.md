# BidBlitz Super App - PRD

## Original Problem Statement
Build a "Super App" called BidBlitz that consolidates auctions, games, mobility services (taxi, scooter, bike), and a coin-based economy into one platform. The app uses React/FastAPI/MongoDB stack.

## User Personas
- **Gamers**: Play mini-games to earn coins
- **Auction Users**: Bid on products using coins
- **Mobility Users**: Use taxi/scooter/bike services
- **Admins**: Manage platform, users, and economy

## Core Requirements
1. Super App Home with tab navigation (Home/Games/Wallet/Profile)
2. Mini-games integrated with coin economy
3. Auction system with bidding
4. Mobility services booking
5. Admin panel for management

## Tech Stack
- **Frontend**: React, Tailwind CSS
- **Backend**: FastAPI, Pydantic
- **Database**: MongoDB Atlas
- **Pre-existing**: Stripe, Leaflet.js, Three.js

---

## Completed Features

### December 2025
- [x] SuperAppHome with 4-tab navigation (Home/Games/Wallet/Profile)
- [x] 8 Service Cards: Games, Mining, Taxi, Scooter, Bike, Market, Casino, Rank
- [x] 4 Game Cards: Candy Match, Lucky Wheel, Coin Tap, Runner
- [x] Wallet page with coin balance and actions
- [x] Profile page with settings menu
- [x] Backend coin API integration
- [x] AdminPanelNew with 60+ functions
- [x] Multiple game components: CandyMatch, LuckyWheel, CoinTap, ReactionGame, RunnerGame, SlotMachine
- [x] HomeModern as main landing page
- [x] GamesHub game store

---

## P0 - Critical (COMPLETED ✅)
1. ~~**Code Cleanup**: Delete 200+ obsolete files in `/pages` directory~~ - DONE (39 files deleted)
2. ~~**Connect games to backend economy**: All games use local state, need API integration~~ - DONE (CandyMatch, SlotMachine, LuckyWheel, CoinTap)
3. ~~**Admin Panel Navigation Bug**: Tabs navigated away from `/admin-panel` to `/admin`~~ - FIXED (March 2026) - Updated `handleTabClick` and `handleItemClick` to use `setActiveTab` instead of `navigate()`

## P1 - High Priority
4. **Navigation standardization**: Convert remaining vanilla JS onclick to React Router
5. **Leaderboard consolidation**: Two components exist (Leaderboard.jsx, GameLeaderboard.jsx)

## P2 - Medium Priority
5. **Translations**: Most new components have hardcoded German text
6. **Game scoring API**: Connect win/loss to `/api/bbz/coins/earn` and `/api/bbz/games/reward`

## P3 - Future/Backlog
- Customer Video Ads system
- Weekly League & Games Pass
- BidBlitzToken.sol Smart Contract deployment
- Professional Games Backend verification

---

## Key API Endpoints
- `GET /api/bbz/coins/{user_id}` - Get user coin balance
- `POST /api/bbz/coins/earn` - Earn coins
- `POST /api/bbz/games/reward` - Game reward
- `GET /api/bbz/leaderboard` - Get leaderboard

## Test Credentials
- **Admin**: admin@bidblitz.ae / admin123
- **Customer**: kunde@bidblitz.ae / test123

## Known Issues
- Game components use client-side coin counters (not connected to backend)
- GameLeaderboard uses static data
- Some navigation uses vanilla JS instead of React Router

## Changelog - March 2026
- **[FIXED] AdminPanelNew Tab Navigation**: Fixed bug where clicking tabs navigated to `/admin?tab=X` instead of staying on `/admin-panel`. Updated `handleTabClick()` and `handleItemClick()` to update state without navigation.
