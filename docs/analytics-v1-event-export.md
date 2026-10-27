# BidBlitz Analytics V1: administrator event CSV (DEV contract)

**Route:** `GET /api/analytics/v1/portfolio/export.csv?days=30`

This is a read-only export of the **existing** V1 project-event aggregation.
It uses the same strict administrator check and server-side project catalog as
`GET /api/analytics/v1/portfolio`. It does not trust client-selected projects
or create a new access grant. `days` is an integer from 1 to 90 inclusive.

## Shape and interpretation

- One row per project and UTC calendar date **with recorded event counts**,
  ordered by registered project and ascending UTC date.
- An eligible project with no recorded events has one row with an empty UTC
  date, empty counters and `record_status=no_recorded_events`. This does **not**
  establish zero traffic, a healthy collector or an offline project.
- Fixed columns are `project`, `utc_date`, the seven V1 event names from the
  server schema, `record_status`, `verified_revenue_included`, `data_scope`.
- No session identifiers, IP addresses, customer records, emails, raw URLs,
  amounts, verified payments or net profit are exported.
- `checkout_completed` (if present in existing records) remains an **event
  count**, not payment confirmation. `verified_revenue_included=false` in
  every row. Unique visitor numbers are not derivable from this CSV.
- Unknown or malformed dates, invalid counts, duplicate aggregate dimensions,
  unsafe overflows and inconsistent daily/period totals fail closed with 503.
- Response uses a fixed download filename, UTF-8 CSV, `Cache-Control:
  private, no-store`, and `X-Content-Type-Options: nosniff`.

This feature does not enable an event collector, payment integration, or
production deployment.

## Relevant isolated tests

```bash
PYTHONPATH=backend ../.stack-test-venv/bin/python -m pytest -q \
  backend/tests/test_analytics_v1_api.py backend/tests/test_analytics_portfolio_summary.py
```
