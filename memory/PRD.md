# BidBlitz — Product Requirements Document (PRD)

## Original Problem Statement
Complete the POS requirements (at the level of REWE/Lidl/Aldi) and integrate missing competitor Super App features flawlessly, create native mobile builds, and optimize the application architecture for the absolute cheapest possible deployment to maximize revenue and minimize running costs.

**User language**: GERMAN. **Mode**: STRICT FAST MODE (no filler, facts/code/terminal only).

## Architecture
- Frontend: React 19 + Capacitor 7 (iOS/Android) + Tailwind + framer-motion + sonner
- Backend: FastAPI + Motor (MongoDB async) + emergentintegrations
- DB: MongoDB
- Bundle ID: `com.bidblitz.app`
- Stripe key: pre-configured (test mode)
- Emergent LLM Key: pre-configured

## Implemented Features (current Sprint, Feb 2026)

### Phase A — Mobile Build Automation
- Bundle ID migration to `com.bidblitz.app` (iOS, Android, Capacitor, Deep Links)
- `build-mobile-final.sh` script + ANDROID_SIGNING_STEPS.md + IOS_RELEASE_STEPS.md

### Phase B — POS Hardware Integrations (43 endpoints total)
- `/api/pos/hardware/printer/print` (ESC/POS)
- `/api/pos/hardware/scanner/test|register`
- `/api/pos/hardware/cash-drawer/open`
- `/api/pos/hardware/scale/weight`
- `/api/pos/hardware/tse/sign`

### Phase C — Landing-Page Chatbot
- `/api/landing-chatbot/chat|leads|analytics` (gpt-4.1-mini via Emergent LLM Key, multi-turn session memory)

### Phase D — LiveKit Live-Streaming
- `/api/livekit/rooms` POST (create) + GET (list)
- `/api/livekit/token` (publisher/viewer mode)
- `/api/livekit/rooms/{name}/products|recording/start|stop|analytics`

### Phase E — Super-App Marketplace + Wallet
- `/api/super-app/marketplace/categories|items`
- `/api/super-app/wallet/balance|topup`
- `/api/super-app/gaming|creator|analytics`

### POS Enterprise Retail Features (REWE/Lidl-Niveau)
- `/api/pos/receipts/void` + `/return` + `/digital`
- `/api/pos/products/weighted/create|lookup`
- `/api/pos/age-verify` (Dual-Mode: cart_id ODER birth_year/id_checked/required_age)
- `/api/pos/products/age-restricted`
- `/api/pos/prices/bulk-update`
- `/api/pos/supervisor/dashboard|alert`
- `/api/pos/smart-cart/start|scan|checkout`
- `/api/pos/exchange-rate`, `/tax-free/register`, `/loss-prevention/dashboard`

### Frontend UI Wiring (this iteration)
- `LandingChatbot` global widget mounted in App.js root layout for `!user.isAuthenticated` (visible on every guest route incl. `/` and `/landing`)
- New route `/landing` → `LandingPage` with embedded chatbot
- New route `/livekit-stream` → `LiveKitStreamPage` (room list + create + host/viewer token UI)
- New route `/wallet-dashboard` → `WalletDashboard` component
- New route `/super-marketplace` → `SuperAppMarketplace` component
- POSPage RetailTab now has 4 action buttons: Bon-Storno, Rückgabe, Altersverifikation, Hardware-Test
- New components: `POSHardwareModal` (printer/scanner/drawer/scale tabs), `AgeVerificationModal` (FSK 16/18 with ID-check)

## Test Status
- Backend: 19/19 PASS (LiveKit, POS-Hardware, age-verify dual-mode, landing-chatbot, super-app)
- Frontend: 3/3 PASS (LandingChatbot global, LiveKitStreamPage testids, POS RetailTab 4 buttons + Hardware modal)
- Test report: `/app/test_reports/iteration_47.json`
- Pytest harness: `/app/backend/tests/test_iter46_livekit_hardware.py` (19 tests)

## Test Credentials
- admin@bidblitz.ae / BidBlitz2026!
- admin@bidblitz.com / BidBlitz2026!

## P2 Backlog (Optional, non-blocking)
- LandingChatbot Claude Sonnet 4.5 (sobald Emergent-Key Anthropic-Zugriff bekommt)
- LiveKit Recording → S3/local storage
- birth_year range error i18n + better UX
- AdminLandingLeadsPage Lead-Export als CSV

## P0 — User Action Required (External)
- Generate Android Release Keystore via `/app/frontend/build-mobile-final.sh`
- Configure real keys in backend/.env: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- Submit to App Store + Play Store (guides in `/app/frontend/deploy/`)

## Mocked Integrations
- LiveKit: `.env` placeholder structure prepared. User must fill real keys from cloud.livekit.io before live streaming works.
- Landing-Chatbot: NOW LIVE with gpt-4.1-mini (was keyword matcher in iter47)

## Changelog
- **Feb 2026 (iter51)**: Differentiated Resend email status (sent/logged_only/rejected with error detail) + LLM-based automatic lead scoring (gpt-4.1-mini parses chat → score 0-100 + hot/warm/cold + reason + tags). AdminLandingLeadsPage shows 🔥 hot leads at top with red border, score badge, reason, tag chips. 10/10 new + 15/15 regression PASS.
- **Feb 2026 (iter50)**: P2-Batch — CSV-Export für Leads, LiveKit Recording mit MongoDB-GridFS, Sales-Call Invite, Extended Chatbot-Analytics (14-Tage-Chart, Top-Themen).
- **Feb 2026 (iter49)**: Fix LiveKit env empty-string fallback, fix LiveKitStreamPage response-body-double-read.
- **Feb 2026 (iter48)**: P2 cleanup, livekit-client v2.5 web SDK, /live-shopping → LiveKitStreamPage.
- **Feb 2026 (iter48 P0)**: Landing-Chatbot LIVE LLM (gpt-4.1-mini), Android keystore, LIVEKIT .env, build pipeline verified.
- **Feb 2026 (iter47)**: LandingChatbot global mount, /landing route, age-verify dual-mode, POS RetailTab.
- **Feb 2026 (iter46)**: Backend Phases A-E complete (43 endpoints).
- **Feb 2026**: Bundle ID `com.bidblitz.app`, mobile build scripts, 18 POS Enterprise features.
