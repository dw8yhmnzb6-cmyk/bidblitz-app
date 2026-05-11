import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import { useUser } from '../store/UserContext';
import ReviewModal from '../components/ReviewModal';
import SplitPaymentModal from '../components/SplitPaymentModal';
import LiveChat from '../components/LiveChat';
import GroupOrderModal from '../components/GroupOrderModal';
import GroupTrackerBanner from '../components/GroupTrackerBanner';
import KYCBanner from '../components/KYCBanner';
import { MAP_STYLES, STATUS_COLORS, STATUS_LABELS, VEHICLE_ICONS, POI_CATEGORIES } from '../components/taxi/TaxiConstants';
import { VehicleIcon } from '../components/taxi/TaxiVehicleIcon';
import TaxiHistoryView from '../components/taxi/TaxiHistoryView';
import TaxiPoiFilterSheet from '../components/taxi/TaxiPoiFilterSheet';
import TaxiMapStylePicker from '../components/taxi/TaxiMapStylePicker';
import TaxiSavePlaceModal from '../components/taxi/TaxiSavePlaceModal';
import TaxiFavoritesModal from '../components/taxi/TaxiFavoritesModal';
import TaxiSaveFavoriteModal from '../components/taxi/TaxiSaveFavoriteModal';
import TaxiDriverOnboardingModal from '../components/taxi/TaxiDriverOnboardingModal';
import TaxiVehiclePicker from '../components/taxi/TaxiVehiclePicker';
import TaxiAddressInput from '../components/taxi/TaxiAddressInput';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import { useTaxiState } from '../hooks/useTaxiState';
import { useGeolocation } from '../hooks/useGeolocation';

// Lazy-load mapbox-gl (~800KB) only when the map is actually rendered.
// This dramatically improves initial paint of the taxi-type selection screen.
let mapboxgl = null;
let mapboxLoadPromise = null;
const loadMapbox = () => {
  if (mapboxgl) return Promise.resolve(mapboxgl);
  if (mapboxLoadPromise) return mapboxLoadPromise;
  mapboxLoadPromise = Promise.all([
    import(/* webpackChunkName: "mapbox-gl" */ 'mapbox-gl'),
    import(/* webpackChunkName: "mapbox-gl" */ 'mapbox-gl/dist/mapbox-gl.css'),
  ]).then(([mod]) => {
    mapboxgl = mod.default;
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
    return mapboxgl;
  });
  return mapboxLoadPromise;
};

const API = process.env.REACT_APP_BACKEND_URL;

export default function TaxiPage({ onNavigate }) {
  const { t } = useI18n();
  const { search: geocodeSearch, geocodeOnBlur: geocodeOnBlurHook } = useTaxiGeocoder();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS: Extracted State Management
  // ═══════════════════════════════════════════════════════════════════════════
  
  const state = useTaxiState();
  
  // Destructure commonly used state
  const {
    view, setView,
    taxiType, setTaxiType,
    pickup, setPickup,
    dropoff, setDropoff,
    estimates, setEstimates,
    selectedVehicle, setSelectedVehicle,
    loading, setLoading,
    error, setError,
    activeRide, setActiveRide,
    rideHistory, setRideHistory,
    moduleEnabled, setModuleEnabled,
    moduleMessage, setModuleMessage,
    surge, setSurge,
    userBalance, setUserBalance,
    mapStyle, setMapStyle,
    showMapStyles, setShowMapStyles,
    showReview, setShowReview,
    reviewRideId, setReviewRideId,
    showSplit, setShowSplit,
    splitRideId, setSplitRideId,
    splitTotal, setSplitTotal,
    showLiveChat, setShowLiveChat,
    showGroupRide, setShowGroupRide,
    showDriverOnboarding, setShowDriverOnboarding,
    onboardingType, setOnboardingType,
    favorites, setFavorites,
    showFavorites, setShowFavorites,
    showSaveFavorite, setShowSaveFavorite,
    favoriteForm, setFavoriteForm,
    pickupSuggestions, setPickupSuggestions,
    dropoffSuggestions, setDropoffSuggestions,
    showPickupSugg, setShowPickupSugg,
    showDropoffSugg, setShowDropoffSugg,
    savedPlaces, setSavedPlaces,
    showSaveModal, setShowSaveModal,
    saveName, setSaveName,
    saveIcon, setSaveIcon,
    activePoiCategory, setActivePoiCategory,
    showPoiFilter, setShowPoiFilter,
    poiLoading, setPoiLoading,
  } = state;

  // Interactive map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const poiMarkersRef = useRef([]);
  
  // Geolocation Hook
  const {
    currentAddress,
    setCurrentAddress,
    loadingLocation,
    getCurrentLocation,
    reverseGeocode,
  } = useGeolocation({ setPickup, mapRef, pickupMarkerRef });

  // Initialize Mapbox GL Map (lazy-load mapbox-gl on first map render)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    let cancelled = false;
    console.log('✓ Loading Mapbox GL library...');

    loadMapbox().then((mb) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      try {
        const map = new mb.Map({
          container: mapContainerRef.current,
          style: mapStyle === 'light' ? 'mapbox://styles/mapbox/light-v11' :
                 mapStyle === 'satellite' ? 'mapbox://styles/mapbox/satellite-streets-v12' :
                 'mapbox://styles/mapbox/dark-v11',
          center: [pickup.lng, pickup.lat],
          zoom: 14,
          language: 'de',
          attributionControl: false
        });

        map.addControl(new mb.NavigationControl(), 'top-right');

        const pickupEl = document.createElement('div');
        pickupEl.className = 'mapbox-marker-pickup';
        pickupEl.style.cssText = `
          width: 32px;
          height: 32px;
          background: #00C2FF;
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(0,194,255,0.6), 0 4px 8px rgba(0,0,0,0.3);
          cursor: move;
        `;

        const pickupMarker = new mb.Marker({
          element: pickupEl,
          draggable: true
        })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map);

        pickupMarkerRef.current = pickupMarker;

        pickupMarker.on('dragend', async () => {
          const lngLat = pickupMarker.getLngLat();
          setPickup(prev => ({ ...prev, lat: lngLat.lat, lng: lngLat.lng }));
          await reverseGeocode(lngLat.lat, lngLat.lng);
        });

        mapRef.current = map;
        console.log('✓ Mapbox GL map loaded successfully');
      } catch (error) {
        console.error('❌ Mapbox initialization error:', error);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [taxiType]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Switch map style when user picks different option
  useEffect(() => {
    if (!mapRef.current) return;
    const styleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.streets;
    mapRef.current.setStyle(styleConfig.style);
    localStorage.setItem('bidblitz_map_style', mapStyle);
  }, [mapStyle]);
  
  // Get current GPS location on mount
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  

  // Update markers when pickup/dropoff changes (Mapbox GL)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Pickup marker – just update position (don't recreate, to preserve draggable handler)
    if (pickupMarkerRef.current && pickup.lat && pickup.lng) {
      pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
    }

    // Dropoff marker
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }
    if (dropoff.lat && dropoff.lng && dropoff.lat !== 0) {
      const el = document.createElement('div');
      el.className = 'custom-dropoff-marker';
      el.style.cssText = 'width:22px;height:22px;background:#EF4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(239,68,68,0.8)';
      dropoffMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map);

      // Fit bounds to show both markers
      const bounds = new mapboxgl.LngLatBounds(
        [pickup.lng, pickup.lat],
        [pickup.lng, pickup.lat]
      );
      bounds.extend([dropoff.lng, dropoff.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
    } else if (pickup.lat) {
      map.flyTo({ center: [pickup.lng, pickup.lat], zoom: 14, duration: 600 });
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  useEffect(() => { loadSavedPlaces(); }, []);

  const loadSavedPlaces = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/saved-places`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setSavedPlaces(d.places || []); }
    } catch {}
  };

  const savePlace = async (address, lat, lng) => {
    if (!saveName || !address) return;
    try {
      await fetch(`${API}/api/taxi/saved-places`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName, icon: saveIcon, address, lat, lng }),
      });
      loadSavedPlaces();
      setShowSaveModal(false); setSaveName(""); setSaveIcon("star");
    } catch {}
  };

  const deletePlace = async (placeId) => {
    try {
      await fetch(`${API}/api/taxi/saved-places/${placeId}`, { method: 'DELETE', credentials: 'include' });
      loadSavedPlaces();
    } catch {}
  };

  // ─── POI Filter (Mapbox Tilequery API) ─────────────────────────────────
  const clearPoiMarkers = () => {
    poiMarkersRef.current.forEach(m => { try { m.remove(); } catch {} });
    poiMarkersRef.current = [];
  };

  const loadPOIs = async (categoryKey) => {
    const map = mapRef.current;
    if (!map) return;
    clearPoiMarkers();
    if (!categoryKey) { setActivePoiCategory(null); return; }
    setActivePoiCategory(categoryKey);
    setPoiLoading(true);
    try {
      const center = map.getCenter();
      const cat = POI_CATEGORIES[categoryKey];
      const token = process.env.REACT_APP_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${center.lng},${center.lat}.json?radius=2500&limit=40&dedupe=true&layers=poi_label&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const features = (data.features || []).filter(f => {
        const cls = (f.properties?.class || '').toLowerCase();
        const maki = (f.properties?.maki || '').toLowerCase();
        return cat.filter.some(t => cls.includes(t) || maki.includes(t));
      });
      features.slice(0, 30).forEach(f => {
        const [lng, lat] = f.geometry.coordinates;
        const el = document.createElement('div');
        el.className = 'mapbox-poi-marker';
        el.style.cssText = `
          width:30px;height:30px;border-radius:50%;background:${cat.color};
          border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;cursor:pointer;
        `;
        el.textContent = cat.icon;
        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(`
          <div style="font-family:system-ui;color:#0A0A0F;padding:2px 4px;min-width:160px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${(f.properties?.name_de || f.properties?.name || cat.label)}</div>
            <button onclick="window.__taxiSetDropoffPOI(${lng},${lat},'${(f.properties?.name_de || f.properties?.name || '').replace(/'/g, "\\'")}')"
              style="background:#00C2FF;color:white;border:none;padding:6px 10px;border-radius:8px;font-weight:600;font-size:11px;cursor:pointer;width:100%;">Als Ziel setzen</button>
          </div>
        `);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);
        poiMarkersRef.current.push(marker);
      });
    } catch (err) {
      console.error('POI load failed:', err);
    } finally {
      setPoiLoading(false);
    }
  };

  // Bridge global handler for the popup HTML "Als Ziel setzen" button
  useEffect(() => {
    window.__taxiSetDropoffPOI = (lng, lat, name) => {
      setDropoff({ lat: Number(lat), lng: Number(lng), address: name || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` });
      clearPoiMarkers();
      setActivePoiCategory(null);
    };
    return () => { delete window.__taxiSetDropoffPOI; };
  }, []);

  // Cleanup POIs when leaving taxi flow
  useEffect(() => {
    if (!taxiType) clearPoiMarkers();
  }, [taxiType]);
  // ───────────────────────────────────────────────────────────────────────


  const handlePickupChange = (text) => {
    setPickup(p => ({ ...p, address: text }));
    geocodeSearch('pickup', text, setPickupSuggestions, setShowPickupSugg);
  };

  const handleDropoffChange = (text) => {
    setDropoff(p => ({ ...p, address: text }));
    geocodeSearch('dropoff', text, setDropoffSuggestions, setShowDropoffSugg);
  };

  // Auto-geocode on blur if no coords yet
  const geocodeOnBlur = async (type) => {
    const target = type === 'pickup' ? pickup : dropoff;
    const setter = type === 'pickup' ? setPickup : setDropoff;
    await geocodeOnBlurHook(target, setter);
  };

  const selectPickupSugg = (s) => {
    setPickup({ lat: s.lat, lng: s.lng, address: s.address });
    setShowPickupSugg(false); setPickupSuggestions([]);
  };

  const selectDropoffSugg = (s) => {
    setDropoff({ lat: s.lat, lng: s.lng, address: s.address });
    setShowDropoffSugg(false); setDropoffSuggestions([]);
  };
  const [businessDrivers, setBusinessDrivers] = useState(0);
  const [privateDrivers, setPrivateDrivers] = useState(0);
  const [modeSettings, setModeSettings] = useState({
    business: { enabled: true, label: 'Unternehmer-Taxi', description: '' },
    private: { enabled: true, label: 'Privat-Taxi', description: '' },
  });
  
  // Refs
  const pollingRef = useRef(null);

  // Fetch user data
  useEffect(() => {
    fetchUserData();
    checkActiveRide();
    checkModuleStatus();
    fetchModeSettings();
    fetchFavorites();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchFavorites = async () => {
    try {
      const res = await fetch(`${API}/api/user/favorite-locations`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    }
  };

  const saveFavorite = async (locationData, name, icon) => {
    try {
      const res = await fetch(`${API}/api/user/favorite-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          address: locationData.address,
          latitude: locationData.lat,
          longitude: locationData.lng,
          icon
        })
      });
      if (res.ok) {
        await fetchFavorites();
        setShowSaveFavorite(false);
        setFavoriteForm({ name: '', icon: 'star' });
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Fehler beim Speichern');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    }
  };

  const deleteFavorite = async (favoriteId) => {
    try {
      const res = await fetch(`${API}/api/user/favorite-locations/${favoriteId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchFavorites();
      }
    } catch (err) {
      console.error('Failed to delete favorite:', err);
    }
  };

  const selectFavorite = async (favorite) => {
    setPickup({ lat: favorite.latitude, lng: favorite.longitude, address: favorite.address });
    setShowFavorites(false);
    
    // Mark as used
    try {
      await fetch(`${API}/api/user/favorite-locations/${favorite.id}/use`, {
        method: 'POST',
        credentials: 'include'
      });
      await fetchFavorites();
    } catch (err) {}
  };

  const fetchModeSettings = async () => {
    try {
      const res = await fetch(`${API}/api/admin/taxi/public/mode-settings`);
      if (res.ok) {
        const data = await res.json();
        setModeSettings(data);
      }
    } catch (err) {}
  };

  const checkModuleStatus = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.module_enabled === false) {
          setModuleEnabled(false);
          setModuleMessage(data.message || 'Taxi-Modul wird derzeit vorbereitet');
        } else {
          // Get driver counts by type
          setBusinessDrivers(data.business_drivers || 0);
          setPrivateDrivers(data.private_drivers || 0);
        }
      }
    } catch (err) {}
  };

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const checkActiveRide = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/rides/active`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.has_active_ride && data.ride) {
          setActiveRide(data.ride);
          setView('tracking');
          startPolling(data.ride.ride_id);
        }
      }
    } catch (err) {
      console.error('Failed to check active ride:', err);
    }
  };

  const startPolling = (rideId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/taxi/ride/${rideId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setActiveRide(data.ride);
          if (['completed', 'cancelled'].includes(data.ride.status)) {
            clearInterval(pollingRef.current);
            fetchUserData();
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  // NOTE: getCurrentLocation is already defined at line 143 with GPS + Geocoding
  // This old version has been removed to fix duplicate declaration error

  // Get fare estimates
  const getEstimates = async () => {
    // Auto-geocode dropoff if needed
    if (dropoff.address && (!dropoff.lat || dropoff.lat === 0)) {
      try {
        const token = process.env.REACT_APP_MAPBOX_TOKEN;
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropoff.address)}.json?access_token=${token}&country=de,at,ch&language=de&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const f = (data.features || [])[0];
          if (f && f.center) { setDropoff({ lat: f.center[1], lng: f.center[0], address: f.place_name || dropoff.address }); }
          else { setError('Ziel nicht gefunden. Bitte Vorschlag auswählen.'); return; }
        }
      } catch { setError('Geocoding-Fehler'); return; }
    }
    if (!pickup.lat || !dropoff.address) {
      setError('Bitte Start und Ziel eingeben');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/taxi/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pickup, dropoff }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setEstimates(data.estimates || []);
        setSurge(data.surge || { active: false, multiplier: 1.0 });
      } else {
        const err = await res.json();
        setError(err.detail || 'Fehler beim Laden der Preise');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Book ride
  const bookRide = async () => {
    const estimate = estimates.find(e => e.vehicle_type === selectedVehicle);
    if (!estimate) return;
    
    if (userBalance < estimate.fare) {
      setError(`Nicht genug Guthaben. Benötigt: €${estimate.fare.toFixed(2)}`);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/taxi/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pickup,
          dropoff,
          vehicle_type: selectedVehicle,
          payment_method: 'wallet',
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setActiveRide(data.ride);
        setView('tracking');
        startPolling(data.ride.ride_id);
      } else {
        const err = await res.json();
        setError(err.detail || 'Buchung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Cancel ride
  const cancelRide = async () => {
    if (!activeRide) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/taxi/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveRide(null);
        setView('book');
        fetchUserData();
      } else {
        const err = await res.json();
        setError(err.detail || 'Stornierung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Fetch ride history
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/rides/history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRideHistory(data.rides || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    if (view === 'history') fetchHistory();
  }, [view]);

  // Simulate driver for demo
  const simulateDriverArrival = async () => {
    if (!activeRide) return;
    try {
      await fetch(`${API}/api/taxi/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id, status: 'arriving' }),
      });
    } catch (err) {}
  };

  const simulateStartTrip = async () => {
    if (!activeRide) return;
    try {
      await fetch(`${API}/api/taxi/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id, status: 'started' }),
      });
    } catch (err) {}
  };

  const simulateCompleteTrip = async () => {
    if (!activeRide) return;
    try {
      await fetch(`${API}/api/taxi/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id, status: 'completed' }),
      });
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">BidBlitz Taxi</h1>
            <div className="flex items-center gap-2">
              {/* Zentrale anrufen Button */}
              <a 
                href="tel:+49305806" 
                className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                title="Zentrale anrufen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
              <div className="text-sm text-cyan-400 font-medium">€{userBalance.toFixed(2)}</div>
            </div>
          </div>
          
          {/* Tab Navigation */}
          {moduleEnabled && (
          <div className="flex gap-2 mt-4">
            {['book', 'tracking', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  view === tab
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {tab === 'book' ? 'Buchen' : tab === 'tracking' ? 'Live' : 'Verlauf'}
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <KYCBanner onNavigate={onNavigate} />
        {/* MODULE DISABLED NOTICE */}
        {!moduleEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-24 h-24 mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Taxi Demnächst</h2>
            <p className="text-gray-400 mb-6 max-w-sm">
              {moduleMessage || 'Das Taxi-Modul wartet auf echte Fahrer-Onboarding. Bald verfügbar!'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl font-semibold text-black"
            >
              Zur Startseite
            </button>
          </motion.div>
        )}

        {moduleEnabled && (
        <AnimatePresence mode="wait">
          {/* GROUP-RIDE LIVE-TRACKER BANNER (alle Views) */}
          <GroupTrackerBanner
            serviceType="taxi"
            onOpenGroup={() => setShowGroupRide(true)}
          />

          {/* BOOKING VIEW */}
          {view === 'book' && (
            <motion.div
              key="book"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* TAXI TYPE SELECTION */}
              {!taxiType && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  {/* Hero Image */}
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden -mt-2">
                    <img 
                      src="https://images.unsplash.com/photo-1758179128122-6079c9cb3e4e?w=800&q=80" 
                      alt="BidBlitz Taxi" 
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h2 className="text-2xl font-bold text-white mb-1">BidBlitz Taxi</h2>
                      <p className="text-sm text-gray-300">Professionelle Fahrten in deiner Stadt</p>
                    </div>
                  </div>

                  <h2 className="text-lg font-semibold text-center">Wähle deinen Taxi-Typ</h2>
                  <div className={`grid gap-4 ${modeSettings.business.enabled && modeSettings.private.enabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Business/Company Taxi */}
                    {modeSettings.business.enabled && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTaxiType('business')}
                      className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 rounded-2xl p-5 text-left hover:border-cyan-400/60 transition-all"
                      data-testid="taxi-type-business"
                    >
                      <div className="w-14 h-14 mb-4 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">{modeSettings.business.label || 'Unternehmer'}</h3>
                      <p className="text-xs text-gray-400 mb-3">{modeSettings.business.description || 'Professionelle Taxiunternehmen mit Lizenz'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-400 font-medium">
                          {businessDrivers > 0 ? `${businessDrivers} verfügbar` : 'Buchung anfragen'}
                        </span>
                      </div>
                      {businessDrivers > 0 && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </motion.button>
                    )}

                    {/* Private Taxi */}
                    {modeSettings.private.enabled && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTaxiType('private')}
                      className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-5 text-left hover:border-purple-400/60 transition-all"
                      data-testid="taxi-type-private"
                    >
                      <div className="w-14 h-14 mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">{modeSettings.private.label || 'Privat'}</h3>
                      <p className="text-xs text-gray-400 mb-3">{modeSettings.private.description || 'Private Fahrer in deiner Nähe'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 font-medium">
                          {privateDrivers > 0 ? `${privateDrivers} verfügbar` : 'Buchung anfragen'}
                        </span>
                      </div>
                      {privateDrivers > 0 && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </motion.button>
                    )}
                  </div>

                  {/* No modes available fallback */}
                  {!modeSettings.business.enabled && !modeSettings.private.enabled && (
                    <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-sm text-gray-400">Taxi-Buchung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.</p>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-[#111] rounded-xl p-4 border border-white/5">
                    <h4 className="text-sm font-semibold mb-2">Was ist der Unterschied?</h4>
                    <div className="space-y-2 text-xs text-gray-400">
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span><strong className="text-white">Unternehmer:</strong> Lizenzierte Taxiunternehmen, feste Preise, Quittung möglich</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        <span><strong className="text-white">Privat:</strong> Flexible Preise, schneller verfügbar, Community-Fahrer</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* BOOKING FORM - Only show after taxi type is selected */}
              {taxiType && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Selected Type Badge & Change Button */}
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      taxiType === 'business' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {taxiType === 'business' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                      <span className="text-sm font-medium">
                        {taxiType === 'business' ? 'Unternehmer-Taxi' : 'Privat-Taxi'}
                      </span>
                    </div>
                    <button
                      onClick={() => setTaxiType('')}
                      className="text-xs text-gray-400 hover:text-white underline"
                    >
                      Ändern
                    </button>
                  </div>

              {/* Interactive Map (Mapbox GL JS) */}
              <div className="relative h-56 bg-[#0A0A0F] rounded-2xl overflow-hidden border border-white/10">
                <div
                  ref={mapContainerRef}
                  className="w-full h-full"
                  data-testid="taxi-map-container"
                  style={{ minHeight: '14rem' }}
                />

                {/* Reload Location Button */}
                <button
                  onClick={getCurrentLocation}
                  disabled={loadingLocation}
                  className="absolute bottom-3 right-3 bg-cyan-500 hover:bg-cyan-600 text-white p-3 rounded-full shadow-lg z-20 disabled:opacity-50 transition-colors"
                  title="Standort aktualisieren"
                  data-testid="taxi-reload-location"
                >
                  {loadingLocation ? (
                    <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>

                {/* POI Filter Button (Restaurants/Supermärkte/etc — taxi.eu Parität) */}
                <button
                  onClick={() => setShowPoiFilter(true)}
                  className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md border border-white/10 text-white px-3 py-2.5 rounded-full shadow-lg z-20 flex items-center gap-2 hover:bg-black/90 transition-colors"
                  title="In der Nähe anzeigen"
                  data-testid="taxi-poi-filter-btn"
                >
                  {activePoiCategory ? (
                    <>
                      <span className="text-base leading-none">{POI_CATEGORIES[activePoiCategory]?.icon}</span>
                      <span className="text-xs font-semibold">{POI_CATEGORIES[activePoiCategory]?.label}</span>
                      <span
                        role="button"
                        aria-label="Filter entfernen"
                        onClick={(e) => { e.stopPropagation(); loadPOIs(null); }}
                        className="ml-1 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px]"
                      >×</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      <span className="text-xs font-semibold">In der Nähe</span>
                    </>
                  )}
                </button>

                {/* POI Filter Sheet */}
                <TaxiPoiFilterSheet
                  isOpen={showPoiFilter}
                  onClose={() => setShowPoiFilter(false)}
                  activeCategory={activePoiCategory}
                  onPick={loadPOIs}
                  loading={poiLoading}
                />

                {/* Map Style Switcher (Apple Maps-style) */}
                <button
                  onClick={() => setShowMapStyles(true)}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg z-20 flex items-center justify-center hover:bg-black/90 transition-colors"
                  title="Kartenmodus wechseln"
                  data-testid="taxi-map-style-btn"
                >
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 3m0 0l-3 3m3-3H9a6 6 0 00-6 6v3m18 0v-3a6 6 0 00-6-6h-3m0 18l-3-3m0 0l3-3m-3 3h6a6 6 0 006-6v-3" opacity="0.3"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                </button>

                {/* Map Style Picker Modal (Apple Maps-style) */}
                <TaxiMapStylePicker
                  isOpen={showMapStyles}
                  onClose={() => setShowMapStyles(false)}
                  mapStyle={mapStyle}
                  onPick={setMapStyle}
                />

                {/* Current Address Overlay (Straße + Hausnummer) */}
                {currentAddress && (
                  <div className="absolute top-3 left-3 right-16 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl z-10 border border-white/10" data-testid="taxi-current-address">
                    <p className="text-[9px] text-cyan-400 font-semibold uppercase tracking-wider">
                      {currentAddress.includes('verweigert') || currentAddress.includes('nicht verfügbar') || currentAddress.includes('Timeout') ? '⚠️ Standortfehler' : 'Dein Standort'}
                    </p>
                    <p className="text-xs text-white">{currentAddress}</p>
                    {(currentAddress.includes('Standortzugriff verweigert') || currentAddress.includes('nicht verfügbar') || currentAddress.includes('Timeout')) && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[9px] text-yellow-300">💡 Gib deine Adresse manuell im Feld unten ein</p>
                        <button
                          onClick={getCurrentLocation}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium underline"
                        >
                          🔄 Standort erneut abfragen
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Personalized Greeting Overlay */}
                <div className="absolute bottom-20 left-0 right-0 px-3 z-10 pointer-events-none">
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4">
                    <p className="text-lg font-bold text-white mb-1">
                      {(() => {
                        const h = new Date().getHours();
                        if (h < 5) return 'Gute Nacht';
                        if (h < 12) return 'Guten Morgen';
                        if (h < 18) return 'Guten Tag';
                        return 'Guten Abend';
                      })()}
                    </p>
                    <p className="text-xs text-gray-400">Wohin möchtest du fahren?</p>
                  </div>
                </div>

                {/* Route info overlay */}
                {dropoff.lat !== 0 && estimates.length > 0 && (
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl z-10 border border-white/10">
                    <p className="text-[10px] text-cyan-400 font-semibold">{estimates[0]?.distance_km} km</p>
                    <p className="text-[9px] text-white/50">~{estimates[0]?.duration_minutes} Min</p>
                  </div>
                )}
              </div>

              {/* Location Inputs */}
              <div className="space-y-3">
                {/* ABHOLUNG */}
                <TaxiAddressInput
                  variant="pickup"
                  zIndexClass="z-20"
                  testId="taxi-pickup-input"
                  placeholder={pickup.address || currentAddress.includes('verweigert') || currentAddress.includes('nicht verfügbar') ? "📍 Abholadresse eingeben" : "Aktueller Standort"}
                  value={pickup.address}
                  onChange={handlePickupChange}
                  onBlur={() => geocodeOnBlur('pickup')}
                  suggestions={pickupSuggestions}
                  showSuggestions={showPickupSugg}
                  setShowSuggestions={setShowPickupSugg}
                  onSuggestionClick={selectPickupSugg}
                  favoritesCount={favorites.length}
                  onFavoritesClick={() => setShowFavorites(!showFavorites)}
                />

                {/* ZIEL */}
                <TaxiAddressInput
                  variant="dropoff"
                  zIndexClass="z-10"
                  testId="taxi-dropoff-input"
                  placeholder="Wohin möchtest du?"
                  value={dropoff.address}
                  onChange={handleDropoffChange}
                  onBlur={() => geocodeOnBlur('dropoff')}
                  suggestions={dropoffSuggestions}
                  showSuggestions={showDropoffSugg}
                  setShowSuggestions={setShowDropoffSugg}
                  onSuggestionClick={selectDropoffSugg}
                />
                
                {/* Saved Places */}
                {savedPlaces.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Gespeicherte Orte</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {savedPlaces.map((p) => {
                        const icons = { home: '🏠', work: '💼', gym: '🏋️', school: '🎓', star: '⭐' };
                        return (
                          <button
                            key={p.place_id}
                            onClick={() => setDropoff({ lat: p.lat, lng: p.lng, address: p.address })}
                            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 rounded-xl text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
                            data-testid={`taxi-saved-${p.name}`}
                          >
                            <span>{icons[p.icon] || '📍'}</span>
                            <span className="font-medium">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Destinations + Save Button */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Schnellauswahl</span>
                    {dropoff.address && dropoff.lat !== 0 && (
                      <button
                        onClick={() => setShowSaveModal(true)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        data-testid="taxi-save-place-btn"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                        Ziel speichern
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {[
                      { name: 'Flughafen BER', lat: 52.3667, lng: 13.5033 },
                      { name: 'Hauptbahnhof', lat: 52.5251, lng: 13.3694 },
                      { name: 'Alexanderplatz', lat: 52.5219, lng: 13.4132 },
                      { name: 'Brandenburger Tor', lat: 52.5163, lng: 13.3777 },
                    ].map((dest) => (
                      <button
                        key={dest.name}
                        onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name })}
                        className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors border border-white/5"
                        data-testid={`taxi-quick-${dest.name}`}
                      >
                        {dest.name}
                      </button>
                    ))}
                  </div>

                  {/* Bekannte Orte: Prishtina */}
                  <div className="mb-2">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">Prishtina</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {[
                        { name: 'Flughafen Prishtina', lat: 42.5728, lng: 21.0358 },
                        { name: 'Skanderbeg-Platz', lat: 42.6629, lng: 21.1655 },
                        { name: 'Newborn Monument', lat: 42.6598, lng: 21.1596 },
                        { name: 'Germia Park', lat: 42.6740, lng: 21.1910 },
                        { name: 'Kathedrale Mutter Teresa', lat: 42.6608, lng: 21.1573 },
                        { name: 'Grand Hotel Prishtina', lat: 42.6622, lng: 21.1645 },
                        { name: 'Bulevardi Nënë Tereza', lat: 42.6610, lng: 21.1620 },
                        { name: 'Albi Mall', lat: 42.6484, lng: 21.1544 },
                      ].map((dest) => (
                        <button
                          key={dest.name}
                          onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name + ', Prishtina' })}
                          className="px-2.5 py-1 bg-emerald-500/8 rounded-lg text-[10px] text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors border border-emerald-500/10"
                          data-testid={`taxi-pri-${dest.name}`}
                        >
                          {dest.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bekannte Orte: Dubai */}
                  <div>
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">Dubai</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {[
                        { name: 'Dubai Airport (DXB)', lat: 25.2532, lng: 55.3657 },
                        { name: 'Burj Khalifa', lat: 25.1972, lng: 55.2744 },
                        { name: 'Dubai Mall', lat: 25.1985, lng: 55.2796 },
                        { name: 'Palm Jumeirah', lat: 25.1124, lng: 55.1390 },
                        { name: 'Burj Al Arab', lat: 25.1413, lng: 55.1853 },
                        { name: 'Dubai Marina', lat: 25.0805, lng: 55.1403 },
                        { name: 'Dubai Frame', lat: 25.2350, lng: 55.3006 },
                        { name: 'Mall of Emirates', lat: 25.1182, lng: 55.2006 },
                      ].map((dest) => (
                        <button
                          key={dest.name}
                          onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name + ', Dubai' })}
                          className="px-2.5 py-1 bg-amber-500/8 rounded-lg text-[10px] text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-400 transition-colors border border-amber-500/10"
                          data-testid={`taxi-dub-${dest.name}`}
                        >
                          {dest.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Save Place Modal */}
                <TaxiSavePlaceModal
                  isOpen={showSaveModal}
                  onClose={() => setShowSaveModal(false)}
                  address={dropoff.address}
                  saveIcon={saveIcon}
                  setSaveIcon={setSaveIcon}
                  saveName={saveName}
                  setSaveName={setSaveName}
                  onSave={() => savePlace(dropoff.address, dropoff.lat, dropoff.lng)}
                />
                
                <button
                  onClick={getEstimates}
                  disabled={loading || !dropoff.address}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Lädt...
                    </span>
                  ) : '🚕 Preise anzeigen'}
                </button>
              </div>

              {/* Surge Warning */}
              {surge.active && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-medium text-yellow-400">Hohe Nachfrage</p>
                      <p className="text-sm text-gray-400">Preise sind {surge.multiplier}x höher</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Options */}
              {estimates.length > 0 && (
                <div className="space-y-3">
                  <TaxiVehiclePicker
                    estimates={estimates}
                    selectedVehicle={selectedVehicle}
                    onSelect={setSelectedVehicle}
                  />

                  {/* Book Button */}
                  <button
                    onClick={bookRide}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl font-bold text-black text-lg disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)] hover:shadow-[0_6px_32px_rgba(0,194,255,0.5)] transition-shadow"
                    data-testid="taxi-book-btn"
                  >
                    {loading ? 'Wird gebucht...' : 'Fahrt buchen'}
                  </button>

                  {/* Group Ride Button (Bolt-Style) */}
                  <button
                    type="button"
                    onClick={() => setShowGroupRide(true)}
                    data-testid="taxi-group-ride-btn"
                    className="w-full py-3 bg-[#121218] border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    👥 Group Ride starten
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
                  {error}
                </div>
              )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* TRACKING VIEW */}
          {view === 'tracking' && (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {activeRide ? (
                <>
                  {/* Live Map */}
                  <div className="relative h-56 bg-[#111] rounded-2xl overflow-hidden border border-white/10">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-5xl mb-3">
                          {activeRide.status === 'started' ? '🚗💨' : '📍'}
                        </div>
                        <p className="text-gray-400">Live Tracking</p>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[activeRide.status]}`}>
                        {STATUS_LABELS[activeRide.status]}
                      </span>
                    </div>
                  </div>

                  {/* Driver Info */}
                  {activeRide.driver && (
                    <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
                      <div className="flex items-center gap-4">
                        <img
                          src={activeRide.driver.photo_url || 'https://via.placeholder.com/60'}
                          alt={activeRide.driver.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/30"
                        />
                        <div className="flex-1">
                          <p className="font-bold text-lg">{activeRide.driver.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="text-yellow-400">★</span>
                            <span>{activeRide.driver.rating}</span>
                            <span>•</span>
                            <span>{activeRide.driver.total_rides} Fahrten</span>
                          </div>
                        </div>
                        <button className="p-3 bg-green-500/20 rounded-full text-green-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Vehicle Info */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Fahrzeug</p>
                          <p className="font-semibold">{activeRide.driver.vehicle?.model}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-sm">Kennzeichen</p>
                          <p className="font-mono font-bold text-cyan-400">{activeRide.driver.vehicle?.plate}</p>
                        </div>
                      </div>
                      
                      {/* ETA */}
                      {activeRide.driver.eta_minutes && activeRide.status !== 'started' && (
                        <div className="mt-4 p-3 bg-cyan-500/10 rounded-xl text-center">
                          <p className="text-cyan-400 font-bold text-2xl">{activeRide.driver.eta_minutes} Min</p>
                          <p className="text-sm text-gray-400">bis zur Ankunft</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Route Info */}
                  <div className="p-4 bg-[#111] rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                      <div>
                        <p className="text-gray-400 text-sm">Abholung</p>
                        <p className="font-medium">{activeRide.pickup?.address || 'Startpunkt'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                      <div>
                        <p className="text-gray-400 text-sm">Ziel</p>
                        <p className="font-medium">{activeRide.dropoff?.address || 'Zielpunkt'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fare Info */}
                  <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Geschätzter Preis</span>
                      <span className="text-2xl font-bold text-cyan-400">
                        €{(activeRide.final_fare || activeRide.fare_estimate || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-gray-500">
                      <span>{activeRide.distance_km} km</span>
                      <span>~{activeRide.duration_min} Min</span>
                      <span>{activeRide.vehicle_name}</span>
                    </div>
                  </div>

                  {/* Demo Controls */}
                  {activeRide.status !== 'completed' && activeRide.status !== 'cancelled' && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <p className="text-yellow-400 text-sm font-medium mb-3">Demo Steuerung:</p>
                      <div className="flex gap-2 flex-wrap">
                        {activeRide.status === 'accepted' && (
                          <button onClick={simulateDriverArrival} className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm">
                            Fahrer kommt
                          </button>
                        )}
                        {activeRide.status === 'arriving' && (
                          <button onClick={simulateStartTrip} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">
                            Fahrt starten
                          </button>
                        )}
                        {activeRide.status === 'started' && (
                          <button onClick={simulateCompleteTrip} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">
                            Fahrt beenden
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Live Chat + Split during active ride */}
                  {!['completed', 'cancelled'].includes(activeRide.status) && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        data-testid="taxi-livechat-btn"
                        onClick={() => setShowLiveChat(true)}
                        className="py-3 bg-[#121218] border border-[#00C2FF]/40 text-[#00C2FF] rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >💬 Chat mit Fahrer</button>
                      <button
                        data-testid="taxi-split-btn"
                        onClick={() => {
                          setSplitRideId(activeRide.ride_id);
                          setSplitTotal(activeRide.final_fare || activeRide.fare_estimate || 0);
                          setShowSplit(true);
                        }}
                        className="py-3 bg-[#121218] border border-purple-500/40 text-purple-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >👥 Split Pay</button>
                    </div>
                  )}

                  {/* Cancel Button */}
                  {!['completed', 'cancelled', 'started'].includes(activeRide.status) && (
                    <button
                      onClick={cancelRide}
                      disabled={loading}
                      className="w-full py-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold"
                    >
                      {loading ? 'Wird storniert...' : 'Fahrt stornieren'}
                    </button>
                  )}

                  {/* Completed */}
                  {activeRide.status === 'completed' && (
                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                      <div className="text-5xl mb-4">✅</div>
                      <h3 className="text-xl font-bold text-emerald-400">Fahrt abgeschlossen!</h3>
                      <p className="text-gray-400 mt-2">Bezahlt: €{(activeRide.final_fare || activeRide.fare_estimate).toFixed(2)}</p>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          data-testid="taxi-rate-after-btn"
                          onClick={() => { setReviewRideId(activeRide.ride_id); setShowReview(true); }}
                          className="px-4 py-3 bg-yellow-500/20 text-yellow-400 rounded-xl font-bold"
                        >⭐ Bewerten</button>
                        <button
                          onClick={() => { setActiveRide(null); setView('book'); }}
                          className="px-4 py-3 bg-cyan-500 rounded-xl text-black font-semibold"
                        >Neue Fahrt</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🚕</div>
                  <p className="text-gray-400">Keine aktive Fahrt</p>
                  <button
                    onClick={() => setView('book')}
                    className="mt-4 px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl"
                  >
                    Fahrt buchen
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* HISTORY VIEW */}
          {view === 'history' && (
            <TaxiHistoryView
              rideHistory={rideHistory}
              onRefresh={fetchHistory}
              onReview={(rideId) => { setReviewRideId(rideId); setShowReview(true); }}
            />
          )}
        </AnimatePresence>
        )}
      </div>

      {/* Super-App Parity Modals */}
      <ReviewModal
        isOpen={showReview}
        onClose={() => setShowReview(false)}
        serviceType="taxi"
        serviceId={reviewRideId}
        onSubmit={() => fetchHistory && fetchHistory()}
      />
      <SplitPaymentModal
        isOpen={showSplit}
        onClose={() => setShowSplit(false)}
        type="taxi"
        itemId={splitRideId}
        totalAmount={splitTotal}
      />
      <AnimatePresence>
        {showLiveChat && activeRide?.ride_id && (
          <LiveChat
            rideId={activeRide.ride_id}
            userRole="passenger"
            onClose={() => setShowLiveChat(false)}
          />
        )}
      </AnimatePresence>

      {/* Driver Onboarding Modal */}
      <TaxiDriverOnboardingModal
        isOpen={showDriverOnboarding}
        onClose={() => setShowDriverOnboarding(false)}
        onboardingType={onboardingType}
      />
      
      <GroupOrderModal
        isOpen={showGroupRide}
        onClose={() => setShowGroupRide(false)}
        serviceType="taxi"
        details={{
          pickup,
          destination: dropoff,
          vehicle_type: selectedVehicle,
        }}
      />

      {/* Favoriten Modal */}
      <TaxiFavoritesModal
        isOpen={showFavorites}
        onClose={() => setShowFavorites(false)}
        favorites={favorites}
        onSelect={selectFavorite}
        onDelete={deleteFavorite}
        pickupAddress={pickup.address}
        onSaveCurrentAddress={() => { setShowSaveFavorite(true); setShowFavorites(false); }}
      />

      {/* Save Favorite Modal */}
      <TaxiSaveFavoriteModal
        isOpen={showSaveFavorite}
        onClose={() => setShowSaveFavorite(false)}
        form={favoriteForm}
        setForm={setFavoriteForm}
        address={pickup.address}
        onSubmit={() => {
          if (!favoriteForm.name) {
            setError('Bitte Name eingeben');
            return;
          }
          saveFavorite(pickup, favoriteForm.name, favoriteForm.icon);
        }}
      />
    </div>
  );
}
