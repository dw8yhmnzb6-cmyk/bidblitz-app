# Native BOX admin inbox — 2026-11-07

## User requirement and current boundary
Afrim wants the project admin functions inside bidblitz.ae, not external navigation.
This change implements the FIRST slice: location application inbox, read-only.
It does not implement approval/rejection, shipments, customers, stations, payments,
locker control, or other projects' admin functions.

NOT deployed. NOT enabled. Existing website and V3 external link are unchanged.
Do not rebuild IONOS frontend from its stale source. Earlier full build regressed
the website and was rolled back to index SHA256
9d2b6733e5484640ed6ccaf387c308ab8867dd9755c518b384379e0f29080969.
The current HTML also includes the separately added V3 link; strip only that
known addition when comparing the baseline. Never restore a stale full build.

## Verified production authentication (read-only inspection)
IONOS /var/www/bidblitz/backend/routes/admin_projects.py provides require_owner.
It checks current database identity, owner allowlist, disabled state, auth_version
and active session record. The new route imports that existing function;
it does not copy the obsolete dependencies.get_admin_user implementation.
IONOS backend files are accessible through the read-only agent after the user's
explicit service configuration update. No production files were written here.

## Implemented source files
Main project:
- backend/core/box_admin_delegation.py
- backend/routes/admin_box_native.py
- frontend/public/admin-box-native.js
- backend/tests/test_admin_box_native.py
- deploy/tests/test_native_box_inbox_ui.cjs
BOX companion:
- backend/box_admin_delegation.py (identical protocol)
- backend/box_native_admin_inbox.py
- backend/test_box_native_admin_inbox.py

The browser fetches only GET /api/admin/box/partner-applications with its current
same-origin session. The central server performs require_owner BEFORE outbound
requests, then creates a 30-second, operation/cursor-bound HMAC delegation.
No browser JWT, cookie or SSO wildcard permission is forwarded to BOX.
The destination is fixed HTTPS, redirects and environment proxies are disabled,
timeout is 8 seconds and response bytes are capped at 128 KiB.

BOX verifies signature, issuer, audience, scope, method, path, cursor, timestamps
and nonce. Subject -> BOX account mapping must be explicitly configured.
The mapped account must exist in admin_accounts with role admin and state ACTIVE
on EACH request. No account is created, promoted or unblocked.
Replay prevention uses a separate, explicitly initialized private SQLite store.
The existing customer/application database is opened read-only.

The UI is a mountable plain JavaScript module to avoid rebuilding the frontend.
It renders data with textContent; no iframe, external anchor, copied browser
credential, or navigation is used. Real empty results and backend failures differ.

## Verification
- BOX: 19 unittest tests, including real receive->inbox fixture, replay race,
  authorization, revocation, tampering and no customer DB mutation.
- Main: 11 unittest tests, including a sender->receiver integration with real
  fixture SQLite inbox (outbound network simulated).
- Playwright Chromium: mobile 390x844, empty/401/403/503, injection-safe text,
  pagination, same-origin/no-store, no external navigation or iframe, no horizontal
  overflow, duplicate mount, malformed response, teardown.
- These are DEVELOPMENT tests; no authenticated production flow was tested.

Commands:
BOX backend: python3 -m unittest test_box_native_admin_inbox test_box_partner_applications -v
Main: /srv/bidblitz-dev/main-app-testenv/bin/python -m unittest discover -s backend/tests -p test_admin_box_native.py -v
UI: LD_LIBRARY_PATH=/srv/bidblitz-dev/main-app-browser-testenv/libroot/usr/lib/x86_64-linux-gnu NODE_PATH=/srv/bidblitz-dev/main-app-browser-testenv/node_modules node deploy/tests/test_native_box_inbox_ui.cjs

## Remaining deployment work (not completed)
1. Inspect actual BOX launch factory, current proxy and IONOS backend bootstrap.
2. Mount receiver only on its exact internal GET path, preserving other routes.
3. Wire the IONOS router into its existing running app, without replacing auth.
4. Generate/store a DEDICATED server-to-server secret privately on both servers.
   Main environment: BIDBLITZ_NATIVE_BOX_INBOX_ENABLED=true and
   BIDBLITZ_NATIVE_BOX_INBOX_SECRET (never print actual values).
   Receiver construction is explicit: secret, subjects, ReplayStore, enabled=True.
5. Resolve central subject and BOX account IDs from verified existing accounts;
   require BOX role admin/ACTIVE. Do not infer permission from email alone.
6. Initialize dedicated replay DB explicitly using initialize_replay_store;
   ensure private permissions and identical protocol files on both hosts.
7. Publish only the new UI asset + narrowly checked HTML mounting addition.
   Existing V3 code can keep the card container, but its external link must be
   replaced by BidBlitzBoxInbox.mount(container). Preserve all current JS/CSS.
8. Test the CURRENT logged-in owner -> native API -> BOX inbox in production,
   plus unauthenticated/non-owner/blocked denial. Do not send real applications.
9. Only report live after these checks. Remaining full-admin functions need their
   existing per-operation APIs and checks; never emulate approval in the UI.

## Follow-up: runtime attachment and guarded publication planning

Implemented:
- BOX backend/box_native_admin_runtime.py: optional private configuration.
- tools/run_box_login.py attaches it inside the existing trusted local proxy.
  Absent configuration returns the exact original application. Invalid native
  configuration yields 503 only on the native inbox path; original login and
  other routes remain available.
- Main deploy/scripts/box_native_admin_plan.py: pure transformations for the
  IONOS router registry, BOX exact-path GET proxy, and current V3 HTML addition.
- Hashed UI asset: admin-box-native.ec5e395eea059087.js.
- Candidate HTML SHA256:
  03feff2ac099db12316ed845b7ac9c6e53843e47b3380db8eb44b4437a9ac648.
- Actual current public HTML passes the restored-site guard.
- Actual IONOS router registry was inspected and candidate syntax checked.
- Original compiled application JS/CSS are preserved byte for byte by the plan.
- Two Playwright mobile suites pass, including the actual candidate bootstrap
  loaded in an isolated HTML harness with same-origin API fixture.

Validation totals for this slice:
41 BOX tests (19 receiver/protocol, 10 optional runtime, 12 existing applications)
+ 6 existing tools/test_run_box_login.py tests
+ 11 main proxy tests
+ 7 publication planner tests
= 65 passing unit/integration tests, plus two mobile browser suites.

NOT LIVE: no service restart, production configuration, secret, account mapping,
nginx write, IONOS router registration, or HTML/asset publication occurred.
No shared delegation secret was generated or revealed. No customer database
was changed. IONOS source access is read-only; operator step remains required.

Remaining operator facts:
- Identify IONOS process manager/backend unit and its working directory before
  preparing a restart/rollback command. Do not guess service names.
- Pair a dedicated private secret on both servers and explicitly map an existing
  authorized central subject to an existing ACTIVE BOX admin. No new grants.
- Initialize a dedicated 0600 replay DB in the same private 0700 directory as
  native-admin.json (default: existing BOX database parent).
- Apply only reviewed individual files/plans with backups and scoped reload.
- Verify current authenticated owner end to end before reporting live.

## PM2 target identified from operator evidence and PID file
IONOS Uvicorn PID 3242908 is a child of PM2 (pm2-root.service).
Read-only inspection of /root/.pm2/pids/api-0.pid returned 3242908.
Target is therefore PM2 name api, ID 0; frontend ID 8 must not be restarted.
The new stage_ionos_native_box.py revalidates live pm2 jlist metadata and the
current PID/cwd before staging, so it does not depend on this PID remaining fixed.

A self-contained operator staging package now embeds eight reviewed source files.
It only invokes PM2 jlist; creates a private /root/bidblitz-native-box-stage-*
directory containing sources, exact HTML/registry backups, and candidate files.
It NEVER restarts PM2, rewrites a live source/index, pairs secrets, or maps accounts.
Eight focused staging tests pass (target, PID/cwd drift, bundle bounds and paths,
protocol consistency, readonly process invocation). Total known passing tests:
73 unit/integration tests + two mobile browser suites (65 prior + 8 new).

Use the generated stage_ionos_native_box.py, not its .template.py source.
Publication and live authenticated verification are still pending.
