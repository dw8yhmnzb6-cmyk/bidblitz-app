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
- **08.05.2026 (iter57b — P0 Crash-Fixes + Mapbox Migration finalisiert)**:
  - 🔴 **WalletPage JSX-Crash** behoben: Quick-Actions-Grid `<motion.div>` war kaputt (User-Number-Card + QuickSend in Tag-Attribute reingeschrieben + Duplikat-Block). Sauberer Rewrite: User-Number-Card und QuickSend-Section stehen jetzt VOR dem Quick-Actions-Grid.
  - 🔴 **WalletContext** erweitert: `userNumber` jetzt Teil des State (initialState, SET_WALLET reducer, context value) — WalletPage liest `wallet?.userNumber || wallet?.user_number || wallet?.user?.user_number`. Behebt "Laden..." Bug.
  - 🔴 **TaxiPage mapStyle ReferenceError** behoben: fehlende `useState` Hooks für `mapStyle` und `showMapStyles` (mit localStorage-Initialisierung) hinzugefügt.
  - 🔴 **TaxiPage getGreeting ReferenceError** behoben: durch Inline-IIFE für Begrüßung (Guten Morgen/Tag/Abend/Nacht) ersetzt.
  - 🟡 **Leaflet → Mapbox Migration finalisiert**: alle `L.divIcon`, `L.marker`, `L.latLngBounds`, `setLatLng`, `setView` durch `mapboxgl.Marker`, `mapboxgl.LngLatBounds`, `flyTo` ersetzt. Geocoding (Forward + Reverse + onBlur) auf Mapbox API umgestellt — Autocomplete liefert jetzt PLZ + Stadt + Country-Code als Subtitle (taxi.eu Parität).
  - 🟡 **Backend `/api/wallet/send`** akzeptiert nun `recipient_email`, `recipient_number` (BE-XXXXX), oder `recipient` (auto-detect via "@"). Neuer Endpoint `/api/wallet/lookup-recipient?q=...` zur Empfänger-Validierung. `/api/wallet/` Response liefert nun `user_number` und `user`-Objekt.
  - 🟡 **Backend `/api/taxi/status`**: private_drivers Counter toleriert nun `driver_online` ODER `driver_active` ODER `driver_status='online'` Flag.
  - 🟡 **Frontend `/api/taxi/driver/status` → `/api/taxi/status`**: TaxiPage rief falschen Endpoint für Driver-Counts.
  - ✅ Verifiziert: Wallet zeigt `BE94874` für Admin korrekt, Taxi-Map rendert mit Pickup-Input + 6 Mapbox-Suggestions für "Berlin" (Berlin-Neukölln, Berlin-Mitte, Berlin-Wilmersdorf, etc. mit "Berlin, DE" Subtitle), keine Runtime-Errors.
- **04.05.2026 (iter57 — P2 Bündel a+b+c+d)**:
  - **(a)** Apple Privacy Manifest erstellt: `/app/frontend/ios/App/App/PrivacyInfo.xcprivacy` mit allen Datenkategorien (Email, Name, Phone, Photos/KYC, Location, Purchase, Payment, Crash, UserID) + Required-Reason-APIs (UserDefaults, FileTimestamp, BootTime, DiskSpace) — iOS17+ App Store-konform.
  - **(b)** LandingChatbot/Lead-Scoring **upgraded gpt-4.1-mini → gpt-5** (Claude Sonnet 4.5 nicht via Emergent-Key zugänglich, gpt-5 ist top-tier verfügbar). Health endpoint: `{"model":"gpt-5","provider":"openai"}`. End-to-End-Smoke-Test ✅ erfolgreich (echte qualitativ-höhere Antwort generiert).
  - **(c)** LiveKit S3 Egress-Recording: Code bereits vorhanden in `livekit_streaming.py:253-330`. Doku `/app/LIVEKIT_S3_RECORDING_SETUP.md` erstellt — AWS-Bucket, IAM-Policy, ENV-Vars, API-Beispiele, Costs.
  - **(d)** Age-Verification-Modal UX verbessert: Live-Alter-Berechnung mit Farbindikator (✓/min Age), Range-Validation 1900–`currentYear`, bessere Error-Messages (4-stellig + Range + Mindestalter), Alter-vorab-Check vor API-Call (kein wasted Network-Roundtrip), object-detail.message Parsing.
- **04.05.2026 (iter56 — Legal/Compliance Smoke-Test)**:
  - ✅ Smoke-Test verifiziert: `/privacy`, `/terms`, `CookieBanner` rendern korrekt ohne JS-Errors. Layout intakt, Bottom-Nav unverdeckt.
  - ✅ JSX-Syntax-Fix `<10%` → `&lt;10%` in `TermsPage.jsx` Zeile 32 (verifiziert via Lint + Render).
  - ✅ `STORE_SUBMISSION_CHECKLIST.md` erstellt — komplette App Store + Play Store Submission-Checklist (DSGVO/UAE-konform, KYC-Banner, Legal-URLs).
  - User-Aktion offen: Resend DNS, Stripe Live-Keys, AAB-Build extern, Apple+Google Account.
- **Feb 2026 (iter53 — Bug Hotfix)**: 
  - 🔴 **Stripe Checkout BROKEN**: `/api/auctions/buy-credits-stripe` nutzte direktes `stripe_mod` mit ungültigem `sk_live_...` Key → "Invalid API Key" 500-Error im Frontend als "Server error". Fix: Refactored auf `emergentintegrations.payments.stripe.checkout.StripeCheckout` (Emergent-Proxy) + `STRIPE_API_KEY=sk_test_emergent` in `/app/backend/.env`. Test-Checkout-Session erfolgreich erstellt (`cs_test_...`).
  - 🔴 **"Access denied" / "Server error" englisch**: `services/api.js` formatApiError ignorierte dict-details mit `.message` → fiel zurück auf String(detail) = `[object Object]`, dann generische englische Fallbacks. Fix: formatApiError parst jetzt `.message`, `.msg`, `.detail`, `.error` Felder. Alle Fallback-Strings ins Deutsche übersetzt (timeout, offline, network, 401-500). KYC-Block-Error zeigt nun "Bitte verifiziere zuerst deinen Ausweis…" statt "Access denied".
- **Feb 2026 (iter52)**: Slack/Discord Webhooks für Hot-Leads (>80), Score-Refresh + Score-Historie (immutable timeline), Lead-Funnel-Tracking (5 Stages), LiveKit Egress server-side recording.
- **Feb 2026 (iter51)**: Differentiated Resend status, automatic LLM lead scoring.
- **Feb 2026 (iter50)**: P2-Batch CSV-Export, GridFS Recording, Sales-Call Invite, Extended Analytics.
- **Feb 2026 (iter49)**: Fix LiveKit env empty-string fallback, fix LiveKitStreamPage response-body-double-read.
- **Feb 2026 (iter48)**: P2 cleanup, livekit-client v2.5 web SDK, /live-shopping → LiveKitStreamPage.
- **Feb 2026 (iter48 P0)**: Landing-Chatbot LIVE LLM (gpt-4.1-mini), Android keystore, LIVEKIT .env, build pipeline verified.
- **Feb 2026 (iter47)**: LandingChatbot global mount, /landing route, age-verify dual-mode, POS RetailTab.
- **Feb 2026 (iter46)**: Backend Phases A-E complete (43 endpoints).
- **Feb 2026**: Bundle ID `com.bidblitz.app`, mobile build scripts, 18 POS Enterprise features.
