# Mapbox Production Setup (Frontend + Backend)

## 1. GitHub Secrets (one-time)

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value | Used by |
|---|---|---|
| `PROD_REACT_APP_BACKEND_URL` | `https://bidblitz.ae` *(or `https://api.bidblitz.ae`)* | Frontend build (`REACT_APP_BACKEND_URL`) |
| `PROD_REACT_APP_MAPBOX_TOKEN` | `pk.eyJ1...d6w` *(from frontend/.env)* | Frontend build **and** synced to backend `.env` as `MAPBOX_TOKEN` |
| `PROD_REACT_APP_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Frontend build |

The workflow (`.github/workflows/deploy.yml`) automatically:
1. Builds frontend with these values baked-in.
2. **SSHs into the VPS and writes/updates `MAPBOX_TOKEN=...` inside `/var/www/bidblitz/backend/.env`** — idempotent, runs every deploy.
3. Restarts PM2 (`api`), backend picks up new token.

## 2. Verify after deploy

Once the workflow finishes:

```bash
curl -s 'https://bidblitz.ae/api/readiness/mapbox-token?live=true'
```

Expected response:

```json
{
  "status": "ok",
  "configured": true,
  "source": "MAPBOX_TOKEN",
  "masked": "pk.eyJ1IjoiY...d6w",
  "valid_format": true,
  "live_ok": true,
  "live_status_code": 200
}
```

If `live_ok` is `false` → check Mapbox dashboard URL-restrictions.
If `configured` is `false` → `PROD_REACT_APP_MAPBOX_TOKEN` secret is missing in GitHub.

## 3. Lockfile drift recovery (auto)

`deploy.yml` runs `yarn install --frozen-lockfile` first. If `yarn.lock` is out of sync with `package.json` (e.g. forgotten push after `yarn add`), the workflow:
- emits a `::warning::` in the Actions UI,
- regenerates the lockfile on the fly,
- continues the deploy.

To silence the warning, just commit the updated `frontend/yarn.lock` next time.

## 4. Mapbox Token URL restrictions (recommended)

[account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/) → open token → URL restrictions:

```
https://bidblitz.ae/*
https://*.bidblitz.ae/*
capacitor://localhost/*
ionic://localhost/*
http://localhost:*/*
```
