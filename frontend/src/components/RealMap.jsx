/**
 * BidBlitz V2 - Real Map Component
 * Production-ready map using Leaflet (OpenStreetMap)
 * Used for Taxi, Scooter, Food, and Admin views
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
  onPickupSelect,
  onDropoffSelect,
  height = '250px',
}) => {
  const [selectMode, setSelectMode] = useState(null); // 'pickup' or 'dropoff'
  const mapRef = useRef(null);

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
  
  if (driverLocation) {
    markers.push({
      id: 'driver',
      lat: driverLocation.lat,
      lng: driverLocation.lng,
      icon: ICONS.driver,
      popup: 'Dein Fahrer',
    });
  }

  const route = pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : null;

  return (
    <RealMap
      height={height}
      markers={markers}
      route={route}
      fitBounds={pickup && dropoff ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : null}
    />
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
