# BidBlitz Staff — UI/UX System

> **Single Source of Truth** für alles UI im Staff-Modul.
> Keine eigenen Card/Button-Styles mehr pro Seite. Mobile-First. Light-Theme. Premium-Look.

## Struktur

```
src/staff/
├── tokens.js              # Farben, Spacings, Schrift, Radius, Shadows, Button-Größen
├── components.jsx         # 9 wiederverwendbare Staff-Komponenten
├── useResponsiveGuard.js  # Hook für isMobile/isTablet/isDesktop
├── eslint-rules.js        # Linting-Regeln (warn bei hardcoded Hex, Mini-Schrift, etc.)
├── StaffUIAuditPage.jsx   # Live-DOM-Scanner unter /staff/ui-audit
└── README.md              # diese Datei
```

## Tokens

```javascript
import tokens, { COLORS, BUTTON_SIZE, STATUS_COLORS, MOBILE_RULES } from "../staff/tokens";

// Statt:  className="bg-[#00C2FF] text-[10px]"  ❌
// Lieber:  <StaffCard><StaffStatusBadge status="working" /></StaffCard>  ✅
```

## Komponenten

| Komponente | Beschreibung | Wo verwenden? |
|---|---|---|
| `StaffCard` | Basis-Container mit Light-BG + shadow-sm + rounded-2xl | Alle Content-Gruppen |
| `StaffButton` | 5 Varianten (primary/secondary/success/danger/warning/ghost/outline), 5 Größen (xs→xl) | Alle Buttons |
| `StaffKpiCard` | KPI-Card mit Icon + 3xl-Zahl + Label + Sub | Dashboard-KPIs |
| `StaffStatusBadge` | Pill mit semantischer Farbe (working/break/off/pending/...) | Statusanzeigen |
| `StaffPageHeader` | Sticky Header mit Back-Button + Titel + Aktionen | Jede Seite |
| `StaffBottomNav` | **Erzwingt max. 4 Items** | Mobile-Nav |
| `StaffEmptyState` | Empty-Placeholder mit Icon + Titel + CTA | Leere Listen |
| `StaffListItem` | Listen-Zeile mit Avatar + Title + Subtitle + Badge | Listen |
| `StaffActionButton` | Großer farbiger Action-Button mit Icon + Subtitle | Hero-Actions |
| `StaffSegmented` | Pill-Segmented-Control | Tab-Switches |

## Mobile Rules (enforced)

| Regel | Wert | Wo geprüft |
|---|---|---|
| Min Button-Höhe | 44px | UI-Audit-Page + StaffButton size="sm" → h-10 |
| Primary Mobile Button | 56px | StaffButton size="lg" → h-14 |
| Max Bottom-Nav Items | 4 | StaffBottomNav warnt + kürzt automatisch |
| Max Parent-Tabs | 4 | StaffSegmented warnt |
| Min Schrift | 11px | UI-Audit zählt Verstöße |
| Keine Tabellen auf <768px | enforced | UI-Audit flaggt jedes `<table>` als HIGH |
| Keine Neon-Farben | enforced | UI-Audit + ESLint-Pattern |

## UI-Audit live nutzen

1. Login als Admin/Merchant (`admin@bidblitz.ae` / `BidBlitz2026!`)
2. Browse zur Seite die du checken willst (z.B. `/merchant/staff`)
3. Öffne in neuem Tab: `/staff/ui-audit`
4. Klick "Erneut Scannen"
5. Score ablesen + Issues fixen
6. Wiederholen bis Score >= 90

## Pre-Commit Lint

```bash
cd /app/frontend
node src/staff/eslint-rules.js
# Exit code = 0 wenn keine Errors
# Exit code = 1 wenn mindestens 1 error-Rule getriggert
```

## Verbotene Patterns

```javascript
// ❌ NIEMALS:
className="bg-[#00C2FF] text-[#A855F7]"      // Legacy Neon
className="text-[10px]"                       // Mini-Schrift
className="bg-white border border-slate-200"  // Eigene Card-Styles
style={{ color: "#ff0000" }}                  // Inline-Color

// ✅ STATT DESSEN:
<StaffCard>
  <p className="text-xs text-slate-500">…</p>
  <StaffStatusBadge status="working" />
</StaffCard>
```

## Migration Checkliste (für bestehende Komponenten)

- [ ] `bg-[#0A0A0A]` → `bg-slate-50`
- [ ] `text-white/40` → `text-slate-500`
- [ ] `bg-white/[0.02] border-white/[0.08]` → `StaffCard`
- [ ] `border-b-2 border-[#00C2FF]` → `StaffSegmented`
- [ ] Eigene Tab-Bars → `StaffSegmented` mit `current/onChange`
- [ ] `<button className="px-3 py-1.5 bg-[#00C2FF]...">` → `<StaffButton variant="primary" size="md">`
- [ ] Empty-States → `<StaffEmptyState>`

## Roadmap

- [x] Tokens + Components + Audit-Page
- [x] ESLint-Rules (Pattern-basiert, CLI-Runner)
- [ ] Vollständige Migration aller Staff-Seiten zu Components (langfristig)
- [ ] Automatisches Pre-Commit-Hook via husky
- [ ] Visuelle Regression-Tests (Playwright snapshots)
