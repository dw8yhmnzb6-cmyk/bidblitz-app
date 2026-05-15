# BidBlitz Staff — Ehrliche Konkurrenz-Analyse (Mai 2026)

Vergleich gegen: **Connecteam · Crewmeister · Papershift · Clockify · Jibble**

Stand der Daten: 30 Backend-Routen-Module, ~7.900 LOC Backend, 10 Frontend Staff-Seiten. Light-Theme Mobile-Portal + Terminal-Kiosk neu (iter111-112).

---

## 1. WAS HABEN DIE? — Feature-Gap-Tabelle

### Legende: ✅ vorhanden · 🟡 teilweise · ❌ fehlt

| Bereich | BidBlitz | Connecteam | Crewmeister | Papershift | Clockify | Jibble |
|---|---|---|---|---|---|---|
| **Mobile App nativ** | 🟡 PWA + Capacitor-Guide | ✅ iOS+Android | ✅ | ✅ | ✅ | ✅ |
| **Kiosk/Terminal** | ✅ (PIN+NFC, NEU) | ✅ | ✅ | ✅ | ✅ Selfie+Face | ✅ Face-Recognition |
| **GPS-Stempeln** | ✅ + Geofence | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Offline-Modus** | 🟡 nur Download-Snapshot | ✅ vollständig | ✅ | ✅ | ✅ | ✅ |
| **Push-Notifications** | ✅ VAPID | ✅ + Chat-Push | ✅ | ✅ | ✅ | ✅ |
| **Schichtplan** | 🟡 Schichten anlegen | ✅ Drag&Drop, Auto-Plan | ✅ + Wunschplan | ✅ Auto-Plan, Open-Shifts | ❌ | 🟡 |
| **Schicht-Tausch** | ❌ | ✅ Marketplace | ✅ | ✅ | ❌ | ❌ |
| **Verfügbarkeiten** | ❌ | ✅ wöchentlich | ✅ | ✅ | ❌ | ❌ |
| **Open-Shifts (Bewerben)** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Urlaubsanträge** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Krankmeldung mit Beleg-Upload** | 🟡 (Antrag, kein Upload) | ✅ | ✅ | ✅ | ❌ | 🟡 |
| **Aufgaben/Tasks** | ✅ staff_tasks | ✅ Checklisten + Forms | 🟡 | 🟡 | ❌ | ❌ |
| **Checklists / Formulare** | ✅ Templates | ✅ Best-in-class | 🟡 | 🟡 | ❌ | ❌ |
| **Digitale Unterschriften** | ❌ | ✅ | ✅ Dokumente | 🟡 | ❌ | ❌ |
| **In-App Chat (Mitarbeiter)** | ❌ | ✅✅ Killer-Feature | 🟡 | ❌ | ❌ | ❌ |
| **Broadcast/Announcements** | 🟡 Admin-Push, nicht Staff-only | ✅ | ✅ | 🟡 | ❌ | ❌ |
| **Knowledge-Base/Trainings** | ✅ staff_knowledge + training | ✅ Kurse + Quizzes | ❌ | ❌ | ❌ | ❌ |
| **DATEV-Export** | ✅ datev-placeholder | ✅ echte DATEV-ASCII | ✅✅ Branchenführer | ✅✅ | 🟡 nur CSV | 🟡 |
| **Lohn-Vorlauf (Payroll)** | 🟡 PDF-Reports | ✅ + ADP/Gusto-API | ✅ | ✅ + Lexware/Sage | ❌ | ❌ |
| **Überstunden-Regeln** | 🟡 basic | ✅ Custom-Rules | ✅ | ✅✅ | 🟡 | ✅ |
| **Auto-Pause-Abzug** | 🟡 hardcoded | ✅ konfigurierbar | ✅ | ✅ | ✅ | ✅ |
| **Zuschläge (Nacht/SF)** | ❌ | ✅ | ✅ | ✅✅ | ❌ | 🟡 |
| **Multi-Standort** | ✅ staff_locations | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Franchise / Multi-Mandant** | ✅ staff_multi_merchant | ✅ Enterprise | 🟡 | ✅ Konzern-Modul | 🟡 | 🟡 |
| **Rollen/Rechte (RBAC)** | ✅ staff_roles | ✅ feingranular | ✅ | ✅ | 🟡 | 🟡 |
| **Stundenkonto/Saldo** | 🟡 net_hours | ✅ Konto | ✅ visuell | ✅✅ | ✅ | ✅ |
| **Reports (Manager)** | ✅ summary+hours | ✅ + Custom-Reports | ✅ | ✅ | ✅✅ Pivot | ✅ |
| **Echtzeit-Anwesenheit** | 🟡 statusByMember | ✅ Live-Map | ✅ | ✅ | ✅ | ✅ |
| **Mitarbeiter-Dokumente** | 🟡 staff_connect/onboard | ✅ Vault + Ablauf-Alarme | ✅ | ✅ | ❌ | ❌ |
| **Onboarding-Workflow** | ✅ staff_invites + connect | ✅ + Begrüßungsfluss | 🟡 | 🟡 | ❌ | ❌ |
| **Warnungen/Disziplin** | ✅ staff_warnings | 🟡 | ❌ | ❌ | ❌ | ❌ |
| **Lohnabrechnung-Anzeige** | ❌ | ✅ Payslip-Anzeige | ✅ | ✅ | ❌ | ❌ |
| **Trinkgeld-Tracking** | ✅✅ (USP) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Wallet/Auszahlung On-Demand** | ✅✅ (USP) | ❌ Earnedwage extern | ❌ | ❌ | ❌ | ❌ |
| **API/Webhooks** | 🟡 | ✅ | ✅ | ✅ Zapier | ✅ Public-API | ✅ |

**Quintessenz:** Wir haben mehr Backend-Surface als Crewmeister oder Jibble, aber:
- ❌ Kein In-App Chat (Connecteams größter Pull-Faktor)
- ❌ Kein Schicht-Tausch / Open-Shifts (Industry-Standard 2024+)
- ❌ Keine Verfügbarkeits-Kalender
- 🟡 Offline-Modus nur als Daten-Snapshot, kein echter Sync mit Queue
- 🟡 DATEV-Export ist Placeholder, kein echtes ASCII-DATEV-Format

---

## 2. UX-PROBLEME — schonungslos

### Mobile Mitarbeiter-App (`/staff/portal`)
**Status:** Nach iter111-Redesign — Top 30 % im Markt. Light-Theme + Live-Timer + Tabs sind sauber.

| Problem | Schwere | Beispiel |
|---|---|---|
| Kein "Hallo, was muss ich heute tun?" Mid-Day-Briefing | Mittel | Connecteam zeigt automatisch heutige Aufgaben + Schichtstart |
| Anträge-Tab leer-Zustand zu trist | Niedrig | Crewmeister zeigt Resturlaub als Hero-Number |
| Kein Quick-Action "Pause beenden" als FAB | Mittel | User muss erst Home öffnen |
| Profil-Tab zeigt keine Lohn-Vorschau | Mittel | Connecteam: aktuelle Periode + Lohn-Schätzung |
| Notifications sind nur Bell-Icon ohne Liste | Hoch | Klick → keine Detail-Page |

### Terminal/Kiosk (`/staff/terminal`)
**Status:** Nach iter112-Redesign — sehr gut für PIN-Flow. Aber:

| Problem | Schwere | Beispiel |
|---|---|---|
| Keine Foto-Verifikation beim PIN-Eincheck (Buddy-Punching!) | **Hoch** | Jibble/Clockify: Selfie-Pflicht, Face-Match |
| Backend-Endpoint `/api/staff/auth/terminal-pin` fehlt noch | **Hoch (Blocker)** | Frontend ruft 404 |
| Keine Mehrsprachigkeit im Kiosk-Modus | Mittel | Häuser mit ausländischen Aushilfen leiden |
| Kein "Aufgaben anschauen" Button im Menu (war im Mockup!) | Mittel | Mitarbeiter sieht heutige Tasks erst in Mobile-App |
| Success-Screen verschwindet nach 2.2s — zu schnell für Geste-Bestätigung | Niedrig | Connecteam: 4s + Sound |

### Manager Dashboard (`/merchant/staff`)
**Status:** Aktuell überladen. 8 Tabs (Übersicht / Mitarbeiter / Zeiterfassung / Timesheet / Schichtplan / Schedule-Editor / Knowledge / Urlaub-Krank / Reports).

| Problem | Schwere | Beispiel |
|---|---|---|
| **8 Tabs** sind zu viele (Industry-Standard: 4-5) | **Hoch** | Crewmeister: 4 Tabs (Heute, Plan, Stunden, Mitarbeiter) |
| Übersicht-Tab kein Live-Status-Map | Hoch | Connecteam: Karte mit Pins für GPS-eingecheckte Mitarbeiter |
| Doppelte Zeiterfassung + Timesheet Tabs verwirren | Mittel | Konsolidieren auf 1 Tab mit Switch |
| Reports versteckt im 8. Tab | Mittel | Sollte Quick-Access auf Übersicht sein |
| Keine "Heute zu genehmigen" Inbox auf Übersicht | Hoch | Papershift: Banner mit offenen Genehmigungen |

### Analytics Bereich
**Status:** Backend (`staff_analytics`) hat 7 Endpoints, Frontend zeigt 2 davon.

| Problem | Schwere |
|---|---|
| Kein Custom-Date-Range-Picker | Mittel |
| Heatmap (Endpoint existiert!) nicht im UI | Hoch |
| Costs-by-Location nicht im UI | Hoch |
| Kein Export-Knopf auf Analytics-Tab | Mittel |

---

## 3. KONKURRENZ-DEEP-DIVE

### Connecteam — Mobile UX Champion
- **Chat ist alles**: Mitarbeiter chatten in der App, schicken Fotos, Locations, machen Calls. **Bei uns 100 % fehlend.**
- **Forms-Builder**: Manager bauen eigene Formulare per Drag&Drop (z.B. "Tagesabschluss-Check", "Schaden-Meldung mit Foto"). Wir haben staff_checklists Templates — aber **kein UI-Builder**.
- **Knowledge-Base mit Quiz**: Mitarbeiter lesen Schulungen → machen Quiz → Manager sieht Pass/Fail. Wir haben `staff_training` Backend, **UI ist Placeholder**.
- **Job-Scheduler**: Wiederkehrende Tasks (täglich/wöchentlich Reinigung). Wir haben Tasks, aber **keine Recurrence-Rules**.

### Crewmeister — Einfachheit
- **3-Tap-Eincheck**: App auf → grüner Button → eingecheckt. Wir: Login → Portal → Home → grüner Button = **4 Taps**.
- **Stundenkonto sichtbar**: Mitarbeiter sieht "+12,5h Plus" oder "-3h Minus" sofort. Wir zeigen nur Wochenstunden.
- **Wunschplan-Feature**: Mitarbeiter trägt Verfügbarkeit ein → Manager plant darauf basierend. Wir: ❌

### Papershift — Schichtplanung König
- **Open-Shifts-Pool**: Manager veröffentlicht Schicht → Mitarbeiter bewerben sich → Manager wählt. **Game-Changer bei uns: ❌**
- **Auto-Schichtplan**: KI generiert Wochenplan basierend auf Verfügbarkeit + Qualifikation + Lohnkosten. **❌**
- **Zuschlagsregeln**: 25 % Nachtzuschlag automatisch, Sonn-/Feiertag, Bereitschaft. **❌ Bei uns nicht**

### Clockify — Geschwindigkeit
- **Globale Tastenkombo zum Stempeln** (Desktop): Strg+Alt+Space → Timer läuft. Wir: nur App.
- **Pomodoro-Timer + Project-Tagging**: Zeit pro Projekt/Kunde. Wir: nur "Schicht", keine Projekt-Differenzierung.
- **API-First**: 100 % der App auch via REST nutzbar. Wir: 90 % der Endpoints existieren, aber **keine Public-API-Docs**.

### Jibble — Face-Recognition
- **Selfie-Pflicht** beim Eincheck → ML matched gegen Mitarbeiter-Foto. Verhindert Buddy-Punching. **Bei uns: ❌**
- **Live-Dashboard**: Manager sieht Echtzeit-Karte mit allen GPS-Positionen. Wir haben Endpoint `gps/staff-locations` aber **kein UI**.

---

## 4. KANN EIN ECHTER MITARBEITER OHNE ERKLÄRUNG STARTEN?

**Aktuelle Antwort: 70 %.**

Was funktioniert:
- ✅ Login + Eincheck-Flow ist seit iter111 selbsterklärend
- ✅ Big-Buttons + Live-Timer = sofort verständlich
- ✅ Bottom-Tab-Nav mit 4 klaren Tabs

Was scheitert:
- ❌ Wo finde ich meinen Schichtplan für nächste Woche? → Schichten-Tab zeigt nur kommende, **keine Wochenansicht**
- ❌ Wie tausche ich eine Schicht mit Kollegen? → **Feature fehlt komplett**
- ❌ Wie kontaktiere ich den Chef? → **Kein Chat, kein Direkt-Anruf-Button**
- ❌ Wo sehe ich meine Lohnabrechnung? → **Feature fehlt**
- ❌ Was wenn ich krank bin? → Anträge-Tab + "Krank" wählen — aber **kein Beleg-Upload**, kein Auto-Ping an Manager

---

## 5. SCREENS DIE ÜBERLADEN/ZU KOMPLIZIERT SIND

| Screen | Problem | Fix-Vorschlag |
|---|---|---|
| `/merchant/staff` Übersicht | 8 Tabs + viele Mini-Cards | Auf 4 Tabs reduzieren: Heute · Plan · Mitarbeiter · Reports |
| `StaffMobilePage` (alt) | Wird noch von `/staff/mobile` referenziert — Duplikat zu Portal | Löschen, umrouten auf `/staff/portal` |
| `StaffSettingsPage` | Wahrscheinlich Merchant-Settings — zu viele Optionen | In 3 Sub-Tabs: Allgemein / Lohnregeln / Standorte |
| `StaffSystemCheckPage` | Geek-Tool, kein Mitarbeiter-Wert | In Admin-Diag verschieben (`/admin/diag/staff-system`) |

---

## 6. TOP 20 — FEHLENDE FEATURES PRIORISIERT

### 🔴 P0 — vor Pilot
1. **Backend `/api/staff/auth/terminal-pin` Endpoint** (Terminal funktioniert nicht ohne!)
2. **Echtes DATEV-ASCII Export** (Steuerberater erwartet `EXTF`-Format, nicht JSON)
3. **In-App Chat** (1:1 Mitarbeiter ↔ Manager) — Connecteams Killer
4. **Schicht-Tausch / Open-Shifts** — Wettbewerbs-Minimum
5. **Verfügbarkeiten-Kalender** — Voraussetzung für Wunschplan
6. **Foto-Eincheck am Terminal** (Anti-Buddy-Punching)
7. **Krankmeldung mit Beleg-Upload** (PDF/Foto-Attach)
8. **Stundenkonto-Saldo** sichtbar für Mitarbeiter
9. **Tasks: Recurrence-Rules** (täglich/wöchentlich)
10. **Manager Live-Map** mit GPS-Pins (Endpoint da, UI fehlt)

### 🟡 P1 — 30 Tage nach Pilot
11. **Zuschlagsregeln** (Nacht 25 %, Sonn-/Feiertag 50 %)
12. **Auto-Schichtplan-Generator** (basierend auf Verfügbarkeit)
13. **Forms-Builder** (Drag&Drop für Manager)
14. **Training-Module mit Quiz** (Backend da, UI fehlt)
15. **Lohnabrechnungs-Anzeige** für Mitarbeiter
16. **Custom-Reports + Pivot** (Wochenstunden × Standort × Mitarbeiter)
17. **Heatmap-UI** (Endpoint da)
18. **Dokumenten-Vault** mit Ablauf-Alarmen (Führerschein, Gesundheitszeugnis)
19. **Public-API + Webhooks** (Zapier-Style)
20. **Mehrsprachigkeit Terminal** (mind. DE/EN/TR/AR)

### 🟢 P2 — später
- Face-Recognition (DSGVO-Aufwand)
- Pomodoro/Projekt-Tagging
- Earned-Wage-Access B2B (separate Produktstrategie)
- Manager-Mobile-App (separate Tablet-UI)
- Sound-Cues auf Terminal-Success

---

## 7. UNSERE VORTEILE — wo wir die Konkurrenz schlagen

### 🚀 USPs (keiner der 5 hat das)
1. **Integriertes Wallet** — Mitarbeiter sieht Trinkgeld + Bonus + Lohn-Anteil in einer App. Kein zusätzliches Earnedwage-Tool nötig.
2. **Trinkgeld-Tracking pro Schicht** — Verteilung digital. Connecteam/Crewmeister: 0 %.
3. **QR-Pay zum Mitarbeiter** — Direkter Cash-Tip von Kunde → Mitarbeiter-Wallet. Einzigartig.
4. **Marketplace-Anbindung** — Mitarbeiter können in derselben App einkaufen / Auktionen mitmachen → Lohn → Konsum geschlossener Kreis (Plattform-Stickiness)
5. **Multi-Branchen-Bundles** (Eiscafé, Restaurant, Friseur, Hotel) — Konkurrenz ist "one-size-fits-all"
6. **NFC-Tagging** out-of-the-box ohne Hardware-Lock-in (Connecteam: nur eigene Reader)
7. **Multi-Mandant (`staff_multi_merchant`)** — Mitarbeiter arbeitet bei 2 Restaurants → eine App. Connecteam: separater Account pro Arbeitgeber.

### 💡 Argumentations-Linie für Vertrieb
> "Bei Connecteam zahlt der Mitarbeiter Trinkgeld-Steuer und sieht trotzdem nichts davon in der App. Bei uns ist Trinkgeld + Lohn + Bonus + Auszahlung in einer App. Der Mitarbeiter ist glücklicher, der Chef hat weniger Fluktuation."

---

## 8. RISIKEN

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Buddy-Punching am Terminal (Mitarbeiter A stempelt für B) | Hoch | Hoch | Foto-Pflicht (P0) |
| Steuerberater lehnt DATEV-Placeholder ab | Hoch | Hoch | Echtes ASCII-Format (P0) |
| Mitarbeiter verlangt Chat → wechselt nach Connecteam | Mittel | Hoch | Chat-MVP (P0) |
| Schichten manuell anlegen ist zu zeitaufwendig | Hoch | Mittel | Auto-Plan (P1) |
| GDPR-Klagen wegen GPS-Tracking ohne Opt-out | Mittel | Sehr Hoch | Opt-out + Geofence-Visualisierung sichtbar |
| 8-Tab Manager-Dashboard wirkt unprofessionell im Sales-Pitch | Hoch | Mittel | Konsolidierung auf 4 Tabs (P0) |

---

## 9. FINAL — was VOR dem echten Launch passieren muss

### 🔴 BLOCKER (3-7 Tage Arbeit)
1. **Backend `/api/staff/auth/terminal-pin`** Endpoint live (1 Tag)
2. **Echtes DATEV-ASCII-Format** (2 Tage)
3. **Manager-Dashboard auf 4 Tabs reduzieren** (1 Tag)
4. **Manager Live-Map UI** (2 Tage — Endpoint existiert)
5. **Foto-Eincheck am Terminal** (Browser-Camera-API + Compare via Backend; 2 Tage)

### 🟠 MUST-HAVE für glaubwürdiges Pilot-Sales-Pitch
6. **In-App Chat MVP** (3-5 Tage; WebSocket existiert für Auctions)
7. **Schicht-Tausch (Open-Shifts)** (3 Tage)
8. **Verfügbarkeits-Kalender** (2 Tage)
9. **Krankmeldung mit Beleg-Upload** (1 Tag)
10. **Stundenkonto-Saldo** auf Mitarbeiter-Home (4h)

### 🟢 NICE-TO-HAVE für Differenzierung
11. **Lohnabrechnungs-Anzeige** + Trinkgeld-Aggregation = USP-Hebel maximieren

---

## ZUSAMMENFASSUNG

**Stärken:** Massive Feature-Surface (30 Backend-Module), Wallet/Tip/QR sind echte USPs, neue Mobile + Terminal UIs (iter111-112) sind im oberen Drittel des Marktes.

**Schwächen:**
1. **Kein Chat** = Connecteams größtes Verkaufsargument
2. **Kein Schicht-Tausch** = jeder Wettbewerber hat es
3. **Manager-Dashboard 8 Tabs** = überladen
4. **DATEV nur Placeholder** = Steuerberater stutzig
5. **Terminal ohne Foto** = Buddy-Punching offen

**Gesamtnote ehrlich: 7,2 / 10** — Funktionsreich aber 5 kritische Lücken vor Pilot-Launch.

**Time-to-Launch geschätzt: 3-4 Wochen Fokus-Arbeit** auf P0+MUST-HAVE.
