/**
 * BidBlitz V2 - Leaflet Mobility Map
 * Dark-themed map (CartoDB Dark Matter) with user location + car markers.
 * Drop-in replacement for MapboxMap.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, AlertCircle, Layers, X } from "lucide-react";

// Fix default marker icon paths (CDN)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER = [52.52, 13.405]; // Berlin [lat, lng]
const DEFAULT_ZOOM = 13;

// Map style tile providers
const MAP_STYLES = {
  dark: {
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OSM &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20,
  },
  light: {
    name: "Hell",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OSM &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20,
  },
  satellite: {
    name: "Satellit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    subdomains: "",
    maxZoom: 19,
  },
};

const makeUserIcon = () =>
  L.divIcon({
    className: "leaflet-user-marker",
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:rgba(59,130,246,0.25);animation:taxi-pulse 2s ease-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 12px rgba(59,130,246,0.9),0 2px 6px rgba(0,0,0,0.5);"></div>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const makeCarIcon = () =>
  L.divIcon({
    className: "leaflet-car-marker",
    html: `
      <div style="width:32px;height:32px;border-radius:50%;background:#00C2FF;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,194,255,0.5);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
          <circle cx="6.5" cy="16.5" r="2.5"/>
          <circle cx="16.5" cy="16.5" r="2.5"/>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const LeafletMobilityMap = ({
  cars = [],
  showUserLocation = true,
  onMarkerClick = null,
  height = "100%",
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const carMarkersRef = useRef([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem("bidblitz_map_style") || "dark");
  const [showStylePicker, setShowStylePicker] = useState(false);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    const styleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.dark;
    tileLayerRef.current = L.tileLayer(styleConfig.url, {
      attribution: styleConfig.attribution,
      subdomains: styleConfig.subdomains,
      maxZoom: styleConfig.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);
    setTimeout(() => map.invalidateSize(), 500);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch tile layer when user picks a different style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.dark;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(styleConfig.url, {
      attribution: styleConfig.attribution,
      subdomains: styleConfig.subdomains,
      maxZoom: styleConfig.maxZoom,
      crossOrigin: true,
    }).addTo(map);
    localStorage.setItem("bidblitz_map_style", mapStyle);
  }, [mapStyle]);

  // User location
  useEffect(() => {
    if (!showUserLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        const map = mapRef.current;
        if (!map) return;
        map.setView([loc.lat, loc.lng], 14);
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = L.marker([loc.lat, loc.lng], { icon: makeUserIcon() }).addTo(map);
      },
      () => setLocationError("Standort konnte nicht ermittelt werden"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showUserLocation]);

  // Render car markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    carMarkersRef.current.forEach((m) => m.remove());
    carMarkersRef.current = [];

    cars.forEach((car) => {
      if (!car.latitude || !car.longitude) return;
      const marker = L.marker([car.latitude, car.longitude], { icon: makeCarIcon() }).addTo(map);
      marker.on("click", () => {
        if (onMarkerClick) onMarkerClick({ type: "car", data: car });
      });
      carMarkersRef.current.push(marker);
    });

    // Auto-fit bounds if we have cars + user
    if (cars.length > 0 && userLocation) {
      const points = cars
        .filter((c) => c.latitude && c.longitude)
        .map((c) => [c.latitude, c.longitude]);
      points.push([userLocation.lat, userLocation.lng]);
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 14 });
      }
    }
  }, [cars, userLocation, onMarkerClick]);

  const recenterUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        mapRef.current?.setView([loc.lat, loc.lng], 15);
      });
    }
  };

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" data-testid="leaflet-mobility-map" />

      {/* Map Style Switcher */}
      <button
        onClick={() => setShowStylePicker(true)}
        className="absolute top-4 left-4 w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg flex items-center justify-center z-[400] hover:bg-black/90 transition-colors"
        data-testid="mobility-map-style-btn"
        title="Kartenmodus wechseln"
      >
        <Layers size={18} className="text-cyan-400" />
      </button>

      {/* Style Picker Overlay */}
      {showStylePicker && (
        <div
          onClick={() => setShowStylePicker(false)}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[500] flex items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[#0A0A0F]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 p-4 animate-slide-up"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm">Kartenmodus</h3>
              <button
                onClick={() => setShowStylePicker(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X size={14} className="text-white/70" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(MAP_STYLES).map(([key, style]) => {
                const isActive = mapStyle === key;
                const previewBg = {
                  dark: "linear-gradient(135deg, #1A1D2E 0%, #0A0C1A 100%)",
                  light: "linear-gradient(135deg, #E8ECF0 0%, #C8D0D8 100%)",
                  satellite: "linear-gradient(135deg, #3A5A3C 0%, #2A4A2C 60%, #5A7A5C 100%)",
                }[key];
                return (
                  <button
                    key={key}
                    onClick={() => { setMapStyle(key); setShowStylePicker(false); }}
                    className={`flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${isActive ? "" : "opacity-70 hover:opacity-100"}`}
                    data-testid={`mobility-map-style-${key}`}
                  >
                    <div
                      className={`w-full h-16 rounded-xl border-2 transition-all overflow-hidden ${isActive ? "border-cyan-400 shadow-[0_0_16px_rgba(0,194,255,0.4)]" : "border-white/10"}`}
                      style={{ background: previewBg }}
                    >
                      <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="none">
                        <path d="M0,40 Q20,30 40,35 T80,30" stroke={key === "light" ? "#B8C5D0" : "#4A5568"} strokeWidth="2" fill="none" opacity="0.6" />
                        <path d="M20,0 L35,60" stroke={key === "light" ? "#D0D8E0" : "#3A4258"} strokeWidth="1.5" fill="none" opacity="0.5" />
                        <circle cx="40" cy="35" r="3" fill="#00C2FF" />
                      </svg>
                    </div>
                    <span className={`text-[11px] font-semibold ${isActive ? "text-cyan-400" : "text-white/70"}`}>{style.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recenter button */}
      <button
        onClick={recenterUser}
        className="absolute bottom-6 right-4 w-11 h-11 rounded-full bg-[#00C2FF] shadow-lg flex items-center justify-center z-[400] hover:bg-[#00D4FF] transition-colors"
        data-testid="map-recenter-btn"
        title="Zurück zu meinem Standort"
      >
        <Navigation size={16} className="text-black" />
      </button>

      {locationError && (
        <div className="absolute top-3 left-3 right-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2 z-[400]">
          <AlertCircle size={14} className="text-red-400" />
          <span className="text-xs text-red-400">{locationError}</span>
        </div>
      )}
    </div>
  );
};

export default LeafletMobilityMap;
