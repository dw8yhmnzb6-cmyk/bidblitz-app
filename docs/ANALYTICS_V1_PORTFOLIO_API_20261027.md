# Read-only Analytics V1 portfolio API — 2026-10-27

## Implemented
- `GET /api/analytics/v1/portfolio?days=30` returns registered catalog project reports with one grouped query against the existing conversion_events collection.
- Existing project overview uses the same aggregation helper and preserves its response fields.
- Both routes retain the existing require_admin guard. No external customer/project-admin role is granted access.
- Server-owned ProjectName catalog defines the portfolio scope; client query parameters and headers cannot add projects.
- UTC report cutoff is shared across projects, legacy records and unknown event types are excluded by the query, only grouped counts are serialized. Revenue remains explicitly unavailable from these events.
- Cursor bound includes an extra UTC calendar date for rolling day windows; 90 days can touch 91 dates.

## Validation
93 tests passed, 0 failed, 0 skipped across the nine current Analytics core suites and 23 new HTTP contract tests. Tests use Python 3.12 and the repository-pinned FastAPI 0.110.1, Starlette 0.37.2, Pydantic 2.12.5, HTTPX 0.28.1, pytest 9.0.2 and pytest-asyncio 1.3.0. One dependency deprecation warning about the AnyIO BlockingPortal alias; no test failure.

HTTP tests mount the actual router in FastAPI with isolated fake auth and aggregate cursor dependencies. They exercise unauthorized/forbidden roles before DB reads, unknown projects, day limits, server-owned scope, one grouped query, existing project response shape, raw-field omission, empty data and full 90-day bucket capacity. They do not verify actual token validation, MongoDB execution/indexes, live mounting, latency or frontend behavior.

## Not yet released
No service restart, migration, production writes, live tracking, financial action, DNS change or deployment. Empty aggregate output means no recorded V1 data, not proof of a healthy collector or zero real visitors. Customer tenant ownership and permissions, collector integration and frontend wiring remain separate work. Schema and retention must still be reviewed before enabling collection.
