# Auth Testing Playbook

## Admin Seed Verification
- Startup must call `seed_admin()` idempotently after DB indexes are created.
- Admin must exist with canonical email `admin@bidblitz.ae`, `role=admin`, `kyc_status=approved`, `kyc_verified=true`, bcrypt `password_hash`, and alias `admin@bid-blitz.ae`. `admin@bidblitz.com` must not authenticate as admin.
- Login smoke:
```bash
curl -c /tmp/bidblitz_auth_cookies.txt -X POST "$REACT_APP_BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bidblitz.ae","password":"BidBlitz2026!"}'
curl -b /tmp/bidblitz_auth_cookies.txt "$REACT_APP_BACKEND_URL/api/auth/me"
```

## Legacy Password Report
- Login as admin
- GET `/api/admin/customers-report/legacy-passwords`
- Verify fields: user_id, email, registered_at, password_format, risk_level, recommended_action

## Secure Password Reset
1. Trigger reset request via admin or `/api/auth/forgot-password`
2. Validate token via `GET /api/auth/reset-password/verify?token=...`
3. Submit new password via `POST /api/auth/reset-password`
4. Verify old password fails and new password succeeds
5. Confirm audit log entries and `force_password_change` handling for admin-issued reset links

## Staff BioTime Cookie Auth
- Existing core cookies remain unchanged: `access_token` / `refresh_token`.
- Staff BioTime endpoints use the existing httpOnly `staff_session` cookie created by `/api/staff/auth/terminal-pin`.
- Staff BioTime endpoints must not accept unauthenticated requests.

## Auth Hardening Notes
- `/api/auth/login` uses MongoDB identifier-based brute-force tracking; five failed attempts return `401`, the sixth active attempt returns `429`.
- The old coarse IP-only SlowAPI login throttle was removed from `/api/auth/login` so legitimate QA/admin/merchant logins are not blocked before the per-identifier lockout contract.
- Local FastAPI CORS preflight returns explicit `access-control-allow-origin` with credentials. If the preview edge returns wildcard on `OPTIONS`, that is an upstream ingress/preflight interception and not the app middleware response.

### Staff BioTime Smoke
```bash
curl -c /tmp/staff_cookies.txt -X POST "$REACT_APP_BACKEND_URL/api/staff/auth/terminal-pin" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"mitarbeiter@bidblitz.ae","pin":"1234"}'

curl -b /tmp/staff_cookies.txt "$REACT_APP_BACKEND_URL/api/biopay/staff/biotime/status"

curl -b /tmp/staff_cookies.txt -X POST "$REACT_APP_BACKEND_URL/api/biopay/staff/biotime/enroll" \
  -H "Content-Type: application/json" \
  -d '{"template_token":"PALM-STAFF-TEST-1234","modality":"palm","nickname":"QA Palm"}'

curl -b /tmp/staff_cookies.txt -X POST "$REACT_APP_BACKEND_URL/api/biopay/staff/biotime/clock" \
  -H "Content-Type: application/json" \
  -d '{"template_token":"PALM-STAFF-TEST-1234","event_type":"check_in","modality":"palm"}'
```

## Merchant Approval Execution Smoke
- Login as merchant/admin.
- Create/request pending approval.
- Call `/api/pos/security/approvals/{approval_id}/decision` with `approved`.
- Confirm approval status is decided and executable types return execution payloads.

## Customer Login Offline-Guard Regression
- Konto: `agimk@me.com` / `Aldink56600`
- `POST /api/auth/login` muss erfolgreich sein und darf **nicht** mit einer falschen Offline-Meldung blockiert werden, solange das Backend erreichbar ist.
- Nach erfolgreichem Login muss `GET /api/auth/me` mit Session-Cookies denselben Kunden zurückgeben.
- Frontend-Login darf nicht mehr allein wegen `navigator.onLine === false` vorzeitig abbrechen; echte Netzfehler müssen weiterhin sauber als Network-/Server-Fehler erscheinen.
