# BidBlitz — Keystore Security Action Plan

## Status
- Keystore-Artefakte gehören **nicht** ins Repo.
- Release-Signing läuft jetzt über lokale `keystore.properties` **oder** `ANDROID_*` Secrets.
- Keine echten Passwörter, Keys oder Base64-Backups mehr in Git ablegen.

## Sichere Ablage
Nutze nur externe sichere Speicherorte:
1. Passwortmanager / Secret Vault
2. Verschlüsselter Offline-Backup-Datenträger
3. CI Secret Store (`ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)

## Android Build
- Lokaler Build: `frontend/android/keystore.properties` nur lokal anlegen
- CI Build: nur `ANDROID_*` Secrets setzen
- `frontend/build-aab-release.sh` erzeugt `keystore.properties` jetzt temporär aus Secrets, falls nötig

## Template für lokale `keystore.properties`
```properties
storeFile=/absolute/path/to/bidblitz-upload.jks
storePassword=<local-secret>
keyAlias=<local-secret>
keyPassword=<local-secret>
```

## Resend Hinweis
- Keine API Keys in Markdown-Dateien speichern
- Domain-Checks nur mit Werten aus `.env` / Secret Store durchführen

## Store Checklist Kurz
- Google Play: AAB mit lokalem/CI Secret signieren
- Apple: Version/Build-Nummer vor Archive erhöhen
- Keystore niemals per Git, Chat oder Base64-Backup im Repo verteilen
