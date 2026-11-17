# Customer analytics aggregate validation (DEV)

The authenticated customer-site overview reads only events already matched by the server-owned `tenant_id` and `site_id` from a unique, active and ownership-verified site record. This validation layer does not create site grants, change ownership, activate collection, or read legacy unbound events.

Before an aggregate is returned, the route now validates the bounded MongoDB projection independently:

- Only the exact `_id: {day, event}` and integer `count` shape is accepted.
- Day keys must be canonical calendar dates within the requested UTC reporting window.
- Event names must belong to the customer-safe V1 allowlist; payment completion is deliberately excluded.
- Counts must be positive integers, not booleans or floats, and must fit within JavaScript's safe integer range.
- Duplicate `(day, event)` dimensions, excessive row counts and overflowing per-event totals are rejected.
- Unknown database fields, including accidental identity or contact fields, are never copied into a response.

Malformed aggregate data returns a generic HTTP 503. The response does not include raw database values or exception details. Empty aggregates remain an empty recording and do not assert zero customer activity or collector health.

This is an integrity guard for the existing read-only customer API. It does not establish a payment ledger, revenue metric, retention cohort, or production readiness. No collection, index, migration, environment variable, secret, permission, or deployment setting is changed.

Focused verification:

```bash
PYTHONPATH=backend /srv/bidblitz-dev/.stack-test-venv/bin/python -m pytest -q \
  backend/tests/test_analytics_customer_aggregate.py \
  backend/tests/test_analytics_customer_api.py
```
