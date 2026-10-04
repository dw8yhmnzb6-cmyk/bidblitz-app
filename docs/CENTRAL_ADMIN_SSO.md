# BidBlitz: zentrale Projektverwaltung und Owner-Anmeldung

Stand: 4. Oktober 2026. Implementierter Code, keine Produktionsfreischaltung.

## Verhalten

`/admin/projects` verwaltet 35 Standard-Katalogeinträge sowie eigene zusätzliche Einträge in der bestehenden BidBlitz-Datenbank. Änderungen verwenden Revisionen und ein begrenztes Audit-Protokoll. Suche, Statusfilter und Bearbeitung sind vorhanden. Nur ein ausdrücklich konfigurierter Owner mit aktueller Datenbankrolle `admin` oder `super_admin` darf den Katalog ändern oder Zugangscodes ausstellen. Login-Aliase allein verleihen keine Owner-Rechte.

BidBlitz öffnet seinen eigenen Admin mit der bestehenden Sitzung. Für Eyes, Trade, NEX, Stack, AION, Verify, BIDTAX und Conformexa und Spy BidBlitz und Remote bestehen Empfänger und Browser-Übergaben. Andere Projekte bleiben sichtbar und bearbeitbar, ihr gemeinsamer Admin-Zugang bleibt deaktiviert. Ein normaler Projektlink wird nicht als gemeinsame Anmeldung angezeigt.

Die zusätzliche Ansicht „Anbindungen & offene Schritte“ zeigt pro Projekt
die lokale Katalogfreigabe, erlaubte Ziele, explizite Freischaltung,
Schlüssel-Verfügbarkeit und Owner-Subject-Verfügbarkeit. Sie liefert nur
Konfigurationsnamen, niemals Schlüsselwerte oder konkrete Kontenzuordnungen.
Alle externen Konten-, Bereitstellungs-, Rechte- und MFA-Prüfungen bleiben
ausdrücklich offen. Die Ansicht führt keine Empfänger-Anfragen aus und stellt
keine Codes aus. Details: [Anbindungsdiagnose](CENTRAL_ADMIN_READINESS_2026-10-04.md).

Der Browser öffnet einen fest erlaubten Empfänger unter `/auth/bidblitz-sso#code=...`. Das Ziel entfernt den Code vor dem ersten Austausch aus der Adresszeile und erstellt mit einem POST eine eigene lokale Sitzung. Der Code erscheint nicht in Abfrageparametern, Cookies oder Browser-Speicher. Doppelte React-Mounts teilen genau einen Austausch. Anfragen haben ein Zeitlimit.

## Sicherheitsvertrag

HMAC-SHA256 über `base64url(JSON)`, getrennt durch einen Punkt von der Signatur. Felder: `iss=https://bidblitz.ae`, projektspezifisches `aud`, stabiles Owner-`sub`, `role=owner`, `permissions=["*"]`, ganzzahlige `iat`/`exp`, zufällige `nonce`. Der Aussteller verwendet 60 Sekunden; Empfänger erlauben höchstens 90 Sekunden und höchstens 15 Sekunden Zukunftstoleranz. Signatur, Objektstruktur, Audience, Zeit, Rolle, Subject und Nonce werden geprüft. Ein abgelaufener Code ist auch exakt zum Ablaufzeitpunkt ungültig.

Ein Ziel ordnet das Subject ausschließlich einem bereits vorhandenen lokalen Admin-Konto zu. Es legt weder Konten noch Rollen an. Die E-Mail im Code entscheidet nicht über Rechte. Nonces werden in der jeweiligen bestehenden Datenbank mit einem eindeutigen Digest atomar verbraucht. Ein paralleler Austausch darf nur einmal gewinnen. Das bestehende Sitzungs- und Berechtigungssystem bleibt maßgeblich.

Trade verwendet seinen vorhandenen TOTP-/Recovery-Login, wenn ein Faktor aktiv ist; bis zur erfolgreichen zweiten Stufe gibt es kein Zugriffstoken. AION behält Faktoren und lokale Step-up-Prüfungen; SSO behauptet keine bestätigte starke Authentifizierung. Stack bindet einen aktiven TOTP-Faktor an den vorhandenen lokalen MFA-Empfänger und verweigert die Übergabe, wenn dieser nicht montiert ist.

## Konfiguration des Ausstellers

- `BIDBLITZ_OWNER_EMAILS`: ausdrücklich freigegebene aktuelle Datenbank-E-Mails. Wenn nicht gesetzt, gilt `BIDBLITZ_CANONICAL_OWNER_EMAIL`, sonst `admin@bidblitz.ae`.
- `BIDBLITZ_OWNER_ID`: stabiles Owner-Subject, auf allen Empfängern identisch konfigurieren.
- Je Projekt `BIDBLITZ_SSO_<PROJEKT>_SECRET`: eigener Schlüssel mit mindestens 32 Zeichen. `BIDBLITZ_SSO_SHARED_SECRET` bleibt ein Legacy-Fallback; ein ausdrücklich leerer projektspezifischer Schlüssel deaktiviert diesen Fallback.
- Je Projekt `BIDBLITZ_SSO_<PROJEKT>_ENABLED=true`: explizite Freischaltung. Ein Schlüssel allein aktiviert keinen Zugang.
- AION und Verify benötigen zusätzlich `BIDBLITZ_AION_BASE_URL` bzw. `BIDBLITZ_VERIFY_BASE_URL`. Nur eine HTTPS-Origin unter `.bidblitz.ae`, ohne Zugangsdaten, Pfad, Query, Fragment oder fremden Port, wird akzeptiert. Katalog-Adressen beeinflussen diese Übergabeziele nicht.
- BIDTAX benötigt `BIDBLITZ_BIDTAX_BASE_URL`: HTTPS unter `.bidblitz.ae` oder `bid-tax.com`/dessen Subdomains. Nur dieser Adapter akzeptiert die zusätzliche Domain; sonst gelten dieselben Origin-Grenzen.
- Der Projektstatus muss `active` oder `dev` sein. `hidden` und `coming_soon` stellen keine Codes aus.

## Empfänger

| Projekt | API-Austausch | Schlüssel | Owner-Zuordnung | Lokales Konto |
| --- | --- | --- | --- | --- |
| Eyes | `/api/auth/bidblitz-sso` | `EYES_BIDBLITZ_SSO_SHARED_SECRET` | `EYES_BIDBLITZ_OWNER_ID` | `EYES_BIDBLITZ_LOCAL_ADMIN_EMAIL`, aktiver `admin` |
| Trade | `/api/auth/bidblitz-sso` | `TRADE_BIDBLITZ_SSO_SHARED_SECRET` | `TRADE_BIDBLITZ_OWNER_ID` | `TRADE_BIDBLITZ_LOCAL_ADMIN_ID`, aktiver `SUPER_ADMIN` |
| NEX | `/api/auth/bidblitz-sso` | `NEX_BIDBLITZ_SSO_SHARED_SECRET` | `NEX_BIDBLITZ_OWNER_ID` | `NEX_BIDBLITZ_LOCAL_OWNER_ID`, `OWNER` der Plattformorganisation |
| Stack | `/api/auth/bidblitz-sso` | `STACK_BIDBLITZ_SSO_SHARED_SECRET` | `STACK_BIDBLITZ_OWNER_ID` | `STACK_BIDBLITZ_LOCAL_OWNER_ID`, `OWNER` der Plattformorganisation |
| AION | `/api/auth/bidblitz-sso` | `AION_BIDBLITZ_SSO_SHARED_SECRET` | `AION_BIDBLITZ_OWNER_ID` | `AION_BIDBLITZ_LOCAL_ADMIN_ID`, aktiver Plattformadministrator im Plattform-Tenant |
| Verify | `/v1/auth/bidblitz-sso` | `BBV_BIDBLITZ_SSO_SHARED_SECRET` | `BBV_BIDBLITZ_OWNER_ID` | `BBV_BIDBLITZ_LOCAL_ADMIN_EMAIL`, bestehender `ADMIN`; ausschließlich Sandbox |
| BIDTAX | `/api/auth/bidblitz-sso` | `BIDTAX_BIDBLITZ_SSO_SHARED_SECRET` | `BIDTAX_BIDBLITZ_OWNER_ID` | `BIDTAX_BIDBLITZ_LOCAL_ADMIN_ID`, vorhandener aktiver `super_admin` |
| Conformexa | `/v1/platform/admin/bidblitz-sso` | `CONFORMEXA_BIDBLITZ_SSO_SHARED_SECRET` | `CONFORMEXA_BIDBLITZ_OWNER_ID` | vorhandener `platform_operator`-Kontext; keine Tenant-Rollenänderung |

BIDTAX benötigt zusätzlich `BIDTAX_BIDBLITZ_SSO_ENABLED=true` und `BIDTAX_BIDBLITZ_SSO_BROWSER_ORIGIN`. Bei Hinweisen auf einen zweiten Faktor sperrt der neue Einstieg, da im geprüften Quellstand kein MFA-Abschluss montiert ist. Das lokale Konto, seine Rolle und `auth_version` werden bei jeder SSO-Sitzungsanfrage erneut geprüft. Details: [BIDTAX-Anbindung](CENTRAL_ADMIN_BIDTAX_2026-10-04.md).

Trade nutzt die vorhandenen `CORS_ORIGINS`, NEX `NEX_ALLOWED_ORIGINS`, Stack `STACK_ALLOWED_ORIGINS`. Die tatsächliche Origin des eigenen Projektbrowsers muss zugelassen sein. AION benötigt `AION_BIDBLITZ_SSO_BROWSER_ORIGIN`. Eyes tauscht jetzt aus dem eigenen Browserprojekt aus, wodurch kein BidBlitz-Cross-Origin-Cookie-Austausch erforderlich ist.

## Einrichten und prüfen

1. Empfänger-Code integrieren, bestehendes lokales Owner-/Admin-Konto prüfen und dessen konkrete ID oder E-Mail zuordnen. Keine Konten automatisch hochstufen.
2. Schlüssel außerhalb von Git sicher konfigurieren; je Empfänger und Aussteller müssen die projektspezifischen Werte übereinstimmen. Keine echten Schlüssel in Dokumentation oder Logs schreiben.
3. Trade: Alembic-Migration `0212_central_sso_nonces` anwenden. Stack: Migration `050_central_sso.sql` über den bestehenden Migrationslauf anwenden. NEX: `002_central_sso.sql` auf vorhandenen Datenbanken anwenden; neue Datenbanken laden den gesamten Migrationsordner. Eyes und Verify haben vorhandene Nonce-Tabellen. AION nutzt eine eigene Collection im bestehenden MongoDB mit eindeutigem `_id` und TTL-Index.
4. Den Projektbrowser und die API unter der tatsächlichen Projekt-Origin bereitstellen. Die SPA muss die Landing-Route ausliefern. Verify bleibt eine Testumgebung und darf nicht als echte Identitätsprüfung aktiviert werden.
5. Erst nach erfolgreichem Empfänger-Login das zentrale Freischaltungsflag setzen und den Katalogstatus freigeben. Anmeldung, Logout, Rollenentzug, abgelaufenen und wiederverwendeten Code sowie bestehende MFA prüfen.

## Prüfung dieses Arbeitsstands

- Zentraler Katalog: API-Tests für echte JWT-Auswertung, Rechte, Speicherung, Revisionen, Origins, Secret-Fallback, explizite Freischaltung und feste Ziele; React-Tests für Fehler, Bearbeitung und deaktivierte Zugänge.
- Sechs Empfänger: je 22 Protokolltests und fünf Browser-Helfer-Tests für Signatur-/Claim-Fehler, Mapping, Fragmententfernung und genau einen Austausch.
- Empfänger-APIs: echte SQLite-Sitzungen bei Eyes/Verify; echte PostgreSQL-Sitzungen und Konkurrenztests bei NEX/Stack; Trade mit PostgreSQL und vollständigem vorhandenen TOTP-Abschluss; AION mit MongoDB-Testdouble, echter Session-Logik und separat gemocktem Audit. Redis-Drosselung ist im PostgreSQL-Browser-/API-Test isoliert ersetzt.
- Alle sieben Frontends einschließlich BidBlitz bauen erfolgreich. NEX wurde zusätzlich im Browser mit vollständiger lokaler Datenbankstruktur geprüft: Owner-Sitzung, Dashboard, leerer URL-Fragment, keine horizontale Überbreite und keine Browserfehler.

Diese Prüfungen betreffen den entwickelten Stand, keine bereits laufende Produktion. Es wurden keine Live-Trades oder echten Zahlungen ausgelöst.

## Noch nicht angebundene Projekte

Power, iCharging, Passport, Games, IPTV, The Eye, VEYSCA, Conformexa, OS,
Remote, Spy, TV, Charge, BIDTAX und Match besitzen in diesem zentralen
Arbeitsstand keinen freigeschalteten Empfänger. Die Verwaltung ihrer
Katalogeinträge ist vorhanden. Das geprüfte Power-Repository enthält lediglich
ein README; IPTV hat einen Benutzerlogin, aber keinen geprüften lokalen
Admin-Rollenvertrag für diese Übergabe. 13 native Produktmodule und der
Haupt-Admin verwenden dagegen die bestehende BidBlitz-Sitzung; sie ersetzen
keine separate Owner-Anmeldung eines anderen Projekts.

Die Produktionsaktivierung benötigt die tatsächlichen Live-Versionen, Owner-Zuordnungen und Schlüssel. Der zuletzt geprüfte BidBlitz-Produktionszugang unter der vorhandenen Deployment-Konfiguration verweigerte SSH-Authentifizierung. Neue Arbeitsbranches wurden nicht nach `main` gemergt und keine Produktionsbereitstellung wurde ausgelöst.

Conformexa verwendet keine Tenant-Admin-Hochstufung. Der Empfänger verbraucht den Einmalcode atomar in Migration `0015_bidblitz_central_sso.sql` und erzeugt ausschließlich die bestehende serverseitige Operator-Sitzung. Der Plattform-Schlüssel bleibt serverseitig. Erlaubte explizite Zielorigins sind `.bidblitz.ae`, `conformexa.com`/Subdomains und `conformexa.de`/Subdomains; Katalog-URLs beeinflussen das Ziel nicht.

| Spy BidBlitz | `/api/v1/dev/admin/bidblitz-sso` | `SPY_BIDBLITZ_SSO_SHARED_SECRET` | `SPY_BIDBLITZ_OWNER_ID` | serverseitige `DEV_ADMIN`-Sitzung; alter DEV-Key bleibt Fallback |

| Remote | `/v1/auth/bidblitz-sso` | `REMOTE_BIDBLITZ_SSO_SHARED_SECRET` | `REMOTE_BIDBLITZ_OWNER_ID` | vorhandener Remote-`owner` + Organisation; kein neues Konto |

| VEYSCA | `/api/v1/admin/bidblitz-sso` | `VEYSCA_BIDBLITZ_SSO_SHARED_SECRET` | `VEYSCA_BIDBLITZ_OWNER_ID` | 30-Minuten-`VEYSCA_ADMIN`-Sitzung; manueller Admin-Token bleibt Fallback |

| BidBlitz TV | `/api/v1/admin/bidblitz-sso` | `BIDBLITZ_TV_SSO_SHARED_SECRET` | `BIDBLITZ_TV_OWNER_ID` | read-only `TV_ADMIN`; keine Playlist-/Kundenrechte |
