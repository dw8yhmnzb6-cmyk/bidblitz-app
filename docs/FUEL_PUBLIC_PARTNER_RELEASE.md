# BidBlitz Fuel — öffentliche Partnerseite (Public-only)

## Ziel

Geschäftspartner sollen das **Konzept** von BidBlitz Fuel bereits sehen können, ohne dass Provider-Anbindungen, Zahlungsfunktion, Tanksäulenfreigabe oder das private Adminsystem öffentlich erreichbar sein müssen.

Die Seite liegt im **bestehenden** `bidblitz-app`-Repository:

- `frontend/public/fuel-partner.html` — statische öffentliche Partnerseite, keine JavaScript-/API-Abhängigkeiten.
- `frontend/src/pages/FuelLandingPage.jsx` — bestehende Fuel-Startseite mit echtem Link zum Partnerprogramm.
- `frontend/tests/fuel-partner-public.test.cjs` — Prüfungen für mobile Ansicht, Erreichbarkeit der Kontakt-CTA und korrekte Pilot-Hinweise.

Es wurde keine zweite Anwendung und keine zweite Datenbank angelegt.

## Veröffentlichungsgrenze

**Stand: Nur DEV-Branch. Noch keine Live-Freigabe und kein bestätigter öffentlicher HTTP-200-Status für `fuel.bidblitz.ae`.**

Eine Veröffentlichung der *statischen Partnerseite* ist unabhängig von der späteren Freigabe echter Tankzahlungen möglich. Nicht freigeben: `/api/fuel`, `/admin/fuel`, Partner-Credentials, MongoDB, Simulator-API, Zahlungsendpunkte oder Pumpensteuerung.

## DEV-/QA-Nachweis

1. `FUEL_PYTHON=/path/to/venv/bin/python bash scripts/fuel-dev-smoke.sh`.
2. `frontend/tests/fuel-partner-public.test.cjs` muss bestehen.
3. Vollständigen Frontend-Build in einer geprüften, isolierten Umgebung ausführen; nichts ungeprüft deployen.
4. Die statische HTML-Datei ist nach dem React-Build Teil des vorhandenen `frontend/build`-Verzeichnisses.
5. Sicherheit prüfen: Keine Kontaktformulare ohne Datenschutzkonzept, keine anonymen Adminrouten, keine erfundenen Netzwerk-Anbindungen, kein bezahlbarer Tankvorgang.

## Bereitstellung auf dem bestehenden BidBlitz-Webserver

Voraussetzung: Autorisierter Zugriff auf **den bereits verwendeten** Nginx/Webserver, korrektes DNS für `fuel.bidblitz.ae` und gültiges TLS-Zertifikat.

Bevor ein bestehender Serverblock geändert wird, seine Konfiguration und etwaige Routing-Abhängigkeiten prüfen und sichern. Für die Fuel-Subdomain kann eine **separate statische öffentliche Route innerhalb der bestehenden Infrastruktur** eingerichtet werden, deren Root auf die bereits gebauten öffentlichen Assets zeigt. Die Hauptseite der Subdomain darf auf `/fuel-partner.html` leiten. Sie darf **nicht** ungeprüft den Super-App-Backend-Proxy oder Fuel-Admin zugänglich machen.

Die konkreten Pfade und Serverblöcke müssen anhand der tatsächlichen Serverkonfiguration gewählt werden, nicht aus Beispieldaten geraten.

## Prüfungen nach der Veröffentlichung

- `https://fuel.bidblitz.ae/` zeigt die Partnerseite und kein DEV- oder Admin-Dashboard.
- `https://fuel.bidblitz.ae/fuel-partner.html` liefert HTTP 200, HTML und korrektes UTF-8.
- Mobilansicht und Kontaktlinks funktionieren.
- Keine JavaScript- oder Cookie-Abhängigkeit ist erforderlich.
- HTTP wird auf HTTPS umgeleitet; TLS-Zertifikat gültig.
- `/api/fuel`, `/admin/fuel`, Credentials, Bearer-Token und Dateien außerhalb des öffentlichen Build-Verzeichnisses sind von dieser Domain aus nicht zugänglich.
- Kein externes Partnernetzwerk oder PSP wird durch die Veröffentlichung aktiviert.

**Erst nach erfolgreicher öffentlicher Prüfung den Link an Partner versenden.**
