import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import { useUser } from '../store/UserContext';
import ReviewModal from '../components/ReviewModal';
import SplitPaymentModal from '../components/SplitPaymentModal';
import LiveChat from '../components/LiveChat';
import GroupOrderModal from '../components/GroupOrderModal';
import GroupTrackerBanner from '../components/GroupTrackerBanner';
import KYCBanner from '../components/KYCBanner';
import TaxiHistoryView from '../components/taxi/TaxiHistoryView';
import TaxiFavoritesModal from '../components/taxi/TaxiFavoritesModal';
import TaxiSaveFavoriteModal from '../components/taxi/TaxiSaveFavoriteModal';
import TaxiDriverOnboardingModal from '../components/taxi/TaxiDriverOnboardingModal';
import TaxiBookingSheet from '../components/taxi/TaxiBookingSheet';
import TaxiTrackingSheet from '../components/taxi/TaxiTrackingSheet';
import useTaxiVoiceover from '../hooks/useTaxiVoiceover';
import TaxiBottomSheet from '../components/taxi/TaxiBottomSheet';
import TaxiAddressSearchSheet from '../components/taxi/TaxiAddressSearchSheet';
import TaxiOrderOptions from '../components/taxi/TaxiOrderOptions';
import TaxiSideMenu from '../components/taxi/TaxiSideMenu';
import TaxiNoteModal from '../components/taxi/TaxiNoteModal';
import TaxiHeader from '../components/taxi/TaxiHeader';
import TaxiTypeSelector from '../components/taxi/TaxiTypeSelector';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import { useTaxiState } from '../hooks/useTaxiState';
import { useGeolocation } from '../hooks/useGeolocation';
import { useTaxiMap } from '../hooks/useTaxiMap';
import * as api from '../services/taxiApi';

export default function TaxiPage({ onNavigate }) {
  const { t } = useI18n();
  const { user } = useUser();
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
    orderOptions, setOrderOptions,
    showOrderOptions, setShowOrderOptions,
    searchSheetMode, setSearchSheetMode,
    waypoints, setWaypoints,
    recentAddresses, setRecentAddresses,
    showSideMenu, setShowSideMenu,
  } = state;

  // Inline editor state for per-address notes
  const [noteTarget, setNoteTarget] = useState(null); // null | { type: 'pickup' | 'dropoff' | 'waypoint', index?: number }
  const [vehiclePriority, setVehiclePriority] = useState('fastest');
  const [pickupCity, setPickupCity] = useState('');
  const [citySaved, setCitySaved] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Live driver availability (count near pickup, filtered by options)
  const [nearbyCount, setNearbyCount] = useState(null); // null = unknown, 0+ = known
  const [nearbyDrivers, setNearbyDrivers] = useState([]); // for live pulse markers on map
  const [promo, setPromo] = useState(null); // {code, label, discount}

  // Favorite routes (top pickup→dropoff pairs from ride history)
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);

  // Toggle body class for fullscreen booking mode (hides BottomNav, AIChat, FAB-cluster, cookie banner)
  useEffect(() => {
    const inMapFlow = moduleEnabled && (
      (view === 'book' && taxiType) ||
      (view === 'tracking' && activeRide)
    );
    if (inMapFlow) {
      document.body.classList.add('taxi-fullscreen-mode');
    } else {
      document.body.classList.remove('taxi-fullscreen-mode');
    }
    return () => document.body.classList.remove('taxi-fullscreen-mode');
  }, [view, taxiType, moduleEnabled, activeRide]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS: Map + Geolocation
  // ═══════════════════════════════════════════════════════════════════════════

  // Map-error state surfaced when Mapbox fails (invalid token, network, etc.)
  const [mapError, setMapError] = useState(null);
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false);
  const [showTripReplay, setShowTripReplay] = useState(false);

  // Surge zones — synthesized from `surge` state in nearby cells for the heatmap overlay.
  // In production this would come from a backend `/api/taxi/surge-zones` endpoint.
  const surgeZones = useMemo(() => {
    if (!surge?.active || !pickup?.lat) return null;
    const m = surge.multiplier || 1.2;
    // Generate 8 zones around the pickup (radius ~600m) for visual interest
    const zones = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dx = Math.cos(angle) * 0.005;
      const dy = Math.sin(angle) * 0.005;
      zones.push({
        lat: pickup.lat + dy,
        lng: pickup.lng + dx,
        multiplier: m * (0.9 + Math.random() * 0.3),
      });
    }
    // hot center
    zones.push({ lat: pickup.lat, lng: pickup.lng, multiplier: m });
    return zones;
  }, [surge?.active, surge?.multiplier, pickup?.lat, pickup?.lng]);

  const {
    mapContainerRef,
    mapRef,
    pickupMarkerRef,
    loadPOIs,
    driverPathRef,
  } = useTaxiMap({
    pickup, setPickup,
    dropoff, setDropoff,
    taxiType,
    mapStyle,
    activePoiCategory, setActivePoiCategory,
    setPoiLoading,
    driverLocation: activeRide?.driver_lat && activeRide?.driver_lng
      ? { lat: activeRide.driver_lat, lng: activeRide.driver_lng }
      : null,
    onError: setMapError,
    surgeZones,
    showTripReplay,
    nearbyDrivers,
  });

  // Expose so the activeRide-status effect can preload the server-recorded path on completion.
  useEffect(() => {
    if (typeof window !== "undefined") window.__taxiDriverPathRef = driverPathRef;
  }, [driverPathRef]);

  const {
    currentAddress,
    loadingLocation,
    getCurrentLocation,
  } = useGeolocation({ setPickup, mapRef, pickupMarkerRef });

  // Voiceover (Web Speech API) — announces ride status transitions in German
  const voiceover = useTaxiVoiceover(activeRide);

  // Get current GPS location on mount + fetch recent addresses + favorite routes
  useEffect(() => {
    getCurrentLocation();
    (async () => {
      try {
        const [recent, routes] = await Promise.all([
          api.fetchRecentAddresses(10),
          api.fetchFavoriteRoutes(5),
        ]);
        setRecentAddresses(recent);
        setFavoriteRoutes(routes);
      } catch {}
    })();
  }, [getCurrentLocation, setRecentAddresses]);

  // City detection from pickup address (used for City-Defaults feature)
  useEffect(() => {
    if (!pickup?.address) { setPickupCity(''); return; }
    // Cheap heuristic: city is usually 2nd-to-last comma segment, or zip+city
    const parts = pickup.address.split(',').map(s => s.trim()).filter(Boolean);
    let city = '';
    for (const p of parts) {
      const m = p.match(/^\d{4,5}\s+(.+)$/);
      if (m) { city = m[1]; break; }
    }
    if (!city && parts.length >= 2) {
      city = parts[parts.length - 2].replace(/^\d{4,5}\s+/, '');
    }
    setPickupCity(city.split(' ')[0] || '');
  }, [pickup?.address]);

  // Load saved city defaults whenever pickupCity changes
  useEffect(() => {
    if (!pickupCity) { setCitySaved(false); return; }
    (async () => {
      const saved = await api.fetchCityDefault(pickupCity);
      if (saved?.options) {
        setOrderOptions((prev) => ({ ...prev, ...saved.options }));
        setCitySaved(true);
      } else {
        setCitySaved(false);
      }
    })();
  }, [pickupCity, setOrderOptions]);

  const handleSaveCityDefault = async () => {
    if (!pickupCity) return;
    const ok = await api.saveCityDefault(pickupCity, orderOptions);
    if (ok) setCitySaved(true);
  };

  // Live driver count: refetch when pickup coords or options change (debounced)
  useEffect(() => {
    if (!moduleEnabled || !taxiType) { setNearbyCount(null); setNearbyDrivers([]); return; }
    if (!pickup?.lat || pickup.lat === 0) { setNearbyCount(null); setNearbyDrivers([]); return; }
    const carType = selectedVehicle || 'standard';
    const t = setTimeout(async () => {
      const { count, drivers } = await api.fetchNearbyDriversCount({
        lat: pickup.lat,
        lng: pickup.lng,
        carType,
        withPet: orderOptions.withPet,
        luggage: orderOptions.luggage,
        assistance: orderOptions.assistance,
      });
      setNearbyCount(count);
      setNearbyDrivers(drivers || []);
    }, 400);
    return () => clearTimeout(t);
  }, [
    moduleEnabled, taxiType,
    pickup?.lat, pickup?.lng,
    selectedVehicle,
    orderOptions.withPet, orderOptions.luggage, orderOptions.assistance,
  ]);

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

  const pollingRef = useRef(null);

  // ─── API-backed actions ──────────────────────────────────────────────────
  const fetchUserData = useCallback(async () => {
    const data = await api.fetchMe();
    if (data) setUserBalance(data.balance || 0);
  }, [setUserBalance]);

  const refreshFavorites = useCallback(async () => {
    setFavorites(await api.fetchFavorites());
  }, [setFavorites]);

  const refreshSavedPlaces = useCallback(async () => {
    setSavedPlaces(await api.fetchSavedPlaces());
  }, [setSavedPlaces]);

  const checkModuleStatus = useCallback(async () => {
    const data = await api.fetchTaxiStatus();
    if (!data) return;
    if (data.module_enabled === false) {
      setModuleEnabled(false);
      setModuleMessage(data.message || 'Taxi-Modul wird derzeit vorbereitet');
    } else {
      setBusinessDrivers(data.business_drivers || 0);
      setPrivateDrivers(data.private_drivers || 0);
    }
  }, [setModuleEnabled, setModuleMessage]);

  const loadModeSettings = useCallback(async () => {
    const data = await api.fetchModeSettings();
    if (data) setModeSettings(data);
  }, []);

  const startPolling = useCallback((rideId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const data = await api.fetchRide(rideId);
      if (!data?.ride) return;
      setActiveRide(data.ride);
      if (['completed', 'cancelled'].includes(data.ride.status)) {
        clearInterval(pollingRef.current);
        fetchUserData();
      }
    }, 3000);
  }, [setActiveRide, fetchUserData]);

  const checkActiveRide = useCallback(async () => {
    const data = await api.fetchActiveRide();
    if (data?.has_active_ride && data.ride) {
      setActiveRide(data.ride);
      setView('tracking');
      startPolling(data.ride.ride_id);
    }
  }, [setActiveRide, setView, startPolling]);

  useEffect(() => {
    fetchUserData();
    checkActiveRide();
    checkModuleStatus();
    loadModeSettings();
    refreshFavorites();
    refreshSavedPlaces();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFavorite = async (locationData, name, icon) => {
    const result = await api.saveFavoriteApi({
      name, address: locationData.address, latitude: locationData.lat, longitude: locationData.lng, icon,
    });
    if (result.ok) {
      await refreshFavorites();
      setShowSaveFavorite(false);
      setFavoriteForm({ name: '', icon: 'star' });
    } else {
      setError(result.error);
    }
  };

  const deleteFavorite = async (favoriteId) => {
    if (await api.deleteFavoriteApi(favoriteId)) await refreshFavorites();
  };

  const selectFavorite = async (favorite) => {
    setPickup({ lat: favorite.latitude, lng: favorite.longitude, address: favorite.address });
    setShowFavorites(false);
    await api.markFavoriteUsed(favorite.id);
    await refreshFavorites();
  };

  const savePlace = async (address, lat, lng) => {
    if (!saveName || !address) return;
    if (await api.savePlaceApi({ name: saveName, icon: saveIcon, address, lat, lng })) {
      refreshSavedPlaces();
      setShowSaveModal(false); setSaveName(''); setSaveIcon('star');
    }
  };

  const getEstimates = async () => {
    // Auto-geocode dropoff if needed
    if (dropoff.address && (!dropoff.lat || dropoff.lat === 0)) {
      const geo = await api.forwardGeocode(dropoff.address);
      if (!geo) { setError('Ziel nicht gefunden. Bitte Vorschlag auswählen.'); return; }
      setDropoff(geo);
    }
    if (!pickup.lat || !dropoff.address) {
      setError('Bitte Start und Ziel eingeben');
      return;
    }
    setLoading(true); setError('');
    const result = await api.estimateRide({ pickup, dropoff, promoCode: promo?.code });
    if (result.ok) {
      setEstimates(result.estimates);
      setSurge(result.surge);
      if (result.promo && !result.promo.valid && promo) {
        // server says applied promo no longer valid → clear
        setPromo(null);
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  // Auto-fetch estimates when both pickup + dropoff are valid (Uber/Bolt parity).
  // Also re-trigger when promo changes.
  useEffect(() => {
    if (!moduleEnabled || !taxiType) return;
    if (!pickup?.lat || !dropoff?.lat) return;
    if (loading) return;
    const t = setTimeout(() => { getEstimates(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleEnabled, taxiType, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, promo?.code]);

  const bookRide = async () => {
    const estimate = estimates.find(e => e.vehicle_type === selectedVehicle);
    if (!estimate) return;
    if (userBalance < estimate.fare) {
      setError(`Nicht genug Guthaben. Benötigt: €${estimate.fare.toFixed(2)}`);
      return;
    }
    setLoading(true); setError('');
    const result = await api.bookRideApi({
      pickup, dropoff, vehicleType: selectedVehicle,
      options: orderOptions,
      stops: waypoints,
      promoCode: promo?.code || null,
    });
    if (result.ok) {
      setActiveRide(result.ride);
      setView('tracking');
      startPolling(result.ride.ride_id);
      // Refresh recent addresses + favorite routes (newly-used pair tracked)
      api.fetchRecentAddresses(10).then(setRecentAddresses).catch(() => {});
      api.fetchFavoriteRoutes(5).then(setFavoriteRoutes).catch(() => {});
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const cancelRide = async (reason = null) => {
    if (!activeRide) return;
    setLoading(true);
    const result = await api.cancelRideApi(activeRide.ride_id, reason);
    if (result.ok) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setActiveRide(null);
      setView('book');
      fetchUserData();
    } else {
      setError(result.error);
    }
    setLoading(false);
    setCancelReasonOpen(false);
  };

  // Trigger trip-replay automatically when ride completes (one-shot)
  useEffect(() => {
    if (activeRide?.status === 'completed' && !showTripReplay) {
      // Fetch server-recorded path for reliable replay (works after page reload too)
      const rid = activeRide.ride_id;
      if (rid) {
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/taxi/rides/${rid}/path`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d?.path?.length >= 2) {
              // Inject server path into the map hook by setting both refs
              // (the hook reads driverPathRef on showTripReplay=true)
              const path = d.path.map(p => [p.lng, p.lat]);
              if (window.__taxiDriverPathRef) {
                window.__taxiDriverPathRef.current = path;
              }
            }
          })
          .catch(() => {});
      }
      setShowTripReplay(true);
    }
    if (!activeRide || activeRide.status !== 'completed') {
      if (showTripReplay) setShowTripReplay(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.status]);

  const fetchHistory = async () => {
    setRideHistory(await api.fetchRideHistory());
  };

  useEffect(() => {
    if (view === 'history') fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const simulateDriverArrival = () => activeRide && api.setDriverStatus(activeRide.ride_id, 'arriving');
  const simulateStartTrip     = () => activeRide && api.setDriverStatus(activeRide.ride_id, 'started');
  const simulateCompleteTrip  = () => activeRide && api.setDriverStatus(activeRide.ride_id, 'completed');

  // Order options summary text for the sheet button
  const optionsSummary = (() => {
    const tags = [];
    if (orderOptions.scheduledAt) {
      const d = new Date(orderOptions.scheduledAt);
      tags.push(d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
    } else {
      tags.push('Jetzt');
    }
    if (orderOptions.withPet) tags.push('🐾');
    if (orderOptions.luggage === 'much' || orderOptions.luggage === 'much_combi') tags.push('🧳');
    if (orderOptions.assistance) tags.push('♿');
    if (orderOptions.language && orderOptions.language !== 'de') tags.push(orderOptions.language.toUpperCase());
    return tags.join(' · ');
  })();
  const scheduledLabel = orderOptions.scheduledAt
    ? new Date(orderOptions.scheduledAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  // taxi.eu-style: render map full-screen with bottom-sheet during booking OR active tracking
  const inMapBookingFlow = moduleEnabled && (
    (view === 'book' && taxiType) ||
    (view === 'tracking' && activeRide)
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white" data-mapflow={inMapBookingFlow ? '1' : '0'}>
      {!inMapBookingFlow && (
        <TaxiHeader
          onBack={() => navigate('/')}
          view={view}
          setView={setView}
          moduleEnabled={moduleEnabled}
          userBalance={userBalance}
        />
      )}

      {/* FULL-SCREEN MAP BOOKING FLOW (taxi.eu parity) */}
      {inMapBookingFlow && (
        <div className="fixed inset-0 z-10">
          {/* Map fills entire viewport */}
          <div
            ref={mapContainerRef}
            className="absolute inset-0"
            data-testid="taxi-map-container"
          />

          {/* Map error overlay (token/network failure) */}
          {mapError && (
            <div
              className="absolute inset-x-0 top-20 mx-4 z-30 p-4 rounded-2xl bg-red-500/10 border border-red-500/40 backdrop-blur-xl flex items-start gap-3"
              data-testid="taxi-map-error"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-300">Karte nicht ladbar</p>
                <p className="text-[12px] text-white/65 mt-0.5 leading-snug">{mapError}</p>
                <button
                  onClick={() => { setMapError(null); window.location.reload(); }}
                  data-testid="taxi-map-error-reload"
                  className="mt-2 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold"
                >
                  Neu laden
                </button>
              </div>
            </div>
          )}

          {/* Top bar overlay */}
          <div className="absolute top-0 inset-x-0 z-40 px-4 pt-3 pb-2 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setShowSideMenu(true)}
                className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0"
                data-testid="map-flow-menu"
                title="Menü"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {currentAddress ? (
                (() => {
                  const isDenied = /verweigert|denied|verboten/i.test(currentAddress);
                  if (isDenied) {
                    return (
                      <button
                        onClick={getCurrentLocation}
                        data-testid="map-flow-gps-denied-cta"
                        className="flex-1 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-2 text-left min-w-0 flex items-center gap-2 hover:bg-red-500/15 active:scale-[0.98] transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" className="shrink-0">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                        <span className="flex-1 min-w-0">
                          <p className="text-[9px] text-red-400 font-semibold uppercase tracking-wider leading-none">GPS aus</p>
                          <p className="text-xs text-white truncate leading-tight mt-0.5">Tippen, um zu aktivieren</p>
                        </span>
                      </button>
                    );
                  }
                  return (
                    <div
                      className="flex-1 bg-black/70 backdrop-blur-md border border-white/10 rounded-full px-3 py-2 text-left min-w-0"
                      data-testid="map-flow-current-address"
                    >
                      <p className="text-[9px] text-cyan-400 font-semibold uppercase tracking-wider leading-none">
                        Standort
                      </p>
                      <p className="text-xs text-white truncate leading-tight mt-0.5">{currentAddress}</p>
                    </div>
                  );
                })()
              ) : null}

              <button
                onClick={getCurrentLocation}
                disabled={loadingLocation}
                className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center disabled:opacity-50 shrink-0"
                data-testid="map-flow-locate"
                title="Standort"
              >
                {loadingLocation ? (
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                )}
              </button>

              {view === 'tracking' && (
                <button
                  onClick={() => {
                    voiceover.setEnabled(!voiceover.enabled);
                    if (!voiceover.enabled) {
                      // unmute → speak a confirmation so the user hears it works
                      voiceover.speak("Stimme aktiviert.");
                    }
                  }}
                  className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center shrink-0 transition-colors ${
                    voiceover.enabled
                      ? "bg-[#00C2FF]/20 border-[#00C2FF]/40 text-[#00C2FF]"
                      : "bg-black/70 border-white/10 text-white/50"
                  }`}
                  data-testid="map-flow-voice-toggle"
                  title={voiceover.enabled ? "Stimme ausschalten" : "Stimme einschalten"}
                >
                  {voiceover.enabled ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M15.54 8.46a5 5 0 010 7.07" />
                      <path d="M19.07 4.93a10 10 0 010 14.14" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Draggable Bottom Sheet (starts collapsed for max map area) */}
          <TaxiBottomSheet defaultSnap={view === 'tracking' ? 'half' : 'collapsed'}>
            {view === 'tracking' ? (
              <TaxiTrackingSheet
                activeRide={activeRide}
                loading={loading}
                cancelRide={cancelRide}
                onRequestCancel={() => setCancelReasonOpen(true)}
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
            ) : (
              <TaxiBookingSheet
                taxiType={taxiType}
                onChangeType={() => setTaxiType('')}
                userName={user?.name?.split(" ")?.[0] || user?.first_name || null}
                pickup={pickup}
                dropoff={dropoff}
                onTapPickup={() => setSearchSheetMode('pickup')}
                onTapDropoff={() => setSearchSheetMode('dropoff')}
                onClearDropoff={() => { setDropoff({ lat: 0, lng: 0, address: '' }); setEstimates([]); }}
                onEditPickupNotes={() => setNoteTarget({ type: 'pickup' })}
                onEditDropoffNotes={() => setNoteTarget({ type: 'dropoff' })}
                waypoints={waypoints}
                onAddWaypoint={() => {
                  setWaypoints((prev) => [...prev, { lat: 0, lng: 0, address: '', notes: '' }]);
                  setSearchSheetMode(`waypoint:${waypoints.length}`);
                }}
                onTapWaypoint={(idx) => setSearchSheetMode(`waypoint:${idx}`)}
                onRemoveWaypoint={(idx) => setWaypoints((prev) => prev.filter((_, i) => i !== idx))}
                onEditWaypointNotes={(idx) => setNoteTarget({ type: 'waypoint', index: idx })}
                savedPlaces={savedPlaces}
                onPickSavedPlace={(p) => setDropoff({ lat: p.lat, lng: p.lng, address: p.address })}
                estimates={estimates}
                selectedVehicle={selectedVehicle}
                setSelectedVehicle={setSelectedVehicle}
                surge={surge}
                loading={loading}
                error={error}
                optionsSummary={optionsSummary}
                onOpenOptions={() => setShowOrderOptions(true)}
                noDriversAvailable={nearbyCount === 0}
                nearbyCount={nearbyCount}
                onGetEstimates={getEstimates}
                onBook={bookRide}
                scheduledLabel={scheduledLabel}
                pickupCity={pickupCity}
                citySaved={citySaved}
                onSaveCityDefault={handleSaveCityDefault}
                favoriteRoutes={favoriteRoutes}
                onPickFavoriteRoute={(r) => {
                  setPickup({ lat: r.pickup.lat, lng: r.pickup.lng, address: r.pickup.address });
                  setDropoff({ lat: r.dropoff.lat, lng: r.dropoff.lng, address: r.dropoff.address });
                }}
                promo={promo}
                onPromoChange={setPromo}
                onApplyPromoCode={async (code) => {
                  try {
                    const r = await api.validatePromoCode(code);
                    if (r?.valid) {
                      setPromo({ code: r.code, label: r.label, discount: r.discount });
                    }
                  } catch {}
                }}
              />
            )}
          </TaxiBottomSheet>

          {/* Address search overlay */}
          <TaxiAddressSearchSheet
            mode={searchSheetMode}
            onClose={() => setSearchSheetMode(null)}
            currentLocation={currentAddress ? { address: currentAddress, lat: pickup.lat, lng: pickup.lng } : null}
            pickup={pickup}
            dropoff={dropoff}
            onSelectPickup={(p) => setPickup({ ...p })}
            onSelectDropoff={(d) => setDropoff({ ...d })}
            onSelectWaypoint={(idx, sel) => {
              setWaypoints((prev) => {
                const next = [...prev];
                next[idx] = { ...next[idx], lat: sel.lat, lng: sel.lng, address: sel.address };
                return next;
              });
            }}
            onUseCurrentLocation={getCurrentLocation}
            onPickOnMap={() => setSearchSheetMode(null)}
            favorites={favorites}
            savedPlaces={savedPlaces}
            recentAddresses={recentAddresses}
          />

          {/* Per-address driver notes modal */}
          <TaxiNoteModal
            isOpen={Boolean(noteTarget)}
            title={
              noteTarget?.type === 'pickup' ? 'Hinweis für Abholung' :
              noteTarget?.type === 'dropoff' ? 'Hinweis für Ziel' :
              `Hinweis für Stop ${(noteTarget?.index ?? 0) + 1}`
            }
            initialValue={
              noteTarget?.type === 'pickup' ? (pickup.notes || '') :
              noteTarget?.type === 'dropoff' ? (dropoff.notes || '') :
              noteTarget?.type === 'waypoint' ? (waypoints[noteTarget.index]?.notes || '') : ''
            }
            onClose={() => setNoteTarget(null)}
            onSave={(text) => {
              if (!noteTarget) return;
              if (noteTarget.type === 'pickup')      setPickup((p) => ({ ...p, notes: text }));
              else if (noteTarget.type === 'dropoff') setDropoff((d) => ({ ...d, notes: text }));
              else {
                setWaypoints((prev) => {
                  const next = [...prev];
                  if (next[noteTarget.index]) next[noteTarget.index] = { ...next[noteTarget.index], notes: text };
                  return next;
                });
              }
            }}
          />

          {/* Order options overlay */}
          <TaxiOrderOptions
            isOpen={showOrderOptions}
            onClose={() => setShowOrderOptions(false)}
            options={orderOptions}
            setOptions={setOrderOptions}
          />

          {/* Side menu (hamburger) */}
          <TaxiSideMenu
            isOpen={showSideMenu}
            onClose={() => setShowSideMenu(false)}
            user={currentUser}
            userBalance={userBalance}
            favoritesCount={favorites.length}
            recentAddressesCount={recentAddresses.length}
            onOpenFavorites={() => setShowFavorites(true)}
            onOpenHistory={() => setView('history')}
            onOpenSaved={() => setShowFavorites(true)}
            onOpenDriverOnboarding={() => setShowDriverOnboarding(true)}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {!inMapBookingFlow && (
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
                <TaxiTypeSelector
                  modeSettings={modeSettings}
                  businessDrivers={businessDrivers}
                  privateDrivers={privateDrivers}
                  onPick={setTaxiType}
                />
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

          {/* TRACKING VIEW now lives inside fullscreen Map+Sheet (see inMapBookingFlow above) */}

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
      )}

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
        {cancelReasonOpen && (
          <CancelReasonModal
            onClose={() => setCancelReasonOpen(false)}
            onConfirm={(reason) => cancelRide(reason)}
            loading={loading}
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


function CancelReasonModal({ onClose, onConfirm, loading }) {
  const REASONS = [
    { key: "wrong_address", label: "Falsche Adresse eingegeben" },
    { key: "too_long_wait", label: "Wartezeit zu lange" },
    { key: "no_longer_needed", label: "Brauche das Taxi nicht mehr" },
    { key: "driver_no_show", label: "Fahrer nicht aufgetaucht" },
    { key: "found_other", label: "Habe eine andere Option gefunden" },
    { key: "other", label: "Anderer Grund" },
  ];
  const [selected, setSelected] = useState(null);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      data-testid="cancel-reason-overlay"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Warum brichst du die Fahrt ab?</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1.5" data-testid="cancel-reason-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-white/55">Deine Antwort hilft uns, den Service zu verbessern.</p>
        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              data-testid={`cancel-reason-${r.key}`}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${
                selected === r.key
                  ? "bg-red-500/15 border-red-500/40 text-white"
                  : "bg-white/[0.03] border-white/[0.08] text-white/80 hover:bg-white/[0.06]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            data-testid="cancel-reason-back"
            className="flex-1 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm font-semibold text-white/80"
          >
            Doch nicht abbrechen
          </button>
          <button
            disabled={!selected || loading}
            onClick={() => onConfirm(selected)}
            data-testid="cancel-reason-confirm"
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
          >
            {loading ? "..." : "Bestätigen"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
