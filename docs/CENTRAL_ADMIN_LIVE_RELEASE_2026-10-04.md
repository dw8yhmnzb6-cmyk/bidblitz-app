# Freigegebene Admin-Veröffentlichung

Afrim hat die Veröffentlichung der geprüften Admin-Erweiterung auf bidblitz.ae am 4. Oktober 2026 ausdrücklich freigegeben.

## Nachgewiesener Ausgangsstand

DNS und vorhandener SSH-Hostkey bestätigen den bestehenden Server 212.227.20.190. GitHub Actions hat den Quellstand lesend inventarisiert; der direkte Mac-SSH-Zugang besitzt keine funktionierende Anmeldung. PM2 startet `api` aus `/var/www/bidblitz/backend`. Nginx liefert `/var/www/bidblitz/frontend/build` aus.

Der ausgelieferte Frontend-Build meldet `beec9e81579ce45b93b3454e6f09240d3d5a8e98`. Der Quellordner auf dem Server enthält dagegen noch eine ältere V1-App und eignet sich nicht als Frontend-Buildquelle. Deshalb basiert dieses Release auf dem nachgewiesenen Frontend-Commit beec9e81 und ergänzt gezielt die Projektübersicht. Unabhängige Änderungen an RealMap, Monitoring und ErrorBoundary wurden nicht übernommen.

Die bestehende produktive globale Authentifizierung, Konfiguration, Datenbankanbindung und Serverdatei werden nicht ersetzt. Die neue Owner-Oberfläche prüft Sperrflags, Token-/Kontoversion und gegebenenfalls aktive Sitzungsbindung zusätzlich selbst. 119 isolierte Backend-Tests auf der tatsächlich inventarisierten Live-Authentifizierung bestanden. Rollen und Umgebungsvariablen werden nicht verändert. Externe SSO-Empfänger bleiben gemäß ihrer expliziten Konfiguration gesperrt; diese Veröffentlichung bestätigt keine externen Zielkonten.

## Begrenzter Austausch

Sieben Backend-Dateien: Routerregistrierung, `admin_access`, drei Projekt-Metadatenmodule sowie `admin_projects`/`admin_sso`. Der Frontend-Build ergänzt den gut sichtbaren Button „Alle Projekte“, die bestehende App-Route, Katalog, Rechteansicht und Anbindungsdiagnose. Der bestehende direkte Admin-Login-Einstieg bleibt für neue Browser nutzbar.

Die Workflow-Datei `central-admin-live-release.yml` installiert keine Testabhängigkeiten auf dem Server. Sie prüft Backend und Frontend im Runner, baut mit Node 20 und verwendet den bereits vorhandenen Deployment-Zugang sowie den auf dem Mac geprüften SSH-Hostkey. Alle produktiven Vorlagenprüfungen erfolgen vor dem ersten Austausch. Der Quellstand muss exakt zur inventarisierten SHA256-Baseline passen, neue Dateipfade dürfen keine abweichenden vorhandenen Inhalte überschreiben und der Frontend-Build muss weiterhin beec9e81 sein.

Vorherige Backend-Dateien und das komplette Frontend werden gesichert. Alte gehashte Assets bleiben für offene Tabs verfügbar. Es wird ausschließlich der bestehende PM2-Prozess `api` neu gestartet. Der Server prüft danach das vorhandene Owner-Konto über gewöhnliche lokale JWT-Anmeldung, mindestens 35 Katalogeinträge, HTTP 401 ohne Anmeldung und die öffentliche Build-Identität. Die Browserprüfung bei 390/1440 Pixel nutzt eine fünf Minuten gültige, über die bestehende lokale JWT-Logik ausgestellte Testanmeldung für das vorhandene Konto; der Token wird weder geloggt noch als Artefakt gespeichert. Aktive Owner-MFA sperrt diesen automatisierten Testzugang vor dem Austausch. Es ist kein Passwort-/MFA-Login-Test. Sie führt ausschließlich lesende Anfragen aus und stellt keine SSO-Codes aus. Die bestehende Authentifizierung kann dabei ihre gewöhnliche `last_seen`-Aktualisierung ausführen.

Bei fehlgeschlagenen Aktivierungsprüfungen werden Backend und Frontend zurückgenommen. Bei Browserfehlern erfolgt die Rücknahme nur, wenn dieser exakte Release weiterhin aktiv ist; spätere fremde Änderungen werden nicht überschrieben. Ergebnis und Sicherungspfad werden im Deployment-Protokoll dokumentiert. Dieses Dokument beschreibt den vorgesehenen Lauf; die tatsächliche Veröffentlichung ist erst nach erfolgreicher Live-Verifikation bestätigt.

## Tatsächlich veröffentlicht und live geprüft

Der freigegebene Lauf [37216060680](https://github.com/dw8yhmnzb6-cmyk/bidblitz-app/actions/runs/37216060680) ist erfolgreich abgeschlossen. Quellcommit des veröffentlichten Builds: `99bc37413c5c913c44381cbb6daa754322a6ece2`. Build-ID: `admin-99bc3741-20261004161530`. Aktivierung am 4. Oktober 2026 um 18:17 Uhr Europe/Belgrade.

Im Runner bestanden 119 Backend-Tests und 19 Frontend-Tests; der Node-20-Frontend-Build war erfolgreich. Vor dem Austausch bestanden die Live-Quellprüfungen und die neue Owner-Route auf der vorhandenen lokalen Anmeldelogik. Nach dem Austausch lieferte die tatsächliche API 35 Projekte an das vorhandene Owner-Konto. Anonyme Anfragen werden mit HTTP 401 abgewiesen.

Die echte Live-Browserprüfung bei 390 und 1440 Pixel war erfolgreich: „Alle Projekte“ im Admin-Menü sichtbar, Klick navigiert nach `/admin/projects`, authentifizierter Katalogabruf HTTP 200, Projektseite und BIDTAX-Eintrag sichtbar, kein horizontaler Überlauf und keine JavaScript-Page-Errors. Es wurden nur GET/HEAD-Anfragen zugelassen; keine Katalogeinträge verändert oder SSO-Codes ausgestellt. Die temporäre fünfminütige Verifikationsanmeldung wurde aus Runner und Server entfernt.

Sicherung der betroffenen Backend-Dateien: `/var/www/bidblitz/admin-release-backup-20261004161730`. Vorheriger Frontend-Build: `/var/www/bidblitz/frontend/build.admin-previous-20261004161730`. Diese Sicherungen bleiben für eine gezielte Rücknahme erhalten. Die externen Empfänger sind mit dieser Veröffentlichung weiterhin nicht live verifiziert oder automatisch aktiviert.
