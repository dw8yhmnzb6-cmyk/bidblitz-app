# Taxi-Map zeigt nichts in Production (`bidblitz.ae`) — Diagnose & Fix

## Symptome (laut User-Screenshots vom 14.05.2026)
- `/taxi` auf `bidblitz.ae` → **Map ist komplett schwarz**
- Kein GPS-Pin sichtbar
- Bottom-Sheet funktioniert (Adressen eingeben geht), aber:
- **„Leider ist kein freies Taxi in Ihrer Nähe."** in dominantem rotem Banner

## Root Cause (sehr wahrscheinlich)

Der Preview-Build (Emergent) zeigt die Map korrekt → Code & Token sind **lokal OK**.
Production (`bidblitz.ae`) zeigt sie nicht → **Production-Deployment-Problem**.

Die wahrscheinlichsten 3 Ursachen:

### 1️⃣ `REACT_APP_MAPBOX_TOKEN` fehlt im Production-Build
React inlined Env-Variablen zum **Build-Zeitpunkt**, nicht zur Runtime.
- Wenn dein CI/CD-Pipeline die Variable nicht gesetzt hat, ist der Token **nicht im JS-Bundle** und Mapbox sendet keine Requests.
- Check: Öffne `https://bidblitz.ae/taxi`, drücke `F12` → **Network**-Tab → filtere auf `mapbox.com`. Wenn **keine Requests** zu sehen sind → Token fehlt.

**Fix**:
```bash
# Auf dem Production-Server (oder CI):
export REACT_APP_MAPBOX_TOKEN=pk.eyJ1Ijo...   # gleicher Wert wie in /app/frontend/.env
cd frontend && yarn build
# danach: build/ deployen
```

### 2️⃣ Mapbox-Token URL-Restriction blockiert `bidblitz.ae`
Mapbox-Tokens können auf bestimmte URLs beschränkt sein. Wenn `bidblitz.ae` nicht in der Allowed-List ist, gibt Mapbox **401/403** zurück.
- Check (in Browser DevTools → Network): Mapbox-Request hat Status `401` oder `403`?

**Fix**:
1. https://account.mapbox.com/access-tokens → Token auswählen
2. **URL Restrictions** → `https://bidblitz.ae/*` und `https://www.bidblitz.ae/*` hinzufügen
3. **Save**
4. Browser-Cache löschen, neu laden

### 3️⃣ Service-Worker / CDN cached alten Build ohne Token
Manchmal cached ein Service-Worker oder Cloudflare den alten Build.
**Fix**: Hard-Reload mit `Cmd/Ctrl+Shift+R` oder Service-Worker im DevTools löschen.

---

## Was ich JETZT im Code verbessert habe (Iter93)

1. **Sichtbares Error-Overlay** (`taxi-map-error`):
   - Wenn Mapbox-Token fehlt → roter Banner „Karte nicht verfügbar (Konfigurationsfehler)"
   - Wenn 401/403 → „Karte nicht autorisiert. Bitte Support kontaktieren (Token-Fehler)"
   - Wenn Netzwerkfehler → „Karte konnte nicht geladen werden. Bitte Internetverbindung prüfen"
   - „Neu laden"-Button

2. **„No-drivers"-Banner abgeschwächt**:
   - Vor: roter Block mit „Leider ist kein freies Taxi in Ihrer Nähe"
   - Nach: gelber Info-Block „Gerade kein Taxi frei — wir benachrichtigen dich, sobald ein Fahrer verfügbar ist"
   - User wird nicht mehr abgeschreckt, kann trotzdem bestellen

3. **Map-Error-Handler im `useTaxiMap.js`**:
   - `.on("error", ...)` fängt alle Mapbox-internal-Errors ab
   - `.catch()` auf der Bundle-Load-Promise
   - Hard-Fail wenn `REACT_APP_MAPBOX_TOKEN` fehlt

---

## Production-Check für den User (Schritt für Schritt)

1. **Browser DevTools öffnen** auf `https://bidblitz.ae/taxi` (F12, Mobile Chrome remote-debug)
2. **Console-Tab** → Suche nach Zeilen die mit `[taxi]` beginnen (neuer Logger)
3. **Network-Tab** → Filter `mapbox.com`:
   - Keine Requests? → Token fehlt im Build (Ursache #1)
   - Status 401/403? → URL-Restriction (Ursache #2)
   - Status 200 aber Map bleibt schwarz? → CSS/Container-Issue, screenshot bitte schicken

---

## Empfehlung
Schau auf das **Mapbox-Dashboard** (`account.mapbox.com`):
- Statistik → siehst du Requests von `bidblitz.ae`? Falls **0 Requests** trotz User-Besuchen → Token fehlt im Build.
- Falls Requests da sind aber `4xx`-Errors → URL-Restriction.
