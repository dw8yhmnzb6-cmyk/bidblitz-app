/**
 * BidBlitz V2 - Real Map Component
 * Production-ready map using Leaflet (OpenStreetMap)
 * Used for Taxi, Scooter, Food, and Admin views
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom Icons
const createIcon = (color, emoji = '') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export const ICONS = {
  user: createIcon('#00C2FF', '📍'),
  driver: createIcon('#00D26A', '🚗'),
  driverOffline: createIcon('#666', '🚗'),
  scooter: createIcon('#A855F7', '🛴'),
  scooterLow: createIcon('#FF4757', '🛴'),
  restaurant: createIcon('#FF6B35', '🍽️'),
  pickup: createIcon('#00C2FF', 'A'),
  dropoff: createIcon('#FF4757', 'B'),
  delivery: createIcon('#FFB800', '📦'),
};

const createMovingDriverIcon = (rotation = 0) => L.divIcon({
  className: 'custom-driver-marker',
  html: `<div style="
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: rgba(0, 210, 106, 0.18);
      border: 2px solid rgba(255,255,255,0.92);
      box-shadow: 0 8px 18px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    ">
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #00D26A;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        transform: rotate(${rotation}deg);
      ">🚗</div>
    </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -20],
});

const createMapboxPin = ({ background = '#111111', border = '#ffffff', size = 20, innerHtml = '' }) => {
  const el = document.createElement('div');
  el.style.cssText = `
    width:${size}px;
    height:${size}px;
    border-radius:999px;
    background:${background};
    border:3px solid ${border};
    box-shadow:0 6px 18px rgba(0,0,0,0.18);
    display:flex;
    align-items:center;
    justify-content:center;
    color:#fff;
    font-weight:800;
    font-size:11px;
  `;
  el.innerHTML = innerHtml;
  return el;
};

export const TaxiMapbox = ({
  pickup,
  dropoff,
  nearbyDrivers = [],
  driverLocation = null,
  height = '100%',
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxgl.accessToken) return undefined;
    const center = pickup?.lng && pickup?.lat ? [pickup.lng, pickup.lat] : [13.405, 52.52];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom: pickup?.lng && pickup?.lat ? 15 : 13,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [pickup?.lat, pickup?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    const addMarker = (lng, lat, el) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([lng, lat]);
      hasBounds = true;
    };

    nearbyDrivers.slice(0, 8).forEach((driver) => {
      addMarker(driver.lng, driver.lat, createMapboxPin({ background: '#111111', border: '#ffffff', size: 18 }));
    });

    if (pickup?.lat && pickup?.lng) {
      addMarker(pickup.lng, pickup.lat, createMapboxPin({ background: '#2563EB', border: '#ffffff', size: 22 }));
    }

    if (dropoff?.lat && dropoff?.lng) {
      addMarker(dropoff.lng, dropoff.lat, createMapboxPin({ background: '#111111', border: '#ffffff', size: 22, innerHtml: '<span style="font-size:12px">■</span>' }));
    }

    if (driverLocation?.lat && driverLocation?.lng) {
      addMarker(driverLocation.lng, driverLocation.lat, createMapboxPin({ background: '#16A34A', border: '#ffffff', size: 20 }));
    }

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 64, duration: 900, maxZoom: 16 });
    }
  }, [driverLocation?.lat, driverLocation?.lng, dropoff?.lat, dropoff?.lng, nearbyDrivers, pickup?.lat, pickup?.lng]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ height }} data-testid="taxi-mapbox-view">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
    </div>
  );
};

const AnimatedMarker = ({ position, popup, rotation = 0 }) => {
  const [displayPosition, setDisplayPosition] = useState(position);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!position) return undefined;
    if (!displayPosition) {
      setDisplayPosition(position);
      return undefined;
    }

    const [fromLat, fromLng] = displayPosition;
    const [toLat, toLng] = position;
    if (fromLat === toLat && fromLng === toLng) return undefined;

    const startedAt = performance.now();
    const duration = 2200;
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayPosition([
        fromLat + ((toLat - fromLat) * eased),
        fromLng + ((toLng - fromLng) * eased),
      ]);
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [position, displayPosition]);

  if (!displayPosition) return null;

  return (
    <Marker position={displayPosition} icon={createMovingDriverIcon(rotation)}>
      {popup ? <Popup>{popup}</Popup> : null}
    </Marker>
  );
};

// Component to update map center
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
};

// Component to fit bounds
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

// Main Map Component
export const RealMap = ({
  center = [52.52, 13.405], // Berlin default
  zoom = 14,
  height = '300px',
  markers = [],
  route = null,
  userLocation = null,
  onMapClick = null,
  onMarkerClick = null,
  showUserLocation = true,
  fitBounds = null,
  children,
}) => {
  const [currentLocation, setCurrentLocation] = useState(userLocation);
  
  // Get user's real location
  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.log('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [showUserLocation]);

  return (
    <div style={{ height, width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <MapContainer
        center={currentLocation || center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        <MapUpdater center={currentLocation || center} zoom={zoom} />
        
        {fitBounds && <FitBounds bounds={fitBounds} />}
        
        {/* User Location */}
        {showUserLocation && currentLocation && (
          <>
            <Circle
              center={currentLocation}
              radius={50}
              pathOptions={{ color: '#00C2FF', fillColor: '#00C2FF', fillOpacity: 0.2 }}
            />
            <Marker position={currentLocation} icon={ICONS.user}>
              <Popup>Dein Standort</Popup>
            </Marker>
          </>
        )}
        
        {/* Route Line */}
        {route && route.length >= 2 && (
          <Polyline
            positions={route}
            pathOptions={{ color: '#00C2FF', weight: 4, opacity: 0.8 }}
          />
        )}
        
        {/* Custom Markers */}
        {markers.map((marker, idx) => (
          <Marker
            key={marker.id || idx}
            position={[marker.lat, marker.lng]}
            icon={marker.icon || ICONS.user}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(marker),
            }}
          >
            {marker.popup && <Popup>{marker.popup}</Popup>}
          </Marker>
        ))}
        
        {children}
      </MapContainer>
    </div>
  );
};

// Taxi Map with Pickup/Dropoff Selection
export const TaxiMap = ({
  pickup,
  dropoff,
  driverLocation,
  driverBearing = 0,
  driverTarget = null,
  driverPath = [],
  nearbyDrivers = [],
  height = '250px',
}) => {
  const markers = [];
  
  if (pickup) {
    markers.push({
      id: 'pickup',
      lat: pickup.lat,
      lng: pickup.lng,
      icon: ICONS.pickup,
      popup: `Abholung: ${pickup.address || 'Gewählt'}`,
    });
  }
  
  if (dropoff) {
    markers.push({
      id: 'dropoff',
      lat: dropoff.lat,
      lng: dropoff.lng,
      icon: ICONS.dropoff,
      popup: `Ziel: ${dropoff.address || 'Gewählt'}`,
    });
  }
  
  nearbyDrivers.forEach((driver, index) => {
    markers.push({
      id: `nearby-driver-${driver.id || index}`,
      lat: driver.lat,
      lng: driver.lng,
      icon: ICONS.driver,
      popup: driver.popup || 'Fahrer in der Nähe',
    });
  });

  const route = pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : null;
  const fitBounds = [
    pickup ? [pickup.lat, pickup.lng] : null,
    dropoff ? [dropoff.lat, dropoff.lng] : null,
    driverLocation ? [driverLocation.lat, driverLocation.lng] : null,
  ].filter(Boolean);

  return (
    <RealMap
      height={height}
      markers={markers}
      route={route}
      fitBounds={fitBounds.length >= 2 ? fitBounds : null}
    >
      {driverPath.length >= 2 ? (
        <Polyline
          positions={driverPath}
          pathOptions={{ color: '#0F766E', weight: 4, opacity: 0.6, dashArray: '8 8' }}
        />
      ) : null}
      {driverLocation ? (
        <AnimatedMarker
          position={[driverLocation.lat, driverLocation.lng]}
          rotation={driverBearing}
          popup="Dein Fahrer bewegt sich live"
        />
      ) : null}
      {driverLocation && driverTarget ? (
        <Polyline
          positions={[[driverLocation.lat, driverLocation.lng], [driverTarget.lat, driverTarget.lng]]}
          pathOptions={{ color: '#00C2FF', weight: 3, opacity: 0.55 }}
        />
      ) : null}
    </RealMap>
  );
};

// Scooter Map showing available scooters
export const ScooterMap = ({
  scooters = [],
  onScooterSelect,
  selectedScooter,
  height = '300px',
}) => {
  const markers = scooters.map(s => ({
    id: s.scooter_id,
    lat: s.location?.lat || 52.52,
    lng: s.location?.lng || 13.405,
    icon: s.battery_percent < 20 ? ICONS.scooterLow : ICONS.scooter,
    popup: `${s.model || 'Scooter'} - ${s.battery_percent}% - ${s.distance_km?.toFixed(1) || '?'}km`,
    data: s,
  }));

  return (
    <RealMap
      height={height}
      markers={markers}
      onMarkerClick={(marker) => onScooterSelect && onScooterSelect(marker.data)}
    />
  );
};

// Food Map showing restaurants
export const FoodMap = ({
  restaurants = [],
  onRestaurantSelect,
  deliveryLocation,
  height = '250px',
}) => {
  const markers = restaurants.map(r => ({
    id: r.restaurant_id,
    lat: r.location?.lat || 52.52,
    lng: r.location?.lng || 13.405,
    icon: ICONS.restaurant,
    popup: `${r.name} - ${r.rating}⭐ - ${r.delivery_time}`,
    data: r,
  }));

  if (deliveryLocation) {
    markers.push({
      id: 'delivery',
      lat: deliveryLocation.lat,
      lng: deliveryLocation.lng,
      icon: ICONS.delivery,
      popup: 'Lieferadresse',
    });
  }

  return (
    <RealMap
      height={height}
      markers={markers}
      onMarkerClick={(marker) => marker.data && onRestaurantSelect && onRestaurantSelect(marker.data)}
    />
  );
};

// Driver Map for driver dashboard
export const DriverMap = ({
  rideRequests = [],
  currentRide,
  isOnline,
  onRideAccept,
  height = '400px',
}) => {
  const markers = [];
  
  // Show ride requests
  rideRequests.forEach(ride => {
    markers.push({
      id: `pickup-${ride.ride_id}`,
      lat: ride.pickup?.lat || 52.52,
      lng: ride.pickup?.lng || 13.405,
      icon: ICONS.pickup,
      popup: `Abholung: ${ride.pickup?.address || '?'}\nFahrgast wartet...`,
      data: ride,
    });
  });
  
  // Show current ride
  if (currentRide) {
    markers.push({
      id: 'current-pickup',
      lat: currentRide.pickup?.lat,
      lng: currentRide.pickup?.lng,
      icon: ICONS.pickup,
      popup: `Abholen: ${currentRide.pickup?.address}`,
    });
    markers.push({
      id: 'current-dropoff',
      lat: currentRide.dropoff?.lat,
      lng: currentRide.dropoff?.lng,
      icon: ICONS.dropoff,
      popup: `Ziel: ${currentRide.dropoff?.address}`,
    });
  }

  return (
    <RealMap
      height={height}
      markers={markers}
      onMarkerClick={(marker) => marker.data && onRideAccept && onRideAccept(marker.data)}
      route={currentRide ? [
        [currentRide.pickup?.lat, currentRide.pickup?.lng],
        [currentRide.dropoff?.lat, currentRide.dropoff?.lng],
      ] : null}
    />
  );
};

// Admin Map showing everything
export const AdminMap = ({
  drivers = [],
  scooters = [],
  restaurants = [],
  activeRides = [],
  height = '500px',
}) => {
  const markers = [];
  
  // Drivers
  drivers.forEach(d => {
    if (d.current_location) {
      markers.push({
        id: `driver-${d.driver_id}`,
        lat: d.current_location.lat,
        lng: d.current_location.lng,
        icon: d.is_online ? ICONS.driver : ICONS.driverOffline,
        popup: `${d.name} - ${d.is_online ? 'Online' : 'Offline'} - ${d.total_rides} Fahrten`,
      });
    }
  });
  
  // Scooters
  scooters.forEach(s => {
    markers.push({
      id: `scooter-${s.scooter_id}`,
      lat: s.location?.lat || 52.52,
      lng: s.location?.lng || 13.405,
      icon: s.battery_percent < 20 ? ICONS.scooterLow : ICONS.scooter,
      popup: `${s.scooter_id} - ${s.battery_percent}% - ${s.status}`,
    });
  });
  
  // Restaurants
  restaurants.forEach(r => {
    markers.push({
      id: `restaurant-${r.restaurant_id}`,
      lat: r.location?.lat || 52.52,
      lng: r.location?.lng || 13.405,
      icon: ICONS.restaurant,
      popup: `${r.name} - ${r.is_open ? 'Offen' : 'Geschlossen'}`,
    });
  });

  return (
    <RealMap
      height={height}
      markers={markers}
      zoom={12}
    />
  );
};

export default RealMap;
