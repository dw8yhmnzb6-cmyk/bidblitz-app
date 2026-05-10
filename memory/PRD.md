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

### 10.05.2026 (iter59 — EV Charging Customer History UI)
- 🟢 `EVChargingHistoryPage.jsx` (Customer-Liste): Stats-Header (Sessions/Total kWh/Total €), Empty-State, Error-State, Session-Cards mit Status-Badge, Station, Stecker, Datum, Dauer, kWh, Kosten, Settlement-Ref, PDF-Download (`/api/ev/receipt/:id/pdf`) und Detail-Link auf `/ev/session/:id`.
- 🟢 Route `/ev/history` in `App.js` verdrahtet.
- 🟢 "Historie"-Button im Top-Bar von `EVChargingMapPage.jsx` ergänzt.
- ✅ Verifiziert: Lint clean, Page rendert (`data-testid="ev-history-title"` im DOM gefunden), Backend `/api/ev/history` (auth via Cookie) liefert `{"sessions": []}` für kunde@bidblitz.com.

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
- **10.05.2026 (iter59 — EV Charging Business Layer komplett)**:
  - 🟢 **Operator-Modell**: `ev_operators` mit pending/active/suspended-Workflow, Staff-Sub-Collection (`ev_operator_staff` mit viewer/manager-Rollen), Payouts-Pipeline (`ev_operator_payouts` mit requested→approved→paid), Commission-Logs (`ev_operator_commissions`).
  - 🟢 **Settlement mit Commission-Split**: `finalize_session()` rechnet Brutto/Netto/MwSt sauber, zieht Gesamtbetrag vom User, transferiert auf Operator-Wallet, dann zweite Buchung Operator→Plattform-Pool für Commission. Verifiziert: 5.5 kWh × €0.50 + €1 = €3.75 → Net €3.15 + VAT €0.60 (19%) → Platform-Fee €0.56 (15%) + Operator-Share €3.19.
  - 🟢 **Commission-System**: Default 12%, override per Operator (`ev_operators.commission_pct`), override per Charge-Point (`ev_charge_points.commission_pct_override`).
  - 🟢 **Tariff-Erweiterung**: `vat_rate`, `time_rules` (Zeit-basierte Tarife), `idle_fee_per_minute`, `minimum_fee` — PUT `/api/ev/admin/tariffs/{id}` zum Editieren.
  - 🟢 **Hardware-Vendor-Onboarding**: `ev_station_models` mit OCPP-Version, `max_power_kw`, `connector_types`, `firmware_versions`. Endpoints: `POST /api/ev/admin/hardware-vendors/models`, `GET /api/ev/admin/hardware-vendors/{vendor_id}/models`.
  - 🟢 **Receipt + PDF**: `services/ev_receipt.py` mit reportlab, generiert produktionsreifes PDF (A4) mit Header, Kunde/Station, Fahrtdaten, Pricing-Breakdown (Energie/Zeit/Sessiongebühr), Net/VAT/Total. Sequentielle Receipt-No `BB-EV-{YYYY}-{seq:06d}` via MongoDB-Counter. Endpoints: `GET /api/ev/receipt/{session_id}` (JSON) + `GET /api/ev/receipt/{session_id}/pdf` (3.2 KB PDF). Verifiziert: PDF erfolgreich erzeugt + heruntergeladen.
  - 🟢 **Admin-Endpoints**: Operator-Status-Toggle, Commission setzen, Payout-Decisions (approved/rejected/paid mit SEPA-External-Ref → Operator-Wallet wird beim "paid" um den Betrag reduziert + transactions-record).
  - 🟢 **Operator-Endpoints**: Register, Profile, Stations/Sessions/Revenue, Payout-Request, Staff-Management.
  - 🟢 **Frontend (10 neue Pages)**: 5 Admin-Pages (`AdminEVOverviewPage`, `AdminEVOperatorsPage`, `AdminEVHardwareVendorsPage`, `AdminEVTariffsPage`, `AdminEVPayoutsPage`) + 5 Operator-Pages (`EVOperatorDashboardPage`, `EVOperatorStationsPage`, `EVOperatorSessionsPage`, `EVOperatorRevenuePage`, `EVOperatorPayoutsPage`). Alle als dünne Wrapper über zwei Shared-Layouts (`EVAdminLayout`, `EVOperatorLayout`) — DRY ohne Code-Duplikation. Routes wired in App.js: `/admin/ev/*` und `/operator/ev/*`.
  - 🟢 **Receipt-Download im Customer-Flow**: `EVLiveSessionPage` zeigt nach Abschluss "Quittung PDF · BB-EV-2026-XXXXXX"-Link.
  - 🟢 **End-to-End-Test** (`/tmp/test_ev_business.py`): Admin → Operator-Approval → 15% Commission → CP-Erstellung → Hardware-Model → CP-Connect → Customer-Charge → Settlement → PDF-Download → Operator-Payout-Request → Admin-Approve → Admin-Mark-Paid (SEPA-Ref). Alle Schritte erfolgreich, alle 8 Acceptance-Criteria YES.
  - 🟢 **Live-Verifikation**: Admin-EV-Page rendert mit echten DB-Daten (7 Stationen, €6.10 Lifetime-Umsatz, 8.5 kWh).
- **10.05.2026 (iter58 — EV Charging Module komplett: echtes OCPP-1.6J CSMS)**:
  - 🟢 **Backend**: `services/ocpp_csms.py` (~360 Zeilen) — vollständige OCPP-1.6J CSMS-Implementierung. WebSocket-Endpoint `/api/ev/ocpp/v16/{charge_point_id}` mit Subprotocol-Negotiation `ocpp1.6`. Wire-Format `[2,id,action,payload]` / `[3,id,result]` / `[4,id,error,desc,details]` korrekt implementiert. In-Memory-Registry für aktive Verbindungen.
  - 🟢 **OCPP-Messages eingehend**: BootNotification, Heartbeat, Authorize, StartTransaction, StopTransaction, MeterValues, StatusNotification.
  - 🟢 **OCPP-Messages serverseitig**: RemoteStartTransaction, RemoteStopTransaction, ChangeAvailability, Reset, UnlockConnector — mit Future/Promise-basiertem CALL-Tracking + Timeout.
  - 🟢 **REST API** (`routes/ev_charging.py`, ~520 Zeilen): Customer-Endpunkte `/api/ev/stations`, `/api/ev/station/{id}`, `/api/ev/start`, `/api/ev/stop/{session_id}`, `/api/ev/session/{id}`, `/api/ev/history`. Operator-Endpunkte (Stations/Sessions/Revenue). Admin-Endpunkte (HardwareVendors, ChargePoints, Tariffs, Sessions, Overview, Availability/Reset/Unlock-Befehle).
  - 🟢 **Wallet-Integration**: `core/payment_engine.TransactionType.EV_CHARGING` neu hinzugefügt. `finalize_session()` führt atomaren `transfer_between_wallets(user → operator)` durch. **Verifiziert**: 3 kWh × €0.45 + €1 = €2.35 wurden vom User abgezogen + an Operator gutgeschrieben (`TRF-FBE1F1AD`, status `completed`).
  - 🟢 **DB-Collections**: ev_charge_points, ev_connectors, ev_charging_sessions, ev_meter_values, ev_tariffs, ev_authorizations, ev_hardware_vendors, ev_activity_logs (komplette Audit-Trail jeder OCPP-Message persistiert).
  - 🟢 **Security**: nur registrierte charge_point_ids dürfen sich verbinden (1008 Policy Violation bei unbekannten), Single-Use id_tags (BB-XXX), kein doppeltes Charging pro User, KYC-Wallet-Pre-Check vor Start, server-side Preisberechnung.
  - 🟢 **QR/NFC/Deeplink**: `bidblitz://ev/start/{cp}/{c}` + `https://bidblitz.ae/ev/start/{cp}/{c}` automatisch beim Onboarding generiert.
  - 🟢 **Frontend**: `EVStartChargingPage` (lädt Station/Tarif/Wallet, Reservierungsbetrag editierbar, "Jetzt laden"-Button) + `EVLiveSessionPage` (Live-kWh-Anzeige, Power, Live-Kosten, Pulse-Animation, Stop-Button). Routes `/ev/start/:cp/:c` und `/ev/session/:id` in App.js verdrahtet.
  - 🟢 **End-to-End Smoketest** (`/tmp/test_ocpp.py`): WebSocket-Charge-Point-Simulator führt komplettes Szenario durch — Boot/Status/Heartbeat → REST `/api/ev/start` → CSMS sendet RemoteStart → CP antwortet mit Accepted → CP sendet StartTransaction → MeterValues 3 kWh + 22 kW → REST `/api/ev/stop` → CSMS sendet RemoteStop → CP sendet StopTransaction → finalize_session() → Wallet-Settlement OK. **Status: completed, final_cost €2.35**.
  - **Keine Fake-Simulation**: Hardware muss physikalisch via OCPP-1.6 verbunden werden. Backend wartet auf reale Charge-Points.
- **08.05.2026 (iter57d — Resend DNS Tools + GitHub Actions CI + Taxi Code-Splitting Phase 1)**:
  - 🟢 **Resend DNS-Endpoints (Admin-only)**: `GET /api/admin/test-email/dns-status` (live DNS-Check), `POST /api/admin/test-email` (Smoketest-Mail) — verifiziert: Domain `bidblitz.ae` ist im Resend-Dashboard noch nicht verifiziert + `TXT send.bidblitz.ae` SPF-Record fehlt. Komplette Anleitung in `/app/RESEND_DNS_FIX.md`.
  - 🟢 **GitHub Actions CI-Workflow** `.github/workflows/ci.yml` hinzugefügt: Frontend-Lint+Build + Backend-Ruff+Pytest auf jedem Push/PR (kein Setup nötig). Ergänzend zur bestehenden `deploy.yml` für Hetzner-Auto-Deploy.
  - 🟢 **TaxiPage Code-Splitting Phase 1**: extrahiert in `/app/frontend/src/components/taxi/`:
    - `TaxiConstants.js` (MAP_STYLES, STATUS_COLORS/LABELS, VEHICLE_ICONS, POI_CATEGORIES)
    - `TaxiVehicleIcon.jsx` (Standard/Premium/Van SVG-Silhouetten)
    - `TaxiHistoryView.jsx` (komplette Verlauf-Tab UI als stateless Komponente)
  - `TaxiPage.jsx` von 2438 → **2323 Zeilen** reduziert (–115 Zeilen). Verifiziert: Verlauf-Tab rendert mit extrahierter Komponente, alle Tabs funktional, kein Crash.
- **08.05.2026 (iter57c — Taxi POI Filter + Ride-History UI Polish)**:
  - 🟢 **POI-Filter (Mapbox Tilequery API)** für taxi.eu Parität: Floating Button "In der Nähe" links unten auf der Map. Bottom-Sheet mit 6 Kategorien (Restaurants, Supermärkte, Tankstellen, Apotheken, Geldautomat, Bahnhöfe). Ergebnisse als Custom Mapbox-Marker mit Category-Farbe + Emoji + Popup "Als Ziel setzen". Verifiziert: 13 Restaurant-Marker laden für Berlin Mitte.
  - 🟢 **Taxi Ride-History UI** komplett neu gestaltet: Stats-Header (Fahrten-Anzahl + Ausgaben), Pickup→Ziel Route mit Connection-Dots, Status-Badge, Vehicle-Icon + Distanz, Bewerten-Button, Refresh-Button, professioneller Empty-State.
  - 🟢 **Wallet React "unique key prop" Warning** behoben: defensive Key-Fallback im Transaction-List Mapping.
  - 🟢 **Pre-Deploy-Check** für bidblitz.ae: PASS. `.gitignore` von 156 blockierenden `.env`-Zeilen bereinigt (656 → 500 Zeilen).
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
