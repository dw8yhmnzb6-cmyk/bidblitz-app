# BidBlitz Staff Module — Production README

**Version:** 1.0.0
**Released:** 2026-05-12
**Status:** Production-Ready (mit dokumentierten externen Integrations als Platzhalter)

---

## 1. Übersicht

BidBlitz Staff ist die in BidBlitz integrierte Crewmeister/Papershift-Alternative für Händler.
Vollständig deutsche Sprache, DSGVO-konform, Multi-Merchant, Multi-Location.

**Verkaufsmodell:** SaaS Abo
- Basic 4,99 €/Monat — bis 5 Mitarbeiter
- Pro 9,99 €/Monat — bis 20 Mitarbeiter (QR/GPS, DATEV, Manager-Approval)
- Enterprise — auf Anfrage, unbegrenzt
- 30 Tage Free Trial (Pro-Features), keine Kreditkarte

## 2. Modulstruktur

### Backend (`/app/backend/routes/`)
| Datei | Zweck |
|---|---|
| `staff.py` | Core: Members, Clock, Shifts, Leave, Reports, QR-Checkin |
| `staff_subscription.py` | Paywall, Trial, Plans, Admin-Override, Limit-Check |
| `staff_settings.py` | Merchant-Einstellungen |
| `staff_multi_merchant.py` | Multi-Merchant Assignments |
| `staff_manager.py` | Approval-Flow |
| `staff_export.py` | PDF Lohnzettel |
| `staff_templates.py` | 7 Branchen-Vorlagen (Gastro, Eiscafé, Retail, Friseur, Bau, Reinigung, Lieferdienst) |
| `staff_roles.py` | 5 Rollen + 9 Permissions Matrix |
| `staff_locations.py` | GPS-Standorte + Haversine-Geofencing |
| `staff_warnings.py` | Auto-Detection (no_clock_out, duplicate, missing_break, overtime, shift_no_checkin, gps_out) |
| `staff_reports_extended.py` | Daily/Weekly/Monthly + CSV/DATEV Export |
| `staff_magic_link.py` | Magic-Link Login (30 min TTL, anti-enumeration) |
| `staff_invites.py` | Invite Flow (pending/accepted/expired/revoked) |
| `staff_profile.py` | Employee Profile, PIN-Change, Mobile Dashboard |
| `staff_metrics.py` | Admin SaaS Metrics (MRR/ARR Placeholder) |
| `staff_notifications.py` | Notification Center (7 Typen, Auto-Trigger) |
| `staff_insights.py` | AI Insights (regelbasiert): late, overtime, missing checkout, weak coverage |
| `staff_alerts.py` | Smart Alert Engine (live + scan) |
| `staff_analytics.py` | Charts-API + Heatmap + Cost Estimation + Admin Global |
| `staff_demo.py` | Demo Mode Seed + Public Dashboard |
| `staff_system.py` | Health / Version / System-Status |

**Total:** 21 Staff-Module · 126 registrierte Router · ~80 Endpoints unter `/api/staff/*`

### Frontend (`/app/frontend/src/`)
| Datei | Zweck |
|---|---|
| `pages/StaffManagementPage.jsx` | Merchant Dashboard (Tabs, Cards, Warnings, Exports) |
| `pages/StaffUpgradeScreen.jsx` | Marketing-Landing + Pricing |
| `pages/StaffMobilePage.jsx` | Employee Mobile (Public Route, Magic-Link) |
| `pages/StaffInvitePage.jsx` | Invite Accept |
| `pages/StaffSystemCheckPage.jsx` | System Health Check |
| `pages/StaffSettingsPage.jsx`, `StaffLoginPage.jsx`, `StaffPortalPage.jsx` | weitere |
| `components/staff/StaffDashboardCards.jsx` | Live KPIs |
| `components/staff/StaffWarningsList.jsx` | Warnings Inbox |
| `components/staff/StaffExportButtons.jsx` | CSV/PDF/Payroll/DATEV |
| `components/staff/StaffNotificationCenter.jsx` | Bell + Sheet |
| `components/AdminStaffMetrics.jsx`, `AdminStaffOverview.jsx` | Admin Mounts |
| `components/QrCheckinScanner.jsx` | QR Scanner |
| `i18n/staff.js` | DE/EN/SQ/TR |
| `utils/staffOfflineQueue.js` | Offline-Queue + Device-Info |

## 3. Routes (Frontend)

| Route | Zugriff | Beschreibung |
|---|---|---|
| `/merchant/staff` | merchant/admin | Dashboard mit Paywall-Gate |
| `/merchant/staff/upgrade` | merchant/admin | Marketing + Pricing |
| `/staff/settings` | merchant/admin | Merchant Settings |
| `/staff/mobile` | **public** | Employee Mobile App (Magic-Link) |
| `/staff/invite?token=…` | **public** | Invite Accept |
| `/staff/login`, `/staff/portal` | staff | Legacy Web Login |
| `/staff/system-check` | **public** | Health-Dashboard |

## 4. Wichtigste APIs

```
# Subscription
POST   /api/staff/subscription/start-trial
POST   /api/staff/subscription/create-checkout   (Stripe Placeholder)
GET    /api/staff/subscription/status
POST   /api/staff/subscription/admin/override    (Admin)

# Members + Clock
POST   /api/staff/members                        (Limit-Check!)
POST   /api/staff/clock                          (mit device_type/lat/lng → audit + geofence)
GET    /api/staff/me/dashboard                   (Employee Mobile)

# Magic Link / Invites
POST   /api/staff/auth/magic-link
GET    /api/staff/auth/verify-token
POST   /api/staff/invites/create
POST   /api/staff/invites/accept

# Analytics
GET    /api/staff/insights/dashboard
GET    /api/staff/alerts/live
GET    /api/staff/analytics/hours-by-day
GET    /api/staff/analytics/attendance
GET    /api/staff/analytics/heatmap
GET    /api/staff/costs/summary
GET    /api/staff/analytics/admin/global         (Admin)

# Reports
GET    /api/staff/reports/{daily,weekly,monthly,by-location,warnings}
GET    /api/staff/reports/export/{csv,datev}

# Notifications
GET    /api/staff/notifications/list
POST   /api/staff/notifications/mark-all-read

# Demo
POST   /api/staff/demo/seed
DELETE /api/staff/demo/clear
GET    /api/staff/demo/dashboard

# System
GET    /api/staff/health
GET    /api/staff/version
GET    /api/staff/system-status
```

## 5. Rollen & Permissions

| Rolle | view_own | view_all | edit_hours | shifts | approve_leave | export | settings | members | billing |
|---|---|---|---|---|---|---|---|---|---|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Shift-Lead | ✓ | ✓ | | ✓ | ✓ | | | | |
| Mitarbeiter | ✓ | | | | | | | | |
| Aushilfe | ✓ | | | | | | | | |

## 6. Setup / Environment Variables

```bash
# Required
MONGO_URL=mongodb://...
DB_NAME=bidblitz
JWT_SECRET=...

# Feature Flags (defaults true)
STAFF_MODULE_ENABLED=true
STAFF_TRIAL_ENABLED=true
STAFF_SUBSCRIPTION_REQUIRED=true
STAFF_DEMO_ENABLED=true
STAFF_DEV_RETURN_MAGIC_URL=true   # PROD: set to false

# Public URL (für Invite/Magic-Link)
APP_PUBLIC_URL=https://app.bidblitz.com

# Versioning
BUILD_VERSION=1.0.0

# External Integrations (alle PLATZHALTER)
STRIPE_SECRET_KEY=sk_test_...              # echte Live-Keys für Production
RESEND_API_KEY=re_...                      # E-Mail Versand Magic-Link
TWILIO_ACCOUNT_SID=...                     # SMS Versand Magic-Link
ONESIGNAL_APP_ID=...                       # Push für staff_notifications
LIVEKIT_API_KEY=...                        # Video-Meetings (optional)
```

## 7. MongoDB Indexes (in `core/performance.py`)

Alle Compound-Indexes für Reports/Analytics sind erstellt. Wichtigste:
- `staff_clock_events`: `(merchant_id, timestamp -1)`, `(merchant_id, staff_id, timestamp -1)`, `(merchant_id, action, timestamp -1)`
- `staff_warnings`: `(merchant_id, resolved, created_at -1)`
- `staff_subscriptions`: `merchant_id` unique
- `staff_invites`: `token` unique
- `staff_magic_tokens`: `token` unique

## 8. Was produktionsbereit ist ✅

- Subscription/Paywall mit Trial + Limit-Enforcement
- Mitarbeiter, Schichten, Urlaub, Reports
- QR/NFC/GPS Check-in mit Geofence-Validierung
- Auto-Warnings + Alert-Engine
- Magic-Link Login (Tokens funktional)
- Invite-Flow inkl. PIN-Setup
- 7 Branchen-Vorlagen + 5 Rollen
- Notification Center (Inbox + Auto-Trigger)
- Insights / Analytics / Heatmap / Cost-Estimation
- Admin SaaS Metrics
- DSGVO-konformes Audit-Log
- Multi-Language (DE/EN/SQ/TR)
- Offline-Queue im Employee-Mobile
- Demo Mode mit Sales-Daten

## 9. Was externe APIs braucht ⚠️

| Feature | Status | Was tun für Production |
|---|---|---|
| Stripe Checkout | Placeholder aktiviert Plan direkt | echte Stripe Keys + Webhook `customer.subscription.updated` an `/api/staff/subscription/*` verkabeln |
| Magic-Link Versand | URL nur im Response | `RESEND_API_KEY` setzen, in `staff_magic_link.py` Mail-Versand aktivieren, `STAFF_DEV_RETURN_MAGIC_URL=false` |
| SMS-Versand | nicht angebunden | Twilio in `staff_magic_link.py` und `staff_invites.py` einbinden |
| Push-Notifications | nicht angebunden | OneSignal in `staff_notifications.create_notification()` nachgelagert pushen |
| NFC Check-in | UI Stub | Capacitor NFC Plugin im native build (siehe `capacitor.config.json`) |
| LiveKit | Routes existieren, kein UI | Frontend-Component für Video-Meetings |

## 10. Test-Checklist

```bash
# Subscription
POST /api/staff/subscription/start-trial               → 200, status=trialing
GET  /api/staff/subscription/status                    → trial_days_left=30

# Limits
6× POST /api/staff/members (mit Basic max=5)           → 6. Aufruf 403 limit_reached

# Clock + Geofence
POST /api/staff/locations/create                       → location_id
POST /api/staff/clock mit lat/lng weit weg              → warnings/list resolved=false enthält gps_out_of_range

# Magic Link
POST /api/staff/auth/magic-link {email: bekannt}        → magic_url
GET  /api/staff/auth/verify-token?token=...             → 200 + staff_session cookie
2× GET /api/staff/auth/verify-token?token=...           → 2. Aufruf 401 (single-use)

# Demo
POST /api/staff/demo/seed                              → members=10, events≈200, shifts≈28
DELETE /api/staff/demo/clear (admin)                   → cleared=true

# System
GET /api/staff/health                                  → status=ok
GET /api/staff/system-status                           → mongo_ok=true, auth_ok=true
```

## 11. Deployment Checklist

- [ ] `STAFF_DEV_RETURN_MAGIC_URL=false` setzen
- [ ] Echte Stripe-Keys + Webhook konfigurieren
- [ ] Resend / Twilio Keys
- [ ] OneSignal App-ID
- [ ] `APP_PUBLIC_URL` auf Live-Domain
- [ ] MongoDB Backup-Cronjob einrichten
- [ ] Rate-Limiting (FastAPI middleware) für `/auth/*` und `/magic-link`
- [ ] Sentry/Logtail Error-Tracking aktivieren

## 12. Roadmap / Future

1. Wallet-Auszahlungen (Trinkgeld, Bonus) — Architektur in PRD vorgesehen
2. Auto-Shift-Suggestions (KI-basiert, aktuell regelbasiert vorbereitet)
3. Staff Marketplace (offene Schichten zwischen Händlern)
4. Gamification (Streaks, Badges, Top-Employee)
5. Native iOS/Android Builds via Capacitor
6. LiveKit Video-Meetings für Remote-Teams
