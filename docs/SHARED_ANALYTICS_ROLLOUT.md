# BidBlitz: gemeinsame Projekt-Analytics (Entwurf)

## Bestehendes System
Die README dokumentiert bereits `GET /api/analytics/overview`, `POST /api/analytics/track` und `/#/admin/analytics`. Vor einem Rollout müssen die realen Backend-Schemas, Authentifizierung und Deployment-Zustände geprüft werden. Keine parallele Analytics-Datenbank bauen.

## Einheitlicher Event-Vertrag
Das Modul `frontend/src/lib/bidblitzAnalytics.js` bietet nur eine **opt-in Event-Schnittstelle**, keine automatische Aktivierung.
- Projekte bekommen stabile Slugs, z.B. `bidblitz_main`, `trade`, `eyes`, `power`, `verify`, `iptv`, `games`, `fuel`, `identity`.
- Zulässige Ereignisse: `page_view`, `cta_click`, `signup_started`, `signup_completed`, `checkout_started`, `checkout_completed`, `flow_abandoned`.
- Nur erster eigener Backend-Endpunkt; keine fremden Hosts.
- Keine Benutzer-IDs, E-Mails, IPs, Suchtexte, vollständigen URLs, Auth-Tokens, Zahlungsdaten oder Fotos im Event.
- `hasConsent` muss den gültigen, überprüften Consent-Zustand der Anwendung liefern; ohne Consent wird nichts gesendet.
- Backend muss Project IDs anhand authentifizierter App-Konfiguration validieren (Clientwert allein nicht vertrauen), Payload-Schema erzwingen, Rate Limit anwenden und Datenaufbewahrung begrenzen.
- `checkout_completed` nur bei serverseitig bestätigter Zahlung auslösen, keine Finanzwerte aus Frontend-Events als Umsatz zählen.

## Admin-Dashboard / Funnel
Je Projekt und übergreifend: Nutzer / Sitzungen / Seitenaufrufe getrennt; CTA-Klicks; Registrierung gestartet/abgeschlossen; Checkout gestartet / serverseitig bestätigt; Schritt-Abbrüche; Fehlerquote. Filter: Tag, 7 Tage, 30 Tage, Zeitraum, Projekt, Kampagne (ohne personenbezogene Profile). Attribution nur nach Consent und gültiger Rechtsgrundlage.

## Rollout-Gates
1. Bestehende API und Auth/RBAC prüfen.
2. Contract-Tests für Opt-in/Opt-out, unzulässige Events, Query-String-Entfernung und Netzwerkfehler.
3. Backend endpoint an vorhandene Analytics-Pipeline anbinden (nicht blind `/api/analytics/track` annehmen).
4. Staging-Synthetik und Datenqualitätsprüfung; Botfilter und Datenminimierung.
5. Datenschutz-/Einwilligungsprüfung, danach schrittweiser Rollout pro Projekt.
6. Vor Production: Build, Tests, AuthZ, Privacy, Zahlungsabgleich, Monitoring/Alarme. Keine automatische Produktivfreigabe.

## Status
Nur das isolierte Client-Modul und diese Spezifikation sind im Feature-Branch angelegt. Kein Dashboard und kein Produktionstracking sind dadurch aktiviert.
