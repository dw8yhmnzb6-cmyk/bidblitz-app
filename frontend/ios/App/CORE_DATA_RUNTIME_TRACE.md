# CoreData Runtime Trace (lokal in Xcode)

Dieses Projekt enthält jetzt einen DEBUG-Runtime-Trace in `App/CoreDataTrace.m`.

## Was geloggt wird
- `[CoreDataFix][ENSURE] ...`
- `[CoreDataFix][PATH] ...`
- `[CoreDataFix][STATE] ...`
- `[CoreDataFix][PATH_STATE] ...`
- `[CoreDataTrace][START] ...`
- `[CoreDataTrace][CALLER] ...`
- `[CoreDataTrace][FRAMEWORK] ...`
- `[CoreDataTrace][STORE_URL] ...`
- `[CoreDataTrace][END] ...`
- kompletter Call-Stack über `NSThread callStackSymbols`
- `[HealthDebug] HealthPlugin initialized`
- `[HealthDebug] HKHealthStore initialized`

## Lokaler Test auf dem Mac / echten iPhone
1. `yarn ios:diagnose` ausführen
2. `frontend/ios/App/App.xcworkspace` in Xcode öffnen
3. Scheme: Debug
4. App vom iPhone löschen
5. App neu auf echtem iPhone installieren und starten
6. Reihenfolge der Logs prüfen:
   - `[CoreDataFix][ENSURE] ...`
   - `[CoreDataFix][PATH] ...`
   - `[CoreDataFix][STATE] ...`
   - erste `[CoreDataTrace][START] ...`
   - `[HealthDebug] HealthPlugin initialized`
   - `[HealthDebug] HKHealthStore initialized`
   - CoreData-Fehlerlog mit `default.store`

## Auswertung
- Wenn bereits `[CoreDataFix][STATE] support_exists=true support_is_directory=true` erscheint, wurde der Standardpfad beim Launch erfolgreich vorbereitet.
- Wenn `before_store_parent_ensure` bereits `exists=false` und `after_store_parent_ensure` `exists=true` zeigt, greift die zusätzliche Parent-Verzeichnis-Härtung korrekt.
- Wenn `default.store` / CoreData-Fehler **vor** `[HealthDebug] HKHealthStore initialized` erscheint, ist HealthKit **nicht** als Hauptursache bewiesen.
- Wenn der Trace direkt einen Stack mit HealthKit-/Plugin-Pfaden zeigt, ist der Aufrufer klarer eingegrenzt.
- Wenn der Fehler nur beim Öffnen der Move/Health-Funktion erscheint, ist das Health-Plug-in deutlich wahrscheinlicher beteiligt.