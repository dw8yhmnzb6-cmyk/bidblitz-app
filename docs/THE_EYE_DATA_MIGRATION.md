# The Eye – Dateninventur vor der Übernahme auf den Stack

Stand: 4. Oktober 2026.

Der The-Eye-Entwicklungsbranch ist auf GitHub, im zentralen Git unter
`/srv/git/bidblitz-app.git` und im bestehenden privaten Forgejo-Repository
`stack-provisioner/bidblitz-app` gesichert. Die getrennte Arbeitskopie auf dem
Stack liegt unter `/opt/the-eye-dev`. Das ist die Sicherung des versionierten
Codes einschließlich versionierter Dateien, keine Übernahme der laufenden
Datenbank, nicht versionierter Uploads oder Betriebsgeheimnisse.

## Noch fehlende Quelle

Der in älteren Deployment-Unterlagen genannte Host `212.227.20.190` konnte
mit dem vorhandenen SSH-Zugang nicht geöffnet werden. Er ist ein Hinweis aus
der Dokumentation, keine bestätigte aktuelle The-Eye-Datenquelle. In den
überprüften The-Eye-Arbeitskopien war keine lokale Laufzeitkonfiguration
vorhanden. Die vorhandene MongoDB-Restore-Testinstanz des Stacks ist ebenfalls
kein Nachweis der ursprünglichen Datenbank.

Die echte Übertragung bleibt offen, bis die laufende Quelle eindeutig
zugeordnet und über einen vorhandenen freigegebenen Zugang oder ein Backup
zugänglich ist. Ein erfolgreicher Verbindungsaufbau allein bestätigt diese
Zuordnung noch nicht.

## Prüfwerkzeug

`scripts/the_eye_data_preflight.py` liest die vorhandenen The-Eye-Kern- und
Routenmodule sowie The-Eye-Referenzen in der bestehenden Datenbankeinrichtung,
ohne die Anwendung zu importieren oder zu starten. Es findet am aktuellen
Stand 43 direkt referenzierte `the_eye_*`-Collections und die gemeinsame
Abhängigkeit `users`. Die Liste entsteht aus dem Code, nicht aus einer
Datenbankabfrage.

Der Standardlauf benötigt nur Python 3.9 oder neuer und verbindet sich mit
keinem Server:

```bash
python3 /opt/the-eye-dev/scripts/the_eye_data_preflight.py \
  --output /opt/bidblitz-stack-backups/the-eye/code-inventory-NEUER-ZEITSTEMPEL.json
```

Der Ausgabeordner muss existieren. Berichte werden mit Dateirechten 0600 neu
angelegt; bestehende Dateien und Symlinks werden nicht überschrieben.
Der Bericht enthält Commit, Arbeitskopiestatus, Quell-Fingerprint,
Collection-Referenzen und getrennte Laufzeit-/Migrationszustände.
`NOT_INSPECTED` bedeutet: Es wurde keine Datenquelle geprüft.

### Spätere Prüfung einer zugänglichen Quelle

Erst nach Zuordnung zur bestehenden Anwendung kann derselbe Prüfer die
bekannte Quelldatenbank lesend erfassen. Dafür werden PyMongo 4.5.0 und
dnspython 2.8.0 aus den vorhandenen Backend-Abhängigkeiten benötigt.

Eine geschützte JSON-Konfiguration außerhalb des Git-Repositories enthält
genau die Felder `mongo_url` und `db_name` mit den **bestehenden**
Verbindungsdaten. Der Prüfer liest keine beliebigen Umgebungsvariablen.
Zugangsdaten gehören nicht in Git, in den Aufruf oder in Chatnachrichten.
Die Konfigurationsdatei muss eine reguläre Datei mit Zugriff nur für den Eigentümer sein, zum Beispiel mit Rechten 0600;
Gruppen-/Fremdzugriff und Symlinks werden abgewiesen. Verwende einen für diese
Bestandsaufnahme vorgesehenen Datenbankzugang mit Leserechten.

```bash
python3 /opt/the-eye-dev/scripts/the_eye_data_preflight.py \
  --inspect-source \
  --config /GESCHUETZTER-PFAD/the-eye-source.json \
  --output /opt/bidblitz-stack-backups/the-eye/source-inventory-NEUER-ZEITSTEMPEL.json
```

Die Prüfung erfasst nur:

- Vorhandensein der direkt im Code referenzierten The-Eye-Collections.
- Dokumentzahl und Indexzahl vorhandener referenzierter Collections.
- Namen weiterer `the_eye_*`-Collections zur späteren Klärung; deren
  Dokumente und Indizes werden nicht abgefragt.
- Beginn, Ende und Fehlerstatus der Bestandsaufnahme.

`users` und andere gemeinsame Collections werden nicht gelesen.
Dokumentinhalte, Indexdefinitionen, URI, Datenbankname und rohe Treiberfehler
werden nicht in den Bericht übernommen. Daten werden weder kopiert noch
verändert. Verbindungs-/Abfragezeiten sind begrenzt; ein Fehler ergibt
Exit-Code 2 und einen als fehlgeschlagen markierten Bericht. Der Code-Lauf
oder eine erfolgreiche Bestandsaufnahme ergeben Exit-Code 0. Dieser Code
bedeutet **keine erfolgreiche Migration**.

### Grenzen des Ergebnisses

- Die statische Erfassung deckt direkte `db.name`- und
  `db["name"]`-Referenzen ab. Dynamische `db[variable]`-Referenzen werden
  gesondert ausgewiesen. Andere indirekte Zugriffsformen brauchen eine
  zusätzliche Prüfung.
- Zählungen und Indexzahlen werden nacheinander erfasst. Sie sind kein
  konsistenter Snapshot und bestätigen weder Indexdefinitionen noch
  Datenintegrität.
- `source_identity_verified` und `migration_completed` bleiben false.
  Die Zuordnung der Datenquelle, ein tatsächlich erstelltes Backup und
  seine Wiederherstellung brauchen eigene Nachweise.
- Uploads, Kamera-/Media-Dateien, externe Speicher, Secrets, MQTT und
  Hardwarezustände werden von diesem Werkzeug nicht erfasst.
- Die gemeinsame Benutzerabhängigkeit braucht vor einem getrennten Betrieb
  eine ausdrücklich definierte Zuordnung. Keine pauschale Kopie aller
  BidBlitz-Benutzer oder anderer Projektdaten.

## Nach der Bestandsaufnahme

Die geprüfte Quelle bildet die Grundlage für ein eigenes The-Eye-Backup.
Gemeinsame Identitäten und Querverweise werden vorher geklärt. Erst danach
folgen eine isolierte Wiederherstellung auf dem Stack, Vergleich der Daten
und Indexdefinitionen sowie ein Anwendungstest. Der bestehende Git-Branch
und eine bestandene Bestandsaufnahme ersetzen diese Schritte nicht.

In diesem Arbeitslauf wurde kein Live-Datenbankzugriff ausgeführt. Die
Tests verwenden einen Ersatz an der Datenbankschnittstelle; deren Methoden
werden gegen die tatsächlich installierte PyMongo-4.5.0-API geprüft.
Getestet werden insbesondere ausgeschlossene gemeinsame Collections,
sichere Fehlermeldungen, geschützte Dateien und die klare Trennung zwischen
Code-Inventur, Laufzeitprüfung und Migration.

Gezielte lokale Prüfung:

```bash
python -m pytest backend/tests/test_the_eye_data_preflight.py \
  backend/tests/test_the_eye_realtime.py \
  backend/tests/test_the_eye_v1_contract.py -q
```

Die neuen Tests sind nicht als eigener CI-Workflow aktiviert. Der frühere
CI-Entwurf bleibt separat archiviert.
