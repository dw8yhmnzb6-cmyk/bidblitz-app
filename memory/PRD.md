# BidBlitz Penny Auction Platform - PRD

## Original Problem Statement
Build a penny auction website modeled after `dealdash.com` and `snipster.de` with full German localization and real-time bidding functionality.

## Core Features

### Implemented ✅
- **User Authentication**: JWT-based auth with email verification
- **Auction System**: Real-time penny auctions with WebSocket updates
- **Bot System**: AI bots that bid automatically (€1-2 range or admin-set targets)
- **Admin Panel**: Complete management of auctions, users, products, bots
- **Payment Integration**: Stripe (live keys), Coinbase Commerce (disabled)
- **VIP System**: VIP membership with exclusive auctions
- **Internationalization**: German/English support
- **Auction Types**: Standard, Beginner, Free, Night, VIP auctions
- **Auto-Restart**: Ended auctions automatically restart after 5 minutes
- **Affiliate System**: Referral tracking and commission
- **Voucher System**: Discount codes and promotions
- **Static Pages**: AGB, Impressum, Datenschutz with multi-language support

### User Personas
1. **Bidders**: Users who purchase bid packages and participate in auctions
2. **Admins**: Manage auctions, products, users, and platform settings
3. **VIP Members**: Premium users with access to exclusive auctions

## Technical Architecture

### Stack
- **Frontend**: React 18, TailwindCSS, Shadcn/UI
- **Backend**: FastAPI, Python 3.11
- **Database**: MongoDB
- **Real-time**: WebSockets
- **Payments**: Stripe

### Key Files
- `/app/frontend/src/pages/Auctions.js` - Main auction page with stable card positioning
- `/app/frontend/src/pages/Admin.js` - Admin panel (refactoring in progress)
- `/app/backend/server.py` - Main server with bot AI logic
- `/app/backend/routers/` - API routes

## Current Session Work (Jan 2025)

### Completed ✅
- **Fixed "Jumping" Auction Cards**: Implemented stable positioning using `useRef` to maintain card order across renders
- **Verified Timer Updates**: Cards show correct HH:MM:SS format, update independently
- **Expired Auction Removal**: Auctions with 00:00:00 timer correctly removed from grid

### Test Results
- Frontend testing: 100% pass rate (9/9 tests)
- Card stability verified over 30+ seconds observation
- All filter buttons working correctly

## Priority Backlog

### P1 - High Priority
- [ ] Complete `Admin.js` refactoring (~30% done, 10+ tabs remaining)

### P2 - Medium Priority  
- [ ] Root cause of "Not Found" toast (mitigated, not resolved)
- [ ] Inconsistent data persistence audit
- [ ] Refactor overlapping user routers (`user.py` + `users.py`)
- [ ] Two-Factor Authentication (2FA)
- [ ] PayPal Integration

### P3 - Low Priority / Future
- [ ] Live-Chat activation (requires Tawk.to ID from user)

## Known Issues

### Mitigated (Not Resolved)
- **"Not Found" Toast**: Global Axios interceptor suppresses 404 toasts, but root cause unknown

### Technical Debt
- `Admin.js` is 4000+ lines - needs component extraction
- Two user router files with overlapping logic

## Credentials
- **Admin**: admin@bidblitz.de / Admin123!
- **Customer**: kunde@bidblitz.de / Kunde123!

## 3rd Party Integrations
- **Stripe**: Live API keys integrated
- **Resend**: Email service (sandbox mode)
- **Tawk.to**: Live chat placeholder (needs user configuration)
- **ip-api.com**: VPN/proxy detection
