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
  
  // Refs
  const mapRef = useRef(null);
  const pollingRef = useRef(null);

  // Fetch user data
  useEffect(() => {
    fetchUserData();
    checkActiveRide();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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
    if (!pickup.lat || !dropoff.lat) {
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
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
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
              {/* Map Placeholder */}
              <div className="relative h-48 bg-[#111] rounded-2xl overflow-hidden border border-white/10">
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🗺️</div>
                    <p className="text-sm">Kartenansicht</p>
                  </div>
                </div>
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
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500" />
                  <input
                    type="text"
                    placeholder="Startpunkt"
                    value={pickup.address}
                    onChange={(e) => setPickup({ ...pickup, address: e.target.value })}
                    className="w-full pl-10 pr-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500" />
                  <input
                    type="text"
                    placeholder="Wohin?"
                    value={dropoff.address}
                    onChange={(e) => {
                      // Simulate geocoding for demo
                      setDropoff({
                        lat: 52.52 + Math.random() * 0.1,
                        lng: 13.405 + Math.random() * 0.1,
                        address: e.target.value,
                      });
                    }}
                    className="w-full pl-10 pr-4 py-4 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                
                <button
                  onClick={getEstimates}
                  disabled={loading || !dropoff.address}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Lädt...' : 'Preise anzeigen'}
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
      </div>
    </div>
  );
}
