# BidBlitz PRD - Product Requirements Document

## Original Problem Statement
BidBlitz is a penny auction platform expanded with Scooter/Mobility, Microfinance, and Support systems.

## Architecture
- **Frontend:** React (CRA) + TailwindCSS + Shadcn UI
- **Backend:** FastAPI with modular routers
- **Database:** MongoDB (Local on IONOS production, Atlas for development)
- **Deployment:** IONOS server (212.227.20.190), GitHub Actions CI/CD
- **Production URL:** bidblitz.ae

## Implemented Features (Feb 27, 2026)

### Core Auction Platform
- 30 live auctions with real product photos, starting at 0.01 EUR
- Active bots, WebSocket real-time updates
- KYC verification, user management

### Scooter/Mobility System (Lime-Style)
- **Backend APIs:**
  - `/api/devices/available` - Public device listing with GPS coordinates
  - `/api/devices/reserve/{id}` - Reserve device (free 10 min)
  - `/api/devices/ring/{id}` - Ring/locate device
  - `/api/devices/report/{id}` - Report problem
  - `/api/devices/unlock/request` - Start ride
  - `/api/devices/unlock/{id}/end` - End ride
  - `/api/devices/my-sessions` - Ride history
- **15 demo scooters** in Dubai + Pristina with GPS, battery, range
- **ScooterApp.jsx** - Full map interface with QR scanner

### Partner Auth System (Separate)
- `/api/partner-auth/register` - Partner registration
- `/api/partner-auth/login` - Partner login (separate JWT)
- Roles: PARTNER_ADMIN, PARTNER_STAFF
- Admin endpoints for activation/suspension

### Wallet Ledger System
- `/api/wallet-ledger/balance` - Balance from double-entry ledger
- `/api/wallet-ledger/transactions` - Transaction history
- `/api/wallet-ledger/topup` - Add funds
- Categories: topup, ride_fee, ride_unlock, loan, repayment, transfer, refund

### Support Tickets (User-Facing)
- `/support-tickets` - Create, view, reply to tickets
- Categories: general, billing, device, account, auction

### Microfinance/Loans (User-Facing)
- `/loans` - Apply for EUR 50-5000 loans, 7-365 days
- Status tracking, repayment via wallet

### Dashboard Quick Access
- New service tiles: Scooter, Support, Kredite
- Positioned below stats cards on user dashboard

### Admin Panel (Mobile-Responsive)
- AdminDevices, AdminTickets, AdminLoans, AdminOrganizations
- Card layout on mobile, table on desktop

## Important Notes
- **Production DB:** MongoDB localhost:27017/bidblitz (NOT Atlas)
- **Changes must be made directly on IONOS server**
- **Admin:** admin@bidblitz.ae / AfrimKrasniqi123
- **Server:** 212.227.20.190 / root / neew7ky3xhyt3H

## Backlog
- Push Notifications
- Haendler-Finder (Map View)
- WhatsApp Integration
- App Store submission
- CI/CD pipeline end-to-end verification
