# Zentrale Projektanmeldung: Live-Abschluss vom 4. Oktober 2026

## Tatsächlicher Stand

Die vier externen Zugänge Eyes, Trade, NEX und Stack sind seit **17:26:16 UTC** aktiviert und über [Alle Projekte](https://bidblitz.ae/admin/projects) nutzbar. Der Katalog enthält **35 Projekte: 14 interne Einträge und 21 externe Projekte**. Vier externe Anbindungen sind freigeschaltet, **17 externe Anbindungen bleiben gesperrt**. Die 14 internen Einträge verwenden die bereits vorhandene BidBlitz-Sitzung; dieses Release bestätigt nicht jede ihrer Fachfunktionen einzeln.

Der sichtbare Einstieg „Alle Projekte“ steht im Admin-Menü oberhalb von „Kunden Live-Map“. Der zentrale Frontend-Build bleibt `admin-99bc3741-20261004161530` (Quellstand `99bc37413c5c913c44381cbb6daa754322a6ece2`). Die SSO-Aktivierung erforderte keinen weiteren Austausch dieses Builds.

| Projekt | Vorhandenes Zielkonto | Geprüfte lokale Rolle | Status |
| --- | --- | --- | --- |
| Eyes | afrimk@me.com | admin | Live aktiviert |
| Trade | afrimk@me.com | SUPER_ADMIN | Live aktiviert |
| NEX | agimk@me.com | OWNER | Live aktiviert |
| Stack | agimk@me.com | OWNER | Live aktiviert |

Die Zielkonten und Rollen bestanden vor der Aktivierung. Es wurden keine Konten angelegt und keine Rollen hochgestuft. Der Empfänger bindet die zentrale Owner-Identität an das konfigurierte lokale Konto und prüft dessen aktuellen Status und Rechte. Bestehende MFA- und Fachberechtigungen bleiben maßgeblich.

## Live-Nachweis

Der Aktivierungslauf [37220463958](https://github.com/dw8yhmnzb6-cmyk/bidblitz-app/actions/runs/37220463958), Job `111489574955`, ist erfolgreich. Ausgeführter zentraler Quellstand: `c3fbf83d4bb98240d166a55470efcc95af83206f`.

Alle acht echten Browserabläufe bestanden: Klick auf die jeweilige Projektkarte im zentralen Dashboard, echter HTTPS-Austausch mit dem Empfänger, gültige lokale Sitzung mit der erwarteten Rolle, bereinigte Code-URL, kein Code im Browserspeicher, keine JavaScript-Page-Errors, kein horizontaler Überlauf und anschließende Abmeldung. Die Breiten waren 390 und 1440 Pixel. Letzte erfolgreiche Prüfung: **17:26:54 UTC**.

Die Browserprüfung erfasste die echte SSO-POST-Antwort vor dem Weiterleiten derselben Antwort an den Browser, damit die nachfolgende Navigation die CDP-Antwort nicht verliert. Es wurden keine Empfängerantworten simuliert. Andere schreibende Requests waren in diesem Prüflauf blockiert. Der zentrale Test verwendete eine fünf Minuten gültige Anmeldung des vorhandenen Owner-Kontos über die bestehende JWT-Logik; er ersetzt keinen Passwort-/MFA-Login-Test. Temporäre zentrale Anmeldedateien wurden entfernt, die bekannten Prüfsitzungen abgemeldet.

Die dauerhaften acht Ergebnisdatensätze stehen in [CENTRAL_ADMIN_SSO_BROWSER_2026-10-04.json](CENTRAL_ADMIN_SSO_BROWSER_2026-10-04.json). Das zugehörige Actions-Artefakt heißt `central-sso-live-browser-evidence`, ID `11309832352`.

## Implementierung und Prüfung

Jedes Projekt verwendet einen eigenen zufälligen HMAC-Schlüssel. Der kurzlebige Code ist an Zielprojekt und Owner gebunden und wird nur einmal verbraucht. Die Schlüssel wurden verschlüsselt übertragen und liegen ausschließlich in privaten Server-Konfigurationsdateien. Kein Schlüssel oder Sitzungstoken steht in diesem Bericht oder den Ergebnisartefakten.

Vor der Freigabe bestanden **88 Empfänger-Protokolltests** und **20 Browser-Helfertests**. Die anschließenden echten API-Prüfungen für alle vier Projekte bestätigten: gültige Anmeldung und Profil HTTP 200, Replay und abgelaufener Code HTTP 401, falscher Owner HTTP 403, falsches Ziel HTTP 401, fehlender Origin HTTP 403 sowie bei gleichzeitiger Verwendung genau ein erfolgreicher Codeverbrauch. Bekannte Prüfsitzungen wurden widerrufen.

Die produktiven Empfänger wurden aus dem tatsächlichen Live-Quellstand mit begrenzten SSO-Änderungen gebaut. Bestehende Container-Konfiguration, Netzwerk-Adressen, Volumes und nicht betroffene Backend-Dateien wurden erhalten. Eyes erhielt zusätzlich den nötigen SPA-Fallback für die direkte Landing-Route. Trade erhielt ausschließlich die additive Nonce-Migration `0204_sso_20261004` auf seinem tatsächlich aktiven Alembic-Stand `0204_strategy_builder_auto_demo`; keine späteren Fachmigrationen wurden übernommen. Bestehende uncommittete Trade-Navigationsänderungen wurden erhalten.

| Projekt | Produktiver Empfänger-Quellstand | Gesicherter Git-Stand |
| --- | --- | --- |
| Eyes | `14a9eb078a51fc9511a11d19b921a146858e091a` | GitHub eyes-bidblitz, `work/central-sso-live-20261004`, `6a9b98ece3670afbb21fba28230e143ebbbac1aa` |
| Trade | `b24ef8edebcd1fe29a5aef961eacb45be4085b10` | GitHub Trade, `work/central-sso-live-20261004`, gleicher Commit |
| NEX | `29ef88c` | Bestehendes Forgejo-Repository, `work/central-sso-production-20261004`, `88c68e76c4bb76394007559a7d813220f2591ca4` einschließlich persistierter Compose-Konfiguration |
| Stack | `ad24463` | Bestehendes Server-Git-Repository, `work/central-sso-production-20261004`, `3223032f5bbc621dfae48783d4071393aa24cac2` einschließlich persistierter Compose-Konfiguration |

Die vier API- und vier Web-Images heißen `bidblitz-central-<projekt>-api:20261004` bzw. `bidblitz-central-<projekt>-web:20261004`. Die SSO-Dateien und private Umgebungsanbindung wurden auch in den bestehenden Deployment-Quellpfaden persistiert. Hauptbranches mit unabhängigen Änderungen wurden nicht pauschal veröffentlicht.

### Allgemeine CI-Grenze

Der allgemeine [Backend-CI-Lauf 37220463898](https://github.com/dw8yhmnzb6-cmyk/bidblitz-app/actions/runs/37220463898), Job `111489574876`, ist **nicht vollständig grün**: **367 bestanden, 9 fehlgeschlagen**. Die neun Fehler sind Erwartungen an den zentralen Router-Registry-Quelltext für Karten, Geschenkkarten, Aktien, Sparziele, Crypto, Reselling, BlitzPay, Live-Shopping und den doppelten alten Kids-Money-Router. Diese Registry-Erwartungen werden von dem begrenzten, auf dem vorhandenen produktiven Stand aufgebauten Release nicht erfüllt. Diese neun Fehler wurden nicht behoben; aus den erfolgreichen SSO-Prüfungen folgt keine Freigabe dieser Fachfunktionen.

Frontend-ESLint einschließlich Cache-/Retry-Prüfungen im selben CI-Lauf ist erfolgreich. Der separate [Frontend-Produktionsbuild 37220463889](https://github.com/dw8yhmnzb6-cmyk/bidblitz-app/actions/runs/37220463889) ist ebenfalls erfolgreich. Die vorherige zentrale Veröffentlichung hatte 119 gezielte Backend- und 19 Frontend-Tests sowie erfolgreiche Live-Menüprüfungen bei beiden Breiten.

## Weiterhin gesperrte Anbindungen

| Projekt | Konkreter offener Punkt |
| --- | --- |
| AION | `aion.bidblitz.ae` löste vom verbundenen Rechner nicht auf; die letzten ausgelesenen Railway-Frontend-/Backend-Deployments vom 26. September waren fehlgeschlagen. Der vorbereitete SSO-Stand ist nicht als aktiver Empfänger verifiziert. |
| Verify | `verify.bidblitz.ae` zeigt auf einen anderen Server; die geprüfte SSO-/Landing-Route lieferte 404. Der vorbereitete Code ist nicht als Live-Empfänger veröffentlicht. |
| BIDTAX | Der vorbereitete private SSO-Branch ist nicht live veröffentlicht. Für `bid-tax.com` bestand keine verifizierte Empfänger-/Hosting-Verbindung; der HTTPS-Aufruf vom verbundenen Rechner scheiterte am Handshake. Das ist kein Nachweis, dass die ganze Website ausgefallen ist. |
| 14 weitere externe Projekte | Für `power, charging, passport, games, iptv, the-eye, veysca, conformexa, os, remote, spy, tv, charge, match` ist in diesem Release kein zentraler SSO-Empfänger integriert. |

Die drei vorbereiteten und 14 übrigen externen Projekte wurden nicht aktiviert. Ein Katalogeintrag allein ersetzt keine veröffentlichte Empfängerroute oder geprüfte lokale Berechtigung. Die UI unterscheidet konfigurierte SSO-Anbindungen von einem allgemeinen Status „remote_access_verified“; dieser Status wird nicht pauschal auf wahr gesetzt.

## Sicherungen und Rücknahme

Projektserver: private Container-/Konfigurations-Sicherungen und freigegebene Ergebnisdateien unter `/root/central-sso-release-20261004`. Vorherige Container tragen den Suffix `-before-central-sso-20261004`. Zentrale Umgebungs-Sicherung: `/var/www/bidblitz/admin-sso-env-backup-20261004/backend.env`. Private Konfigurationsdateien enthalten Geheimnisse und dürfen nicht als Artefakte veröffentlicht werden.

Bei einer Rücknahme zuerst die vier zentralen Aktivierungsflags deaktivieren und den zentralen API-Prozess neu starten, dann die gezielt gesicherten Empfängercontainer/Dateien wiederherstellen. Additive Nonce-Tabellen bleiben erhalten; bei Trade muss die bekannte Nonce-Migrationsdatei auch im alten Quellpfad vorhanden bleiben. Bestehende Datenbankinhalte und Benutzersitzungen dürfen nicht pauschal überschrieben oder widerrufen werden.

Vor dieser finalen Aktivierung gab es zwei zurückgenommene Prüfläufe wegen Fehlern der Browser-Testauswertung (nicht abgefangene Promise bzw. Antwort nach Navigation nicht mehr lesbar). Nach korrigierter Erfassung bestanden alle acht Live-Abläufe; die vier Flags sind im erfolgreichen Abschlusslauf aktiviert.
