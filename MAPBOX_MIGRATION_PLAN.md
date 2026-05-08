# 🗺️ Mapbox Migration Plan für BidBlitz Taxi

## ✅ Vorbereitung Complete
- Mapbox Token: `pk.eyJ1IjoiYWZyaW1rcmFzbmlxaSIsImEiOiJjbW84bnFtamwwMGdzMnFzOHN0Zjc4M2tqIn0.sW7cpxFxH5S7A46eJdSd6w`
- Packages installiert: `mapbox-gl`, `@mapbox/mapbox-gl-geocoder`
- Integration Playbook: Siehe letzte Agent-Response (10,000+ Wörter Dokumentation)

## 📋 Migration Steps

### Phase 1: Replace Leaflet with Mapbox (TaxiPage.jsx)
**Aktuelle Situation:**
- Verwendet Leaflet.js mit OpenStreetMap tiles
- CartoDB Voyager tiles als "Apple-Maps-Stil"
- Custom marker logic

**Neue Implementierung:**
```javascript
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

// Replace useEffect map initialization
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: 'mapbox://styles/mapbox/streets-v12', // Professional style
  center: [userLongitude, userLatitude],
  zoom: 14,
  language: 'de' // German labels
});
```

### Phase 2: Custom Markers
```javascript
// Convert Leaflet markers to Mapbox
taxis.forEach(taxi => {
  const el = document.createElement('div');
  el.className = 'taxi-marker';
  el.innerHTML = `<div class="taxi-icon">${vehicleEmoji}</div>`;
  
  new mapboxgl.Marker(el)
    .setLngLat([taxi.longitude, taxi.latitude])
    .addTo(map);
});
```

### Phase 3: Geocoding Integration
```javascript
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  language: 'de',
  country: 'de',
  placeholder: 'Adresse suchen...'
});

map.addControl(geocoder);
```

### Phase 4: POI Display
- Mapbox Streets style zeigt automatisch:
  - Restaurants
  - Supermärkte
  - Hotels
  - Flughäfen
  - Bahnhöfe

### Phase 5: Performance
- Vector tiles (schneller als Raster)
- Hardware-beschleunigtes Rendering
- Automatisches tile-caching

## 🔧 Files to Modify
1. `/app/frontend/src/pages/TaxiPage.jsx` (Main map component)
2. `/app/frontend/package.json` (Already updated)
3. `/app/frontend/.env` (Token already added)

## ⚠️ Breaking Changes
- Alle Leaflet-spezifischen Funktionen müssen ersetzt werden
- Marker-Event-Handler ändern sich
- Map bounds/zoom API unterscheidet sich

## 📊 Estimated Effort
- **Phase 1-2:** 2-3 Stunden (Core migration)
- **Phase 3:** 1 Stunde (Geocoding)
- **Phase 4-5:** 30 Min (Styling & Performance)
- **Testing:** 1 Stunde
- **Total:** 4-5 Stunden

## ✅ Benefits
1. **Professionelles Design** wie taxi.eu
2. **Bessere Performance** (60 FPS auf Mobile)
3. **Automatische POIs** (Restaurants, Hotels etc.)
4. **Deutsche Labels** (out-of-the-box)
5. **3D Buildings** (optional)
6. **Offline Maps** (mit Mapbox GL JS)

## 🚀 Quick Start (wenn Zeit)
```bash
# 1. Token ist bereits in .env
# 2. Packages sind installiert
# 3. TaxiPage.jsx öffnen und Leaflet-Code durch Mapbox ersetzen
```

## 📚 Resources
- Mapbox GL JS Docs: https://docs.mapbox.com/mapbox-gl-js/
- Migration Guide: https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/
- Geocoder Docs: https://github.com/mapbox/mapbox-gl-geocoder

---

**Status:** ⏸️ PAUSIERT (wegen Zeit)  
**Nächster Agent:** Sollte diesen Plan für Mapbox-Migration nutzen
