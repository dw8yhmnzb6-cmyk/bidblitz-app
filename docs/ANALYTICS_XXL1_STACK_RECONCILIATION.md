# XXL-Paket 1: Bestand und Zusammenführung (12.10.2026)

## Verifizierter Ist-Zustand
- BidBlitz Stack DEV-Repositories lokal erreichbar über bestehenden Remote-Agenten; Branch `work/stack-mcp-central-sso-integration-v1` bei letzter Prüfung `82b8a08`, zwei Commits hinter `origin`. Keine Änderung an diesem Worktree vorgenommen.
- Stack hat `apps/api/forgejo_client.py`, `code_routes.py`, `code_link_routes.py`, Backup-Adapter und Tests. Bereits vorhandene Forgejo-Integration **nicht erneut installieren**.
- Dokumentierter Forgejo-Server-Backup-Test vom 03.10.2026: 2 Repositories, Verify/Restore/Git-FSCK bestanden; dies ist **kein aktueller Server-Healthcheck**.
- BidBlitz-App besitzt `backend/routes/analytics.py` (alter `/track`-Endpoint, Mongo-Collections) und `frontend/src/services/tracker.js` (Alttracker). Gemeinsam geplanter Opt-in-Vertrag liegt in `frontend/src/lib/bidblitzAnalytics.js`. Die Formate sind inkompatibel, Anpassung nötig.
- Vorbereitete Testmodule: `frontend/src/services/tracker.test.js`, `frontend/src/lib/bidblitzAnalytics.test.js`, `backend/tests/test_analytics_event_schema.py`, `backend/tests/test_analytics_reporting.py`. Erstellung ist noch kein Nachweis eines erfolgreichen Testlaufs.
- Weitere Backend-Bausteine: `backend/core/analytics_event_schema.py`, `backend/core/analytics_reporting.py` (Pure Function, noch nicht an API/DB angebunden).

## Konkrete Entscheidung
1. Stack bleibt zentrale Control Plane und vorhandenes Forgejo potenzieller Code-Host; keine zweite Stack-App oder Forgejo-Instanz.
2. BidBlitz-App bleibt das Quellprojekt der **bestehenden** Analytics-Erfassung; Stack zeigt die zentralen Daten über autorisierte APIs. Datenhaltung physisch nur auf freigegebenen eigenen Servern.
3. Projekttrennung und Berechtigungen serverseitig erzwingen; keine unbegrenzten Cross-Project-Identitätsprofile.
4. GitHub als aktuelles Quell-Repo **nicht abschalten oder löschen**, bis Forgejo-Aktualität, Push/Fetch, Branch-Vollständigkeit, Backup und Rollback nachgewiesen sind.
5. Keine Produktionseingriffe, keine API-Routen automatisch schalten, keine Kundendaten anfassen.

## Blocker/Gates mit Nachweispflicht
- [ ] Forgejo-Health auf tatsächlichem Stack-Server read-only prüfen (Mac-Docker-Status sagt nichts über Server-Container).
- [ ] Exakte Repositories und Heads in Forgejo vs. GitHub read-only vergleichen.
- [ ] Legacy Tracker: Cookie-Consent-Widerruf, Event-Limits und alte Sessions in Tests überprüfen.
- [ ] Neue Backend-Schemas gegen reale Pydantic-Version prüfen und Tests ausführen.
- [ ] API-Adapter und sichere, project-scoped Datenaggregation implementieren; Rollenrechte und Datenminimierung testen.
- [ ] Dashboard Staging-Integration und Synthetikdaten, danach Datenschutz-/Security Review.

## Sicherheitsrisiken im Legacy-Code
Alte `POST /api/analytics/track`-Routine speichert IP, Nutzer-ID und ungeprüfte `meta`-Felder. Änderungen der Datenaufbewahrung und rechtlicher Grundlage müssen vor Live-Tracking entschieden werden. Browserereignisse sind kein verifizierter Zahlungsumsatz.

## Nächste Entwicklerarbeiten
A) Stack DEV-Forgejo read-only Serverzustand verifizieren. B) Frontend-Tracker/Backend-V1 auf **einen** geprüften Vertrag konsolidieren. C) isolierte Tests und Integrationschecks. D) RBAC-Dashboard. E) Rolloutplanung je Projekt.
