/**
 * useGeolocation - GPS location management for Taxi booking
 * Handles getCurrentPosition, reverse geocoding, fallback to Berlin
 */

import { useState, useCallback } from 'react';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

export function useGeolocation({ setPickup, mapRef, pickupMarkerRef }) {
  const [currentAddress, setCurrentAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Reverse geocode coordinates to address
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!MAPBOX_TOKEN) {
      console.warn('⚠️ MAPBOX_TOKEN missing');
      return;
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
      );
      if (!res.ok) throw new Error('Geocoding failed');
      
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const place = data.features[0];
        const addr = place.place_name || place.text || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setCurrentAddress(addr);
        setPickup(prev => ({ ...prev, address: addr }));
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setCurrentAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  }, [setPickup]);

  // Get current GPS position
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setCurrentAddress('Geolocation wird nicht unterstützt');
      // Fallback to default location (Berlin center)
      setPickup(prev => ({ ...prev, lat: 52.52, lng: 13.405, address: '' }));
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('✓ GPS Position:', latitude, longitude);

        setPickup(prev => ({ ...prev, lat: latitude, lng: longitude }));

        // Update map center & pickup marker (Mapbox)
        if (mapRef?.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 14 });
        }
        if (pickupMarkerRef?.current) {
          pickupMarkerRef.current.setLngLat([longitude, latitude]);
        }

        // Reverse geocode to get address
        await reverseGeocode(latitude, longitude);
        setLoadingLocation(false);
      },
      (error) => {
        console.error('❌ Geolocation error:', error);
        
        // Provide helpful error message based on error code
        let errorMsg = 'Standort konnte nicht ermittelt werden';
        if (error.code === 1) {
          errorMsg = 'Standortzugriff verweigert. Bitte Berechtigung in den Geräte-Einstellungen aktivieren.';
        } else if (error.code === 2) {
          errorMsg = 'Standort nicht verfügbar. Bitte GPS-Signal prüfen.';
        } else if (error.code === 3) {
          errorMsg = 'Standortabfrage Timeout. Bitte erneut versuchen.';
        }
        setCurrentAddress(errorMsg);
        
        // Fallback: Set pickup to default location (Berlin center) so user can continue
        setPickup(prev => ({ ...prev, lat: 52.52, lng: 13.405, address: '' }));
        
        // Update map to default location
        if (mapRef?.current) {
          mapRef.current.flyTo({ center: [13.405, 52.52], zoom: 12 });
        }
        if (pickupMarkerRef?.current) {
          pickupMarkerRef.current.setLngLat([13.405, 52.52]);
        }
        
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [setPickup, reverseGeocode, mapRef, pickupMarkerRef]);

  return {
    currentAddress,
    setCurrentAddress,
    loadingLocation,
    setLoadingLocation,
    getCurrentLocation,
    reverseGeocode,
  };
}
