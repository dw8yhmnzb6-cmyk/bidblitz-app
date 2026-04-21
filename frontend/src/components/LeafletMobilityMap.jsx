/**
 * BidBlitz V2 - Leaflet Mobility Map
 * Dark-themed map (CartoDB Dark Matter) with user location + car markers.
 * Drop-in replacement for MapboxMap.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, AlertCircle, Loader2 } from "lucide-react";

// Fix default marker icon paths (CDN)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER = [52.52, 13.405]; // Berlin [lat, lng]
const DEFAULT_ZOOM = 13;

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
  const userMarkerRef = useRef(null);
  const carMarkersRef = useRef([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
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
  }, []);

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
