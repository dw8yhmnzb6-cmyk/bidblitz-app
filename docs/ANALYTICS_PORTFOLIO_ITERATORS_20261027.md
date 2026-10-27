# Analytics portfolio iterator fix — 2026-10-27

## Change
Preserve the existing dashboard service and API shape. Snapshot bounded input iterables once after validating the authorized project list so that later projects retain traffic, verified-ledger revenue and minimized business activity. An empty project scope returns without consuming inputs. Read one default UTC clock per report and pass it through all sections and projects.

## Reproduction and validation
Before the fix, the new one-shot iterator regression and shared-clock regression failed (11 passed, 2 failed in the dashboard service suite). After the fix, all 66 tests in the nine isolated analytics core suites passed under Python 3.12 with pytest and pytest-asyncio. Four regression tests were added. No production database or network services were used.

Suites: activity_feed, dashboard_metrics, dashboard_service, event_schema, ingestion, project_registry, reporting, revenue, store (`backend/tests/test_analytics_*.py`). The snapshot contained exactly these nine suites.

## Limits
Core tests do not establish API/RBAC integration, a deployed dashboard, real payment reconciliation or overall completion. Inputs still must be bounded and authorized by the server-side caller. Tuple snapshots add memory proportional to those input batches; production adapters must bound their queries. No tracking activation, migration, deployment, production write or change to the concurrent DEV revenue file.
