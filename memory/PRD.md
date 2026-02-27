# BidBlitz PRD - Product Requirements Document

## Original Problem Statement
BidBlitz is a penny auction platform (React frontend, FastAPI backend, MongoDB). The user needed:
1. Server migration to IONOS (212.227.20.190)
2. Mandatory KYC verification flow
3. Scooter/Device unlock system with support tickets and microfinance
4. CI/CD pipeline via GitHub Actions
5. Auction content creation with bots
6. Fix frontend auction rendering bug

## Architecture
- **Frontend:** React (CRA) with TailwindCSS + Shadcn UI
- **Backend:** FastAPI with modular routers
- **Database:** MongoDB Atlas
- **Deployment:** IONOS server, GitHub Actions CI/CD

## What's Been Implemented
- Server stabilization (swap file, routing)
- Login and navigation fixes
- Mandatory KYC wall with ProtectedRoute
- Backend for Scooter/Device, Support Tickets, Microfinance
- CI/CD pipeline with GitHub Actions
- Email reminder service
- Content: 30 new auctions (Feb 2026) with real product photos, starting at 0.01 EUR
- Active bots bidding on all auctions
- Fixed /api/auctions/recent-winners 404 endpoint

## Current State (Feb 2026)
- 30 live auctions with real Unsplash product images
- All auctions start at 0.01 EUR (1 cent)
- 27 active, 3 night-paused
- Mixed categories: Elektronik, Mode, Haus & Garten, Sport
- Special types: 3 Night auctions, 2 VIP, 2 Beginner
- Bots active on all auctions

## Pending Issues
- P1: E2E verification of CI/CD pipeline
- P2: Complete KYC upload/approval flow test
- P2: User-facing frontend for Scooter/Ticket/Loan features

## Backlog
- Push Notifications
- Haendler-Finder (Map View)
- WhatsApp Integration
- App Store submission
- Refactor large components (StaffPOS.js, Auctions.js, WholesaleDashboard.js)

## Credentials
- Admin: admin@bidblitz.ae / AfrimKrasniqi123
- Server: 212.227.20.190 / root / neew7ky3xhyt3H
- GitHub: dw8yhmnzb6-cmyk/bidblitz
