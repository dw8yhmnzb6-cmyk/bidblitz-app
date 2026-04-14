/**
 * BidBlitz V2 - Mapbox GL Map Component
 * Production-ready map with real user location, markers, and dark theme
 */

import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, Navigation, AlertCircle } from "lucide-react";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const DEFAULT_CENTER = [13.405, 52.52]; // Berlin [lng, lat]
const DEFAULT_ZOOM = 13;

const MARKER_COLORS = {
  user: "#3B82F6",
  scooter: "#22C55E",
  scooterLow: "#F59E0B",
  driver: "#8B5CF6",
  driverBusy: "#EF4444",
  restaurant: "#F97316",
  kid: "#EC4899",
  car: "#00C2FF",
  pickup: "#10B981",
  dropoff: "#EF4444",
};

function createMarkerEl(color, size = 28, pulse = false) {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.4);cursor:pointer;`;
  if (pulse) {
    const ring = document.createElement("div");
    ring.style.cssText = `position:absolute;top:-6px;left:-6px;width:${size + 12}px;height:${size + 12}px;border:2px solid ${color};border-radius:50%;animation:pulse 2s ease-out infinite;opacity:0.6;`;
    el.style.position = "relative";
    el.appendChild(ring);
  }
  return el;
}

const MapboxMap = ({
  scooters = [],
  drivers = [],
  restaurants = [],
  kids = [],
  cars = [],
  pickup = null,
  dropoff = null,
  onMarkerClick = null,
  showUserLocation = true,
  radius = null,
  height = "100%",
  className = "",
  interactive = true,
  style = "mapbox://styles/mapbox/navigation-night-v1",
}) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Get user location
  useEffect(() => {
    if (!showUserLocation) { setLoading(false); return; }
    if (!navigator.geolocation) {
      setLocationError("Geolocation nicht unterstützt");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLocationError(null);
        setLoading(false);
      },
      (err) => {
        const msg = err.code === 1 ? "Standortzugriff verweigert" : "Standort nicht verfügbar";
        setLocationError(msg);
        setLoading(false);
        // Auto-dismiss after 6s
        setTimeout(() => setLocationError(null), 6000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [showUserLocation]);

  // Initialize map
  useEffect(() => {
    if (loading || mapRef.current) return;
    const center = userLocation ? [userLocation.lng, userLocation.lat] : DEFAULT_CENTER;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      center,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      interactive,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => setMapReady(true));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [loading]);

  // Fly to user when location updates initially
  useEffect(() => {
    if (mapRef.current && userLocation && mapReady) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, duration: 1500 });
    }
  }, [userLocation, mapReady]);

  // User marker
  useEffect(() => {
    if (!mapRef.current || !userLocation || !mapReady) return;
    if (userMarkerRef.current) { userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]); return; }
    const el = createMarkerEl(MARKER_COLORS.user, 20, true);
    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .setPopup(new mapboxgl.Popup({ offset: 15, closeButton: false }).setHTML("<b>Dein Standort</b>"))
      .addTo(mapRef.current);
  }, [userLocation, mapReady]);

  // Render all entity markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const addMarker = (lng, lat, color, size, popupHtml, type, data) => {
      if (!lng || !lat || lat < -90 || lat > 90) return;
      const el = createMarkerEl(color, size);
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 15, closeButton: false, maxWidth: "200px" }).setHTML(popupHtml))
        .addTo(mapRef.current);
      if (onMarkerClick) {
        el.addEventListener("click", (e) => { e.stopPropagation(); onMarkerClick({ type, data }); });
      }
      markersRef.current.push(marker);
    };

    // Scooters
    scooters.filter(s => s.status !== "offline").forEach(s => {
      const lat = s.lat || s.location?.lat;
      const lng = s.lng || s.location?.lng;
      addMarker(lng, lat, s.battery < 20 ? MARKER_COLORS.scooterLow : MARKER_COLORS.scooter, 26,
        `<b>E-Scooter</b><br/>Batterie: ${s.battery}%<br/><span style="color:#888">${s.model || ""}</span>`,
        "scooter", s);
    });
    // Drivers
    drivers.filter(d => d.is_online).forEach(d => {
      const lat = d.lat || d.current_lat;
      const lng = d.lng || d.current_lng;
      addMarker(lng, lat, d.is_busy ? MARKER_COLORS.driverBusy : MARKER_COLORS.driver, 30,
        `<b>${d.name || "Fahrer"}</b><br/>${d.vehicle?.model || ""}<br/>⭐ ${(d.rating || 5).toFixed(1)}`,
        "driver", d);
    });
    // Restaurants
    restaurants.filter(r => r.is_approved !== false).forEach(r => {
      addMarker(r.lng, r.lat, MARKER_COLORS.restaurant, 26,
        `<b>${r.name}</b><br/>${r.category || "Restaurant"}<br/>⭐ ${(r.rating || 4.5).toFixed(1)}`,
        "restaurant", r);
    });
    // Kids
    kids.filter(k => k.lat && k.lng).forEach(k => {
      addMarker(k.lng, k.lat, MARKER_COLORS.kid, 30,
        `<b>${k.name}</b><br/><span style="color:#888">${k.last_updated ? new Date(k.last_updated).toLocaleTimeString() : "Live"}</span>`,
        "kid", k);
    });
    // Cars (Car Rental)
    cars.filter(c => c.lat && c.lng).forEach(c => {
      addMarker(c.lng, c.lat, MARKER_COLORS.car, 28,
        `<b>${c.title || c.brand}</b><br/>€${(c.price_per_day || 0).toFixed(0)}/Tag<br/>⭐ ${(c.rating || 0).toFixed(1)}`,
        "car", c);
    });
    // Pickup/Dropoff
    if (pickup?.lat && pickup?.lng) {
      addMarker(pickup.lng, pickup.lat, MARKER_COLORS.pickup, 34,
        "<b style='color:#10B981'>Abholpunkt</b>", "pickup", pickup);
    }
    if (dropoff?.lat && dropoff?.lng) {
      addMarker(dropoff.lng, dropoff.lat, MARKER_COLORS.dropoff, 34,
        "<b style='color:#EF4444'>Ziel</b>", "dropoff", dropoff);
    }
  }, [scooters, drivers, restaurants, kids, cars, pickup, dropoff, mapReady, onMarkerClick]);

  // Radius circle
  useEffect(() => {
    if (!mapRef.current || !mapReady || !userLocation || !radius) return;
    const sourceId = "radius-circle";
    if (mapRef.current.getSource(sourceId)) {
      mapRef.current.getSource(sourceId).setData(createCircleGeoJSON(userLocation, radius));
    } else {
      mapRef.current.addSource(sourceId, { type: "geojson", data: createCircleGeoJSON(userLocation, radius) });
      mapRef.current.addLayer({
        id: "radius-fill", type: "fill", source: sourceId,
        paint: { "fill-color": "#3B82F6", "fill-opacity": 0.08 },
      });
      mapRef.current.addLayer({
        id: "radius-line", type: "line", source: sourceId,
        paint: { "line-color": "#3B82F6", "line-width": 1.5, "line-opacity": 0.4 },
      });
    }
  }, [userLocation, radius, mapReady]);

  const centerOnUser = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 1000 });
    }
  }, [userLocation]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-[#0A0A0F] ${className}`} style={{ height }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-[#00C2FF] mx-auto mb-2" />
          <p className="text-sm text-gray-500">Karte wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {locationError && (
        <div className="absolute top-2 left-2 right-12 z-10 p-2.5 rounded-xl bg-yellow-500/90 text-black text-xs font-medium flex items-center gap-2 cursor-pointer"
          onClick={() => setLocationError(null)}>
          <AlertCircle size={14} />
          <div>
            <span>{locationError}</span>
            <p className="text-[9px] opacity-70 mt-0.5">iPhone: Einstellungen → Safari → Standort → Erlauben</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {userLocation && (
        <button onClick={centerOnUser} data-testid="map-center-btn"
          className="absolute bottom-20 right-3 z-10 w-11 h-11 rounded-full bg-[#111118] border border-white/10 shadow-lg flex items-center justify-center">
          <Navigation size={18} className="text-[#00C2FF]" />
        </button>
      )}
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
        .mapboxgl-popup-content { background: #111118 !important; color: white !important; border-radius: 12px !important; padding: 10px 14px !important; font-size: 12px !important; border: 1px solid rgba(255,255,255,0.1) !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; }
        .mapboxgl-popup-tip { border-top-color: #111118 !important; }
        .mapboxgl-popup-close-button { color: white !important; }
      `}</style>
    </div>
  );
};

function createCircleGeoJSON(center, radiusMeters) {
  const coords = [];
  const steps = 64;
  const km = radiusMeters / 1000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    coords.push([
      center.lng + (dx / (111.32 * Math.cos(center.lat * Math.PI / 180))),
      center.lat + (dy / 110.574),
    ]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } };
}

export default MapboxMap;
