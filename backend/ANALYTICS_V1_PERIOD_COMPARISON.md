# BidBlitz Analytics V1 – Recorded-event period comparison (DEV)

## Endpoint

`GET /api/analytics/v1/portfolio/period-compare?days=7`

- Admin session required; unauthorized users are rejected before database access.
- `days`: integer from 1 to 90, default 7. The request cannot select or expand project access.
- Two read-only, bounded aggregations over the same server-owned catalog of registered projects.
- Current UTC interval: `[as_of - days, as_of]`.
- Previous UTC interval: `[as_of - 2*days, as_of - days)`. The shared boundary belongs **only** to the current period, preventing double counting.
- All `as_of`, `start_inclusive`, `end_inclusive`, and `end_exclusive` values are ISO-8601 UTC timestamps.
- JSON response is marked `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.

## Contract

The payload contains `period_days`, `as_of`, `timezone: "UTC"`, `windows`, `projects`, and `summary`.

Each `projects[]` row contains a registered `project`, `current_events`, `previous_events`, `recorded_event_change` and `current_recorded_utc_days` / `previous_recorded_utc_days`. Counts are integer **recorded event occurrences**, not distinct users. Each event map has the seven registered V1 event names; the signed difference is current minus previous. The summary aggregates event counts across all registered projects and gives the number of projects with **recorded** events in each interval.

The response always sets:
- `data_scope: "v1_project_events_only"`
- `verified_revenue_included: false`
- `unique_visitors: null`
- `net_profit_available: false`
- `collection_health_verified: false`

**Interpretation:** Zero recorded events or a negative count change does not prove zero traffic, customer loss, collector health, a conversion rate, or a revenue change. No payment ledger, customer table, browser identity or user session is queried. Event named `checkout_completed` is still **not** a verified payment.

Malformed grouped aggregates, repeated grouped dimensions, or unsafe cross-project integer sums fail closed with HTTP 503. No personal or raw event fields are returned. A true verified-revenue dashboard requires an independently authorized, audited and privacy-reviewed source before a separate API can be designed.

## Test guidance

Run using the existing isolated DEV Python test environment (never production credentials):

```sh
PYTHONPATH=backend /srv/bidblitz-dev/main-app-testenv/bin/python -m pytest backend/tests/test_analytics_v1_api.py -q
```

The backend tests use a fake database and fake authentication. The isolated DEV admin dashboard now consumes this endpoint **on demand** through `AnalyticsPeriodCompare`, using the existing admin session. It validates the complete project/event catalog, disjoint UTC window boundaries and all summary totals before rendering. Frontend unit tests use mocked responses. Real browser End-to-End tests with DEV authentication are still outstanding. No merge or deployment is included.

## Read-only comparison CSV export (DEV)

`GET /api/analytics/v1/portfolio/period-compare/export.csv?days=7`

The CSV endpoint uses the **same admin authorization and two bounded, disjoint
database aggregate queries** as the JSON comparison. The server fixes the
project catalog; user-supplied headers or project IDs cannot expand scope.
Only periods of 1–90 days are accepted. Unauthorized requests are denied
before any analytics database read.

The download `bidblitz-v1-period-comparison.csv` contains exactly 10 registered
projects × 7 event types plus 7 portfolio summary rows. It reports current
and previous **recorded event counts**, signed count changes, recorded UTC-day
counts (project rows), and the precise adjacent UTC window boundaries.
Only server-owned project IDs and event names enter the CSV. No raw events,
customer IDs, IP addresses, emails, sessions or payment amounts are included.

Each row sets `data_scope=v1_project_events_only`,
`verified_revenue_included=false` and `collection_health_verified=false`.
A zero count means **no V1 events recorded**, not zero visitors, customers,
orders or revenue. `checkout_completed` is not a confirmed payment.
Verified financial metrics require a separate audited, authorized source.

The renderer verifies the complete fixed project and event catalogs,
non-overlapping UTC windows, JavaScript-safe integer counts, recording-day
coverage, all signed deltas and cross-project sums. Malformed results fail
closed with HTTP 503. No untrusted spreadsheet-formula fields are exported.
Responses have `Cache-Control: private, no-store` and
`X-Content-Type-Options: nosniff` headers.

### DEV tests (fake database and authentication; no production credentials)

```sh
PYTHONPATH=backend /srv/bidblitz-dev/main-app-testenv/bin/python -m pytest \
  backend/tests/test_analytics_v1_period_comparison_csv.py \
  backend/tests/test_analytics_v1_period_comparison.py \
  backend/tests/test_analytics_v1_api.py -q
```

The backend CSV endpoint is read-only; the separate isolated DEV frontend integration below adds its export button without deploying it. Browser E2E and full CI remain open. No production change, merge or deployment.

### Admin dashboard integration (isolated DEV branch)

The time-comparison panel loads JSON only after an explicit admin click.
Its selected-project filter changes the displayed rows, not the authorized API
query. The CSV button is enabled only after a validated JSON comparison is
available. It requests the full catalog CSV with existing session credentials
and a fixed `days` parameter; no customer IDs, payment amounts or project
filters are submitted.

The browser accepts only `text/csv` responses, rejects invalid or excessive
announced/body lengths (2 MiB bound), refuses empty bodies, and uses a fixed
client-owned `bidblitz-v1-period-compare-{days}d.csv` filename instead of
trusting `Content-Disposition`. Refresh, window changes and unmount abort
pending downloads. Unauthorized/failed responses show fixed German messages
without exposing server errors. Tests cover those paths with mocked responses;
a real-device/browser test remains open. The server endpoint is read-only.
