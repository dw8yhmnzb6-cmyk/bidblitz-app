# Analytics implementation backlog — ready for development
Linked plan: [ANALYTICS_ENTERPRISE_MASTERPLAN.md](./ANALYTICS_ENTERPRISE_MASTERPLAN.md)
All tasks on feature branch, no production writes.

| ID | Work package | Depends | Proof of done |
| --- | --- | --- | --- |
| ANA-001 | Inventory all existing trackers, routes, persistence, consent systems | — | File map and API/DB diff, duplicate tracking identified |
| ANA-002 | Align event contract, schema_version, adapter and backend track route | ANA-001 | Contract tests pass, old callers unchanged |
| ANA-003 | Audit and remediate PII/IP/session fields and replay privacy | ANA-001 | Tests confirm no sensitive payload, retention and deletion |
| ANA-004 | Consent-gate old tracker and centralize consent changes | ANA-002/003 | Reject/withdraw = zero outbound tracking |
| ANA-005 | Add project catalog, authenticated per-project identity and RBAC | ANA-002 | Tenant isolation and spoofed project rejection tests |
| ANA-006 | Add first-party validated ingestion, limits and dedupe | ANA-003/005 | Abuse, malformed schema, duplicate tests |
| ANA-007 | Extend existing event aggregates, indexed queries and funnels | ANA-006 | Deterministic dashboard fixtures and latency budget |
| ANA-008 | Reconcile payment provider events, refunds and currencies | ANA-005 | Exact sums on fixtures, retry does not double count |
| ANA-009 | Cohort retention / cross-project journey with permission checks | ANA-007/008 | Opt-out, logout, cross-tenant and deletion tests |
| ANA-010 | Build Stack portfolio + per-project UI and admin exports | ANA-007/008/009 | Role-scoped E2E, empty/error/loading states |
| ANA-011 | Optional heatmaps/replays, sensitive route exclusions | ANA-003/004 | Masking regression suite, default disabled |
| ANA-012 | Experiment assignment, flags, kill switch, audit log | ANA-005/007 | Stable bucketing and rollback tests |
| ANA-013 | Alerts, diagnostics and AI report suggestions (advisory only) | ANA-007/008 | Synthetic anomaly and no-auto-deploy proof |
| ANA-014 | Scheduled daily / weekly / monthly executive reports | ANA-007/008/010 | Reproducible snapshot and safe distribution tests |
| ANA-015 | Integrate ten catalog projects via common SDK | ANA-004/006/010 | Staging contracts/E2E per project |
| ANA-016 | Security, privacy, load, migration, backup and rollback gates | ANA-001..015 | Signed staging checklist before any release |

## Project pilot order
BidBlitz Main (pilot) → BidBlitz ID/Stack → Trade → Eyes → Power → Verify → IPTV → Games → Fuel.
Deployment remains a separate approval step. Product domains may differ; do not presume their environments are configured.

## Preliminary discovered blockers
1. New `frontend/src/lib/bidblitzAnalytics.js` sends `{project,event,path,timestamp,label?}`, while existing `TrackEvent` expects `{event,session_id?,meta?}`, and old `VALID_EVENTS` rejects most new values.
2. Old `frontend/src/services/tracker.js` does not call the cookie-consent function before sending and stores session IDs.
3. Existing backend `/api/analytics/track` persists IP, raw metadata and user_id.
4. README endpoint descriptions are not proof of endpoint behavior; API routing and privacy need integration tests.
5. Current frontend consent gating is present in `CookieBanner.jsx`, but Analytics SDK is not wired to it.

## Reporting standard
Only code confirmed by commit may be marked implemented; only executed passing tests may be marked tested; only live smoke-checked deployments may be called live. Do not claim a project-percentage without a measurable denominator.
