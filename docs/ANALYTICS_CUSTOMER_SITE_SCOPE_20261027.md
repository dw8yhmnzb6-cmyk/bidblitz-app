# Read-only Analytics customer site ownership — DEV block

## API
- GET /api/analytics/v1/my/sites returns at most 100 active, ownership-verified sites for the authenticated database identity. has_more signals a longer metadata list; subsequent page retrieval remains future work.
- GET /api/analytics/v1/my/sites/{site_id}/overview?days=30 validates the canonical site UUID, resolves exactly one active ownership record and aggregates only V1 events with BOTH the resolved tenant_id and site_id. Missing, malformed, duplicate, inactive or unverified assignments return the same 404. Authentication errors precede metadata/event access. An admin role does not bypass ownership on these customer routes.
- All bindings come from server-owned metadata. Client headers/query fields do not provide owner identity, tenant or grants. Public summaries contain site_id and display_name, not owner/tenant IDs. Empty event results are explicitly marked has_recorded_events=false, and browser checkout events are never represented as verified revenue.

## Data and trust boundary
Use analytics_sites metadata within the EXISTING configured MongoDB database, alongside the existing conversion_events collection. No second database, network backend, migration or live write is introduced. This block only reads metadata; it does not provision sites or grant access. Authenticated identity uses the real database _id (ObjectId or string), falling back to legacy id; request-like user_id fields are not trusted.

A separately reviewed server-side provisioner must create metadata with: unique canonical UUID site_id; canonical UUID tenant_id; canonical owner_user_id; display_name (1..100 characters, no control characters); status='active'; ownership_verified=true only after proving website ownership. Neither users nor public profile updates may set these fields. Provisioning must introduce and verify a unique site_id index and an owner/status lookup index; no request handler creates indexes. Disable assignments through trusted metadata to revoke access. Reassignment and concurrent revocation need operational/integration review.

A future trusted ingestion adapter must bind tenant_id/site_id AFTER validating the existing minimized V1 event, using server configuration. The current collector helpers do not yet attach these fields and remain inactive. Unbound legacy records cannot be relabeled or adopted for a customer. The read-side contract alone does not establish working customer tracking. Event-query compound indexes, bounded retention, provisioning and database behavior need integration verification.

## Executed verification
29 new tests covering owner-only listing, forged request scope, foreign/missing equivalence, no admin bypass, unauthenticated access, inactive/unverified grants, ambiguous metadata, canonical UUID checks, malformed identities, correct tenant+site query, no raw-field leakage, empty results and period validation. Total executed backend Analytics suites: 122 passed, 0 failed, 0 skipped, one dependency deprecation warning. The actual FastAPI router runs with fake auth/database; no real customer records, credentials, MongoDB, DNS, service restart, tracking enablement or production write. Repository-pinned runtime versions as documented in the prior API block; pymongo 4.5.0 supplies ObjectId validation.

## Remaining
Admin provisioning/domain ownership flow, customer UI connection, collector binding and retention/index migrations, real authenticated DB integration tests and staged release. Existing admin endpoints and page remain admin-only.
