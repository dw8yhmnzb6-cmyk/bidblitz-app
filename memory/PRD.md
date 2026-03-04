# BidBlitz Super-App - PRD

## Architecture
Frontend: React + Tailwind + Leaflet | Backend: FastAPI | DB: MongoDB | Server: IONOS 212.227.20.190

## Level 17: Multi-Tenant SaaS (March 2026)

### Tenant System
- Default tenant: "bidblitz" (backward compatible)
- Resolution: X-Tenant-ID header > domain mapping > query param > default
- Each tenant: own fees, wallet, branding, users, ledger

### Collections
- tenants (id, name, domains, branding, status)
- tenant_users (user_id, tenant_id, role)
- tenant_fees (per-module fee percentages)
- tenant_wallets (balance_cents)
- tenant_ledgers (audit trail)

### Tenant Admin (/tenant-admin)
- Dashboard with wallet + fees + branding
- Set fees: hotels/taxi/marketplace %
- Manage team: invite users with roles
- Update branding: colors + logo

### Super Admin (/super-admin/tenants)
- Create/list/suspend tenants
- View per-tenant stats (bookings, users, revenue)
- Domain mapping for white-label

### Public Config
- GET /api/tenant/public-config — branding + modules per domain

### Frontend
- /tenant-admin — Tenant dashboard
- /super-admin/tenants — Tenant management

### Files Created (6)
- utils/tenant.py, tenants_admin.py, super_admin_tenants.py, tenant_public.py
- TenantAdminDashboard.jsx, SuperAdminTenants.jsx

## All Levels: L1-17
Hotels, Taxi, Marketplace, Admin, Security, Monetization, Genius, Reviews, Chat, Push/PWA, Multi-Tenant
