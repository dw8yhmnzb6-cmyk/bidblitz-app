# BidBlitz V2 - Product Requirements Document

## Core Stack
- Frontend: React, TailwindCSS, Framer Motion
- Backend: FastAPI, Motor (async MongoDB)
- Production: IONOS Server (212.227.20.190), PM2, Nginx, MongoDB Atlas

## Production Status: LIVE ✅ | All 41+ V2 Modules Running

## Deployed Features (2026-04-17 22:40 UTC)

### BlitzMine (Pi-Network Tap-to-Earn) — NEU
- Route: `/blitz-mine`
- Daily 24h tap session, auto-claim after 24h
- Security Circle (max 5 members, +20% per member)
- Roles: Pioneer → Contributor → Ambassador → Node (×1.0 → ×1.5)
- Referral bonus (+5% per active direct referral, cap 50%)
- Lockup (14d / 6m / 1y / 3y, +10% – +120%)
- Leaderboard (Top 20 Pioneers)
- **QR-Code + Share-Modal** for referral link (qrcode.react)
- Earnings in BLZ (same wallet as `/mining`)
- Backend: `/app/backend/routes/blitz_mine.py`
- Frontend: `/app/frontend/src/pages/BlitzMinePage.jsx`
- Seed: 30 pioneers (max.weber 12.4k, lina.kaiser 9.8k, jonas.ott 7.3k, …) in prod DB

### Legal Pages (AGB / Datenschutz / Impressum / Sicherheit) — NEU
- Route: `/legal/{agb|datenschutz|impressum|sicherheit}`
- Tabbed navigation between all 4 pages
- Linked in MorePage under new "Rechtliches" group
- Company: BidBlitz LLC, Dubai UAE (generic placeholders)
- Backend: `/app/backend/routes/legal.py`
- Frontend: `/app/frontend/src/pages/LegalPage.jsx`

### Mobility Seed-Daten — NEU (production DB)
- 10 Taxi drivers (Berlin, Muenchen, Hamburg, Koeln, Frankfurt)
- 20 Scooters (TIER, Lime, Bolt, Voi, Bird) across 3 cities with real coords
- 8 Hotels
- 175 Flights (25 routes)
- 8 Rental Cars
- 10 Nearby Places
- Script: `scripts/seed_real_data.py` (run on prod with DB_NAME=bidblitz)

### App.js Code-Splitting — NEU
- 20+ heavy pages now lazy-loaded via `React.lazy`
- Admin cluster, DeFi/Crypto complex, BlitzMine/Boost/Transfer, Legal
- Suspense fallback with spinner
- Bundle now split into 19+ chunks (from 1 monolithic bundle)
- Main bundle: `main.bb5a5234.js`

### BlitzBoost Navigation Fix
- Added to MorePage, AllServicesPage, QuickAccessBar

### Auctions Bot Fix (Production)
- Legacy `end_time`/`id` schema migrated to new `ends_at`/`auction_id`
- Embedded `product._id` ObjectId removed (was breaking `/api/auctions/list`)
- 80 auctions reactivated with fresh bot targets
- 3-phase bot bidding strategy active

## Deployed Features (2026-04-16)

### Server Monitoring Dashboard (/admin/monitoring)
- Real-time system health (CPU, RAM, Disk, Uptime)
- API metrics (Requests/h, Errors/h, Avg Response, P95/P99)
- RPM chart (Requests per Minute, letzte 10 Min)
- Database stats (Collections, Objects, Data Size, Latency)
- User statistics (New today/week/month, Active 7d, Role distribution)
- Slow endpoint tracking (>500ms)
- Error code breakdown
- Auto-refresh every 15 seconds
- Middleware tracks all requests automatically

### Haendler-Verwaltung (/admin/merchants)
- Haendler-ID System (BZ-M-XXXX format)
- Bulk-ID-Vergabe fuer alle Haendler ohne ID
- Remote Neustart (force re-login via force_restart flag)
- Sperren/Aktivieren von Haendlern
- Fehler-Log pro Haendler (24h)
- Session-Tracking (Online/Offline, Device Info)
- Detail-Modal mit Umsatz, Transaktionen, Errors, Sessions
- Heartbeat-Endpoint fuer Geraete-Monitoring
- Search & Filter (Name, Email, ID)

### Multi-Mode System (Personal/Kids/Merchant)
- ModeSwitcher in header
- Mode-aware BottomNav
- Auto-switch on navigation

## Credentials
- Admin (Production): admin@bidblitz.ae / BidBlitz2026!
- Admin (Preview): admin@bidblitz.com / BidBlitz2026!
- SSH: root@212.227.20.190

## Backlog
- P1: APK-Build fuer Android (TWA)
- P2: App.js Code Splitting
- P2: Server Security (Fail2Ban, SSH keys)
