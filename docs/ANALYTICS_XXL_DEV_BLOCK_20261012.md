# Analytics XXL Development Block — 2026-10-12

## Implemented on existing feature branch
- Strengthened `backend/core/analytics_event_schema.py`: strict schema, timezone-aware timestamps, safe route templates, reject browser-claimed payment completion, explicit trusted-project comparison helper.
- Extended `backend/routes/analytics.py` with admin-only `GET /api/analytics/v1/projects/{project}/overview?days=30` returning project-scoped aggregate counts and daily event totals. No raw identifiers exposed. Only schema_version=1 project events are counted. This is a read-only API; it is not an event collector.
- Updated `frontend/src/lib/bidblitzAnalytics.js`: explicit consent callback, required registered static route allowlist, no payment-completion browser event, no arbitrary payloads.
- Added regression cases for revocation, route restrictions, payment-event spoofing and trusted project binding.

## Executed tests (Mac isolated DEV worktree)
- `backend/tests/test_analytics_event_schema.py` + `test_analytics_reporting.py`: **18 passed**.
- `frontend/src/lib/bidblitzAnalytics.test.js` + `frontend/src/services/tracker.test.js`: **14 passed**.
- `python3 -m compileall -q backend/routes/analytics.py`: completed successfully.
- Tests were executed in a detached temporary worktree, leaving the existing dirty `main` working tree untouched.
- No full FastAPI integration, MongoDB integration, end-to-end browser or production smoke test performed.

## Important limitations and blockers
- `/api/analytics/v1/projects/{project}/overview` is not live; it requires an authorized V1 ingestion pipeline to contain actual data.
- Existing `POST /api/analytics/track` remains legacy and still stores IP/user_id and free-form metadata; must be hardened before any expanded tracking rollout.
- New frontend V1 SDK is deliberately not wired into production and requires explicit route allowlists. Its configurable endpoint must not point at the legacy `/track` schema.
- Real payment/revenue data must be joined only from server-verified ledgers, not browser events.
- RBAC is currently limited to global admin via `require_admin`; project-admin scoping is a future gate.
- Forgejo is documented in the existing Stack, but live server health and repo parity are not yet confirmed.
- No second analytics platform, no new external analytics cloud, no production change.

## Next safe block
1. Build first-party V1 collector with trusted project identity, rate limits, explicit consent strategy, dedupe and retention.
2. Implement integration tests for API/RBAC/DB; secure or retire legacy tracking.
3. Build the portfolio and per-project dashboard on top of verified aggregate APIs.
4. Verify Forgejo current health and synchronize code only after a full backup and branch parity check.
