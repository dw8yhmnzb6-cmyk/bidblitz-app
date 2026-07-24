# BidBlitz Android Release Build - Signing Steps

**Bundle ID:** `com.bidblitz.app`

---

## Prerequisites

- **JDK 17+** installed
- **Android Studio** with SDK 34+
- **Gradle** (included in `/app/frontend/android/`)

---

## 1. Generate Upload Keystore (ONE TIME - Keep Forever)

```bash
cd /app/frontend/android

keytool -genkeypair -v \
  -keystore bidblitz-upload.jks \
  -alias bidblitz \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype JKS
```

**Prompts:**
- **Keystore password:** Choose strong password (WRITE IT DOWN)
- **Key password:** Can be same as keystore password
- **Name/Organization/Country:** Fill with company details

**⚠️ CRITICAL:** Back up `bidblitz-upload.jks` to a safe off-site location.  
Losing this file means **you can never update the app** on Google Play Store.

---

## 2. Create keystore.properties

```bash
cd /app/frontend/android
cp keystore.properties.template keystore.properties
```

Edit `keystore.properties` with your real values:

```properties
storeFile=bidblitz-upload.jks
storePassword=YOUR_KEYSTORE_PASSWORD_HERE
keyAlias=bidblitz
keyPassword=YOUR_KEY_PASSWORD_HERE
```

**Note:** `keystore.properties` is git-ignored for security.

---

## 3. Extract SHA256 Fingerprint

```bash
cd /app/frontend/android

keytool -list -v \
  -keystore bidblitz-upload.jks \
  -alias bidblitz
```

**Output will show:**

```
Certificate fingerprints:
     SHA1:   AB:CD:EF:...
     SHA256: 12:34:56:78:9A:BC:DE:F0:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88
```

**Copy the SHA256 line** (including colons).

---

## 4. Update assetlinks.json with SHA256

Open: `/app/frontend/public/.well-known/assetlinks.json`

Replace:
```json
"sha256_cert_fingerprints": ["REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT"]
```

With your actual SHA256:
```json
"sha256_cert_fingerprints": ["12:34:56:78:9A:BC:DE:F0:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88"]
```

**Rebuild frontend** so the updated file gets into the Android assets:

```bash
cd /app/frontend
yarn build
npx cap sync android
```

**Deploy** the static files to production so the file is reachable at:  
`https://bidblitz.ae/.well-known/assetlinks.json`

---

## 5. Build Release AAB (for Google Play)

```bash
cd /app/frontend/android
./gradlew bundleRelease
```

**Output:**  
`android/app/build/outputs/bundle/release/app-release.aab`

**Upload this AAB to Google Play Console.**

---

## 6. Build Debug APK (for Testing)

```bash
cd /app/frontend/android
./gradlew assembleDebug
```

**Output:**  
`android/app/build/outputs/apk/debug/app-debug.apk`

**Install on device:**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. Build Release APK (Alternative - Signed)

```bash
cd /app/frontend/android
./gradlew assembleRelease
```

**Output:**  
`android/app/build/outputs/apk/release/app-release.apk`

**Note:** Google Play requires AAB format (step 5), not APK.  
Use APK only for internal distribution or sideloading.

---

## 8. Google Play App Signing (Recommended)

If you enroll in **Google Play App Signing**, Google generates a second signing key.

**After enrollment:**
1. Go to Play Console → Release → Setup → App Integrity
2. Find **"App signing key certificate"** → Download SHA256
3. Add it to `assetlinks.json` as a **second fingerprint**:

```json
"sha256_cert_fingerprints": [
  "YOUR_UPLOAD_KEY_SHA256",
  "GOOGLE_PLAY_SIGNING_KEY_SHA256"
]
```

---

## 9. Verify Deep Links

After installing the app, test deep links:

```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://bidblitz.ae/auctions/123" com.bidblitz.app
```

App should open directly (not browser).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `keystore.properties not found` | Run step 2 to create it from template |
| `Keystore was tampered with` | Wrong password in `keystore.properties` |
| `BUILD FAILED: Task :app:validateSigningRelease` | Check `storeFile` path is correct (relative to `android/`) |
| Deep links not working | Verify `assetlinks.json` is reachable at `https://bidblitz.ae/.well-known/assetlinks.json` |
| SHA256 not accepted | Remove spaces and ensure colons are included |

---

## Build Configuration Summary

| Property | Value |
|----------|-------|
| Bundle ID | `com.bidblitz.app` |
| Keystore File | `bidblitz-upload.jks` |
| Key Alias | `bidblitz` |
| Validity | 10000 days (~27 years) |
| Algorithm | RSA 2048-bit |

---

## Final Checklist

- [ ] Upload keystore generated
- [ ] `keystore.properties` created with real passwords
- [ ] Keystore backed up off-site
- [ ] SHA256 extracted
- [ ] `assetlinks.json` updated with SHA256
- [ ] Frontend rebuilt and deployed to production
- [ ] Release AAB built successfully
- [ ] AAB uploaded to Google Play Console

**✅ Ready for Google Play submission!**
