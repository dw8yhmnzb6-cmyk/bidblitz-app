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
# In a DEV worktree with an intact root node_modules installation:
CI=true GENERATE_SOURCEMAP=false DISABLE_ESLINT_PLUGIN=true \
  NODE_OPTIONS=--max-old-space-size=4096 \
  npm run build --workspace=frontend
```

**Verified on 2026-10-13:** after providing the Fuel worktree with a root `node_modules` link to the existing main-worktree installation, the CRA build completed with **`Compiled successfully.`** and produced `frontend/build/index.html`, `frontend/build/asset-manifest.json`, and JavaScript/CSS assets. An independent manifest check confirmed the manifest and its entrypoints. **No deploy was performed.** The flags above disabled source maps and the ESLint Webpack plugin for this build; a release must also run independent lint and environment-specific checks.

The full CRA build is much heavier than the fast smoke test. Build-generated changes to tracked `backend/build_info.json` and `frontend/public/version.json` were inspected and restored after the DEV build; they are **not** deployment evidence. The root `node_modules` symlink is ignored by Git and is local to this DEV worktree. Before any production build, install validated locked dependencies in a clean environment rather than relying on a manually linked development installation.

Before any Fuel release, separately verify a completed frontend build, full backend dependencies, permission checks, approved partner credentials and contracts, PSP and receipt integrations, reconciliation, idempotency, and explicit production sign-off. Until then: external networks off, payment execution off, no real pump release.
