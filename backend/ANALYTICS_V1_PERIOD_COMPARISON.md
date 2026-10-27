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

The tests use a fake database and fake authentication. The browser dashboard currently **does not consume this new endpoint**; an independent UI integration with real authorization tests remains an open task. No merge or deployment is included.
