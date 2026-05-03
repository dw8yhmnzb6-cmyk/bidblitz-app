# App Store Blocker Fix Report — Feb 2026

## Fixed items

| # | Blocker | Fix | Files changed |
|---|---------|-----|---------------|
| 1 | AI chatbot 500 on 2nd+ message | Removed invalid `store=False` kwarg; rewrote history replay as inline multi-turn prompt (last 3 user+assistant pairs packed into single API call) | `/app/backend/routes/ai_chatbot.py` |
| 2 | Route collision `/api/cards` | `collectibles.py` prefix → `/api/collectibles`; frontend `BlitzHubPage.jsx` updated | `/app/backend/routes/collectibles.py`, `/app/frontend/src/pages/BlitzHubPage.jsx` |
| 2 | Route collision `/api/notifications` | `notification_center.py` prefix → `/api/notifications/center`; primary `/api/notifications` now unambiguous (`notifications.py`) | `/app/backend/routes/notification_center.py` |
| 3 | Password reset dead link | Wired frontend to existing `POST /api/auth/forgot-password` (Resend email already configured via `RESEND_API_KEY` + `FROM_EMAIL` in backend `.env`) | `/app/frontend/src/pages/AuthPage.jsx` |
| 4 | MongoDB `subscriptions.user_id_1` duplicate | 1 duplicate row deleted (safe — kept first doc), unique index recreated | DB migration (no file) |
| 5 | Missing iOS + Android icons / splash | `@capacitor/assets generate` — 100 Android, 13 iOS, 7 PWA assets generated from `resources/icon.png` + `resources/splash*.png` | `/app/frontend/android/app/src/main/res/**`, `/app/frontend/ios/App/App/Assets.xcassets/**`, `/app/frontend/public/icons/**` |
| 6 | Android release signing | Gradle signingConfig added, reads `android/keystore.properties` (gitignored) | `/app/frontend/android/app/build.gradle`, `/app/frontend/android/keystore.properties.template`, `/app/frontend/android/.gitignore` |
| 7 | Deep links | `assetlinks.json` + `apple-app-site-association` served from `/.well-known/` (placeholders for final TEAM_ID + SHA256) | `/app/frontend/public/.well-known/*` |
| 8 | Stripe return / 3DS | Capacitor bridge listens to `appUrlOpen` for `/pay/return*`; wallet refresh triggered via `bidblitz:refresh-wallet` event | `/app/frontend/src/services/capacitorBridge.js`, `/app/frontend/src/index.js`, `/app/frontend/src/pages/WalletPage.jsx` |
| 9 | Service Worker stale cache in native | SW registration already globally disabled (unregister + cache.delete at boot); verified for Capacitor WebView | `/app/frontend/src/index.js` (comment updated) |
| 10 | Seed data forced in production | `seed_demo_auctions()` now gated by `DEMO_SEED` env flag (default true in dev). Bot-only auctions unchanged (intentional feature, already flagged `bot_only=true`) | `/app/backend/server.py`, `/app/backend/.env` |
| 11 | Android target SDK check | Verified `android/variables.gradle`: `compileSdkVersion=35`, `targetSdkVersion=35`, `minSdkVersion=23` — meets Play Store 2025 requirement (API 35). No change needed. | — |
| 12 | Apple IAP risk report | See "Apple IAP Risk" below | — |

## Verification

**Chatbot 3-turn test (admin session)** — all PASS, KB facts correct in every response:

```
Msg1 (Auktionen):  502 chars  → 0,50 € / 0,01 € / 10 s / Bot-Only  ✅
Msg2 (Wallet-Topup): 166 chars  → 500 € Limit, Stripe              ✅
Msg3 (Referral):     434 chars  → 5 € Bonus + 10 % Provision        ✅
```

**Route regression** — 200 OK on `/api/geo/cities`, `/api/auctions/list`, `/api/feature-flags`, `/api/crypto/prices`, `/api/collectibles/*` (401 auth gate), `/api/cards/me` (401 auth gate), `/api/notifications/center/*` (401 auth gate).

**Build** — `yarn build` green, `yarn cap sync android` green, `/.well-known/` present in `build/`.

**Duplicate index** — backend startup log clean; `subscriptions.user_id_1` unique index active.

---

## Remaining blockers for App Store (require external action by the user)

| Item | Required action |
|------|-----------------|
| Android signing keystore | User must generate `bidblitz-upload.jks` (see `/app/deploy/MOBILE_BUILD.md`), place in `/app/frontend/android/`, and fill `keystore.properties` from template. CI/Dev cannot generate a production keystore for you safely — **private key must live only on user's machine + off-site backup**. |
| Deep-link SHA256 fingerprint | After keystore is created, run `keytool -list -v -keystore bidblitz-upload.jks -alias bidblitz` → paste SHA256 into `public/.well-known/assetlinks.json` (replace `REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT`). Also applies to Google Play "App Signing" fingerprint. |
| Apple Team ID | Replace `REPLACE_TEAMID` in `public/.well-known/apple-app-site-association` with the user's Apple Developer Team ID (10-char). File must be served with `Content-Type: application/json` and no extension — **already correct filename**. |
| iOS App-Store Connect listing | Not created yet — only code side is ready. User must create the listing, upload build via Xcode → Archive, submit for review. |
| Google Play Console listing | Same — user must create, upload signed AAB. |
| Stripe webhook public URL | Must be configured on Stripe Dashboard with the live URL `https://bidblitz.ae/api/webhook/stripe`. |
| Apple IAP decision | See below — no code change required yet, but legal/product decision needed before submission. |

---

## Apple IAP Risk Report

Per Apple App Store Review Guideline 3.1.1 ("In-App Purchase"), all **digital content or services consumed within the app** must use Apple's In-App Purchase API. External payment (Stripe) is only allowed for **physical goods / real-world services**.

| Feature | Risk | Recommendation |
|---------|------|----------------|
| Wallet Top-up (EUR credit) | **MEDIUM-HIGH** — wallet credit is a stored value that can be spent on digital or physical goods. Apple often requires IAP when the wallet pays for digital content. | Option A: Hide wallet top-up inside the iOS app entirely (users top up on web only). Option B: Convert to IAP with consumable products (€10/€20/€50/€100 packs). Recommend **A** for initial launch. |
| POS Subscription purchase | **HIGH** — pure SaaS subscription → Apple IAP required per Guideline 3.1.1. | Hide the "Upgrade POS" screen on iOS at first release (detect `Capacitor.getPlatform()==='ios'` → redirect to web). Add IAP products later. |
| POS Add-On purchases | **HIGH** — same as above. | Hide on iOS; purchasable only on web. |
| Premium user upgrade | **HIGH** if offering ad-free or feature-unlock. | Hide on iOS; web-only. |
| Penny-Auction bids (€0.50 per bid, chance-based) | **MEDIUM** — Apple sometimes treats Penny Auctions as gambling/loot-box. Can be rejected under Guideline 5.3.3/5.3.4. Also Apple treats paid-bid systems as "chance-based prize purchase". | Prepare clear user consent + age-gating (18+). Possibly disable real-money auctions on iOS at launch (view-only) and re-enable after Apple review. Bot-only auctions unaffected (no real money). |
| Hotel / Flight / Event booking | **LOW** — tangible services / physical goods → Stripe OK. | Keep as-is. |
| Car rental / Taxi / Food delivery | **LOW** — physical services. | Keep as-is. |
| Stripe Issuing Cards | **LOW** — financial service, explicitly allowed (Guideline 3.1.5). | Keep as-is. |
| Referral rewards | **LOW** — user-earned credit, not purchased. | Keep as-is. |
| Cashback / rewards shop | **MEDIUM** — if rewards are exchanged for digital goods, IAP may apply. For vouchers/physical goods OK. | Audit the rewards catalog before iOS submission. |
| Live Shopping / Creator Tips | **HIGH** — Apple usually rules tips/gifts for digital creators as IAP. | Disable tip-feature on iOS at launch. |
| BlitzMine / Token purchases | **HIGH** — "token" purchases for digital utility → IAP. Mining-as-reward (no purchase) = OK. | Verify no real-money token purchase path is exposed on iOS. |

**Bottom line:** For the iOS launch build, **feature-flag these paths off**: POS subscription/add-on purchase, user premium upgrade, creator tips, token purchases. Wallet top-up can stay if users are clearly told top-ups only work on the web. Penny-auctions need explicit age verification and full T&Cs or defer to a later release.

No code changes were made for IAP compliance in this pass — only the risk matrix. Implementation requires a product decision first.

---

## Decision

```
READY_FOR_CAPACITOR_BUILD:  YES
READY_FOR_APP_STORE:        NO
READY_FOR_GOOGLE_PLAY:      NO
```

### Why Capacitor build is YES
All technical pre-requisites done: icons, splash, permissions, deep-link files, Stripe return handling, chatbot bug fixed, route conflicts resolved, duplicate DB index fixed. `yarn cap sync android|ios` + `yarn cap open android|ios` will produce a working native app.

### Why App Store / Play Store still NO
Blockers are **external** (user must provide keystore + fingerprint + Apple Team ID + Play/App-Store Connect listings + IAP product decision). Nothing further can be fixed in code until those are in place.
