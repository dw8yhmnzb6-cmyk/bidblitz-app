# BidBlitz V2 - Product Requirements Document

## Original Problem Statement
Build a modern, professional fintech Super App called BidBlitz V2. 100% REAL system with NO fake/demo/seed data.

## Core Stack
- **Frontend**: React, TailwindCSS, Framer Motion, Shadcn/UI
- **Backend**: FastAPI, Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (via proxy, `sk_test_emergent`)
- **Auth**: JWT (cookie-based)

---

## Completed Features

### Core Platform (DONE)
- Unified Wallet (EUR), Kids GPS, Merchant POS, Auctions, Mobility Map, Loyalty

### Gaming Hub (DONE)
- 6 games with real EUR wallet integration

### Scooter Live (DONE)
- Live scooter map + Admin management

### Car Rental Module (DONE)
- Full backend + 13 frontend pages
- Image upload, Customer reviews (1-5 stars), PDF export (invoices + receipts)

### Credit Score Enhancement (DONE)
- Extended loan application with term selection (2, 6, 12, 18 months)
- Detailed cost breakdown + repayment schedule

### Chat/Support System (DONE - 2026-04-11)
- **Threaded Support Chat**: Ticket-based messaging between Customer ↔ Admin
- **Customer View** (`/support-chat`): Create tickets (category, subject, message), chat thread, search
- **Admin View** (`/admin/support`): See all tickets with user info, reply to any ticket, close tickets
- **Real-time Polling**: Auto-refreshes messages every 5 seconds while in chat
- **Categories**: Allgemein, Zahlung, Autovermietung, Konto, Technisch
- **Ticket Status**: Open / Resolved (auto-reopens if customer sends new message)
- **Backend**: Extended `/api/support/` with threaded messages in `support_messages` collection
- **Navigation**: Support Chat in MorePage (Support section) + Admin Support in Admin section

---

## Architecture

### Key Pages
```
/app/frontend/src/pages/SupportChatPage.jsx (NEW - ticket list + chat + new ticket)
/app/frontend/src/modules/car-rental/ (13 pages)
/app/frontend/src/pages/CreditScorePage.jsx (enhanced)
```

### Key API Endpoints (Support)
- POST /api/support/tickets - Create ticket
- GET /api/support/tickets - User's tickets
- GET /api/support/tickets/{id} - Ticket detail + messages
- POST /api/support/tickets/{id}/messages - Send message
- POST /api/support/tickets/{id}/close - Close ticket
- GET /api/support/admin/tickets - Admin: all tickets

---

## Upcoming Tasks (P2)
- Push Notifications
- Apple Pay / Google Pay
- Car rental insurance management

## Test Credentials
- Admin: admin@bidblitz.com / BidBlitz2026!
- Customer: kunde@bidblitz.com / Kunde2026!
