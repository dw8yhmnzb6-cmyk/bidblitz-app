# BidBlitz — CI/CD Auto-Deploy via GitHub Actions

Production läuft auf **Hetzner VPS (212.227.20.190)** mit nativem **systemd + nginx + PM2** (kein Docker).

## Architektur

| Komponente | Pfad / Manager |
|---|---|
| Frontend (statisch) | `/var/www/bidblitz/frontend/build/` (von Nginx serviert) |
| Backend (FastAPI)   | `/var/www/bidblitz/backend/` — gestartet via **PM2** (process name `api`) |
| Nginx Vhost         | `/etc/nginx/sites-enabled/bidblitz` (HTTPS via Let's Encrypt) |
| MongoDB             | lokal, port 27017 |
| systemd `bidblitz-backend.service` | **DEAKTIVIERT** (Konflikt mit PM2 — nicht reaktivieren) |

## Workflow: `.github/workflows/deploy.yml`

**Trigger:**
- Jeder `git push` auf `main`
- Manuell: *GitHub → Actions → Deploy to Hetzner Production → Run workflow*

**Ablauf (auf GitHub-Runner):**
1. Checkout
2. `yarn install --frozen-lockfile && yarn build` mit Production-`.env`
3. `rsync` `frontend/build/` → `/var/www/bidblitz/frontend/build/` (vorher Backup, max. 5 Generations)
4. `rsync` `backend/` → `/var/www/bidblitz/backend/` (excludes: `venv`, `.env`, `data`, `logs`, `__pycache__`)
5. SSH: `pip install -r requirements.txt`, `pm2 restart api`, `nginx -s reload`
6. Health-Checks via `curl`

> Vorteil: Auf dem VPS muss **kein GitHub-Auth** sein. Der Runner macht alles.

## Pflicht-Secrets (GitHub → Repo Settings → Secrets and variables → Actions)

| Secret         | Wert                              |
|----------------|-----------------------------------|
| `VPS_HOST`     | `212.227.20.190`                  |
| `VPS_USER`     | `root`                            |
| `VPS_PASSWORD` | `<SSH-Passwort des root Users>`   |

## Optionale Secrets (Frontend Build-Time)

| Secret                                  | Default falls leer  |
|-----------------------------------------|---------------------|
| `PROD_REACT_APP_BACKEND_URL`            | `https://bidblitz.ae` |
| `PROD_REACT_APP_MAPBOX_TOKEN`           | (leer)              |
| `PROD_REACT_APP_STRIPE_PUBLISHABLE_KEY` | (leer)              |

> ⚠️ **Backend-Secrets** (Stripe Live-Key, Mongo-URL, JWT-Secret etc.) liegen ausschließlich in `/var/www/bidblitz/backend/.env` auf dem VPS. Diese Datei wird vom Deploy NICHT überschrieben (`rsync --exclude '.env'`).

## Erstmalige Aktivierung — Schritt für Schritt

1. **Code in GitHub pushen:** Emergent Chat → *Save to GitHub* (Repo: `dw8yhmnzb6-cmyk/bidblitz`, Branch: `main`)
2. **Secrets setzen:** GitHub Repo → Settings → Secrets and variables → Actions → "New repository secret" für `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD`
3. **Workflow auslösen:** GitHub → Actions → *Deploy to Hetzner Production* → *Run workflow* → Branch `main` → *Run*
4. **Logs verfolgen:** Job-Output zeigt Build-Größe, Rsync-Stats, Health-Check (HTTP 200)
5. **Verify:** `curl -sk https://bidblitz.ae/ | grep -oE 'main\.[a-z0-9]+\.js'` → muss neuen Hash zeigen

Ab Schritt 3 läuft jeder zukünftige Push automatisch deployed.

## Rollback

Auf dem VPS werden die letzten 5 Frontend-Builds als `build.bak.<timestamp>` aufbewahrt:

```bash
ssh root@212.227.20.190
ls -lh /var/www/bidblitz/frontend/ | grep build.bak
# Wiederherstellen:
rm -rf /var/www/bidblitz/frontend/build
mv /var/www/bidblitz/frontend/build.bak.<TIMESTAMP> /var/www/bidblitz/frontend/build
systemctl reload nginx
```

Für Backend: Datenbank-Migrationen sind nicht versioniert — Vorsicht. Code-Rollback per `git revert` lokal + neuer Push.

## Manueller Deploy (Notfall, ohne GitHub Actions)

```bash
# Lokal
cd /app/frontend
cp .env .env.dev.bak
echo "REACT_APP_BACKEND_URL=https://bidblitz.ae" > .env
yarn build
tar czf /tmp/bidblitz-build.tar.gz -C build .
cp .env.dev.bak .env

# Upload
sshpass -p '<PW>' scp /tmp/bidblitz-build.tar.gz root@212.227.20.190:/tmp/

# Apply
sshpass -p '<PW>' ssh root@212.227.20.190 '
  TS=$(date +%Y%m%d_%H%M%S)
  cp -r /var/www/bidblitz/frontend/build /var/www/bidblitz/frontend/build.bak.$TS
  rm -rf /var/www/bidblitz/frontend/build/*
  tar xzf /tmp/bidblitz-build.tar.gz -C /var/www/bidblitz/frontend/build/
  systemctl reload nginx
'
```

Backend (einzelne Datei):
```bash
sshpass -p '<PW>' scp /app/backend/routes/<file>.py \
  root@212.227.20.190:/var/www/bidblitz/backend/routes/
sshpass -p '<PW>' ssh root@212.227.20.190 'pm2 restart api'
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Live zeigt alten Build | `curl -sk https://bidblitz.ae/ \| grep -oE 'main\.[a-z0-9]+\.js'` mit `ls /var/www/bidblitz/frontend/build/static/js/` vergleichen |
| `502 Bad Gateway` auf `/api/*` | `pm2 logs api --lines 50` → ggf. `pm2 restart api` |
| `Address already in use :8001` | `systemctl status bidblitz-backend` — falls active: `systemctl stop bidblitz-backend && systemctl disable bidblitz-backend` |
| Action: SSH timeout | Secret `VPS_PASSWORD` korrekt? Firewall-Port 22 offen? `ssh root@212.227.20.190` von einer anderen Maschine testen |
| Action: `rsync exit 255` | Meist Auth-Fehler — Passwort prüfen |
| Action: `yarn install` fehlschlägt | `frontend/yarn.lock` muss in Git committed sein |
| GitHub-Auth-Fehler beim `git fetch` auf VPS | Egal — der Workflow nutzt rsync vom Runner aus, kein Git auf VPS nötig |

## Logs

```bash
ssh root@212.227.20.190
pm2 logs api --lines 100              # Backend
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
journalctl -u nginx -n 50 --no-pager
```
