import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Status badge colors
const STATUS_COLORS = {
  requested: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-blue-500/20 text-blue-400',
  arriving: 'bg-cyan-500/20 text-cyan-400',
  started: 'bg-green-500/20 text-green-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS = {
  requested: 'Suche Fahrer...',
  accepted: 'Fahrer gefunden',
  arriving: 'Fahrer kommt',
  started: 'Fahrt läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

// Vehicle type icons (using emoji for simplicity)
const VEHICLE_ICONS = {
  standard: '🚗',
  premium: '🚙',
  van: '🚐',
};

export default function TaxiPage({ onNavigate }) {
  const { t } = useI18n();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // State
  const [view, setView] = useState('book'); // book, tracking, history
  const [taxiType, setTaxiType] = useState(''); // '' = not selected, 'business' = Unternehmer, 'private' = Privat
  const [pickup, setPickup] = useState({ lat: 52.52, lng: 13.405, address: '' });
  const [dropoff, setDropoff] = useState({ lat: 0, lng: 0, address: '' });
  const [estimates, setEstimates] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  const [error, setError] = useState('');
  const [surge, setSurge] = useState({ active: false, multiplier: 1.0 });
  const [userBalance, setUserBalance] = useState(0);
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [moduleMessage, setModuleMessage] = useState('');

  // Autocomplete state
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSugg, setShowPickupSugg] = useState(false);
  const [showDropoffSugg, setShowDropoffSugg] = useState(false);
  const pickupTimer = useRef(null);
  const dropoffTimer = useRef(null);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveIcon, setSaveIcon] = useState("star");

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

  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
  const geocodeSearch = async (query, setter, showSetter) => {
    if (!query || query.length < 2 || !MAPBOX_TOKEN) { setter([]); showSetter(false); return; }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=de&country=de,at,ch&limit=5&types=address,poi,place,locality`
      );
      if (res.ok) {

  // Geocoding autocomplete
        const data = await res.json();
        const results = (data.features || []).map(f => ({
          name: f.text,
          address: f.place_name,
          lat: f.center[1],
          lng: f.center[0],
          type: f.place_type?.[0] || 'address',
        }));
        setter(results);
        showSetter(results.length > 0);
      }
    } catch { setter([]); showSetter(false); }
  };

  const handlePickupChange = (text) => {
    setPickup(p => ({ ...p, address: text }));
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(() => geocodeSearch(text, setPickupSuggestions, setShowPickupSugg), 300);
  };

  const handleDropoffChange = (text) => {
    setDropoff(p => ({ ...p, address: text }));
    if (dropoffTimer.current) clearTimeout(dropoffTimer.current);
    dropoffTimer.current = setTimeout(() => geocodeSearch(text, setDropoffSuggestions, setShowDropoffSugg), 300);
  };

  // Auto-geocode on blur if no coords yet
  const geocodeOnBlur = async (type) => {
    const target = type === 'pickup' ? pickup : dropoff;
    const setter = type === 'pickup' ? setPickup : setDropoff;
    if (target.address && (!target.lat || target.lat === 0 || target.lat === 52.52)) {
      if (!MAPBOX_TOKEN) return;
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(target.address)}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1`);
        if (res.ok) {
          const data = await res.json();
          const f = data.features?.[0];
          if (f) setter({ lat: f.center[1], lng: f.center[0], address: f.place_name || target.address });
        }
      } catch {}
    }
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
  
  // Refs
  const mapRef = useRef(null);
  const pollingRef = useRef(null);

  // Fetch user data
  useEffect(() => {
    fetchUserData();
    checkActiveRide();
    checkModuleStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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
      const res = await fetch(`${API}/api/taxi/active`, { credentials: 'include' });
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

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickup({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Aktueller Standort',
          });
        },
        (err) => {
          console.error('Geolocation error:', err);
          setError('Standort konnte nicht ermittelt werden');
        }
      );
    }
  };

  // Get fare estimates
  const getEstimates = async () => {
    // Auto-geocode dropoff if needed
    if (dropoff.address && (!dropoff.lat || dropoff.lat === 0)) {
      if (MAPBOX_TOKEN) {
        try {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(dropoff.address)}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1`);
          if (res.ok) {
            const data = await res.json();
            const f = data.features?.[0];
            if (f) { setDropoff({ lat: f.center[1], lng: f.center[0], address: f.place_name || dropoff.address }); }
            else { setError('Ziel nicht gefunden. Bitte Vorschlag auswählen.'); return; }
          }
        } catch { setError('Geocoding-Fehler'); return; }
      }
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
      const res = await fetch(`${API}/api/taxi/history`, { credentials: 'include' });
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
            <div className="text-sm text-cyan-400 font-medium">€{userBalance.toFixed(2)}</div>
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
                  <h2 className="text-lg font-semibold text-center">Wähle deinen Taxi-Typ</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Business/Company Taxi */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTaxiType('business')}
                      className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 rounded-2xl p-5 text-left hover:border-cyan-400/60 transition-all"
                    >
                      <div className="w-14 h-14 mb-4 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">Unternehmer</h3>
                      <p className="text-xs text-gray-400 mb-3">Professionelle Taxiunternehmen mit Lizenz</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-400 font-medium">
                          {businessDrivers > 0 ? `${businessDrivers} verfügbar` : 'Bald verfügbar'}
                        </span>
                      </div>
                      {businessDrivers > 0 && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </motion.button>

                    {/* Private Taxi */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTaxiType('private')}
                      className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-5 text-left hover:border-purple-400/60 transition-all"
                    >
                      <div className="w-14 h-14 mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">Privat</h3>
                      <p className="text-xs text-gray-400 mb-3">Private Fahrer in deiner Nähe</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 font-medium">
                          {privateDrivers > 0 ? `${privateDrivers} verfügbar` : 'Bald verfügbar'}
                        </span>
                      </div>
                      {privateDrivers > 0 && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </motion.button>
                  </div>

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

              {/* Map with Mapbox Dark Style */}
              <div className="relative h-52 bg-[#0A0A0F] rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={`https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/static/pin-s+00C2FF(${pickup.lng},${pickup.lat})/${pickup.lng},${pickup.lat},13,0/600x300@2x?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`}
                  alt="Map"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ color: "#00C2FF" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {pickup.address || 'Aktueller Standort'}
                </div>
                {dropoff.lat !== 0 && (
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-red-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Ziel
                  </div>
                )}
                <button
                  onClick={getCurrentLocation}
                  className="absolute bottom-4 right-4 p-3 bg-cyan-500 rounded-full shadow-lg hover:bg-cyan-600 transition-colors"
                >
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* Location Inputs */}
              <div className="space-y-3">
                {/* ABHOLUNG */}
                <div className="relative z-20">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
                  </div>
                  <div className="absolute left-4 top-[58px] -translate-y-1/2 text-[8px] text-gray-500 uppercase tracking-wider z-10">ABHOLUNG</div>
                  <input
                    type="text"
                    placeholder="Aktueller Standort"
                    value={pickup.address}
                    onChange={(e) => handlePickupChange(e.target.value)}
                    onFocus={() => { if (pickupSuggestions.length > 0) setShowPickupSugg(true); }}
                    onBlur={() => { setTimeout(() => setShowPickupSugg(false), 200); geocodeOnBlur('pickup'); }}
                    className="w-full pl-10 pr-4 pt-6 pb-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    data-testid="taxi-pickup-input"
                  />
                  {showPickupSugg && pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl" style={{ zIndex: 50 }}>
                      {pickupSuggestions.map((s, i) => (
                        <button key={i} onMouseDown={() => selectPickupSugg(s)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-cyan-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                          data-testid={`pickup-sugg-${i}`}>
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{s.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{s.address}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ZIEL */}
                <div className="relative z-10">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                  </div>
                  <div className="absolute left-4 top-[58px] -translate-y-1/2 text-[8px] text-gray-500 uppercase tracking-wider z-10">ZIEL</div>
                  <input
                    type="text"
                    placeholder="Wohin möchtest du?"
                    value={dropoff.address}
                    onChange={(e) => handleDropoffChange(e.target.value)}
                    onFocus={() => { if (dropoffSuggestions.length > 0) setShowDropoffSugg(true); }}
                    onBlur={() => { setTimeout(() => setShowDropoffSugg(false), 200); geocodeOnBlur('dropoff'); }}
                    className="w-full pl-10 pr-4 pt-6 pb-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all cursor-text"
                    data-testid="taxi-dropoff-input"
                  />
                  {showDropoffSugg && dropoffSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl" style={{ zIndex: 50 }}>
                      {dropoffSuggestions.map((s, i) => (
                        <button key={i} onMouseDown={() => selectDropoffSugg(s)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                          data-testid={`dropoff-sugg-${i}`}>
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{s.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{s.address}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
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
                  <div className="flex gap-2 flex-wrap">
                    {['Flughafen BER', 'Hauptbahnhof', 'Alexanderplatz', 'Brandenburger Tor'].map((dest) => (
                      <button
                        key={dest}
                        onClick={() => handleDropoffChange(dest)}
                        className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors border border-white/5"
                        data-testid={`taxi-quick-${dest}`}
                      >
                        {dest}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save Place Modal */}
                {showSaveModal && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-[#1a1a1f] border border-cyan-500/20 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Ort speichern</span>
                      <button onClick={() => setShowSaveModal(false)} className="text-gray-500 hover:text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{dropoff.address}</div>
                    <div className="flex gap-2">
                      {[
                        { id: 'home', label: '🏠 Zuhause' },
                        { id: 'work', label: '💼 Arbeit' },
                        { id: 'gym', label: '🏋️ Gym' },
                        { id: 'school', label: '🎓 Schule' },
                        { id: 'star', label: '⭐ Andere' },
                      ].map(ic => (
                        <button key={ic.id} onClick={() => { setSaveIcon(ic.id); if (!saveName || ['Zuhause','Arbeit','Gym','Schule','Andere'].includes(saveName)) setSaveName(ic.id === 'home' ? 'Zuhause' : ic.id === 'work' ? 'Arbeit' : ic.id === 'gym' ? 'Gym' : ic.id === 'school' ? 'Schule' : 'Andere'); }}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${saveIcon === ic.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-white/5'}`}
                          data-testid={`taxi-save-icon-${ic.id}`}
                        >{ic.label}</button>
                      ))}
                    </div>
                    <input
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      placeholder="Name (z.B. Zuhause)"
                      className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 outline-none"
                      data-testid="taxi-save-name"
                    />
                    <button
                      onClick={() => savePlace(dropoff.address, dropoff.lat, dropoff.lng)}
                      disabled={!saveName}
                      className="w-full py-2.5 bg-cyan-500 text-black rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-cyan-400 transition-all"
                      data-testid="taxi-save-confirm"
                    >Speichern</button>
                  </motion.div>
                )}
                
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
                  <h3 className="font-semibold text-gray-300">Wähle dein Fahrzeug</h3>
                  {estimates.map((est) => (
                    <motion.button
                      key={est.vehicle_type}
                      onClick={() => setSelectedVehicle(est.vehicle_type)}
                      className={`w-full p-4 rounded-xl border transition-all ${
                        selectedVehicle === est.vehicle_type
                          ? 'bg-cyan-500/10 border-cyan-500/50'
                          : 'bg-[#111] border-white/10 hover:border-white/20'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{VEHICLE_ICONS[est.vehicle_type] || '🚗'}</span>
                          <div className="text-left">
                            <p className="font-semibold">{est.name}</p>
                            <p className="text-sm text-gray-400">{est.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {est.capacity} Personen • {est.eta_minutes} Min
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-cyan-400">€{est.fare.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            €{est.fare_range?.min.toFixed(2)} - €{est.fare_range?.max.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                  
                  {/* Book Button */}
                  <button
                    onClick={bookRide}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black text-lg disabled:opacity-50"
                  >
                    {loading ? 'Wird gebucht...' : 'Fahrt buchen'}
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
                      <button
                        onClick={() => { setActiveRide(null); setView('book'); }}
                        className="mt-4 px-6 py-3 bg-cyan-500 rounded-xl text-black font-semibold"
                      >
                        Neue Fahrt buchen
                      </button>
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
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h3 className="font-semibold text-gray-300">Deine Fahrten</h3>
              
              {rideHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-gray-400">Noch keine Fahrten</p>
                </div>
              ) : (
                rideHistory.map((ride) => (
                  <div
                    key={ride.ride_id}
                    className="p-4 bg-[#111] rounded-xl border border-white/10"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">{ride.dropoff?.address || 'Ziel'}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ride.created_at).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[ride.status]}`}>
                        {STATUS_LABELS[ride.status]}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{VEHICLE_ICONS[ride.vehicle_type]}</span>
                        <span>{ride.vehicle_name}</span>
                        <span>•</span>
                        <span>{ride.distance_km} km</span>
                      </div>
                      <span className="font-bold text-cyan-400">
                        €{(ride.final_fare || ride.fare_estimate || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>
    </div>
  );
}
