# BidBlitz — Production `.env` Template

## Backend `.env` (in `/app/backend/.env`)

Kopiere die Werte und ersetze die `<PLACEHOLDER>` mit echten Production-Keys.

```bash
# ── Database ──
MONGO_URL=mongodb://localhost:27017
DB_NAME=bidblitz_v2

# ── Auth ──
JWT_SECRET=<RANDOM-32-BYTE-HEX>  # python -c "import secrets;print(secrets.token_hex(32))"
ADMIN_EMAIL="admin@bidblitz.ae"
ADMIN_PASSWORD=<STRONG-PASSWORD>

# ── Stripe (PRODUCTION) ──
STRIPE_API_KEY=sk_live_<YOUR-LIVE-KEY>
STRIPE_PUBLIC_KEY=pk_live_<YOUR-LIVE-PUBLISHABLE-KEY>
STRIPE_WEBHOOK_SECRET=whsec_<FROM-STRIPE-DASHBOARD-WEBHOOK>

# ── Resend (Email) ──
RESEND_API_KEY=re_GfVbS3eF_MWWk7iq37YTMFVBiDYCCpsS7
FROM_EMAIL=BidBlitz <noreply@bidblitz.ae>
FRONTEND_URL=https://bidblitz.ae

# ── Emergent LLM (Universal) ──
EMERGENT_LLM_KEY=<your-emergent-key>

# ── LiveKit (Real-Time Streaming) ──
LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_API_KEY=<API-KEY-FROM-CLOUD.LIVEKIT.IO>
LIVEKIT_API_SECRET=<API-SECRET-FROM-CLOUD.LIVEKIT.IO>

# ── Slack/Discord Webhooks (Hot-Lead Alerts, optional) ──
SLACK_WEBHOOK_URL=<SLACK-INCOMING-WEBHOOK-URL>
DISCORD_WEBHOOK_URL=<DISCORD-CHANNEL-WEBHOOK-URL>

# ── S3 (LiveKit Egress Recording, optional) ──
S3_ACCESS_KEY=<AWS-ACCESS-KEY>
S3_SECRET_KEY=<AWS-SECRET>
S3_REGION=us-east-1
S3_BUCKET=bidblitz-recordings

# ── Deployment ──
PUBLIC_BASE_URL=https://api.bidblitz.ae
DEMO_SEED=false  # WICHTIG: false in Production!
```

## Frontend `.env` (in `/app/frontend/.env`)

```bash
REACT_APP_BACKEND_URL=https://api.bidblitz.ae
REACT_APP_STRIPE_PUBLIC_KEY=pk_live_<YOUR-LIVE-PUBLISHABLE-KEY>
WDS_SOCKET_PORT=443  # für HTTPS Hot-Reload (Dev only)
```

## Stripe Webhook Setup (Stripe Dashboard)

1. Login: https://dashboard.stripe.com → API Keys → Live Mode
2. Get `sk_live_...` (starts with `sk_live_`) → kopiere in `STRIPE_API_KEY`
3. Get `pk_live_...` → kopiere in beide `STRIPE_PUBLIC_KEY`
4. Webhooks → "Add Endpoint":
   - URL: `https://api.bidblitz.ae/api/webhook/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.updated`
5. Nach Creation: "Reveal" Webhook Signing Secret → kopiere in `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
6. Webhook-Test: Stripe Dashboard → "Send test event" → checkout.session.completed → Backend logs prüfen

## Validation Checklist (Production)

```bash
# 1. Backend hot-reload
sudo supervisorctl restart backend && sleep 4
curl -s https://api.bidblitz.ae/api/landing-chatbot/health
# → {"status":"ok",...}

# 2. Stripe Live Mode
curl -X POST https://api.bidblitz.ae/api/auctions/buy-credits-stripe \
  -H "Cookie: <admin-session>" \
  -H "Content-Type: application/json" \
  -d '{"package_id":"25"}'
# → checkout_url muss "checkout.stripe.com" enthalten (NICHT api.stripe.com)

# 3. Resend live email
curl -X POST https://api.bidblitz.ae/api/landing-chatbot/leads/sales-invite \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d '{"email":"DEINE-ECHTE-EMAIL@gmail.com","lead_name":"Test"}'
# → email_sent:true, email_reason:"sent"

# 4. KYC Status
curl https://api.bidblitz.ae/api/kyc/status -H "Cookie: ..."

# 5. Frontend Production Build
cd /app/frontend && yarn build
ls -la build/static/js/main.*.js  # → < 2 MB ist gut

# 6. Mobile Bundle ID Check
grep com.bidblitz /app/frontend/capacitor.config.ts
# → appId: "com.bidblitz.app"
```

## Production Health-Monitoring (Optional)

Ergänze in Backend-Logs:
- Stripe Charge: `STRIPE_LIVE | checkout.session.completed | user_X | €Y.YY`
- Resend Reject: `RESEND_REJECT | email | reason`
- KYC Approve: `KYC_AUTO | user_X | gemini_score=Y`
- Hot Lead: `HOT_LEAD | email | score=N | tags=[...]`

Push diese Logs zu Datadog / Sentry / LogTail für Live-Monitoring.
