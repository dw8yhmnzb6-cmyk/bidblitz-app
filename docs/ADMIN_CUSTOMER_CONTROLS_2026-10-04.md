# Zentrale Kundenverwaltung: geprüfter Stand vom 4. Oktober 2026

## Verhalten

Die Projektübersicht zeigt den angemeldeten Besitzer mit weißer Schrift auf dunklem Hintergrund und größere Projektnamen. Der neue Bereich **Kunden · Sperren · Gutschriften** zeigt pro Projekt die tatsächlich vorhandenen Kundenfunktionen und die passenden Einstiege. Projektstatus und verfügbare Anmeldung werden getrennt ausgewiesen; ein konfigurierter Status ist keine Messung der Erreichbarkeit.

| Projekte | Kundenfunktionen | Gutschriften / Besonderheit |
| --- | --- | --- |
| 14 native BidBlitz-Module | Gemeinsame Kundenliste, bestehendes Sperren-/Entsperren-Formular | Bestehendes Wallet mit EUR/BLZ, Buchungsgrund und Admin-Bestätigung |
| Eyes | Kundenliste, Sperren/Entsperren im eigenen Admin | Suchguthaben in Credits |
| Trade | Customers, Sperren/Entsperren im eigenen Admin | Lizenzbefreiung und Freimonate; keine Broker-/Wallet-Geldbuchung |
| NEX | Mitglieder, Sperren/Entsperren im eigenen Admin | Manuelle Abos; Anbieter-Abos bleiben beim Zahlungsanbieter |
| Stack | Organisationen im eigenen Admin ansehen | Kundensperren und Gutschriften fehlen noch |
| AION / Verify | Öffentliche Projektseite mit separatem Login | Zentrale Anmeldung und Kundenrechte noch nicht nachgewiesen |
| Weitere nicht angebundene Projekte | Anklickbare Anbindungsdiagnose | Keine erfundenen Kundenaktionen |

Native Module verwenden gemeinsame Konten. Die zusätzlichen Buttons öffnen bereits vorhandene Werkzeuge, ohne Rollen oder Konten zu ändern. Die vier externen Einstiege melden im jeweiligen Projekt an; die dortige Kundenliste wird anschließend im Projekt geöffnet.

## Trade: nachgewiesene Ursache der leeren Seite

Die WebKit-Prüfung reproduzierte nach erfolgreicher zentraler Anmeldung eine leere Trade-Oberfläche: `root_children: 0`, `text_length: 0`. Die Browserfehlermeldung war **Can't find variable: hostedWorkers**. Nachweis: Diagnose-Lauf 37238793708, Job 111543129505, 22:09:32 UTC.

Das inzwischen durch einen weiteren Deployment-Lauf ausgelieferte Bundle `index-Bem6NZgZ.js` enthielt eine Kennzahlen-Zeile mit nicht definierten Variablen `hostedWorkers`, `hostedGate`, `pcFreeReady`, `hostedAssignments` und `hosted`. Der aktuelle Arbeitsquellcode enthielt diese Zeile bereits nicht mehr. Daher wurde ausschließlich diese veraltete Zeile im tatsächlich ausgelieferten Bundle durch einen Hinweis auf nicht verfügbare Hosted-Worker-Messwerte ersetzt. Es wurden keine Betriebszustände, Guthaben oder Trading-Freigaben erfunden. Die übrigen Bundles, Styles und API blieben erhalten. Die Reparaturskripte prüfen die exakte Ausgangsversion und sichern das vorige Frontend.

- Ausgangsimage: `sha256:7304ccdd1141348c95e0db931ee501bf17e899714f5a9bce965e4bb105465ab9`.
- Original-Bundle SHA-256: `986dcf6824193cfcf8fe37b8074f10c18ff9f137964e4dda503777b2a08effc8`.
- Korrigiertes Bundle: `index-adminfix-af8fc1878b52.js`, SHA-256 `af8fc1878b52889f7e4803d63018447dbf4729860ced63f7355f2c49c1e5444f`.
- Veröffentlichtes Image: `sha256:10627d9336b26f0ea0433ded7849f0f6a831b2277b32c8e3b41f8700f7a9efc8`.
- Sicherung: `trade-bidblitz-frontend-1-before-render-fix-20261004`.

Der unabhängige Ladeschutz zeigt nach sechs Sekunden bei leerem App-Root den lesbaren Namen, Neuladen und den Rückweg zum zentralen Admin. HTML und Schutzskript werden ohne Cache ausgeliefert; unbekannte Assets liefern 404. Der Ladeschutz wurde mit dem korrigierten Bundle erneut ausgeliefert. Vier Live-Prüfungen mit Chromium/WebKit bestanden, jeweils mit normalem Aufruf und absichtlich blockiertem App-JavaScript. Diese Prüfung bestätigt den Ladeschutz; die tatsächliche Anmeldung wird zusätzlich separat geprüft.

Die früher veröffentlichte Ladeschutz-Quelle ist im Trade-Repository auf Branch `work/admin-entry-guard-20261004`, Commit `df3606d2e6d1d302f59487b116046331c00eb99c` gespeichert. Die zusätzliche Bundle-Reparatur ist durch die drei `scripts/central_sso/trade_render_fix_*.py` im zentralen Reparaturbranch reproduzierbar dokumentiert. Keine uncommittierten App-/Backend-Arbeiten wurden überschrieben.

## Offene Arbeiten

### Paralleler Trade-Rollout: Veröffentlichung blockiert

Die zusätzlich implementierte, kontrastreiche Trade-Kundenleiste öffnete die echte Kundenliste und das bestehende Commercial-Formular. Chromium/WebKit bei 390/1440 Pixeln bestätigten jeweils HTTP 200, ein nach Eingabe eines Grundes freigabefähiges BLOCK-/UNBLOCK-Formular, verfügbare Lizenzvorteile und keinen Seitenüberlauf. Es wurde keine Aktion abgesendet. Die Änderungen wurden im Trade-Quellcode auf Branch `work/admin-entry-guard-20261004`, Commit `ae1ccdcdca85362d25636440686b8be515433ea3`, gespeichert.

Ein unabhängiger Trade-Deploymentlauf ersetzte anschließend das geprüfte Frontend. Bei der Kontrolle am 4. Oktober wurden `index-FBU3SOER.js`, fehlende Schutz-/Kunden-Einstiegsskripte und Image `sha256:d17418a5a3d3c31a1598e8c3dc3a7901eac8d7e2075da474d89fc400976209f3` festgestellt (Container erstellt 22:54:38 UTC). Die Zusatzleiste ist deshalb **nicht dauerhaft live bestätigt**. Weitere Trade-Veröffentlichungen werden bis zur Abstimmung des maßgeblichen Rollouts nicht vorgenommen.

Der Trade-Finanzüberblick meldete außerdem `PLATFORM_REVENUE_FEE_COLLECTION_EVIDENCE_MISSING`. Fehlende Finanznachweise werden nicht durch angenommene Guthaben oder Betriebszustände ersetzt. Der separat geprüfte Kundenzugang funktionierte unabhängig von dieser Meldung.

Die zentrale Frontend-Veröffentlichung wird separat durch 33 gezielte Tests und drei tatsächliche Browserdurchläufe geschützt. Externe Projekt-UIs werden in diesem Durchlauf nicht als bestanden gezählt: Ihre Receiver und Anmeldeflags werden nicht geändert, und der parallele Trade-Rollout ist ausdrücklich als offenes Integrationsproblem dokumentiert.

17 externe Projekte besitzen weiterhin keine geprüfte zentrale Anmeldung. Stack benötigt eine eigene Implementierung von Sperren und Gutschriften. NEX besitzt keine angebundene Geldgutschrift. Games lieferte bei der Prüfung eine Domain-Parkseite und erhält daher keinen irreführenden Direktlink. AION und Verify lieferten öffentliche Anwendungen, was ihre Kundenverwaltung oder eine zentrale Anmeldung noch nicht bestätigt.

Die allgemeine Backend-CI meldet 367 bestandene und neun fehlgeschlagene Prüfungen in den RouterRegistry-Erwartungen (zusätzliche Router und doppelte Kids-Route). Diese Reparatur behebt diese Abweichungen nicht. Die Produktionsveröffentlichung betrifft ausschließlich das Frontend und den separat geprüften Trade-Ladeschutz.

## Veröffentlichung und Nachweise

Die zentrale Frontend-Veröffentlichung ist erfolgreich: Workflow-Lauf 37242114053, Job 111552749122, veröffentlicht am 4. Oktober 2026 um 23:01:46 UTC. Die ausgelieferte Anwendung stammt aus Commit `33859ed59b3025b17be7d3c72b14e79251ee040d`, Build `admin-customers-33859ed5-20261004215539`. Das unveränderte, zuvor gebaute Frontend wurde erneut geprüft und ausschließlich dessen geprüfter Build veröffentlicht. Die Workflow-/Verifikationsquelle liegt in Commit `817aab81b785d74bdbd74ca8b1603c656bcbfb44`.

33 gezielte Tests in drei Suites bestanden. Drei tatsächliche Browserprüfungen bestanden: Chromium 1440, Chromium 390 und WebKit 390. Geprüft wurden lesbare Besitzerkennung, Kunden-Navigation und echte Kundenliste, vorhandenes Sperren-/Entsperren-Formular, echtes Wallet mit Kundenwahl/Gutschriftenformular, verständliche Diagnose fehlender Anbindungen, keine JavaScript-Fehler und kein Seitenüberlauf. Es wurden keine echten Kunden gesperrt/entsperrt und keine Gutschriften abgeschickt. Die vorhandenen Kunden-/Wallet-GET-Endpunkte lieferten HTTP 200; anonymer Admin-Zugang wurde abgewiesen.

Eine unabhängige HTTP-Kontrolle bestätigte danach den oben angegebenen Live-Build. Die vorherige zentrale Oberfläche bleibt unter `/var/www/bidblitz/frontend/build.customer-previous-20261004230146` für eine kontrollierte Rücknahme erhalten. Frühere fehlgeschlagene Browserdurchläufe wurden automatisch auf das bisherige Frontend zurückgesetzt. Zwei reine Build-Durchläufe wurden vor Veröffentlichung abgebrochen, um Prüfskripte zu korrigieren.

Externe Projekt-Anmeldungen und Kundenseiten sind **nicht** Teil des erfolgreichen Freigabedurchlaufs und werden nicht als bestanden ausgegeben. Das Ergebnisartefakt nennt ausdrücklich `not_run_in_this_frontend_release`. Die zuvor dokumentierten Anmeldungen bleiben konfiguriert; die separate Trade-Veröffentlichung bleibt wegen der parallelen Rollouts offen.
