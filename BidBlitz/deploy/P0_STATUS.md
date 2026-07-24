# BidBlitz P0 Deployment Asset Status

## Updated: 26.05.2026

### ✅ (a) Android Release Keystore — REPO BEREINIGT
- Die Datei `frontend/android/bidblitz-upload.jks` darf **nicht** im Repo liegen.
- Keystore nur lokal/offline oder via CI-Secrets halten.
- Falls ein Release gebaut werden soll: `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` setzen oder lokal eine nicht versionierte `keystore.properties` nutzen.
- Keine Passwörter oder Fingerprints mehr in Repo-Dokumenten speichern.

### ✅ (b) LIVEKIT .env Structure — PREPARED
Added to `/app/backend/.env`:
```
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```
**Get keys at**: https://cloud.livekit.io → Project Settings → Keys
Set `LIVEKIT_URL` to your project's `wss://xxx.livekit.cloud` URL.

### ✅ (c) Build Pipeline — VERIFIED
- `yarn build` → SUCCESS (33.98s, no errors)
- Build folder: `/app/frontend/build/` (production-ready static assets)
- Capacitor sync (`npx cap sync android/ios`) requires Android SDK / Xcode locally — run on macOS dev machine after transferring `/app/frontend/`

### ✅ (d) Landing-Chatbot LLM Integration — LIVE
- Model: `gpt-4.1-mini` (OpenAI via Emergent LLM Key)
- File: `/app/backend/routes/landing_chatbot.py`
- Multi-turn session-based memory: WORKING (verified with 3-turn German conversation)
- Lead-capture rule on demo/testen keywords: WORKING

## Next Action Items (User-Side, External)
1. Eigenen Release-Keystore lokal/extern verwalten, nicht im Repo
2. Configure real LIVEKIT_* values in `/app/backend/.env`
3. Transfer `/app/frontend/` to local macOS, run `./build-mobile-final.sh`
4. Open `/app/frontend/android/` in Android Studio → Build → Generate Signed APK/Bundle
5. Open `/app/frontend/ios/App/App.xcworkspace` in Xcode → Archive → Upload to App Store Connect
