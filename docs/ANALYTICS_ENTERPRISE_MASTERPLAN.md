# BidBlitz Analytics Enterprise — vollständiger Implementierungsplan
Stand: 2026-10-12 · Branch: `feat/shared-analytics-contract-20261012` · Status: Entwurf / KEINE Produktionsfreigabe

## 0. Bestand und Risiko
- `backend/routes/analytics.py` stellt Growth-, Retention-, Campaign- und Conversion-Endpunkte bereit.
- `POST /api/analytics/track` akzeptiert nur bisherige `VALID_EVENTS`, jedoch freies `meta`, speichert derzeit `ip`, `session_id` und bei Login `user_id`. Vor erweiterten Events: Datenminimierung, Rechtsgrundlage, Löschkonzept, Rate Limits, Abuse-Schutz.
- `frontend/src/services/tracker.js` sendet mit `sendBeacon` ohne unmittelbar sichtbares Analytics-Consent-Gate.
- `frontend/src/components/CookieBanner.jsx` speichert `analytics`-Einwilligung unter `bidblitz_cookie_consent_v1` und sendet `cookie-consent-changed`.
- `frontend/src/lib/bidblitzAnalytics.js` ist neuer, isolierter Opt-in-Entwurf, **nicht** kompatibel mit dem bisherigen `TrackEvent`-Schema. NICHT direkt an existierenden Endpoint hängen. Adapter erst nach API-Tests.
- Bestehende `conversion_events` und `conversion_metrics` nutzen; keine zweite Paralleldatenbank oder neues Hauptprojekt aufbauen.
- Repo-README behauptet zusätzliche Routen: ausschließlich tatsächliche Implementierung ist maßgeblich.

## 1. Architektur
**BidBlitz Stack Admin** = zentrale, rollenbasierte Übersicht; jedes Produkt erhält eine projektgefilterte Ansicht. Jedes Projekt verschickt nur standardisierte, geprüfte Events an einen autorisierten first-party Collect-Dienst. Alle Projekte teilen dieselben Event-Versionen und KPI-Definitionen, aber behalten strikte Daten-/Rollen-Trennung.

Pipeline: Consent/CMP → Client Adapter → First-party Collector (Schema- und Projektprüfung, Deduplizierung, Rate-Limit) → vorhandener Analytics-Store / Aggregationen → RBAC APIs → Dashboard + Berichte + Anomaliewarnungen. Zahlungsereignisse gehen separat vom bestätigten Backend/Provider ein, niemals aus vertrauenslosen Browser-Angaben als Umsatz.

Projekt-Slugs: `bidblitz_main`, `trade`, `eyes`, `power`, `verify`, `iptv`, `games`, `fuel`, `identity`, `stack`; weitere nur durch zentralen Projektkatalog.

## 2. Module, Fertig-Kriterien und Umsetzungsreihenfolge

### A. Besucher, Klicks, Conversion (P0)
- Events: `page_view`, `cta_click`, `signup_started`, `signup_completed`, `checkout_started`, `checkout_completed`, `flow_abandoned`.
- Definitionen: `page_views` = valide Seitenaufrufe, `sessions` = abgegrenzte Besuche, `unique_visitors` nur soweit datenschutzkonform messbar; Bot- und interner Traffic getrennt.
- Funnels je Projekt, Pfad, Zeitraum und Kampagne. Ein Segment ohne Zustimmung darf nicht heimlich identifiziert werden.
- Akzeptanz: datenschutzkonforme Messung, keine doppelten Events bei SPA-Routenwechsel, 7/30/90 Tage Filter, belastbare Testdatensätze, Kennzeichnung fehlender Daten.

### B. Heatmaps und Session Replay (P1 nach Datenschutzfreigabe)
- Optionales, standardmäßig deaktiviertes Modul; explizites Analytics-/Replay-Consent und dokumentierte Rechtsgrundlage.
- Strikte Maskierung aller Texteingaben, Wallets, Identitätsdaten, Fotos, Auth- und Zahlungsstrecken; sensible Routen vollständig ausschließen.
- Sampling, begrenzte Aufbewahrung, Rollenrechte, Widerruf und Löschpfad.
- Akzeptanz: Redaction-Tests mit Fake-Personendaten; kein Replay auf sensitiven Pfaden, keine Aufzeichnung ohne Opt-in.

### C. A/B-Tests und Feature Flags (P1)
- Deterministische Zuteilung, Kontrollgruppe, Exposition nur bei tatsächlichem Rendern, Guardrails: Error Rate, Payment Success, Performance.
- Segmentierung nur mit zulässigen Merkmalen; Rollback/Kill Switch zentral und pro Projekt; Auditlog.
- Akzeptanz: konsistente Zuteilung, kein Flicker, nachvollziehbarer Ergebnisbericht mit Stichprobengröße und Unsicherheit; Experimente stoppen sich nicht autonom aufgrund zufälliger Schwankung.

### D. KI-Analyse und Fehlerroboter (P1)
- Datenquelle: technische Logs, Web-Vitals, Fehlerereignisse und aggregierte Funnels (keine sensiblen Replay-Daten in KI).
- Baselines, Anomaliealarme und deduplizierte Incidents, Ursachenhypothesen mit Evidenz, Prüfung offener Issues.
- Vorschläge / Staging-Fixes via PR; **kein automatisches Deployment, keine Live-Reparatur, keine Sicherheits- oder Zahlungsänderung ohne Review**.
- Akzeptanz: simulierte Ausfälle werden erkannt, falsche Alarme dokumentiert, jede Maßnahme revisionsfähig.

### E. Umsatz und Kundenbindung (P0)
- Server-seitig verifizierte Zahlung, Netto-/Brutto-Unterscheidung, Gebühren, Refund, Chargeback; mehrere Währungen mit gebuchtem Kursdatum.
- Retention-Kohorten, Aktivierung, Abwanderung, Wiederkauf, Revenue per Cohort; Stripe/Provider-Abgleich idempotent.
- Akzeptanz: Zahlungs-Summen stimmen mit buchbaren Transaktionen überein; keine Doppelzählung bei Webhook-Retry; Refunds korrigieren Reports.

### F. Projektübergreifende Kundenwege (P1)
- Verbundene Funnels nur mit erforderlicher Einwilligung/rechtlicher Grundlage; pseudonyme technische Schlüssel, kontextabhängige Identitätszuordnung.
- BidBlitz ID als Berechtigungs-/Identitätsanbieter, **nicht** als unbeschränktes Tracking-Backbone.
- Rollenbasierte Trennung: Projektadmins nur eigene Daten, Superadmin aggregierte Projektzahlen; kein Zugriff auf fremde Kundenprofile.
- Akzeptanz: Account-Wechsel/Logout/Opt-out trennen Identitäten, Cross-Project-Dedupe und Löschanforderungen testbar.

### G. Automatische Geschäftsberichte (P1)
- Täglich/wöchentlich/monatlich, KPI-Definition und Zeitraum / Zeitzone explizit; Vergleich zum Vorzeitraum, Trend, Maßnahmen, Datenabdeckung.
- Versand nur an autorisierte Empfänger, ohne Kundendaten im E-Mail-Bericht, Download mit RBAC.
- Akzeptanz: periodengerechte, reproduzierbare Zahlen, Reconcile auf Datenbasis, dokumentierte Fehler bei fehlenden Daten.

## 3. Datenvertrag V1 und API-Vorschlag (NICHT bereits implementiert)
Frontend minimal: `{schema_version:1, project, event, path, label?, occurred_at}`. Nur erlaubte Events und Labels, keine freien `meta`-Felder; `path` darf keine personenbezogenen IDs, Token oder Suchbegriffe enthalten (nur vordefinierte Routen-Templates). Der Server muss echte Zeit und legitime Projektzuordnung prüfen, nicht dem Browser vertrauen.
Vorgeschlagen: `POST /api/analytics/v1/events` als sichere Erweiterung neben `/track`; `GET /api/analytics/v1/projects/{project}/overview`; `GET /api/analytics/v1/projects/{project}/funnels`; `GET /api/analytics/v1/portfolio`. Vor Umsetzung Routen-Konflikte mit vorhandener API prüfen.
Ereignis-Erfassung und Aggregation getrennt; Zeit- und Dedupe-IDs serverseitig, anonymisierte Rohereignisse kurz und Aggregate länger speichern gemäß dokumentierter Retention. Consent-Widerruf stoppt neue Erfassung und initiiert erforderliche Löschung.

## 4. Admin-UI
`stack.bidblitz.ae/admin/analytics` (vorgesehener Pfad, noch nicht verfügbar): Portfolio KPIs, Projektfilter, Trend, Conversion-Funnel, Revenue-Reconciliation, Kohorten, Experimente, Anomalie-Zentrum, Exporte, Report Scheduler und Datenschutzstatus.
Jedes Projekt erhält integrierte Ansicht mit gleicher UI-Komponentenbibliothek. Alle Zahlen kennzeichnen Live/Delayed/Simulation, Datenabdeckung, Zeitraum und Metrikdefinition.
Keine Demowerte als reale Werte präsentieren.

## 5. Umsetzungspakete
1. **Bestands-Audit:** Tracker, Backend, CookieBanner, Sentry, Serverkonfiguration, bestehende DB/Reports; Diff und Risiken dokumentieren.
2. **Privacy & Tracking Contract:** Consent-Gate im Alttracker, Allowlist, Entfernung sensitiver Payloads, Eventversionierung, sichere Collector-API; Migration/Kompatibilität testen.
3. **KPI Engine + Revenue:** vorhandene Tabellen/Collections, sichere Indizes, Summenabgleich, Funnels/Kohorten.
4. **Dashboard + RBAC:** zentrale Portfolio-Ansicht und 9+ Projektviews, Multi-Tenant-Rechtetests.
5. **Heatmap/Replay + Experimente:** separate Opt-ins, Redaction, Kill Switch, statistische Guardrails.
6. **KI/Alerts + Reports:** Diagnose, Benachrichtigungen, geplante Auswertungen, Staging-PR-Workflow.
7. **Projektweise Integration + Freigabe:** BidBlitz Hauptapp Pilot, Trade/Eyes/Power/Verify/IPTV/Games/Fuel/ID/Stack schrittweise; Staging E2E, Privacy, Load, Resilience, Security, Backup/Restore, Release Gate.

## 6. Nicht-Ziele / Sperren
- Keine Echtgeld-Trade-Ausführung oder Änderung an MT5.
- Keine Fotos, biometrischen Daten, KYC-Inhalte, Passwörter, Kreditkarten- oder Wallet-Schlüssel in Analytics oder Replay.
- Keine ungeprüfte KI-Autoreparatur oder automatische Produktionsschaltung.
- Kein Merge in `main`, kein Server-/DNS-/Deployment-Eingriff durch diesen Plan.

## 7. Messbare Freigabekriterien
[ ] Contract, Adapter und Backend validieren dieselbe Eventversion
[ ] Consent opt-out, Änderung und Widerruf funktionieren an jedem Entry Point
[ ] Browser, API und DB speichern keine verbotenen Felder
[ ] RBAC verbietet fremde Projekte / nichtautorisierte Revenue-Exporte
[ ] Zahlungen sind serverbestätigt und nachweisbar idempotent
[ ] Replay-Maskierung und empfindliche Routen getestet
[ ] E2E-Funnels und Reports stimmen mit Test-Fixures überein
[ ] Tests, Build, Staging, Security Review, Datenschutzreview und Rollback geprüft
[ ] Erst danach explizite Produktionsfreigabe
