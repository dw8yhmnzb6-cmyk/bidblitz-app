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
import { MAP_STYLES, POI_CATEGORIES } from '../components/taxi/TaxiConstants';
import TaxiHistoryView from '../components/taxi/TaxiHistoryView';
import TaxiPoiFilterSheet from '../components/taxi/TaxiPoiFilterSheet';
import TaxiMapStylePicker from '../components/taxi/TaxiMapStylePicker';
import TaxiSavePlaceModal from '../components/taxi/TaxiSavePlaceModal';
import TaxiFavoritesModal from '../components/taxi/TaxiFavoritesModal';
import TaxiSaveFavoriteModal from '../components/taxi/TaxiSaveFavoriteModal';
import TaxiDriverOnboardingModal from '../components/taxi/TaxiDriverOnboardingModal';
import TaxiVehiclePicker from '../components/taxi/TaxiVehiclePicker';
import TaxiAddressInput from '../components/taxi/TaxiAddressInput';
import TaxiBookingForm from '../components/taxi/TaxiBookingForm';
import TaxiHeader from '../components/taxi/TaxiHeader';
import TaxiTrackingView from '../components/taxi/TaxiTrackingView';
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
      <TaxiHeader
        onBack={() => navigate('/')}
        view={view}
        setView={setView}
        moduleEnabled={moduleEnabled}
        userBalance={userBalance}
      />

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

              {/* BOOKING FORM - extracted to TaxiBookingForm component */}
              {taxiType && (
                <TaxiBookingForm
                  taxiType={taxiType}
                  setTaxiType={setTaxiType}
                  pickup={pickup}
                  dropoff={dropoff}
                  setDropoff={setDropoff}
                  handlePickupChange={handlePickupChange}
                  handleDropoffChange={handleDropoffChange}
                  geocodeOnBlur={geocodeOnBlur}
                  pickupSuggestions={pickupSuggestions}
                  dropoffSuggestions={dropoffSuggestions}
                  showPickupSugg={showPickupSugg}
                  setShowPickupSugg={setShowPickupSugg}
                  showDropoffSugg={showDropoffSugg}
                  setShowDropoffSugg={setShowDropoffSugg}
                  selectPickupSugg={selectPickupSugg}
                  selectDropoffSugg={selectDropoffSugg}
                  mapContainerRef={mapContainerRef}
                  getCurrentLocation={getCurrentLocation}
                  loadingLocation={loadingLocation}
                  currentAddress={currentAddress}
                  mapStyle={mapStyle}
                  setMapStyle={setMapStyle}
                  showMapStyles={showMapStyles}
                  setShowMapStyles={setShowMapStyles}
                  showPoiFilter={showPoiFilter}
                  setShowPoiFilter={setShowPoiFilter}
                  activePoiCategory={activePoiCategory}
                  loadPOIs={loadPOIs}
                  poiLoading={poiLoading}
                  favoritesCount={favorites.length}
                  onFavoritesClick={() => setShowFavorites(!showFavorites)}
                  savedPlaces={savedPlaces}
                  showSaveModal={showSaveModal}
                  setShowSaveModal={setShowSaveModal}
                  saveName={saveName}
                  setSaveName={setSaveName}
                  saveIcon={saveIcon}
                  setSaveIcon={setSaveIcon}
                  onSavePlace={() => savePlace(dropoff.address, dropoff.lat, dropoff.lng)}
                  estimates={estimates}
                  selectedVehicle={selectedVehicle}
                  setSelectedVehicle={setSelectedVehicle}
                  surge={surge}
                  error={error}
                  loading={loading}
                  getEstimates={getEstimates}
                  bookRide={bookRide}
                  onOpenGroupRide={() => setShowGroupRide(true)}
                />
              )}
            </motion.div>
          )}

          {/* TRACKING VIEW */}
          {view === 'tracking' && (
            <TaxiTrackingView
              activeRide={activeRide}
              loading={loading}
              cancelRide={cancelRide}
              simulateDriverArrival={simulateDriverArrival}
              simulateStartTrip={simulateStartTrip}
              simulateCompleteTrip={simulateCompleteTrip}
              onOpenLiveChat={() => setShowLiveChat(true)}
              onOpenSplit={() => {
                setSplitRideId(activeRide.ride_id);
                setSplitTotal(activeRide.final_fare || activeRide.fare_estimate || 0);
                setShowSplit(true);
              }}
              onOpenReview={() => { setReviewRideId(activeRide.ride_id); setShowReview(true); }}
              onResetToBook={() => { setActiveRide(null); setView('book'); }}
            />
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
