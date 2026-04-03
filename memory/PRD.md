# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional web app called BidBlitz V2 - an ultra-modern fintech app similar to Uber, Revolut, Apple with premium, clean UI. Mobile-first design with dark mode (#0A0A0A primary, #00C2FF accent), smooth Framer Motion animations.

## User Personas
- **Consumer**: Uses wallet, books rides, orders food, participates in auctions
- **Merchant/Händler**: Receives payments, tracks earnings, views analytics

## Core Requirements (Phase 1 - Frontend Foundation)
- [x] Dark mode with premium fintech aesthetic
- [x] Mobile-first responsive design
- [x] Bottom navigation (Home, Wallet, Scan, Händler, More)
- [x] Framer Motion animations for page transitions
- [x] Lucide React icons throughout

## What's Been Implemented

### Phase 1 - UI Scaffolding (DONE - Jan 27, 2026)
- 5 main pages: Home, Wallet, Scanner, Merchant, More
- Bottom navigation with center scan button
- Premium dark theme with glassmorphism

### Phase 2 - State Management (DONE - Jan 27, 2026)
- WalletContext with reducer for balance, transactions
- MerchantContext for earnings, payments
- UserContext for profile data
- Custom hooks: usePaymentFlow, useGroupedTransactions, useWalletStats, useMerchantStats

### Phase 3 - Payment Architecture (DONE - Apr 3, 2026)
- **TopUpModal**: Full top-up flow (amount → payment method → processing → success/error). Integrated into WalletPage via "Add Money" quick action. 90% simulated success rate.
- **TransactionDetailModal**: Shows transaction reference, type, status, date, payment method. Integrated into WalletPage via transaction item click. Copy Reference button.
- **TransactionFilters**: Filter tabs (All, Payments, Top-ups, Transfers) with optional status sub-filters. Integrated above transaction list in WalletPage.
- **PaymentRequestSummary**: Review step before QR scan showing reference, amount, merchant, expiry. Integrated into ScannerPage as intermediate step.
- **Services**: paymentService, walletService, merchantService, scannerService - all simulate backend delays and success/failure states.

### Pages
- **Homepage**: User greeting, total balance hero, feature grid, Get Started CTA
- **Wallet**: Balance display, premium card, quick actions (Add Money opens TopUpModal, Send, History), transaction filters, grouped transactions (click opens detail modal)
- **Scanner/Payment**: Amount input → Review (PaymentRequestSummary) → QR scan animation → processing → success/error
- **Händler Dashboard**: Today/Total earnings stats, Recharts area chart, Create Payment button, recent payments
- **More**: Profile card, settings menu, Logout

### Components
- BottomNav, FeatureCard, TransactionItem (with onClick), PremiumCard, StatusBadge, QuickAction
- TopUpModal, TransactionDetailModal, TransactionFilters, PaymentRequestSummary

### Technical
- React with custom navigation state management (useState in App.js)
- Framer Motion for all animations
- Recharts for merchant analytics
- Context API for wallet/transaction/merchant state
- TailwindCSS with custom design tokens
- Services layer simulating backend API calls

## Prioritized Backlog

### P0 (Critical for MVP)
- [ ] Backend API integration for wallet operations
- [ ] User authentication system
- [ ] Real payment gateway integration (Stripe)

### P1 (High Priority)
- [ ] Push notifications
- [ ] QR code generation for merchants
- [ ] Real-time balance updates
- [ ] Transaction history pagination

### P2 (Nice to Have)
- [ ] Biometric authentication
- [ ] Multi-currency support
- [ ] Spending analytics & insights
- [ ] Referral program
- [ ] Light mode toggle

## Design Tokens
- Primary: #0A0A0A (dark background)
- Accent: #00C2FF (cyan)
- Success: #00D26A
- Error: #FF4757
- Gold: #FFD700
- Surface: #111111
- Border-medium: rgba(255,255,255,0.1)
- Font: Outfit (headings), system stack (body)
