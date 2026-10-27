# Customer Analytics UI — DEV integration

## Implemented
The existing App.js router now exposes /#/analytics, loaded lazily. MorePage's account menu has a Website-Statistik entry. Guests, including demo guests, see an explicit login prompt and issue no analytics requests. The existing account identity is a UI lifecycle key, not an authorization parameter; the server remains authoritative via its authenticated cookie.

CustomerAnalyticsPage reads only /api/analytics/v1/my/sites and the selected owned site's /overview endpoint. The UI validates site IDs, duplicate/malformed metadata, report site/period/scope, integer event counters and daily rows before rendering. It supports site/rolling-UTC period selection, update and retry; stale data is cleared on errors, site/account changes and late responses. Empty accounts and empty recorded-event periods have explicit states. Counts are labeled page views rather than unique visitors, and verified revenue remains unavailable. No fake live numbers, automatic grants or external services.

## Validation
36 React-DOM/Jest tests passed: 22 new customer-page cases and 14 existing admin-portfolio cases. Coverage includes guest login/no fetch, owned-site routes and credentialed reads, empty assignments, site/period changes, HTTP errors, revoked sites, mismatched report scope, malformed site lists, out-of-order responses, account changes and retries. App.js, MorePage.jsx and CustomerAnalyticsPage.jsx compiled with Babel in the isolated harness. The previous 122-test backend run remains a prior-block result; it was not rerun for these frontend-only edits.

No full CRA build, visual browser check, real cookie/DB/collector E2E or deployment of the Analytics application was completed by this block. No dependencies or lockfiles changed.

## Remaining
Website provisioning with actual ownership verification, customer site creation flow, trusted collector binding, real verified-payment data, full build, browser QA, real authentication/MongoDB and staging release checks. The menu entry does not provision sites or activate event collection.
