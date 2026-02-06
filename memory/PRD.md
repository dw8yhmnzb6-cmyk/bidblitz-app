# BidBlitz Penny Auction - Product Requirements Document

## Original Problem Statement
Create a penny auction website modeled after `dealdash.com` and `snipster.de` with complete visual and functional features.

## Current Status (February 5, 2026)

### ✅ COMPLETE: Voice Debug Assistant (iOS/Safari Kompatibel) + Dark Mode + Verbesserte Fehlermeldungen

The BidBlitz auction platform now has:
- **86 Backend API Routers** - Full coverage of all features
- **74 Frontend Pages** - Complete user interface
- **🌙 Dark Mode Toggle** - Users can switch between Light and Dark themes
- **🎤 Voice Debug Assistant** - Cross-platform debugging for admins (iOS/Safari kompatibel)
- **✨ Verbesserte Fehlermeldungen** - "Bitte anmelden um zu bieten" statt generischem Fehler

---

## New Feature: Voice Debug Assistant 🎤🐛

### Description:
An AI-powered voice debugging assistant for the Admin Panel that allows admins to report bugs using voice recording.

### How it works:
1. **Click Record Button:** Press "Aufnahme starten" on Admin panel
2. **Voice Recording:** Describe the error in German or English (max 60 seconds)
3. **AI Analysis:** OpenAI Whisper transcribes, GPT-4o-mini analyzes
4. **Report Generation:** Creates detailed bug report with:
   - Description
   - Severity (low/medium/high/critical)
   - Possible causes
   - Affected files
   - Recommendations

### iOS/Safari Compatibility (NEW):
- Uses MediaRecorder API instead of Web Speech Recognition
- Supports multiple audio formats: audio/mp4, audio/webm, audio/ogg
- Dynamic MIME type detection for cross-browser support
- Longer timeslices (1000ms) for iOS stability

### Technical Implementation:
| Component | File | Description |
|-----------|------|-------------|
| Backend | `/routers/voice_debug.py` | API endpoints for transcription and analysis |
| Frontend | `/components/VoiceDebugAssistant.js` | Voice recording UI with iOS compatibility |
| Admin Integration | `/pages/Admin.js` | Floating button and modal |

### API Endpoints:
- `POST /api/admin/voice-debug/transcribe` - Transcribe audio only
- `POST /api/admin/voice-debug/analyze` - Transcribe + AI analysis
- `GET /api/admin/voice-debug/reports` - Get all debug reports

### Requirements:
- Admin or Manager role required
- Microphone access
- EMERGENT_LLM_KEY for OpenAI Whisper

---

## Feature: Dark Mode Toggle 🌙☀️

### Description:
Toggle between Light (Cyan/Turquoise) and Dark (Obsidian Black) themes.

### How it works:
1. Click Sun/Moon icon in Navbar
2. Theme instantly switches
3. Preference saved to localStorage

### Color Palettes:
| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | #ECFEFF → #CFFAFE | #050509 |
| Cards | #FFFFFF | #181824 |
| Text Primary | #1F2937 | #F8FAFC |
| Accent | #F59E0B | #F59E0B |

---

## All Features Summary

### Gamification ✅
Achievements, Levels, Daily Quests, Battle Pass, Lucky Wheel, Streak Protection

### Monetization ✅
Stripe Payments, Bid Packages, VIP Subscription, Gift Cards, Crypto Payments

### Social ✅
Friend Battle, Team Auctions, Referrals, Leaderboard, Winner Gallery

### AI & Personalization ✅
AI Bid Recommendations, Deal Radar, Price Alerts, Wishlist

### Admin Tools ✅
- Dashboard with stats
- User management
- Bot management
- Voice Debug Assistant (NEW!)
- AI Chat Assistant

---

## Test Credentials
- **Admin:** admin@bidblitz.de / Admin123!
- **Manager:** manager.prishtina@bidblitz.de / Manager123!

## Mocked Services
| Service | Status | Required |
|---------|--------|----------|
| WhatsApp | MOCKED | API Token |
| Twilio SMS | MOCKED | Credentials |
| Apple Login | MOCKED | Dev Credentials |
| Tawk.to Live Chat | MOCKED | Property ID |
| Resend Email | MOCKED | Working API Key |

---

## Files Created/Modified This Session

### New Files:
- `/backend/routers/voice_debug.py` - Voice debug backend with MongoDB persistence
- `/frontend/src/components/VoiceDebugAssistant.js` - Voice debug UI (iOS/Safari kompatibel)
- `/frontend/src/context/ThemeContext.js` - Dark mode context

### Modified Files:
- `/backend/server.py` - Added voice_debug_router
- `/frontend/src/App.js` - Added ThemeProvider
- `/frontend/src/components/Navbar.js` - Added Dark Mode toggle
- `/frontend/src/pages/Admin.js` - Added Voice Debug button
- `/frontend/src/index.css` - CSS variables + dark mode overrides
- `/frontend/src/pages/Notifications.js` - Fixed to light theme
- `/frontend/src/pages/Invoices.js` - Fixed to light theme
- `/frontend/src/pages/*.js` - Improved bidding error messages (401/403 handling)
- `~70 pages` - Light theme styling

---

## Debug Reports API & Dashboard (NEW)
Debug reports are now saved to MongoDB and viewable in Admin Panel:

### API Endpoints:
- `GET /api/admin/voice-debug/reports` - List all reports
- `PATCH /api/admin/voice-debug/reports/{id}/status` - Update status
- `DELETE /api/admin/voice-debug/reports/{id}` - Delete report

### Admin Dashboard Features:
- **Stats Cards:** Visual counters by severity (Low/Medium/High/Critical)
- **Filtering:** Filter by severity and status
- **Report Details:** Expandable cards showing transcription, causes, files, recommendations
- **Status Management:** Change status (Pending → In Progress → Resolved → Won't Fix)
- **Delete Function:** Remove old reports

### Files:
- `/frontend/src/components/admin/AdminDebugReports.js` - Dashboard component
- `/backend/routers/voice_debug.py` - API with MongoDB persistence

---

## NEW FEATURES (February 6, 2026)

### 1. User Statistics Dashboard (`/my-stats`)
Complete gamification and statistics page:
- **Stats Cards:** Wins, Bids placed, Savings, Win rate
- **Savings Overview:** Retail value vs. paid with % saved
- **Streaks & Loyalty:** Login streak, max streak, loyalty points, level
- **Recent Activity:** Last 30 days bids and wins
- **Achievements Tab:** 12+ achievements with unlock status
- **Leaderboard Tab:** Weekly rankings

### 2. Daily Rewards System
- Claim daily free bids (2 base + up to 7 streak bonus)
- Milestone bonuses: 7-day (+10), 14-day (+20), 30-day (+50), 60-day (+100), 90-day (+200)
- XP rewards increasing with streak
- API: `GET/POST /api/user-stats/daily-reward-status`, `/claim-daily-reward`

### 3. Leaderboard System
- Weekly/Monthly/All-time rankings
- By wins and by XP
- API: `GET /api/user-stats/leaderboard`

### 4. Celebration Components
- `WinCelebration`: Confetti animation for auction wins
- `NewAchievementToast`: Toast when unlocking achievements
- `DailyRewardPopup`: Reminder to claim daily rewards

### 5. Rate Limiting (Security)
- Slowapi integration for API protection
- Prevents abuse and bot attacks

### 6. PWA Updates
- Updated theme colors for light mode
- New shortcuts including My Stats

---

## Last Updated
February 6, 2026

## Completed Features
1. ✅ Voice Debug Assistant iOS/Safari kompatibel
2. ✅ Debug Reports in MongoDB speichern + Dashboard
3. ✅ Verbesserte Bidding-Fehlermeldungen
4. ✅ Theme-Konsistenz (Notifications, Invoices)
5. ✅ User Statistics Dashboard
6. ✅ Daily Rewards System
7. ✅ Achievements System
8. ✅ Leaderboard System
9. ✅ Celebration Animations
10. ✅ Rate Limiting

## Next Steps
1. 🔶 Remaining theme fixes (Contact, FAQ, HowItWorks, VIP pages)
2. 🔶 Activate WhatsApp/SMS notifications (API keys required)
3. 🔶 Implement Apple Sign-In (credentials required)
4. 🔶 Admin.js refactoring (>1200 lines)
