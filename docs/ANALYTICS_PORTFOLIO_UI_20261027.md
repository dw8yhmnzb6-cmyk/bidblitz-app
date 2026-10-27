# Existing Admin Analytics UI: V1 portfolio integration

## Implemented
The existing /admin/analytics page now opens its V1 portfolio view. The prior view remains accessible through 'Bisherige Übersicht'; its implementation is retained. App.js already restricts this page to user.role === admin, and the API independently requires admin authorization.

The new AnalyticsPortfolioPanel uses GET /api/analytics/v1/portfolio with cookie credentials and the configured REACT_APP_BACKEND_URL, or same origin when unset. It supports rolling UTC periods, project filtering, reloading and retry. Obsolete requests are aborted and their responses cannot replace newer state. HTTP 401/403/404/5xx, network failures and invalid response shapes produce explicit errors without invented zero counters. Empty recorded-event data has a coverage warning. Page views are not labeled unique visitors. Verified revenue remains 'Nicht angebunden'. No changes to external customer permissions or collection activation.

## Verification
14 React DOM/Jest component tests passed in an isolated React 19 + Jest 29/jsdom harness. Cases cover project filtering, request credentials, HTTP failure states, empty data, malformed responses/counters, retry, stale-data clearing and out-of-order responses on a period change. Both modified JSX modules compiled with Babel. No package.json or lockfile changes, full CRA build, real browser E2E, cookie session or live API/DB connection verified by this block. The previous backend validation remains 93 passing tests at parent commit a06aec3; those tests were not rerun for this frontend-only change.

## Remaining
The examined user/profile modules do not establish an Analytics customer-to-project entitlement model. This internal admin view must not be exposed to customer accounts as a shortcut. External customer ownership, project provisioning, verified ingestion, real payment sources and deployment checks remain separate work.
