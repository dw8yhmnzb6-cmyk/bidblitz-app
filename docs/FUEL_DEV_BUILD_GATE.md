# BidBlitz Fuel — DEV Build & Test Gate

**Scope:** existing `bidblitz-app` repository, Fuel DEV branch only. No new database, app or live payment infrastructure.

## Verified fast validation

```bash
# From the repository root
FUEL_PYTHON=/path/to/venv/bin/python bash scripts/fuel-dev-smoke.sh
```

The command checks:

1. The Fuel commercial calculator renders with React server rendering.
2. Its browser API helper makes one authenticated POST to the **admin commercial-preview** endpoint; it never invokes a payment endpoint.
3. Authorization and network errors return explicit errors without blind retries.
4. Backend Fuel tests (if `FUEL_PYTHON` points to a Python installation with the project dependencies) — includes admin access checks, calculation, reconciliation and provider gates.

The command does not fetch external provider data, start services, deploy, or execute any payments. Without `FUEL_PYTHON`, it runs the dependency-free Fuel calculation tests only.

## Worktree dependency resolution

Worktrees do not automatically share installed npm packages. The existing Fuel worktree has a `frontend/node_modules` symlink to a small, incomplete folder; this led to `Cannot find module 'dotenv'` followed by `Can't resolve 'react-dom/client'` in the CRA build.

The smoke script selects a complete root `node_modules` from:
- `FUEL_NODE_MODULES` if explicitly provided;
- the worktree's `node_modules` if installed; otherwise
- the primary worktree's `node_modules`.

It uses `NODE_PATH` **for the test process only** and does not rewrite shared dependency directories or project lockfiles. For a clean isolated CI setup, install the locked dependencies according to the root workspace's supported package manager, then set `FUEL_NODE_MODULES` to that installation's `node_modules`.

## Full application build — separate release gate

```bash
CI=true npm run build --workspace=frontend
```

The full CRA build is substantially heavier than the targeted smoke test and is **not** replaced by it. The isolated diagnostic build previously reached `Creating an optimized production build...` after dependency resolution was corrected, but did not complete during the diagnostic run and was deliberately stopped to avoid continued high CPU usage. Therefore there is **no passing full-build proof yet**.

Before any Fuel release, separately verify a completed frontend build, full backend dependencies, permission checks, approved partner credentials and contracts, PSP and receipt integrations, reconciliation, idempotency, and explicit production sign-off. Until then: external networks off, payment execution off, no real pump release.
