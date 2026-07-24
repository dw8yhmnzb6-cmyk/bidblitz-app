/**
 * BidBlitz V2 - Unified Real Map Component
 * Production-ready map with Leaflet + OpenStreetMap
 * Supports: User location, Scooters, Drivers, Restaurants, Kids tracking
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Navigation, AlertCircle } from "lucide-react";

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom marker icons
const createIcon = (color, size = 32) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const MARKER_ICONS = {
  user: createIcon("#3B82F6", 24),
  scooter: createIcon("#22C55E", 28),
  scooterLow: createIcon("#F59E0B", 28),
  scooterOffline: createIcon("#6B7280", 28),
  driver: createIcon("#8B5CF6", 32),
  driverBusy: createIcon("#EF4444", 32),
  restaurant: createIcon("#F97316", 28),
  restaurantClosed: createIcon("#6B7280", 28),
  kid: createIcon("#EC4899", 32),
  pickup: createIcon("#10B981", 36),
  dropoff: createIcon("#EF4444", 36),
};

// Default fallback location (Berlin Center)
const DEFAULT_CENTER = { lat: 52.52, lng: 13.405 };

// Component to update map view
const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
};

// Component to handle click events
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

/**
 * Unified Real Map Component
 * 
 * @param {Object} props
 * @param {string} props.mode - Map mode: "view" | "select_location" | "track"
 * @param {Array} props.scooters - Array of scooter objects {id, lat, lng, battery, status}
 * @param {Array} props.drivers - Array of driver objects {driver_id, lat, lng, is_online, is_busy, name, vehicle}
 * @param {Array} props.restaurants - Array of restaurant objects {restaurant_id, lat, lng, name, is_open}
 * @param {Array} props.kids - Array of kids locations {child_id, lat, lng, name, last_updated}
 * @param {Object} props.pickup - Pickup location {lat, lng}
 * @param {Object} props.dropoff - Dropoff location {lat, lng}
 * @param {Function} props.onLocationSelect - Callback when location is selected
 * @param {Function} props.onMarkerClick - Callback when marker is clicked {type, data}
 * @param {boolean} props.showUserLocation - Show user's current location
 * @param {number} props.radius - Show radius circle around user (meters)
 * @param {number} props.refreshInterval - Auto-refresh interval in ms (default: 10000)
 */
const UnifiedRealMap = ({
  mode = "view",
  scooters = [],
  drivers = [],
  restaurants = [],
  kids = [],
  pickup = null,
  dropoff = null,
  onLocationSelect = null,
  onMarkerClick = null,
  showUserLocation = true,
  radius = null,
  refreshInterval = 10000,
  height = "100%",
  className = "",
}) => {
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const mapRef = useRef(null);

  // Get real user location
  useEffect(() => {
    if (!showUserLocation) {
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocation nicht unterstützt");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        setMapCenter(loc);
        setLoading(false);
        setLocationError(null);
      },
      (error) => {
        console.warn("Geolocation error:", error.message);
        setLocationError(
          error.code === 1 
            ? "Standortzugriff verweigert" 
            : "Standort konnte nicht ermittelt werden"
        );
        setMapCenter(DEFAULT_CENTER);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    // Watch position for live tracking
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [showUserLocation]);

  const handleMapClick = useCallback((location) => {
    if (mode === "select_location" && onLocationSelect) {
      onLocationSelect(location);
    }
  }, [mode, onLocationSelect]);

  const handleMarkerClick = useCallback((type, data) => {
    if (onMarkerClick) {
      onMarkerClick({ type, data });
    }
  }, [onMarkerClick]);

  // Center on user location
  const centerOnUser = () => {
    if (userLocation) {
      setMapCenter({ ...userLocation });
    }
  };

  // Validate coordinates
  const isValidCoord = (lat, lng) => {
    return lat && lng && 
           typeof lat === "number" && typeof lng === "number" &&
           lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 ${className}`} style={{ height }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Karte wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Location Error Banner */}
      {locationError && (
        <div className="absolute top-2 left-2 right-2 z-[1000] p-2 rounded-lg bg-yellow-500/90 text-black text-xs font-medium flex items-center gap-2">
          <AlertCircle size={14} />
          {locationError}
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        ref={mapRef}
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OSM &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />

        <MapController center={mapCenter} />
        <MapClickHandler onMapClick={handleMapClick} />

        {/* User Location Marker */}
        {userLocation && isValidCoord(userLocation.lat, userLocation.lng) && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={MARKER_ICONS.user}>
              <Popup>
                <div className="text-center">
                  <p className="font-semibold">Dein Standort</p>
                </div>
              </Popup>
            </Marker>
            {radius && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={radius}
                pathOptions={{ color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.1 }}
              />
            )}
          </>
        )}

        {/* Scooter Markers */}
        {scooters.filter(s => isValidCoord(s.lat, s.lng) && s.status !== "offline").map((scooter) => (
          <Marker
            key={scooter.scooter_id || scooter.id}
            position={[scooter.lat, scooter.lng]}
            icon={scooter.battery < 20 ? MARKER_ICONS.scooterLow : MARKER_ICONS.scooter}
            eventHandlers={{
              click: () => handleMarkerClick("scooter", scooter),
            }}
          >
            <Popup>
              <div className="text-center min-w-[120px]">
                <p className="font-semibold">🛴 Scooter</p>
                <p className="text-sm">Batterie: {scooter.battery}%</p>
                <p className="text-xs text-gray-500">{scooter.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Driver Markers */}
        {drivers.filter(d => isValidCoord(d.lat || d.current_lat, d.lng || d.current_lng) && d.is_online).map((driver) => (
          <Marker
            key={driver.driver_id}
            position={[driver.lat || driver.current_lat, driver.lng || driver.current_lng]}
            icon={driver.is_busy ? MARKER_ICONS.driverBusy : MARKER_ICONS.driver}
            eventHandlers={{
              click: () => handleMarkerClick("driver", driver),
            }}
          >
            <Popup>
              <div className="text-center min-w-[120px]">
                <p className="font-semibold">🚗 {driver.name}</p>
                <p className="text-sm">{driver.vehicle?.model || "Fahrzeug"}</p>
                <p className="text-xs">⭐ {driver.rating?.toFixed(1) || "5.0"}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Restaurant Markers */}
        {restaurants.filter(r => isValidCoord(r.lat, r.lng) && r.is_approved !== false).map((restaurant) => (
          <Marker
            key={restaurant.restaurant_id || restaurant.id}
            position={[restaurant.lat, restaurant.lng]}
            icon={restaurant.is_open !== false ? MARKER_ICONS.restaurant : MARKER_ICONS.restaurantClosed}
            eventHandlers={{
              click: () => handleMarkerClick("restaurant", restaurant),
            }}
          >
            <Popup>
              <div className="text-center min-w-[120px]">
                <p className="font-semibold">🍽️ {restaurant.name}</p>
                <p className="text-sm">{restaurant.category || "Restaurant"}</p>
                <p className="text-xs">⭐ {restaurant.rating?.toFixed(1) || "4.5"}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Kids Location Markers */}
        {kids.filter(k => isValidCoord(k.lat, k.lng)).map((kid) => (
          <Marker
            key={kid.child_id}
            position={[kid.lat, kid.lng]}
            icon={MARKER_ICONS.kid}
            eventHandlers={{
              click: () => handleMarkerClick("kid", kid),
            }}
          >
            <Popup>
              <div className="text-center min-w-[120px]">
                <p className="font-semibold">👶 {kid.name}</p>
                <p className="text-xs text-gray-500">
                  {kid.last_updated ? new Date(kid.last_updated).toLocaleTimeString() : "Live"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Pickup Marker */}
        {pickup && isValidCoord(pickup.lat, pickup.lng) && (
          <Marker position={[pickup.lat, pickup.lng]} icon={MARKER_ICONS.pickup}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-green-600">📍 Abholpunkt</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {dropoff && isValidCoord(dropoff.lat, dropoff.lng) && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={MARKER_ICONS.dropoff}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-red-600">🎯 Ziel</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Center on User Button */}
      {userLocation && (
        <button
          onClick={centerOnUser}
          className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center"
        >
          <Navigation size={20} className="text-blue-500" />
        </button>
      )}

      {/* Select Location Hint */}
      {mode === "select_location" && (
        <div className="absolute bottom-4 left-4 right-16 z-[1000] p-2 rounded-lg bg-black/80 text-white text-xs text-center">
          Tippe auf die Karte, um einen Standort zu wählen
        </div>
      )}
    </div>
  );
};

export default UnifiedRealMap;
