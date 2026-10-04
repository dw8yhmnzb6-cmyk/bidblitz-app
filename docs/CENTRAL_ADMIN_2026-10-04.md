# Zentrale BidBlitz-Adminverwaltung – 04.10.2026

## Implementiert

Erweiterung des vorhandenen Zweigs `work/central-admin-projects`, Ausgangscommit `be9ee787`. Bestehende App, bestehende Anmeldung und bestehende MongoDB bleiben die Grundlage.

- `/admin/projects`: vorhandene Projektübersicht mit Suche, Statusfilter und Bearbeitung.
- `GET/POST /api/admin/projects`, `PUT /api/admin/projects/{id}`: persistente Projektverwaltung in `admin_projects` innerhalb der vorhandenen Datenbank. Projekt-ID ist der eindeutige MongoDB-Primärschlüssel. Die bisherigen 15 Einträge dienen als schreibfreie Startwerte, bis der Owner sie bearbeitet.
- Name, Beschreibung, Kategorie, Icon/Kürzel, Farbe, Webseite, Adminadresse, Status und Reihenfolge.
- Versionsprüfung verhindert das Überschreiben zwischenzeitlicher Änderungen. Die letzten 50 Änderungen enthalten Akteur und Zeitpunkt atomar im Projektdokument. Kein Löschendpunkt; Ausblenden ist reversibel.
- Haupt-Admin-Eintrag bleibt aktiv und auf `/admin` gerichtet.
- Bestehende JWT-/Cookie-Anmeldung wird wiederverwendet. Jede Anfrage prüft die aktuelle Benutzeridentität und Rolle aus der Datenbank; deaktivierte Konten werden abgewiesen. Owner-Adressen stammen aus `BIDBLITZ_OWNER_EMAILS` und müssen der tatsächlichen Datenbank-E-Mail entsprechen. Login-Aliasse und historische Domain-Umschreibungen verleihen keine Ownerrechte mehr.
- Schreibzugriffe benötigen `X-BidBlitz-Admin: 1`; Browser-Anfragen zusätzlich einen erlaubten Origin (`https://bidblitz.ae` oder der konfigurierte `FRONTEND_URL`). API-Clients ohne Origin benötigen Bearer-Authentifizierung und denselben Header.
- SSO-Ausstellung bleibt für Eyes/Trade auf feste serverseitige Ziele beschränkt. Editierbare Projektlinks können keine SSO-Codes auf andere Domains umlenken. Ausgeblendete/angekündigte Projekte erhalten keine Codes.
- SSO-Codes: 60 Sekunden gültig, frische Nonce, festes Publikum, keine Cache-Speicherung. Optionale projektspezifische Secrets; bestehendes Shared-Secret bleibt als Rückfall für UNGESETZTE Projektvariablen erhalten. Explizit leeres Projektsecret deaktiviert das jeweilige SSO.
- Die Oberfläche unterscheidet konfigurierte SSO-Anbindung, normale Projektlinks und nicht verfügbare Projekte. Weder ein Schlüssel noch ein Projektstatus werden als Nachweis einer funktionierenden Fernanmeldung dargestellt. Anmeldefehler lassen die Übersicht sichtbar.

## Verifikation

- 35 Backend-Tests erfolgreich, einschließlich echter JWT-Auswertung mit isoliertem MongoDB-Mock: anonyme Zugriffe, Kunden, fremde Admins, deaktivierte Konten, Login-Alias-Verwechslung, Origin-Prüfung, Speichern/Laden, Versionskonflikte, gefährliche URLs, festes SSO-Ziel, Ablaufzeit, unterschiedliche Nonces, Secret-Konfiguration und ausgeblendete Projekte.
- 7 React-DOM-Oberflächentests erfolgreich: Laden wiederholen, SSO-Fehler ohne Verlust der Kacheln, Suche, Bearbeiten, Konflikt, ausgeblendete Projekte, Hinzufügen.
- Vollständiger Frontend-Produktionsbuild erfolgreich. ESLint für beide betroffenen Frontenddateien erfolgreich. Der Build lief ohne das globale ESLint-Buildplugin; die geänderten Dateien wurden separat mit der bestehenden Projektkonfiguration geprüft.
- Browserprüfung mit agent-browser und lokalen Testdaten: Desktop 1280 px, Handy 390 x 844 px; kein horizontaler Überlauf; Kacheln bei SSO-Fehler weiter sichtbar; Formular öffnet und fokussiert den Namen. Diese Prüfung ist ausdrücklich kein Test gegen echte Projektkonten.
- Regressionstests im Repository enthalten; die vorhandenen CI-Workflows bleiben unverändert. GitHub hat die Workflow-Erweiterung wegen fehlendem `workflow`-Scope des vorhandenen OAuth-Zugangs abgewiesen. Testzusatz: `pip install -r backend/tests/requirements-admin.txt`.
- Backend gezielt aus dem Repository-Root starten (mit lokalen Testwerten für `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`): `PYTHONPATH=backend pytest backend/tests/test_admin_projects_hub.py backend/tests/test_admin_sso.py backend/tests/test_admin_projects_api.py -q`.
- Frontend: `CI=true npm --workspace frontend test -- --watchAll=false --runInBand --runTestsByPath src/pages/AdminProjectsPage.test.jsx`.

## Noch nicht live bestätigt

Kein Produktionsdeployment, keine Änderung an Produktivdaten, keine Änderung an anderen Projekt-Backends, keine Live-Trades und keine Zahlungen.

Eine zentrale Anmeldung in allen Projekten ist damit noch nicht fertig: Der vorhandene Herausgeber unterstützt Eyes und Trade; deren aktuelle Empfänger und Produktivkonfiguration wurden in diesem Durchlauf nicht Ende-zu-Ende verifiziert. NEX/Stack werden bislang nur als Projektlinks geführt. Andere Einträge haben noch keine bestätigte Admin-Zieladresse/Anbindung. Ein neuer Katalogeintrag implementiert keine Authentifizierung im Zielprojekt und erteilt dort keine Rechte.

Vor Live-Freigabe die tatsächliche Owner-E-Mail aus der bestehenden Benutzerdatenbank mit der Allowlist abgleichen. SSO-Empfänger müssen Signatur, Issuer, Publikum, Ablauf und atomare Einmalverwendung der Nonce prüfen und die lokale Owner-Zuordnung erzwingen. Projektspezifische Schlüssel nur zusammen mit dem jeweiligen Empfänger umstellen; keine Secrets im Repository speichern.

Für Live-Aktivierung ist die gesonderte Produktionsfreigabe erforderlich. Erst danach können echte Anmeldung, Berechtigungen und Rückkehr in den Admin auf den tatsächlich laufenden Zielsystemen geprüft werden.

## Festgestellter Zugriffsblocker

Der rein lesende SSH-Versuch vom verbundenen Mac zum in der bestehenden Deployment-Konfiguration genannten Host `root@212.227.20.190` wurde mit `Permission denied (publickey,password)` abgewiesen. Der aktuelle Produktiv-HEAD und die Owner-Konfiguration konnten daher nicht geprüft werden. Diese Änderung darf nicht ungeprüft einen neueren Produktivzweig ersetzen; vor Deployment zuerst aktuellen Serverstand integrieren und Owner-Konfiguration prüfen.
