# BidBlitz — Android Google Play Release Prep

## Ziel
Diese Vorbereitung richtet BidBlitz für **Google Play App Signing** ein und prüft, ob ein Release-AAB gebaut werden kann.

## Release-Quelle
- `applicationId`: `com.bidblitz.app`
- Android-Projekt: `frontend/android/`
- Web-Build: `frontend/build/`

## Was jetzt vorbereitet ist
- `frontend/android/app/build.gradle`
  - liest `ANDROID_VERSION_CODE` und `ANDROID_VERSION_NAME` aus Env/Gradle-Props
  - bricht Release-Builds ohne Signing bewusst früh ab
  - deaktiviert Language-Splits im Bundle für konsistentere Play-Auslieferung
- `frontend/android/build-release-aab.sh`
  - prüft Java 17, Android SDK, Signing, Web-Build und `cap sync`
  - erkennt den bekannten **ARM64/AAPT2-Blocker** sauber und meldet ihn klar

## Google Play App Signing — empfohlener Flow
1. In Google Play **App Signing by Google** aktivieren
2. Lokal nur den **Upload Key** verwenden
3. `frontend/android/keystore.properties` mit dem Upload Key pflegen
4. Release über `./build-release-aab.sh` oder direkt `./gradlew bundleRelease` bauen

## Benötigte lokale Dateien
- `frontend/android/bidblitz-upload.jks`
- `frontend/android/keystore.properties`

Template:
`frontend/android/keystore.properties.template`

## Build-Befehl
```bash
cd /app/frontend/android
./build-release-aab.sh
```

## Optionale Versionssteuerung
```bash
export ANDROID_VERSION_CODE=4
export ANDROID_VERSION_NAME=1.0.1
cd /app/frontend/android
./build-release-aab.sh
```

## Aktueller Preview-Blocker
Im aktuellen Preview-Container läuft Linux auf **aarch64/ARM64**.
Der Release-Build scheitert dort weiter an einem Architekturproblem der AAPT2-Binaries:

- AGP 8.7.2 lädt `aapt2-8.7.2-12006047-linux`
- vorhandene `aapt2`-Binaries sind **x86_64**
- Folge: `mergeReleaseResources` → `AAPT2 ... Syntax error: "(" unexpected`

## Ergebnis des Blocker-Checks
- Java 17: prüfbar / installierbar
- Android SDK: vorhanden
- Signing-Dateien: vorbereitet
- `bundleRelease` im Preview: **weiter blockiert durch ARM64/AAPT2**, nicht durch Projekt-Code

## Empfehlung für das echte AAB
Baue das finale `.aab` auf einem **x86_64 Host**:
- Android Studio auf macOS / Windows / x86_64 Linux
- oder GitHub Actions / CI mit x86_64 Runner

Dann liegt das Bundle unter:
`frontend/android/app/build/outputs/bundle/release/`