# CoreData Runtime Trace (lokal in Xcode)

Dieses Projekt enthält jetzt einen DEBUG-Runtime-Trace in `App/CoreDataTrace.m`.

## Was geloggt wird
- `[CoreDataTrace] NSPersistentStoreCoordinator swizzle active`
- `[CoreDataTrace] addPersistentStore called ...`
- kompletter Call-Stack über `NSThread callStackSymbols`
- `[HealthDebug] HealthPlugin initialized`
- `[HealthDebug] HKHealthStore initialized`

## Lokaler Test auf dem Mac / echten iPhone
1. `frontend/ios/App/App.xcworkspace` in Xcode öffnen
2. Scheme: Debug
3. Symbolischen Breakpoint hinzufügen:
   - Symbol: `-[NSPersistentStoreCoordinator addPersistentStoreWithType:configuration:URL:options:error:]`
4. Optional zweiten symbolischen Breakpoint hinzufügen:
   - Symbol: `-[NSPersistentStoreCoordinator bb_trace_addPersistentStoreWithType:configuration:URL:options:error:]`
5. App vom iPhone löschen
6. Clean Build Folder
7. App neu auf echtem iPhone installieren und starten
8. Reihenfolge der Logs prüfen:
   - erste `[CoreDataTrace] addPersistentStore called ...`
   - `[HealthDebug] HealthPlugin initialized`
   - `[HealthDebug] HKHealthStore initialized`
   - CoreData-Fehlerlog mit `default.store`

## Auswertung
- Wenn `default.store` / CoreData-Fehler **vor** `[HealthDebug] HKHealthStore initialized` erscheint, ist HealthKit **nicht** als Hauptursache bewiesen.
- Wenn der Trace direkt einen Stack mit HealthKit-/Plugin-Pfaden zeigt, ist der Aufrufer klarer eingegrenzt.
- Wenn der Fehler nur beim Öffnen der Move/Health-Funktion erscheint, ist das Health-Plug-in deutlich wahrscheinlicher beteiligt.