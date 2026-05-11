import React, { useState, useEffect, useRef } from 'react';
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
import TaxiBookingForm from '../components/taxi/TaxiBookingForm';
import TaxiHeader from '../components/taxi/TaxiHeader';
import TaxiTrackingView from '../components/taxi/TaxiTrackingView';
import TaxiTypeSelector from '../components/taxi/TaxiTypeSelector';
import { useTaxiGeocoder } from '../components/taxi/useTaxiGeocoder';
import { useTaxiState } from '../hooks/useTaxiState';
import { useGeolocation } from '../hooks/useGeolocation';
import { useTaxiMap } from '../hooks/useTaxiMap';

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

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOKS: Map + Geolocation
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    mapContainerRef,
    mapRef,
    pickupMarkerRef,
    loadPOIs,
  } = useTaxiMap({
    pickup, setPickup,
    dropoff, setDropoff,
    taxiType,
    mapStyle,
    activePoiCategory, setActivePoiCategory,
    setPoiLoading,
  });

  const {
    currentAddress,
    loadingLocation,
    getCurrentLocation,
  } = useGeolocation({ setPickup, mapRef, pickupMarkerRef });

  // Get current GPS location on mount
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

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
