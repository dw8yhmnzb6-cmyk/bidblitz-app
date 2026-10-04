# Zentrale Anbindungsdiagnose

Fortsetzung auf dem gesicherten Projekt-/Rechtestand `caf44c5`.
Implementierter Code, keine Produktionsbereitstellung oder Rollenänderung.

## Ablauf

Owner öffnet `/admin/projects` → bestehender JWT-/Datenbankkontocheck →
Katalog und lokale Konfiguration → geheime Werte werden ausgeschlossen →
Ansicht „Anbindungen & offene Schritte“.

Die Diagnose kommt im vorhandenen `GET /api/admin/projects` mit
`Cache-Control: no-store`. Umschalten, Suche und Filter erzeugen keine
zusätzlichen Anfragen. Authentifizierung behält ihre vorhandene
`last_seen`-Aktualisierung bei; die Diagnose selbst ändert keine Konten,
Rollen oder Katalogeinträge und stellt keine Zugangscodes aus.

## Aussagegrenzen

| Anzeige | Tatsächliche Aussage |
| --- | --- |
| Interner Einstieg | Feste Route im bestehenden BidBlitz-Admin; Aktionen prüfen weiterhin eigene Rechte. |
| Empfänger-Code lokal erfüllt | Einer der sechs bereits vorbereiteten Adapter ist bekannt; nicht live bestätigt. |
| Aussteller konfiguriert | Erlaubtes Ziel, Freischaltungsflag, ausreichend langer Schlüssel und nichtleeres Owner-Subject. |
| Lokales Admin-Konto / Bereitstellung / Anmeldung noch prüfen | Zielkonto, Rechte, tatsächliche Version, Nonce-Speicher und MFA sind extern nicht bestätigt. |
| Ohne SSO-Empfänger | Kein geprüfter gemeinsamer Login; eine Katalogadresse aktiviert nichts. |

`integration.remote_access_verified` bleibt für alle Einträge `false`.
Die Diagnose kann weder im Schreibmodell gesetzt noch über gespeicherte
Katalogfelder überschrieben werden. Keine automatische Kontenanlage oder
Hochstufung. Bestehende Status-, Origin-, Einmal-Code- und MFA-Gates bleiben
unverändert.

Projektspezifische Schlüssel haben unverändert Vorrang. Ein explizit leerer
Projektschlüssel sperrt den Legacy-Fallback. Wenn der ausreichend lange
Legacy-Schlüssel verwendet wird, weist die Diagnose auf einen separaten
Projektschlüssel hin, ohne den vorhandenen Übergabevertrag zu ändern.
Ungültige Origins werden nicht in der Antwort wiederholt.

Nur feste Konfigurationsnamen und Migrationshinweise der bekannten sechs
Empfänger werden angezeigt, niemals echte IDs, E-Mail-Zuordnungen, Subjects,
Schlüssel oder Codes. Verify erhält einen ausdrücklichen Sandbox-Hinweis;
damit ist keine echte Identitätsprüfung freigegeben.

Die Projektübersicht unterscheidet jetzt interne Einstiege und konfigurierte
SSO-Aussteller. Sie zählt einen Aussteller nicht als bestätigtes Zielkonto.
Alle 35 Standard-Einträge bleiben vorhanden; zusätzliche und gespeicherte
Owner-Einträge behalten Vorrang.

## Verifikation

- 114 gezielte Backend-/API-/Rechte-/SSO-/Navigationstests bestanden.
- 19 React-Tests bestanden; ESLint für die geänderte Seite und neue Komponente sauber.
- Produktionsbuild unter der im Repository vorgesehenen Node-20-Laufzeit erfolgreich.
- Lokale Browserprüfung mit der echten gebauten App, echten Katalog-/SSO-Routern,
  DB-gebundenem Test-JWT und Mongo-Mock bestanden: 35 Diagnosekarten;
  Filter und Alias-/Konfigurationssuche; echter Katalog-PUT und GET nach erneutem
  Laden mit gespeicherter Revision. Kein SSO-Code im Browserlauf ausgestellt.
- Die Browser-Fixture simuliert genau einen konfigurierten Aussteller:
  20 Einträge mit lokalen Sperren, 21 mit offenen externen Prüfungen und einer
  mit konfiguriertem Aussteller. Das sind Testwerte, keine Produktionszahlen.
- Diagnose-Interaktionen nutzen den einen Katalogabruf. API-Antworten enthalten
  weder Testschlüssel noch privates Test-Subject. GET/PUT/GET jeweils HTTP 200;
  kein horizontaler Überlauf bei 1440 oder 390 px, keine JavaScript-Page-Errors.
  Screenshots wurden visuell kontrolliert.

Die Tests decken fehlende/kurze Schlüssel, explizit leere Projektschlüssel,
Legacy-Fallback, leeres Owner-Subject, ungültige Origins, gesperrte Katalogstatus,
alle sechs Empfänger, native Einstiege und unbekannte Projekte ab. Vollständig
konfigurierte Aussteller lassen externe Rechteprüfungen weiterhin offen.

Produktivkonten und externe Empfänger wurden nicht kontaktiert. Keine
Produktionsbereitstellung, echten Zahlungen oder Trades. Die früher
dokumentierten Produktionszugangs- und Kontenzuordnungsblocker bleiben bestehen;
dies ist kein Nachweis einer vollständigen Live-Integration.

Die Browser-Steuerhilfe hatte im vorangegangenen Lauf ihren Hintergrunddienst
nicht starten können; die Prüfung nutzt denselben vorhandenen Chromium direkt
über Playwright. Die lokalen Testprozesse wurden nach dem Lauf beendet.
Die umfassende vollständige App-Regression wird weiterhin nicht behauptet:
Ihre isolierte Testumgebung hat nicht alle Abhängigkeiten von `test_ci_smoke.py`.
