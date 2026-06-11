/**
 * useGeolocation - GPS location management for Taxi booking
 * Handles getCurrentPosition, reverse geocoding, fallback to Berlin
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const LAST_GPS_STORAGE_KEY = 'bidblitz_last_gps_pickup';

function readLastKnownPickup() {
  try {
    const raw = window.localStorage.getItem(LAST_GPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    if (parsed.lat === 0 && parsed.lng === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistLastKnownPickup(location) {
  try {
    if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) return;
    if (location.lat === 0 && location.lng === 0) return;
    window.localStorage.setItem(LAST_GPS_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // ignore
  }
}

export function useGeolocation({ setPickup, mapRef, pickupMarkerRef }) {
  const [currentAddress, setCurrentAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt');
  const lastAutoRetryAtRef = useRef(0);

  // Reverse geocode coordinates to address.
  // If frontend MAPBOX_TOKEN is missing (e.g. Production build forgot the
  // secret), transparently fall back to backend proxy /api/taxi/geocode/reverse.
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      let url;
      if (MAPBOX_TOKEN) {
        url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1`;
      } else if (BACKEND_URL) {
        url = `${BACKEND_URL}/api/taxi/geocode/reverse?lng=${lng}&lat=${lat}`;
      } else {
        return;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Geocoding failed');

      const data = await res.json();
      // Direct Mapbox returns {features:[...]}, backend proxy returns {address,name,lat,lng}
      let addr = '';
      if (data.features && data.features.length > 0) {
        const place = data.features[0];
        addr = place.place_name || place.text || '';
      } else if (data.address) {
        addr = data.address;
      }
      addr = addr || `Standort gefunden`;
      setCurrentAddress(addr);
      setPickup(prev => ({ ...prev, address: addr }));
      persistLastKnownPickup({ lat, lng, address: addr });
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setCurrentAddress(`Standort gefunden`);
      persistLastKnownPickup({ lat, lng });
    }
  }, [setPickup]);

  // Get current GPS position
  const getCurrentLocation = useCallback((options = {}) => {
    const { silent = false } = options;
    if (!navigator.geolocation) {
      if (!silent) setCurrentAddress('Geolocation wird nicht unterstützt');
      const lastKnown = readLastKnownPickup();
      if (lastKnown) {
        setPickup(prev => ({ ...prev, lat: lastKnown.lat, lng: lastKnown.lng, address: lastKnown.address || prev.address || '' }));
      }
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('✓ GPS Position:', latitude, longitude);

        setPickup(prev => ({ ...prev, lat: latitude, lng: longitude }));
        persistLastKnownPickup({ lat: latitude, lng: longitude });

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
        if (!silent) setCurrentAddress(errorMsg);

        const lastKnown = readLastKnownPickup();
        if (lastKnown) {
          setPickup(prev => ({
            ...prev,
            lat: prev.lat && prev.lat !== 0 ? prev.lat : lastKnown.lat,
            lng: prev.lng && prev.lng !== 0 ? prev.lng : lastKnown.lng,
            address: prev.address || lastKnown.address || '',
          }));
          if (mapRef?.current) {
            mapRef.current.flyTo({ center: [lastKnown.lng, lastKnown.lat], zoom: 13.5 });
          }
          if (pickupMarkerRef?.current) {
            pickupMarkerRef.current.setLngLat([lastKnown.lng, lastKnown.lat]);
          }
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

  useEffect(() => {
    if (!navigator.permissions?.query) return undefined;
    let mounted = true;
    let permissionStatus = null;

    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (!mounted) return;
      permissionStatus = status;
      setPermissionState(status.state || 'prompt');
      status.onchange = () => setPermissionState(status.state || 'prompt');
    }).catch(() => {});

    return () => {
      mounted = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  useEffect(() => {
    if (permissionState !== 'granted') return undefined;

    const retryLocation = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastAutoRetryAtRef.current < 5000) return;
      lastAutoRetryAtRef.current = now;
      getCurrentLocation({ silent: true });
    };

    window.addEventListener('focus', retryLocation);
    document.addEventListener('visibilitychange', retryLocation);
    return () => {
      window.removeEventListener('focus', retryLocation);
      document.removeEventListener('visibilitychange', retryLocation);
    };
  }, [permissionState, getCurrentLocation]);

  return {
    currentAddress,
    setCurrentAddress,
    loadingLocation,
    setLoadingLocation,
    permissionState,
    getCurrentLocation,
    reverseGeocode,
  };
}
