/**
 * BidBlitz V2 - Live Map Wrapper
 * Auto-fetches nearby drivers, scooters, and restaurants
 * Updates every 5 seconds
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RealMap, ICONS } from './RealMap';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveMap({
  showDrivers = false,
  showScooters = false,
  showRestaurants = false,
  onDriverClick,
  onScooterClick,
  onRestaurantClick,
  height = '300px',
  refreshInterval = 5000,
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [scooters, setScooters] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  // Get user's GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          console.log('GPS:', pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.log('GPS Error:', err.message);
          // Fallback to default location (Berlin)
          setUserLocation([52.52, 13.405]);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setUserLocation([52.52, 13.405]);
    }
  }, []);

  // Fetch nearby data
  const fetchNearby = useCallback(async () => {
    if (!userLocation) return;
    
    const [lat, lng] = userLocation;
    
    try {
      // Fetch drivers
      if (showDrivers) {
        const res = await fetch(`${API}/api/driver/nearby?lat=${lat}&lng=${lng}&radius_km=10`);
        if (res.ok) {
          const data = await res.json();
          setDrivers(data.drivers || []);
          console.log('Drivers loaded:', data.drivers?.length || 0);
        }
      }
      
      // Fetch scooters
      if (showScooters) {
        const res = await fetch(`${API}/api/scooter/nearby?lat=${lat}&lng=${lng}&radius=10`);
        if (res.ok) {
          const data = await res.json();
          setScooters(data.scooters || []);
          console.log('Scooters loaded:', data.scooters?.length || 0);
        }
      }
      
      // Fetch restaurants
      if (showRestaurants) {
        const res = await fetch(`${API}/api/food/nearby?lat=${lat}&lng=${lng}&radius=10`);
        if (res.ok) {
          const data = await res.json();
          setRestaurants(data.restaurants || []);
          console.log('Restaurants loaded:', data.restaurants?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch nearby data:', err);
    } finally {
      setLoading(false);
    }
  }, [userLocation, showDrivers, showScooters, showRestaurants]);

  // Initial fetch and interval
  useEffect(() => {
    if (userLocation) {
      fetchNearby();
      
      // Set up refresh interval
      if (refreshInterval > 0) {
        intervalRef.current = setInterval(fetchNearby, refreshInterval);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userLocation, fetchNearby, refreshInterval]);

  // Build markers
  const markers = [];
  
  // Driver markers
  drivers.forEach((driver) => {
    if (driver.lat && driver.lng) {
      markers.push({
        id: `driver-${driver.driver_id || driver.user_id}`,
        lat: driver.lat,
        lng: driver.lng,
        icon: driver.is_online ? ICONS.driver : ICONS.driverOffline,
        popup: (
          <div className="text-sm">
            <strong>{driver.name || 'Fahrer'}</strong>
            <br />
            ⭐ {driver.rating?.toFixed(1) || '5.0'}
            <br />
            📍 {driver.distance_km?.toFixed(1) || '?'} km
            <br />
            🚗 {driver.vehicle?.type || 'Standard'}
          </div>
        ),
        data: driver,
        type: 'driver',
      });
    }
  });
  
  // Scooter markers
  scooters.forEach((scooter) => {
    if (scooter.lat && scooter.lng) {
      const isLowBattery = (scooter.battery || 100) < 20;
      markers.push({
        id: `scooter-${scooter.scooter_id}`,
        lat: scooter.lat,
        lng: scooter.lng,
        icon: isLowBattery ? ICONS.scooterLow : ICONS.scooter,
        popup: (
          <div className="text-sm">
            <strong>Scooter #{scooter.scooter_id?.slice(-4) || '???'}</strong>
            <br />
            🔋 {scooter.battery || 100}%
            <br />
            📍 {scooter.distance_km?.toFixed(1) || '?'} km
            <br />
            🚶 {scooter.walk_minutes || '?'} min
          </div>
        ),
        data: scooter,
        type: 'scooter',
      });
    }
  });
  
  // Restaurant markers
  restaurants.forEach((restaurant) => {
    if (restaurant.lat && restaurant.lng) {
      markers.push({
        id: `restaurant-${restaurant.restaurant_id}`,
        lat: restaurant.lat,
        lng: restaurant.lng,
        icon: ICONS.restaurant,
        popup: (
          <div className="text-sm">
            <strong>{restaurant.name || 'Restaurant'}</strong>
            <br />
            ⭐ {restaurant.rating?.toFixed(1) || '5.0'}
            <br />
            📍 {restaurant.distance_km?.toFixed(1) || '?'} km
            <br />
            ⏱️ {restaurant.delivery_time || '30-45 min'}
          </div>
        ),
        data: restaurant,
        type: 'restaurant',
      });
    }
  });

  // Handle marker click
  const handleMarkerClick = (marker) => {
    if (marker.type === 'driver' && onDriverClick) {
      onDriverClick(marker.data);
    } else if (marker.type === 'scooter' && onScooterClick) {
      onScooterClick(marker.data);
    } else if (marker.type === 'restaurant' && onRestaurantClick) {
      onRestaurantClick(marker.data);
    }
  };

  return (
    <div className="relative">
      <RealMap
        center={userLocation || [52.52, 13.405]}
        zoom={14}
        height={height}
        markers={markers}
        showUserLocation={true}
        onMarkerClick={handleMarkerClick}
      />
      
      {/* Stats overlay */}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/80 flex gap-4">
        {showDrivers && (
          <span>🚗 {drivers.length}</span>
        )}
        {showScooters && (
          <span>🛴 {scooters.length}</span>
        )}
        {showRestaurants && (
          <span>🍽️ {restaurants.length}</span>
        )}
      </div>
      
      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
