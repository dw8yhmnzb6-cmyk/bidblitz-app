# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech Super App called BidBlitz V2. Full-stack application with FastAPI backend, MongoDB database, and React/TailwindCSS frontend. Features include:
- Unified Wallet payment system
- Penny Auction platform with bot bidding
- Kids Wallet with parental controls
- Merchant POS system
- P2P transfers
- Premium Finance features
- Real Map System (Leaflet)
- Driver/Restaurant Dashboards

## What's Been Implemented

### Core Features (DONE)
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Wallet System**: EUR balance, top-ups, transfers
- **P2P Transfers**: Email, Username, QR, NFC methods
- **Stripe Integration**: Top-ups via Emergent proxy

### Penny Auction System (DONE)
- 20 unique premium products (no duplicates)
- 3-phase bot bidding strategy
- Premium DealDash-style UI redesign (April 2026)
- Live timer, bid counter, category filters
- "How it Works" tutorial section

### Kids Wallet System (DONE)
- Parent dashboard with child management
- Freeze/unfreeze child wallets
- PIN system for child authentication
- 16-button quick actions grid
- **NEW (April 2026)**: Tasks/Aufgaben system with rewards
- **FIXED (April 11)**: Aufgaben button now works with dedicated button per child

### Merchant POS (DONE)
- Barcode scanning payments
- Fee structure configuration
- Daily/weekly reporting

### Premium Finance Features (April 2026)
- Split Bill (UI ready, backend stub)
- Virtual Cards (UI ready, backend stub)
- Savings Goals (UI ready)
- BNPL / Pay Later (UI ready)
- Gift Cards (UI ready)
- **NEW**: Bills & eSIM Page - Pay utilities, buy eSIM data packages
- **NEW**: Credit Score Page - View A/B/C score, apply for credit

### Real Map & Mobility System (NEW - April 11, 2026)
- **UnifiedRealMap**: Leaflet-based map showing Scooters, Drivers, Restaurants
- **MapActionSheet**: Click markers for details and actions (unlock scooter, book taxi, order food)
- **MobilityMapPage**: Unified mobility view at `/mobility-map`
- **OrderTrackingPage**: Real-time delivery tracking with driver location

### Driver & Restaurant Dashboards (NEW - April 11, 2026)
- **DriverDashboardPage** (`/driver-dashboard`): Accept rides, go online/offline, view earnings
- **RestaurantDashboardPage** (`/restaurant-dashboard`): 
  - Order management (pending/active/history)
  - Menu management (add, edit, delete items)
  - **Driver Assignment**: Assign delivery drivers to orders
  - Statistics (today/week revenue)

### Receipt System (NEW - April 11, 2026)
- `GET /api/receipts/{transaction_id}` - HTML receipt for printing/PDF
- `GET /api/receipts/{transaction_id}/json` - JSON receipt data

### Translations (DONE)
- 15 languages with flag emojis
- German as primary language
- All Premium Finance features translated

## Architecture

### Backend
- FastAPI with Motor (async MongoDB)
- Routes: `/app/backend/routes/`
- Core: `/app/backend/core/`

### Frontend
- React 18 with TailwindCSS
- Framer Motion animations
- Shadcn/UI components
- State: Zustand stores

### Key Files
- `/app/backend/routes/auctions.py` - Auction system + bot logic
- `/app/backend/routes/kids.py` - Kids wallet + tasks
- `/app/frontend/src/pages/AuctionsPage.jsx` - Premium auction UI
- `/app/frontend/src/pages/KidsPaywall.jsx` - Parent dashboard
- `/app/frontend/src/store/I18nContext.jsx` - Translations

## Credentials
- Admin: `admin@bidblitz.com` / `BidBlitz2026!`
- Customer: `kunde@bidblitz.com` / `Kunde2026!`

## Known Issues
1. ~~SendMoney Modal balance fallback~~ (FIXED)
2. Some Premium Finance pages need full implementation

## Backlog (P1-P2)
- [x] Complete Bills & eSIM implementation ✅
- [x] Credit Score system UI ✅
- [x] Receipt PDF export ✅
- [x] Real map tracking ✅
- [x] Restaurant Dashboard with Driver Assignment ✅
- [ ] Complete Split Bill implementation
- [ ] Complete Virtual Cards implementation
- [ ] NFT Generator UI
- [ ] Apple Pay / Google Pay
- [ ] Chat/Support system

## Session Updates (April 11, 2026)
- Fixed Auction UI - Premium DealDash-style redesign
- Created 20 unique auction products (no duplicates)
- Tested bot bidding - working correctly
- Added Premium Finance menu to MorePage
- Fixed translation keys for new features
- Added Kids Tasks/Aufgaben system with rewards
- Fixed SendMoneyModal balance display bug

## Session Updates (April 11, 2026 - Part 2)
### Bug Fixes
- ✅ **Wallet Balance €0.00 Bug** - Fixed SendMoneyModal to use direct fetch() calls
- ✅ **Aufgaben Button** - Added dedicated "Aufgaben" button per child card with z-index 9999
- ✅ **DriverDashboardPage API Bug** - Fixed api() function calls to use fetch()
- ✅ **Credit Score API Alias** - Added `/my-score` and `/apply` aliases for frontend compatibility

### New Features Implemented
- ✅ **Restaurant Dashboard** (`/restaurant-dashboard`)
  - Order management (pending, active, history)
  - Menu management (add, edit, toggle, delete)
  - Statistics tab (today/week revenue)
  - **Driver Assignment** - Assign/remove drivers for deliveries

- ✅ **Driver Assignment System**
  - `GET /api/restaurant-dashboard/available-drivers`
  - `POST /api/restaurant-dashboard/orders/{id}/assign-driver`
  - `POST /api/restaurant-dashboard/orders/{id}/remove-driver`
  - `GET /api/restaurant-dashboard/orders/{id}/tracking`

- ✅ **Map Action Sheet** (`/app/frontend/src/components/MapActionSheet.jsx`)
  - Click Scooter → Unlock/Reserve
  - Click Driver → Book ride
  - Click Restaurant → View menu

- ✅ **Mobility Map Page** (`/mobility-map`)
  - Filter: Scooters, Drivers, Restaurants
  - Live counts and quick stats
  - Real-time 30-second refresh

- ✅ **Order Tracking Page** (`OrderTrackingPage.jsx`)
  - Status timeline (Ordered → Preparing → Ready → Delivered)
  - Driver location on map
  - Restaurant info with navigation

- ✅ **Bills & eSIM Page** (`/bills`)
  - eSIM packages (EU 1GB, 3GB, 10GB, World 5GB)
  - Mobile top-up (€10, €20, €50)
  - Utility bills (Strom, Gas, Internet)

- ✅ **Credit Score Page** (`/credit-score`)
  - Score display (A/B/C)
  - Max credit limit and interest rate
  - Apply for credit button

- ✅ **Receipt System**
  - `GET /api/receipts/{transaction_id}` - HTML receipt
  - Printable format with transaction details

## Session Updates (April 11, 2026 - Part 3)
### Kids GPS & Safety System (COMPLETE)

**Backend Endpoints** (`/api/kids/gps/`):
- `POST /location` - Update child's GPS position
- `GET /location/{child_id}` - Get current location
- `GET /location/{child_id}/history?days=N` - Get location history (up to 30 days)
- `GET /zones/{child_id}` - List all zones
- `POST /zones` - Create new zone (safe/danger)
- `PUT /zones/{zone_id}` - Update zone
- `DELETE /zones/{zone_id}` - Delete zone
- `GET /all-locations` - Get all children's locations
- `POST /simulate/{child_id}` - Simulate location (for testing)

**Frontend Components**:
- `KidsGPSModal.jsx` - Full GPS tracking modal with 3 tabs:
  - **Live Tab**: Real-time location, battery, speed
  - **History Tab**: 24h/7days/30days location history
  - **Zones Tab**: Create/manage safe zones & danger zones

- `KidsQuickModals.jsx` - All 16 Quick Action modals:
  - ScreenTimeModal - Set daily limits, bedtime
  - BatteryModal - Check child's device battery
  - PointsModal - Reward points system
  - ReportsModal - Weekly activity reports
  - SpendingModal - Spending analytics
  - BadgesModal - Achievement badges
  - ChallengesModal - Parent-set challenges
  - CoParentsModal - Invite co-parents
  - BoardModal - Family notes/reminders
  - AnalyticsModal - Usage statistics

**Zone Features**:
- Safe Zones (green) - Notifications when child enters/exits
- Danger Zones (red) - Alerts when child enters
- Configurable radius: 50m, 100m, 200m, 500m, 1000m
- Custom coordinates (lat/lng)
- Real-time zone checking with haversine distance calculation
  - Statistics tab (today/week revenue)
  - **Driver Assignment** - Restaurants can assign delivery drivers to orders
- ✅ **Driver Assignment System** - Backend endpoints for driver allocation
  - `GET /api/restaurant-dashboard/available-drivers`
  - `POST /api/restaurant-dashboard/orders/{id}/assign-driver`
  - `POST /api/restaurant-dashboard/orders/{id}/remove-driver`
  - `GET /api/restaurant-dashboard/orders/{id}/tracking`

### Bug Fixes Applied
- Fixed `DriverDashboardPage.jsx` API calls (was using broken api() function)
- Fixed `SendMoneyModal.jsx` balance loading
- Enhanced `KidsPaywall.jsx` with dedicated Aufgaben button per child

## Backlog (Updated)
- [ ] KYC Verification UI endpoint mismatch
- [ ] Main app Referral `my-code` auto-generation
- [ ] Merchant Dashboard `today_revenue` null issue
- [ ] Premium Finance UI (Credit Score, eSIM, NFT Generator)
- [ ] Connect Map Markers to Actions
- [ ] Receipt PDF export
- [ ] Apple Pay / Google Pay
