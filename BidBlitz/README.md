# BidBlitz

Komplettes Root-Projekt für die BidBlitz Web- und Capacitor-iOS-App.

## Root-Struktur

```text
BidBlitz/
├── package.json
├── package-lock.json
├── capacitor.config.ts
├── src/
├── public/
├── ios/
├── backend/
├── README.md
├── .env.example
└── weitere Build-/Capacitor-Konfigurationen
```

## Voraussetzungen

- Node.js 20.x
- npm 10.x
- Python 3.11+
- CocoaPods (für iOS auf macOS)
- Xcode 15+ (für `ios/App/App.xcworkspace` und den nativen iOS-Build)

## Produktionskonfiguration

- Bundle Identifier: `com.bidblitz.app`
- Produktions-URL: `https://bidblitz.ae`
- Capacitor Workspace: `ios/App/App.xcworkspace`

## Lokale Schritte

### Frontend / Capacitor

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001
```

## Wichtige Hinweise

- Öffne in Xcode immer **`ios/App/App.xcworkspace`**, nicht nur `App.xcodeproj`.
- `ios/App/App/AppDelegate.swift` importiert `Capacitor` korrekt.
- Die Produktionskonfiguration nutzt `https://bidblitz.ae`.
- Im ZIP sind **keine echten Secrets oder Passwörter** enthalten.

## Einschränkung dieser Build-Umgebung

Die vollständige Xcode-/iOS-Build-Verifikation muss auf **macOS mit Xcode + CocoaPods** erfolgen. In dieser Linux-Container-Umgebung können `npx cap open ios`, `pod install` und ein echter iOS-Build nicht final ausgeführt werden.
