# The Eye by BidBlitz – geprüfter Entwicklungsstand

Stand: 4. Oktober 2026 (Europe/Belgrade).

## Identität und überprüfte Arbeitsgrundlage

- Bestehendes Repository: `dw8yhmnzb6-cmyk/bidblitz-app`.
- Bestehender Branch: `feature/the-eye-device-hub-v1`.
- Geprüfter Ausgangsstand: `e937bb2348c99542603211ab6cf460d17ea414b8` vom 1. Oktober 2026.
- Aktuelle Mac-Arbeitskopie: `/Users/bidblitz/Desktop/TheEye-Work2`.
- Vor Änderungen: Arbeitskopie sauber; nach Fetch 0 Commits voraus / 0 zurück gegenüber dem Remote-Branch.
- Ältere Kopie `/Users/bidblitz/Desktop/TheEye-Work`: `d5537ee6d1af23405b3b6201812f5da86d26509f`.
- Bestehende Backend-/Frontend-Architektur und Datenbank bleiben die Grundlage. Kein Production-Deploy und kein Merge nach main in diesem Arbeitslauf.

## Was im aktuellen Code vorhanden ist

Die Bestandsaufnahme ergibt **17 The-Eye-Routenmodule, 5 Kernmodule und 119 deklarierte API-/WebSocket-Endpunkte**. Das ist eine Code-Inventur, kein Nachweis, dass alle Funktionen mit echter Hardware oder in Production abgenommen sind.

| Bereich | Vorhandene Implementierung | Quelldateien unter backend/routes |
| --- | --- | --- |
| Geräte | Registrierung, gehashte Tokens, Heartbeats, GPS, Telemetrie, Gruppen, Befehle mit Zuständen/Bestätigung, Firmware-Angebot | the_eye_devices.py |
| Echtzeit | Angemeldeter WebSocket, Rollen-/Scope-Filter, Ereignisverteilung | the_eye_ws.py |
| Standorte und Suche | Standort-Hierarchie, Zuweisungen, Suche, Standortübersicht und Kartenabfragen | the_eye_locations.py, the_eye_search.py |
| Kameras | Kamera-Registry, Status-/Ereignis-API, geschützte Stream-Session-Vorbereitung | the_eye_cameras.py |
| Netzwerk | Knoten, Ports, Health-Meldungen, Standort-Gesundheit und Ursachenbewertung | the_eye_network.py |
| Vorfälle | Erstellung, Standort-Korrelation, Zusammenfassung und zulässige Statusübergänge | the_eye_incidents.py |
| Aufgaben und Tickets | Action Center, Tickets, Zuweisungen, Technikeransicht und Zusammenfassungen | the_eye_actions.py |
| Wartung und Lager | Inventar, Bestandskorrekturen, Arbeitsaufträge, Teile reservieren/verbrauchen, unabhängige Validierung, RMA | the_eye_maintenance.py |
| Datenqualität | Quellen, Heartbeats, Datenprobleme, Auflösung, Übersicht und Bewertung je Objekt | the_eye_data_quality.py |
| Anbieter | Provider-Registry, Health, Fallback-Zuordnung, Abhängigkeiten und Risikoübersicht | the_eye_providers.py |
| Projektkennzahlen | Projekt-Registry, Connector-Tokens, idempotente Ereignisse/Snapshots, KPI-Katalog und Übersicht | the_eye_projects.py |
| Sicherheit | Sicherheitsereignisse, Freigaben, Entscheidungen, Audit und Übersicht | the_eye_security.py |
| Geschäftsübersicht | Executive-Übersicht, gespeicherte Berichte und Abruf | the_eye_executive.py |
| AION-Anbindung | Datenbankbasierte Analyseabfragen, Aktionsvorbereitung, Freigabe-/Datenqualitätsprüfungen und Ausführungspfad | the_eye_aion.py |
| Notfall und Wiederherstellung | Backup-/Failover-/Übungsberichte, Notfallmodi und Übersicht | the_eye_continuity.py |
| Fertigstellungsnachweise | Prüfbelege mit Status, Konfigurationsprüfung, getrennte Code-/Staging-Bewertung | the_eye_readiness.py |

Kernmodule: `the_eye_access.py` (Rollen/Scopes), `the_eye_data_safety.py` (Maskierung), `the_eye_guard.py` (Schreibschutz), `the_eye_live.py` (Echtzeit), `the_eye_root_cause.py` (Ursachenbewertung).

Frontend: `frontend/src/pages/TheEyePage.jsx` mit zugehörigem CSS, Leaflet-Karte, Geräte-/Kameraansicht, Suche, Betriebsübersichten und AION-Eingabe. Externe Welt-Layer wie Flugzeuge, Schiffe, Wetter und Satelliten sind als UI-Einträge vorhanden; dadurch sind noch keine realen Datenfeeds nachgewiesen.

## In diesem Arbeitslauf ergänzt und repariert

1. Einen realen Zustellfehler reproduziert: Vor der Korrektur führte ein `datetime` im Heartbeat zu **0 zugestellten Ereignissen** und zum Entfernen des Empfängers.
2. Zeitstempel und verschachtelte Ereignisdaten werden nach der Geheimnismaskierung mit dem FastAPI-JSON-Encoder umgewandelt.
3. Verteilung an Empfänger erfolgt nebenläufig mit begrenzter Sende-/Schließzeit. Langsame oder abgebrochene Verbindungen werden entfernt; andere Empfänger erhalten ihre Ereignisse weiterhin.
4. Auch ein Verbindungsabbruch während der ersten Anmeldebestätigung räumt das Abonnement auf.
5. Ungültige JSON-Nachrichten sowie Arrays/null werden mit WebSocket-Code 1003 beendet.
6. Die Oberfläche zeigt Live erst nach der serverseitigen Anmeldebestätigung. Bei 4401/4403 startet sie keine endlose Wiederverbindung.
7. 32 neue Laufzeittests ergänzen die 25 vorhandenen statischen Sicherheits-/Architekturprüfungen.
8. Ein eigener CI-Job wurde vorbereitet und seine YAML-Struktur geprüft. GitHub verweigerte das Hochladen der Workflow-Änderung, weil der vorhandenen OAuth-Verbindung die `workflow`-Berechtigung fehlt. Der Entwurf bleibt im lokalen Sicherungsbranch `work/the-eye-ci-draft-20261004` (Commit `cd0f3aaa35b446bb3dad06a6f235faa43fcdf2a0`) erhalten. Der veröffentlichte Entwicklungscommit verändert keine CI-Workflow-Datei; die neuen Tests sind dort manuell ausführbar.

## Tatsächlich ausgeführte Validierung

- **57/57 Tests bestanden**: `test_the_eye_v1_contract.py` und `test_the_eye_realtime.py`.
- Getestet: echte Starlette-WebSocket-JSON-Rahmung, FastAPI-ASGI-Handshake/Ping/Ereignis, Kundentrennung, Projekt-/Standort-/Partnergrenzen, Technikerzuweisung, fehlende Rechte, Geheimnismaskierung, langsame/defekte Verbindungen, fehlerhafte Nachrichten und Cleanup.
- Authentifizierung/Datenbank wurden an ihrer Schnittstelle für die Laufzeittests ersetzt; diese Tests greifen nicht auf Kundendaten oder echte Geräte zu.
- Lokaler Testlauf mit Python 3.12 und den sechs fokussierten Abhängigkeitsversionen des Repositories: FastAPI 0.110.1, Starlette 0.37.2, Pydantic 2.12.5, pytest 9.0.2, httpx 0.28.1, anyio 4.13.0.
- Gezieltes ESLint für `TheEyePage.jsx` mit `--max-warnings 0` bestanden.
- `git diff --check` bestanden.
- Kein vollständiger neuer Frontend-Build, kein Hardwaretest und keine Production-Abnahme in diesem lokalen Prüfbericht. GitHub-CI-Ergebnisse sind separat am Commit zu prüfen.

Reproduzierbarer gezielter Testbefehl:

```bash
python -m pytest backend/tests/test_the_eye_v1_contract.py backend/tests/test_the_eye_realtime.py -q
```

## Was noch nachzuweisen oder auszubauen ist

- Echte Kamera-Livebilder über konfigurierten Media-Gateway; die vorhandene Session-API allein liefert noch keinen nachgewiesenen Kamerabetrieb.
- Echte MQTT-/Edge-Geräte und Befehls-/Firmware-Ausführung mit realen Bestätigungen.
- Aufzeichnung, Object Storage, Wiederherstellung und Failover praktisch testen; vorhandene Berichts-APIs ersetzen keine ausgeführten Backups.
- Datenbankgestützte Integrationstests für Rollen, Kunden-/Standorttrennung, Befehle, Freigaben, Vorfälle und Lagerreservierungen.
- Umfangreiche Browser-/Mobiltests sowie vollständigen Build am aktuellen Commit nachweisen.
- Den vorbereiteten eigenen The-Eye-CI-Job mit einer für Workflow-Änderungen freigegebenen GitHub-Verbindung übernehmen. Die Programmcode-/Teständerungen benötigen diese zusätzliche Berechtigung nicht.
- Externe Welt-Datenfeeds, 3D-Globus und Zeitreiseansicht sind durch die aktuelle Code-Inventur nicht als fertige Integration belegt.
- Länger laufende WebSocket-Sitzungen prüfen ihre Berechtigung derzeit nur bei der Anmeldung; Session-Ablauf und Rechteentzug während einer offenen Verbindung sind ein weiterer Sicherheits-Prüfpunkt.
- Realtime-Verteilung bleibt pro Prozess; ein Redis-/Mehrprozess-Betrieb ist noch kein Ergebnis dieses Arbeitslaufs.
- Production-Freigabe und tatsächliches Deployment separat durchführen. Der Readiness-Endpunkt setzt `production_ready = False`.

**Keine belastbare Gesamt-Prozentzahl:** Der gesamte geplante Produktumfang und echte Integrationsnachweise sind noch nicht vollständig abgenommen. Die 100 % beziehen sich nur auf die 57 gezielten bestandenen Prüfungen.

## Ergänzung: Vorbereitung der Datenübernahme

Am 4. Oktober 2026 wurde das lesende Prüfwerkzeug `scripts/the_eye_data_preflight.py` im selben Entwicklungsprojekt ergänzt. Die separate Anleitung `docs/THE_EYE_DATA_MIGRATION.md` beschreibt die gesicherte Codekopie auf dem Stack, die noch nicht verifizierte Laufzeitquelle und die ausgeschlossenen gemeinsamen Benutzerdaten. Die aktuellen gezielten Prüfungen ergeben **79/79 bestandene Tests** (57 bisherige plus 22 neue). Die neue Prüfung ist lokal ausgeführt und kein Live-Datenbank- oder Wiederherstellungsnachweis.

## Endpunkt-Inventar

Die folgende Liste wurde direkt aus den Routen-Deklarationen des geprüften Codes erzeugt. Bei den HTTP-Routen gilt das Präfix `/api/the-eye`; der WebSocket-Pfad ist bereits vollständig.

### the_eye_actions.py

| Methode | Route |
| --- | --- |
| POST | `/admin/actions` |
| GET | `/admin/actions` |
| PATCH | `/admin/actions/{action_id}/status` |
| PATCH | `/admin/actions/{action_id}/assign` |
| POST | `/admin/incidents/{incident_id}/actions` |
| POST | `/admin/tickets` |
| GET | `/admin/tickets` |
| GET | `/technician/tickets` |
| PATCH | `/admin/tickets/{ticket_id}/assign` |
| PATCH | `/admin/tickets/{ticket_id}/status` |
| GET | `/admin/technicians` |
| GET | `/admin/actions/summary` |

### the_eye_aion.py

| Methode | Route |
| --- | --- |
| POST | `/admin/aion/query` |
| POST | `/admin/aion/actions/prepare` |
| POST | `/admin/aion/actions/{approval_id}/execute` |

### the_eye_cameras.py

| Methode | Route |
| --- | --- |
| POST | `/admin/cameras` |
| GET | `/admin/cameras` |
| GET | `/admin/cameras/{camera_id}` |
| PATCH | `/admin/cameras/{camera_id}` |
| POST | `/admin/cameras/{camera_id}/health` |
| POST | `/admin/cameras/{camera_id}/events` |
| GET | `/admin/cameras/{camera_id}/events` |
| POST | `/admin/cameras/{camera_id}/stream-session` |

### the_eye_continuity.py

| Methode | Route |
| --- | --- |
| POST | `/admin/continuity/backups` |
| GET | `/admin/continuity/backups` |
| POST | `/admin/continuity/failover` |
| POST | `/admin/continuity/drills` |
| PATCH | `/admin/continuity/emergency-mode` |
| GET | `/admin/continuity/overview` |

### the_eye_data_quality.py

| Methode | Route |
| --- | --- |
| POST | `/admin/data-quality/sources` |
| POST | `/admin/data-quality/sources/{source_id}/heartbeat` |
| POST | `/admin/data-quality/issues` |
| PATCH | `/admin/data-quality/issues/{issue_id}/resolve` |
| GET | `/admin/data-quality/issues` |
| GET | `/admin/data-quality/overview` |
| GET | `/admin/data-quality/entity/{entity_type}/{entity_id}` |

### the_eye_devices.py

| Methode | Route |
| --- | --- |
| GET | `/health` |
| POST | `/admin/devices` |
| GET | `/admin/devices` |
| PATCH | `/admin/devices/{device_id}/location-assignment` |
| PATCH | `/admin/devices/{device_id}/status` |
| POST | `/devices/{device_id}/heartbeat` |
| POST | `/devices/{device_id}/location` |
| POST | `/devices/{device_id}/telemetry` |
| GET | `/admin/map/devices` |
| POST | `/admin/devices/{device_id}/commands` |
| GET | `/admin/devices/{device_id}/commands` |
| GET | `/devices/{device_id}/commands` |
| POST | `/devices/{device_id}/commands/ack` |
| POST | `/admin/groups` |
| GET | `/admin/groups` |
| POST | `/admin/firmware` |
| GET | `/devices/{device_id}/firmware` |

### the_eye_executive.py

| Methode | Route |
| --- | --- |
| GET | `/admin/executive/overview` |
| POST | `/admin/executive/briefs` |
| GET | `/admin/executive/briefs` |
| GET | `/admin/executive/briefs/{brief_id}` |

### the_eye_incidents.py

| Methode | Route |
| --- | --- |
| POST | `/admin/incidents` |
| POST | `/admin/incidents/correlate-site/{site_id}` |
| GET | `/admin/incidents` |
| GET | `/admin/incidents/summary` |
| GET | `/admin/incidents/{incident_id}` |
| PATCH | `/admin/incidents/{incident_id}/status` |

### the_eye_locations.py

| Methode | Route |
| --- | --- |
| POST | `/admin/locations` |
| GET | `/admin/locations` |
| GET | `/admin/locations/{location_id}` |
| PATCH | `/admin/locations/{location_id}` |
| DELETE | `/admin/locations/{location_id}` |

### the_eye_maintenance.py

| Methode | Route |
| --- | --- |
| POST | `/admin/inventory/items` |
| GET | `/admin/inventory/items` |
| PATCH | `/admin/inventory/items/{item_id}/status` |
| POST | `/admin/inventory/items/{item_id}/adjust` |
| POST | `/admin/work-orders` |
| GET | `/admin/work-orders` |
| GET | `/technician/work-orders` |
| POST | `/admin/work-orders/{work_order_id}/parts/reserve` |
| GET | `/admin/work-orders/{work_order_id}/parts` |
| GET | `/technician/work-orders/{work_order_id}/parts` |
| POST | `/technician/work-orders/{work_order_id}/parts/consume` |
| PATCH | `/admin/work-orders/{work_order_id}/status` |
| POST | `/admin/work-orders/{work_order_id}/validation` |
| POST | `/admin/rma` |
| PATCH | `/admin/rma/{rma_id}/status` |
| GET | `/admin/maintenance/summary` |

### the_eye_network.py

| Methode | Route |
| --- | --- |
| POST | `/admin/network/nodes` |
| GET | `/admin/network/nodes` |
| POST | `/admin/network/nodes/{node_id}/health` |
| POST | `/admin/network/nodes/{node_id}/ports` |
| GET | `/admin/sites/{site_id}/health` |

### the_eye_projects.py

| Methode | Route |
| --- | --- |
| POST | `/admin/projects` |
| GET | `/admin/projects` |
| POST | `/admin/projects/{project_key}/connector-token` |
| POST | `/connectors/{project_key}/snapshot` |
| POST | `/connectors/{project_key}/events` |
| POST | `/admin/projects/{project_key}/snapshot` |
| GET | `/admin/projects/{project_key}` |
| POST | `/admin/kpis` |
| GET | `/admin/kpis` |
| GET | `/admin/project-intelligence/overview` |

### the_eye_providers.py

| Methode | Route |
| --- | --- |
| POST | `/admin/providers` |
| GET | `/admin/providers` |
| PATCH | `/admin/providers/{provider_id}/health` |
| PATCH | `/admin/providers/{provider_id}/fallback` |
| GET | `/admin/providers/dependencies` |
| GET | `/admin/providers/overview` |

### the_eye_readiness.py

| Methode | Route |
| --- | --- |
| POST | `/admin/readiness/evidence` |
| GET | `/admin/readiness/evidence` |
| GET | `/admin/readiness` |

### the_eye_search.py

| Methode | Route |
| --- | --- |
| GET | `/admin/search` |
| GET | `/admin/location-summary` |

### the_eye_security.py

| Methode | Route |
| --- | --- |
| POST | `/admin/security/events` |
| GET | `/admin/security/events` |
| PATCH | `/admin/security/events/{event_id}/resolve` |
| POST | `/admin/approvals` |
| GET | `/admin/approvals` |
| PATCH | `/admin/approvals/{approval_id}/decision` |
| GET | `/admin/audit` |
| GET | `/admin/security/overview` |

### the_eye_ws.py

| Methode | Route |
| --- | --- |
| WEBSOCKET | `/api/the-eye/ws` |
