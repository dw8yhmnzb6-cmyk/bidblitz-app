# BidBlitz — Client Storage Map

Stand: 18.07.2026

## 1) Was **nicht** lokal gespeichert wird

### Auth / Login / aktueller User / KYC
- **Nicht in `localStorage` gespeichert**
- Quelle: **Backend-Session per Cookie** + Live-Abruf
- Hauptpfad:
  - `frontend/src/store/UserContext.jsx`
  - `api.getMe()`
  - `api.refresh()`
- Zusätzliche Live-Freigabe für KYC-UI:
  - `frontend/src/hooks/useEffectiveKycAccess.js`
  - Endpoint: `/api/kyc/status`

## 2) Aktiv genutzte lokale Speicher

### `localStorage`

| Key | Datei | Zweck |
|---|---|---|
| `bidblitz_mode` | `frontend/src/store/UserContext.jsx` | Speichert aktiven Modus wie `personal` |
| `bidblitz_onboarded` | `frontend/src/App.js` | Merkt, ob die Einführung bereits abgeschlossen wurde |
| `bb_hint_dismissed` | `frontend/src/pages/HomePage.jsx` | Merkt, ob Hinweis auf Home ausgeblendet wurde |
| `bb_balance_hidden` | `frontend/src/pages/HomePage.jsx` | Merkt, ob Guthaben auf Home verborgen ist |
| `more_open_groups` | `frontend/src/pages/MorePage.jsx` | Speichert offene/aufgeklappte Gruppen in More |
| `bb_ai_chat_session` | `frontend/src/components/AIChatWidget.jsx` | Speichert aktuelle AI-Chat-Session-ID |
| `bidblitz_lang` | `frontend/src/store/I18nContext.jsx` | Spracheinstellung |
| `bidblitz_theme` | `frontend/src/store/ThemeContext.jsx` | Theme-Wahl |
| `bidblitz_push_dismissed` | `frontend/src/components/PushPermissionPrompt.jsx` | Push-Hinweis ausgeblendet |
| `bidblitz_pwa_dismissed` | `frontend/src/components/PWAInstallPrompt.jsx` | PWA-Hinweis ausgeblendet |
| `bidblitz_cookie_consent_v1` | `frontend/src/components/CookieBanner.jsx` | Cookie-Einwilligung |
| `bb_premium_banner_dismissed` | `frontend/src/components/PremiumLaunchBanner.jsx` | Premium-Banner ausgeblendet |
| `move_earn_tracking_opt_in` | `frontend/src/pages/MoveEarnPage.jsx` | Tracking-Zustimmung für Move/Earn |
| `bb_snake_high` | `frontend/src/pages/ArcadePage.jsx` | Highscore für Snake |
| `bb_merchant_id` | `frontend/src/pages/MerchantQrTablesPage.jsx` | Merchant-ID-Auswahl |
| `bidblitz_map_style` | `frontend/src/components/LeafletMobilityMap.jsx` | Kartenstil |
| `admin_layout_mode` | `frontend/src/pages/AdminPanelFullPage.jsx` | Admin-Layoutpräferenz |
| `bidblitz-admin-ai-conversation` | `frontend/src/pages/AdminAIAssistantPage.jsx` | Admin-AI-Konversation |
| `child_token` | `frontend/src/pages/ChildModePage.jsx` | Child-Mode Token |
| `child_id` | `frontend/src/pages/ChildModePage.jsx` | Child-Mode ID |
| `child_name` | `frontend/src/pages/ChildModePage.jsx` | Child-Mode Anzeigename |
| `pos_offline_queue` | `frontend/src/components/pos/POSCheckoutTab.jsx` | Offline-POS-Warteschlange |
| `bb_ref` | `frontend/src/App.js` | Referral-Code |

### `sessionStorage`

| Key | Datei | Zweck |
|---|---|---|
| `bb_sid` | `frontend/src/services/tracker.js` | Session-ID fürs Tracking |
| verschiedene Once-Keys im Tracker | `frontend/src/services/tracker.js` | Event-/Tracking-Deduplizierung |
| `dating-profile-setup-dismissed` | `frontend/src/pages/DatingPage.jsx` | Dating-Profil-Setup-Hinweis temporär ausgeblendet |

## 3) Verdächtiger Legacy-/Mock-Speicher

### `bidblitz_auth`
- Datei: `frontend/src/services/authService.js`
- Zweck im Altcode: lokaler Mock-Login
- Status aktuell: **Legacy-Key wird jetzt aktiv bereinigt und nicht mehr für Auth verwendet**
- Relevanz: `authService.js` nutzt jetzt echte Backend-Auth via `api` und ruft zusätzlich eine Cleanup-Funktion auf, damit alte `bidblitz_auth`-Einträge keine Tests oder Altzustände mehr verfälschen

## 4) Für die aktuelle Fehlersuche wichtig

Wenn ein Problem wie **KYC-Karte bleibt sichtbar**, **falscher Login-Status**, oder **UI sieht nach altem Zustand aus** auftritt, dann sind die wahrscheinlichsten Speicher-/Statusquellen aktuell:

1. **Backend-Session / Cookie**
2. **`UserContext.jsx` Zustand aus `api.getMe()` / `api.refresh()`**
3. **Live-KYC-Freigabe aus `/api/kyc/status`**
4. erst danach lokale UI-Keys wie `bidblitz_mode`, `more_open_groups`, `bb_balance_hidden`

### Sonderfall: lila Floating-Chat-/AI-Button
- Sichtbarkeit kam **nicht** allein aus Storage, sondern aus Render-Pfaden in:
  - `frontend/src/App.js`
  - `frontend/src/pages/LandingPage.jsx`
  - `frontend/src/components/LandingChatbot.jsx`
  - `frontend/src/components/AIChatWidget.jsx`
  - `frontend/src/components/FloatingChatbot.jsx`
- Lokale Begleit-Keys dazu:
  - `bb_ai_chat_session` → Chat-Session
  - `bidblitz-chatbot-hidden` → merkt nur, ob der alte FloatingChatbot manuell ausgeblendet wurde
- Status aktuell:
  - beide Keys werden jetzt **beim App-Start aktiv gelöscht** in `frontend/src/index.js`
  - Cleanup läuft vor dem React-Render

## 5) Empfehlung

- Auth-/KYC-Wahrheit weiterhin nur aus Backend + Cookie ableiten
- lokale Speicherung nur für UI-Präferenzen nutzen
- Legacy-Mock `authService.js` ist jetzt auf echte API-Auth umgestellt; zusätzliche Aufmerksamkeit gilt nur noch separaten Spezial-Tokens wie `child_token` im Child-Mode
