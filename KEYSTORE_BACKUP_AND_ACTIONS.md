# BidBlitz — Production Keystore Backup & Action Plan

## ⚠️ KRITISCH: Diese Dateien NIEMALS verlieren

Wenn du den Keystore verlierst, kannst du deine App **NIE WIEDER** auf Google Play aktualisieren.
Du müsstest unter neuem Package-Namen (`com.bidblitz.app2`) neu starten = alle User verlieren.

---

## 📦 Backup-Dateien

Ort im Container: `/app/keystore_backup/`

| Datei | Größe | Zweck |
|-------|-------|-------|
| `bidblitz-upload.jks` | 2.7 KB | Keystore (BINARY) |
| `bidblitz-upload.jks.base64` | 3.7 KB | Base64-Kopie für Email/Slack-Versand |
| `keystore.properties` | 886 B | Passwort + Alias (für CI/CD) |
| `CHECKSUM.md5` | 184 B | MD5 + SHA256 zum Verifizieren |

### Checksums
```
MD5:    331ccb64818339551908053e612004bb
SHA256: c0ca2df4eb8e875e7ddc4828c4c7d8157a54cd976b5ab3d4e554391fa81a76ad
```

### Credentials
```
storeFile=bidblitz-upload.jks
storePassword=BidBlitz2026Release!
keyAlias=bidblitz
keyPassword=BidBlitz2026Release!
```

### Cert-Fingerprints (für Play Console / Firebase / Google Sign-In)
```
SHA1:   3C:0C:F9:F7:BB:57:B0:AD:8F:17:5B:84:5C:89:A3:33:7E:42:35:1C
SHA256: 04:42:24:D7:83:9F:E6:CF:CC:5B:F4:4C:AC:5C:09:CB:C3:3A:1E:40:8C:FD:FF:37:A6:3D:6A:8F:02:8B:4B:37
Algorithm: SHA256withRSA
Validity: 04 May 2026 → 19 Sep 2053 (10000 days)
```

---

## 🔐 Backup-Strategie (3-2-1 Rule)

**3 Kopien, 2 verschiedene Medien, 1 Off-Site**

### Methode A — Save to GitHub (empfohlen)
1. Im Emergent-Chatfenster auf **"Save to Github"** klicken
2. Im GitHub-Repo zu `frontend/android/bidblitz-upload.jks` navigieren → Download

### Methode B — Direkt-Download via Backend
```bash
# Container öffnet HTTP-Server für 60 Sek auf Port 9000
cd /app/keystore_backup && python3 -m http.server 9000 &
# Dann lokal: curl http://<container-ip>:9000/bidblitz-upload.jks > bidblitz-upload.jks
```

### Methode C — Base64 → Clipboard
```bash
cat /app/keystore_backup/bidblitz-upload.jks.base64
# → kopiere Output in 1Password / LastPass / Bitwarden als "Secure Note"
# → später dekodieren: base64 -d > bidblitz-upload.jks
```

### Empfohlene Speicherorte
1. **1Password / Bitwarden** Vault (Secure Note + Attachment)
2. **Encrypted USB-Stick** im Tresor
3. **AWS S3 / Backblaze B2** mit Server-Side Encryption + Versioning aktiviert

---

## ✅ Resend-Domain Verifizieren

**Status:** RESEND_API_KEY ist gesetzt: `re_GfVbS3eF_MWWk7iq37YTMFVBiDYCCpsS7`
**Problem:** `bidblitz.com` Domain ist NICHT verifiziert → Resend lehnt alle Mails ab.

### Steps

1. Login: https://resend.com → Dashboard
2. Sidebar → **Domains** → **Add Domain**
3. Domain eingeben: `bidblitz.com` (oder deine echte Domain)
4. Resend zeigt dir **3 DNS-Records** (TXT + CNAME):
   - `MX` Record für `send.bidblitz.com`
   - `TXT` Record für SPF (`v=spf1 include:amazonses.com ~all`)
   - `CNAME` Records für DKIM (3 Stück)
5. Trage diese Records bei deinem **Domain-Registrar** ein (z.B. Cloudflare, GoDaddy, Strato, IONOS)
6. Zurück zu Resend → "Verify DNS Records" Button
7. Status muss auf **"Verified"** (grün) wechseln (kann 5-60 Min dauern)
8. **Wichtig:** Stelle sicher, dass `FROM_EMAIL` in `/app/backend/.env` deine verifizierte Domain nutzt:
   ```
   FROM_EMAIL=BidBlitz <noreply@DEINE-VERIFIZIERTE-DOMAIN.com>
   ```

### Test
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_GfVbS3eF_MWWk7iq37YTMFVBiDYCCpsS7" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "BidBlitz <noreply@bidblitz.com>",
    "to": ["DEINE-EMAIL@example.com"],
    "subject": "Test",
    "html": "<p>Domain verified ✓</p>"
  }'
```
→ erfolgreich = `{"id":"..."}` zurück
→ rejected = `{"name":"validation_error","message":"...domain is not verified..."}`

---

## 📱 Store Submission Checklist

### Google Play Console
- [ ] Account erstellt: https://play.google.com/console (25 USD einmalig)
- [ ] App erstellen → Package Name: `com.bidblitz.app`
- [ ] **Internal Testing** Track als erstes (max. 100 Tester)
- [ ] AAB-Build erzeugen:
  ```bash
  cd /app/frontend && yarn build
  npx cap sync android
  cd android && ./gradlew bundleRelease
  # → outputs: app/build/outputs/bundle/release/app-release.aab
  ```
- [ ] Upload `app-release.aab` zu Play Console
- [ ] Fingerprints abgleichen (SHA256 oben muss matchen)
- [ ] Datenschutzerklärung-URL angeben (Pflicht!)
- [ ] Screenshots: 2-8 Stück pro Gerätetyp

### Apple App Store Connect
- [ ] Apple Developer Program: https://developer.apple.com/programs (99 USD/Jahr)
- [ ] App erstellen → Bundle ID: `com.bidblitz.app`
- [ ] Xcode auf macOS:
  ```bash
  cd /app/frontend && yarn build
  npx cap sync ios
  open ios/App/App.xcworkspace
  # Xcode → Product → Archive → Distribute App → App Store Connect
  ```
- [ ] **TestFlight** für Beta-Tester aktivieren
- [ ] App Review einreichen (typisch 24-48h)

---

## 🚨 Container-Persistence Warnung

**WICHTIG:** Der Emergent-Container ist nicht garantiert persistent. Wenn du das Projekt rollback'st, wird `bidblitz-upload.jks` mit aller Wahrscheinlichkeit überschrieben. Sichere ihn JETZT extern, bevor du irgendetwas anderes machst.

**Safest Path:**
1. Klicke **Save to Github** im Chat → Keystore liegt auch im Git-Repo
2. Klone Repo lokal → kopiere `frontend/android/bidblitz-upload.jks` → 1Password Vault
3. Lösche `bidblitz-upload.jks` aus Git nach lokalem Backup (mit `git filter-branch` oder BFG Repo-Cleaner) für extra Sicherheit (Public-Repo-Risiko)
