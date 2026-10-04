# Zentrale Projekt- und Rechteübersicht

Erweiterung auf dem integrierten Admin-/SSO-Stand `2297477`.
Keine Produktionsbereitstellung, Kontenänderung oder externe Aktion.

## Inventar

35 Standard-Einträge: 22 eigenständige Projekte einschließlich Haupt-App sowie
13 Module der bestehenden BidBlitz-App. Gespeicherte Katalogänderungen behalten
Vorrang. Neue Standards werden additiv eingeblendet; es werden keine vorhandenen
MongoDB-Dokumente überschrieben.

Zusätzlich zu den bisherigen 15 Einträgen:

- BidBlitz OS (Builder als Modul), Remote, Spy BidBlitz (früher Device),
  BidBlitz TV (früher AK Stream TV), BidBlitz Charge, BIDTAX und BidBlitz Match.
- Pay, Staff, ID, Taxi, Scooter, Food, Auctions, Merchant/POS, Pool,
  Audi Tickets, Car Rental, Mining und EV als native BidBlitz-Module.

iCharging/Ladeinfrastruktur und BidBlitz Charge/Ladezubehör sind getrennte
Einträge. TV und IPTV haben getrennte vorhandene Projektstände; AK Stream TV
ist dagegen ein alter Name von TV. Konzeptionelle AION-Unterprodukte oder
ältere Kopien der Haupt-App sind keine zusätzlichen installierten Admins.
Ein Katalogeintrag oder eine Domain ist keine Erreichbarkeits- oder Live-Freigabe.

## Rechte und Grenzen

`GET /api/admin/projects` bleibt Owner-only, authentifiziert anhand des aktuellen
Datenbankkontos und liefert `Cache-Control: no-store`.

- `owner.database_role` zeigt die wirkliche BidBlitz-Rolle, nicht nur das
  organisatorische Label `owner`.
- Privilegierte Rollenverwaltung benutzt denselben unveränderten Policy-Helper
  wie die vorhandene Kontenverwaltung. Ein Login-Alias verschafft keine Rechte.
- Demo-Bereinigung bleibt auf Testmodus + Super-Admin + bestehende ausdrückliche
  Bestätigung beschränkt. Die Übersicht führt diese Aktion niemals aus.
- 15 vorhandene generische Service-Rechtepakete spiegeln die Backend-Regeln:
  normales CRUD, Dating ausschließlich Lesen/Moderieren, produktive Ladesäulen
  ausschließlich Lesen, Scooter-Abos Deaktivieren statt harte Löschung.
- Der Admin-Navigator deckt alle 103 benannten Admin-Einstiege in `App.js` und
  `renderSpecialRoutes.jsx` ab. Vertragstests erkennen fehlende/doppelte Links.
  Navigationsrechte sind ausdrücklich keine pauschale Aktionsberechtigung;
  insbesondere vorhandene admin-only/EV-/Provider-Gates bleiben unverändert.
- Native Ziele sind eine feste Code-Allowlist. Katalog-URLs können kein fremdes
  Anmeldeziel und keinen neuen internen Adminweg erzeugen.
- Eyes/admin, Trade/SUPER_ADMIN, NEX/OWNER, Stack/OWNER, AION/PLATFORM_ADMIN,
  Verify/ADMIN und BIDTAX/super_admin sind erforderliche lokale Rollen.
  Ihre tatsächlichen Live-Kontorechte bleiben `target_check_required` und ihre
  `effective_permissions` leer. BIDTAX hat noch keinen zentralen SSO-Empfänger.
- Die sechs bisherigen SSO-Adapter, Einmal-Codes, Release-Flags, lokale aktive
  Kontenzuordnung und 2FA bleiben unverändert. Keine automatische Kontenanlage
  oder Hochstufung. Unangebundene Projekte bleiben deaktiviert.

`kind`, Aliase, `native_path`, Rechte und SSO-Status werden serverseitig abgeleitet
und sind nicht über die Katalog-Schreibmodelle überschreibbar.

## Prüfungen

- 85 gezielte Backend-, API-, Rechte- und Navigationstests bestanden.
- 15 React-Tests bestanden: vorhandene CRUD-/SSO-Fehlerfälle, Suchalias,
  Modulfilter, Rechteansicht, sichere native Ziele und vollständiger Navigator.
  Der Kontobanner bleibt im Hub im normalen Layoutfluss, damit Titel und
  Zurück-Button nicht vom bisher versetzten Sticky-Banner verdeckt werden.
- ESLint für alle neuen/geänderten Hub-Komponenten ohne Fehler oder Warnungen.
- Vollständiger Frontend-Produktionsbuild unter der im Repository vorgesehenen
  Node-20-Laufzeit erfolgreich (bestehende große Bundles unverändert).
- Der umfassende vorhandene `test_ci_smoke.py` wurde nicht als bestanden
  gewertet: In der isolierten Testumgebung fehlen seine gesamten App-Abhängigkeiten
  (bereits der Import benötigt `slowapi`). Keine Produktionsdatenbank gestartet.

Die Browserprüfung verwendet ausschließlich ein temporäres Loopback-Testkonto,
Mongo-Mock-Datenbank und die echten Katalog-/SSO-Router. Sie bestätigt keine
Produktivkonten, externen Projektrechte oder echten Finanzfunktionen.

Browserprüfung bestanden: echte gebaute App zeigt alle 35 Einträge, 103
Admin-Einstiege und 15 Service-Rechtepakete. Der Rechtebutton öffnet über den
echten App-Router das angeforderte Dating-Modul; dessen API-Testantwort führt
zur Moderations-/Erstellungsverbot-Anzeige. Operationssuche funktioniert.
Kein horizontaler Überlauf bei 1440 px oder 390 px; keine JavaScript-Page-Errors.
Katalog und Modulabruf lieferten HTTP 200. Modul-Datenantwort und Anmeldung
sind ausdrücklich lokale Fixtures, keine vollständige Live-Modulprüfung.
Die Browser-Steuerhilfe konnte ihren Hintergrunddienst nicht starten; der
Check erfolgte mit demselben lokal installierten Chromium direkt über Playwright.

Für die spätere Bereitstellung gelten weiterhin [CENTRAL_ADMIN_SSO.md](CENTRAL_ADMIN_SSO.md)
und die dort dokumentierten offenen Produktionszugänge und Kontenzuordnungen.
