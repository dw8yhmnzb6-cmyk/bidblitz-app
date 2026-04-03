# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Create a modern, professional fintech web app called BidBlitz V2 with premium dark-mode UI, glassmorphism, Framer Motion animations, and a 6-step Apple Pay-style Scanner/Payment flow.

## Architecture
- **Frontend**: React, TailwindCSS, Framer Motion, Lucide React, Shadcn UI
- **Backend**: FastAPI, MongoDB (Motor async driver), PyJWT cookie-based auth, bcrypt
- **State**: React Context API (UserContext, WalletContext, MerchantContext) → now wired to real API
- **Auth**: Cookie-based JWT (httponly, secure, samesite=none)

## What's Been Implemented

### Phase 1-3: Frontend Foundation (DONE)
- Premium dark-mode UI across all pages
- Home, Wallet, Scanner, Merchant, More pages
- React Context state management
- TopUpModal, TransactionDetailModal, TransactionFilters
- Mobile layout fixes (safe areas, bottom nav)

### Phase 4: Premium UI Polish (DONE)
- 6-step Scanner/Payment flow (Amount → Confirm → Scan → Process → Success → Error)
- Wallet page with balance display, premium card, quick actions, grouped transactions
- Merchant dashboard with earnings, stat cards, weekly chart, activity section
- Home page hero with balance card, services grid, wallet banner
- Auth pages (Login/Register) with premium design
- More page as account hub with Profile, Settings sub-pages
- BottomNav with active indicators and smooth transitions

### Phase 5: Backend + Integration (DONE)
- FastAPI backend with MongoDB
- Routes: auth, wallet, payment, merchant, transactions (11 endpoints)
- JWT cookie auth with bcrypt password hashing
- Admin auto-seeding on startup
- **Frontend ↔ Backend integration COMPLETE**
  - UserContext → /api/auth/* (login, register, logout, getMe)
  - WalletContext → /api/wallet, /api/wallet/topup, /api/payment/pay, /api/payment/send
  - MerchantContext → /api/merchant/dashboard
  - All 22 backend tests passed, all frontend flows verified

### Frontend Service Layer (DONE)
- services/api.js - HTTP client with cookie auth
- services/authService.js, walletService.js, paymentService.js, merchantService.js, transactionService.js
- Shared UI components: shared.jsx (Skeleton, EmptyState, ErrorInline, etc.), FormInput.jsx

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| /api/auth/register | POST | Create new user + wallet |
| /api/auth/login | POST | Login, set JWT cookies |
| /api/auth/me | GET | Get current user |
| /api/auth/logout | POST | Clear cookies |
| /api/auth/refresh | POST | Refresh JWT |
| /api/wallet | GET | Get balance + transactions |
| /api/wallet/topup | POST | Add money to wallet |
| /api/payment/pay | POST | Pay merchant |
| /api/payment/send | POST | Send money to user |
| /api/merchant/dashboard | GET | Merchant earnings + stats |
| /api/transactions | GET | List transactions (filterable) |

## Backlog
- P1: Real payment gateway integration (Stripe)
- P2: Real-time notifications
- P2: User profile editing
- P2: Transaction search/export
- P3: Light mode toggle
- P3: Referral program
- P3: Multi-language support
