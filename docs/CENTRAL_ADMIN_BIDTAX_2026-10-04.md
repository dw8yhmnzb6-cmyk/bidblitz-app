# BIDTAX als siebter SSO-Empfänger

Erweiterung auf dem zentralen Stand `21c1ac46d60e1d125d9e0e2c12769030ed68220e`. Das vorhandene Projekt `dw8yhmnzb6-cmyk/Tax` wurde auf Basis von `2d886a08ba0d421fff0f3c464cd764cc9132bd61` erweitert. Kein neues Produktsystem, keine zweite Datenbank, keine Produktionsbereitstellung.

Der zentrale Aussteller kennt jetzt BIDTAX. Das explizite `BIDBLITZ_BIDTAX_BASE_URL` akzeptiert HTTPS unter `.bidblitz.ae` sowie ausschließlich für BIDTAX `bid-tax.com` und dessen Subdomains. Editable Katalogadressen haben keinen Einfluss. Rollen-, Owner-, Status-, Origin- und Freischaltungsprüfungen bleiben erforderlich. Die Diagnose nennt die feste lokale Konto-/Schlüssel-/Subject-Konfiguration; `remote_access_verified` bleibt immer `false`.

Der Empfänger nutzt das vorhandene aktive lokale `super_admin`-Konto und die vorhandenen JWT-/Cookie-Helfer. Nonces werden atomar in der bestehenden MongoDB verbraucht. Aktive MFA-Faktoren sperren diesen zusätzlichen Einstieg, weil im geprüften Tax-Quellstand kein MFA-Abschluss montiert ist. Codefragmente werden vor React entfernt; Analytics ist auf dem Einstiegsdokument deaktiviert.

## Verifikation

- 118 zentrale Backend-/API-/Rechte-/SSO-/Navigation-/Diagnosetests bestanden.
- 50 BIDTAX-Backend-Tests und 9 Browser-Helfer-Tests bestanden.
- BIDTAX-Frontend-Build erfolgreich; lokaler Ajv-Workaround, Lint nicht Teil dieses Builds.
- Browserprüfung bei 1440/390 Pixel über echten zentralen Aussteller und BIDTAX-Empfänger bis zum echten Admin-Overview-Endpunkt erfolgreich. Getrennte MongoDB-Testdoubles, keine echten Konten. Fragment entfernt, ein Austausch, Wiederholung gesperrt, HttpOnly-Cookies, kein Analytics-Aufruf, keine JavaScript-Laufzeitfehler.
- Private OCR-/Payment-SDKs wurden durch Stubs ersetzt, die bei Nutzung abbrechen; Start-Seeds/Migrationen nicht ausgeführt. Dies ist eine Anmeldungskontrolle, kein vollständiger Produkttest. Vorbestehender Tax-Admin-Seed und reproduzierbare Frontend-Abhängigkeiten bleiben vor Produktion zu prüfen.

Die Empfänger-Dokumentation liegt im Tax-Repository unter `docs/CENTRAL_ADMIN_SSO_2026-10-04.md`; die wiederholbare projektübergreifende Browserprüfung unter `tests/central_sso_browser_verify.cjs`.

Alle 35 Katalogeinträge bleiben erhalten. Von 21 externen Projekten haben jetzt sieben einen vorbereiteten SSO-Adapter; weitere 14 sind damit noch nicht über einen gemeinsamen Login angebunden. Die 14 internen Einträge verwenden die bestehende BidBlitz-Sitzung. Das ist kein Prozentwert für den Fertigstellungsgrad sämtlicher Produkte. Live-Konten, Deployment, Konfiguration und Freischaltung bleiben offen; es wurden keine produktiven Rollen vergeben.

Gesicherter Empfängerstand: [Tax `be55cc8`](https://github.com/dw8yhmnzb6-cmyk/Tax/commit/be55cc82f38cb433a55de2e9a8d5667a92309781), Arbeitszweig `work/central-sso-20261004`.
