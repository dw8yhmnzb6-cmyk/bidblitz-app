# BidBlitz — App Store / Play Store Submission Checklist

Stand: 04.05.2026 · Domain: `bidblitz.ae`

---

## 1. Pre-Flight (User-Aktion erforderlich)

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1.1 | Resend DNS-Records (`bidblitz.ae`) setzen → siehe `/app/RESEND_DNS_SETUP.md` | User | ⏳ |
| 1.2 | Stripe Live-Keys in `.env` einsetzen (`sk_live_…`, `pk_live_…`) → siehe `/app/PRODUCTION_ENV_TEMPLATE.md` | User | ⏳ |
| 1.3 | LiveKit API-Key + Secret in `backend/.env` (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`) | User | ⏳ |
| 1.4 | Sentry DSN in `frontend/.env` (`REACT_APP_SENTRY_DSN`) — optional | User | ⏳ |
| 1.5 | Apple Developer Account aktiv ($99/Jahr) | User | ⏳ |
| 1.6 | Google Play Console aktiv ($25 einmalig) | User | ⏳ |

## 2. Build-Artefakte (lokal erzeugen)

### 2.1 Android AAB (Release)
```bash
cd /app/frontend
yarn build
npx cap sync android
bash build-aab-release.sh    # erfordert Android SDK + JDK17
# Output: android/app/build/outputs/bundle/release/app-release.aab
```
**Signing:** `bidblitz-upload.jks` (siehe `/app/KEYSTORE_BACKUP_AND_ACTIONS.md`).
**🔴 BACKUP des Keystores erforderlich (offline + Cloud).**

### 2.2 iOS IPA (TestFlight)
```bash
cd /app/frontend
yarn build
npx cap sync ios
npx cap open ios
# In Xcode: Archive → Distribute → App Store Connect
```
Anleitung: `/app/TESTFLIGHT_PLAY_INTERNAL_TESTING.md`

## 3. Store-Metadata

### 3.1 App-Icon
- 1024×1024 PNG (App Store / Play Store): `/app/frontend/public/app-icon-1024.png` *(generiert via `scripts/generate-store-assets.sh`)*
- Adaptive-Icon Android: 432×432 in `android/app/src/main/res/mipmap-*`

### 3.2 Feature-Graphic (Play Store)
- 1024×500 PNG: `/app/frontend/public/store-feature-1024x500.png`

### 3.3 Screenshots (Pflicht)
| Plattform | Größe | Anzahl |
|-----------|-------|--------|
| iPhone 6.7" | 1290×2796 | 3-10 |
| iPhone 6.5" | 1242×2688 | 3-10 |
| iPad 12.9"  | 2048×2732 | 3-10 |
| Android Phone | 1080×1920 | 2-8 |
| Android Tablet | 1920×1200 | 2-8 |

> **TIPP:** Mit `npx cap run ios --target=…` + Simulator-Screenshots erstellen.

### 3.4 App-Beschreibung (DE/EN)
- **Titel:** BidBlitz — Super App
- **Subtitle (iOS, max 30):** Penny-Auktionen · Wallet · Mobility
- **Short Description (Play, max 80):** Auktionen, Wallet, Taxi, Live-Shopping & POS — alles in einem.
- **Long Description (max 4000):** *(siehe Marketing-Doc — TBD)*

### 3.5 Kategorien
- iOS: **Finanzen** (Primary), **Lifestyle** (Secondary)
- Android: **Finanzen**

### 3.6 Altersfreigabe
- **iOS:** 17+ (User-Generated Content + finanzielle Transaktionen)
- **Android (IARC):** PEGI 18 / Erwachsene

## 4. Compliance / Legal

| # | Item | URL / Pfad | Status |
|---|------|-----------|--------|
| 4.1 | Datenschutzerklärung | `https://bidblitz.ae/privacy` | ✅ |
| 4.2 | AGB / Terms of Service | `https://bidblitz.ae/terms` | ✅ |
| 4.3 | Cookie-Banner (DSGVO) | `<CookieBanner>` global | ✅ |
| 4.4 | KYC-Banner auf Wallet/Auctions/Taxi | global eingebunden | ✅ |
| 4.5 | Apple App Privacy Manifest | `frontend/ios/App/App/PrivacyInfo.xcprivacy` | ⚠️ *prüfen* |
| 4.6 | Android Data Safety Form | Play Console manuell | ⏳ |
| 4.7 | Support-Email / Kontakt | `support@bidblitz.ae` | ⏳ DNS |

## 5. App Store (Apple) — Submission-Steps
1. App Store Connect → "+" → Neue App
2. Bundle-ID: `ae.bidblitz.app` *(prüfen in `frontend/ios/App/App.xcodeproj`)*
3. Build via Xcode hochladen
4. Metadata + Screenshots + Privacy ausfüllen
5. **In Review submitten** → 24-48h Review

## 6. Play Store (Google) — Submission-Steps
1. Play Console → "App erstellen"
2. Package: `ae.bidblitz.app`
3. AAB hochladen (`app-release.aab`)
4. Internal Testing → Closed Testing → Production
5. Data Safety Form ausfüllen
6. **Rollout** (zunächst 5%, dann 100%)

## 7. Post-Launch Monitoring
- Sentry für Crash-Reports (Frontend)
- MongoDB Atlas Monitoring (Backend)
- Stripe Dashboard für Transaktions-Alerts
- Resend Dashboard für Email-Bounces

---

**Status-Legende:** ✅ erledigt · ⏳ User-Aktion offen · ⚠️ prüfen · 🔴 kritisch
