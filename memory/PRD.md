# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional web app called BidBlitz V2 — an ultra-modern fintech app similar to Uber, Revolut, Apple with premium dark-mode UI. Mobile-first design, smooth animations, realistic dummy-data payment flows.

## Tech Stack
- React, TailwindCSS, Framer Motion, Lucide React, Recharts
- Context API for mock state management
- FastAPI + MongoDB backend (created, not yet connected to frontend)

## Design Tokens
- Background: #0A0A0A / #050505
- Accent: #00C2FF (cyan)
- Success: #00D26A
- Error: #FF4757
- Surface: #111111 / #0E0E0E
- Font: Outfit (headings), Inter/system (body)

## What's Been Implemented

### Phase 1 — UI Scaffolding (DONE)
- 5 main pages: Home, Wallet, Scanner, Merchant, More
- Bottom navigation with center scan button (hidden on Scanner page)
- Premium dark theme with glassmorphism

### Phase 2 — State Management (DONE)
- WalletContext: balance, transactions, pay, addMoney, canAfford
- MerchantContext: earnings, payments, createPaymentRequest, receivePayment
- UserContext: profile data
- Custom hooks: usePaymentFlow, useGroupedTransactions, useWalletStats, useMerchantStats

### Phase 3 — Payment Components (DONE)
- TopUpModal: Full top-up flow with presets, payment methods, processing states
- TransactionDetailModal: Reference, type, status, date, payment method
- TransactionFilters: All, Payments, Top-ups, Transfers tabs
- PaymentRequestSummary: Review card before QR scan

### Phase 4 — Scanner Flow Refinement (DONE - Apr 2026)
Rebuilt ScannerPage as premium 5-step payment experience:
1. **Amount Input**: Custom NumPad, quick amount chips (€5/€10/€25/€50), live balance indicator, validation
2. **Confirmation**: Big amount display, merchant info, reference with Copy, payment method, countdown timer with animated ring, "BidBlitz Secure Pay" badge
3. **Scanning**: QR grid with animated blocks, laser line, progress bar, amount/reference display
4. **Processing**: Pulsing rings, "Verifying Payment / Contacting payment network"
5. **Success**: Green checkmark with expanding rings, receipt card (reference, status, new balance), Done button
6. **Error**: Shake animation, decline message, Try Again / Cancel buttons

### Phase 5 — Backend (CREATED, NOT CONNECTED)
- FastAPI backend with modular routes (auth, wallet, payment, merchant, transactions)
- MongoDB integration with indexes
- JWT auth with httpOnly cookies, bcrypt password hashing
- Admin seeding, brute force protection
- **Frontend is NOT connected to backend yet** — uses Context API mock data only

### Pages
- **Home**: Greeting, balance hero, services grid, Get Started CTA
- **Wallet**: Balance, premium card, quick actions (Add Money/Send/History), filters, grouped transactions
- **Scanner**: 5-step premium payment flow (Amount → Confirm → Scan → Processing → Success/Error)
- **Merchant (Händler)**: Today/Total earnings, Recharts chart, recent payments
- **More**: Profile card, settings menu, Logout

## Prioritized Backlog

### P0 (Next)
- [ ] Connect frontend to FastAPI backend (replace Context with API calls)
- [ ] Auth gate (login/register page with real backend)
- [ ] Real payment gateway integration (Stripe)

### P1
- [ ] Push notifications
- [ ] QR code generation for merchants
- [ ] Real-time balance updates via WebSocket
- [ ] Transaction history pagination

### P2
- [ ] Biometric authentication
- [ ] Multi-currency support
- [ ] Spending analytics & insights
- [ ] Light mode toggle
- [ ] Referral program
