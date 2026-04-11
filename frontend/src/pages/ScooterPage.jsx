import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Battery level colors
const getBatteryColor = (percent) => {
  if (percent >= 60) return 'text-green-400';
  if (percent >= 30) return 'text-yellow-400';
  return 'text-red-400';
};

const getBatteryBg = (percent) => {
  if (percent >= 60) return 'bg-green-500';
  if (percent >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
};

export default function ScooterPage({ onNavigate }) {
  const { t } = useI18n();
  
  // Navigation helper
  const navigate = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };
  
  // State
  const [view, setView] = useState('map'); // map, riding, history
  const [scooters, setScooters] = useState([]);
  const [selectedScooter, setSelectedScooter] = useState(null);
  const [activeRental, setActiveRental] = useState(null);
  const [rentalHistory, setRentalHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userBalance, setUserBalance] = useState(0);
  const [pricing, setPricing] = useState({ unlock_fee: 1.0, per_minute: 0.19 });
  const [rideTimer, setRideTimer] = useState(0);
  const [rideCost, setRideCost] = useState(0);
  const [userLocation, setUserLocation] = useState({ lat: 52.52, lng: 13.405 });
  
  // Refs
  const timerRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchUserData();
    fetchPricing();
    checkActiveRental();
    getCurrentLocation();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          fetchNearbyScooters(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          fetchNearbyScooters(52.52, 13.405);
        }
      );
    } else {
      fetchNearbyScooters(52.52, 13.405);
    }
  };

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance || 0);
      }
    } catch (err) {}
  };

  const fetchPricing = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/pricing`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPricing(data);
      }
    } catch (err) {}
  };

  const fetchNearbyScooters = async (lat, lng) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scooter/nearby?lat=${lat}&lng=${lng}&radius=5`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setScooters(data.scooters || []);
      }
    } catch (err) {
      setError('Fehler beim Laden der Scooter');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveRental = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/active`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.has_active_rental && data.rental) {
          setActiveRental(data.rental);
          setView('riding');
          startRideTimer(data.rental);
        }
      }
    } catch (err) {}
  };

  const startRideTimer = (rental) => {
    if (!rental.started_at) return;
    
    const started = new Date(rental.started_at);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      const now = new Date();
      const seconds = Math.floor((now - started) / 1000);
      setRideTimer(seconds);
      
      const minutes = seconds / 60;
      const cost = pricing.unlock_fee + (minutes * pricing.per_minute);
      setRideCost(Math.min(cost, pricing.daily_cap || 15));
    }, 1000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Unlock scooter
  const unlockScooter = async (scooter) => {
    if (userBalance < pricing.unlock_fee) {
      setError(`Nicht genug Guthaben. Mindestens €${pricing.unlock_fee.toFixed(2)} erforderlich, du hast €${userBalance.toFixed(2)}. Bitte lade dein Wallet auf.`);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/scooter/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scooter_id: scooter.scooter_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setActiveRental(data.rental);
        setSelectedScooter(null);
        setView('riding');
        setUserBalance(prev => prev - pricing.unlock_fee);
        startRideTimer(data.rental);
      } else {
        const err = await res.json();
        setError(err.detail || 'Entsperren fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Pause ride
  const pauseRide = async () => {
    if (!activeRental) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scooter/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scooter_id: activeRental.scooter_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setActiveRental(prev => ({ ...prev, status: 'paused' }));
      }
    } catch (err) {}
    finally { setLoading(false); }
  };

  // Resume ride
  const resumeRide = async () => {
    if (!activeRental) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scooter/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scooter_id: activeRental.scooter_id }),
      });
      
      if (res.ok) {
        setActiveRental(prev => ({ ...prev, status: 'active' }));
      }
    } catch (err) {}
    finally { setLoading(false); }
  };

  // End ride
  const endRide = async () => {
    if (!activeRental) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scooter/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scooter_id: activeRental.scooter_id,
          end_location: userLocation,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (timerRef.current) clearInterval(timerRef.current);
        setActiveRental(null);
        setView('map');
        setRideTimer(0);
        setRideCost(0);
        setUserBalance(data.new_balance);
        fetchNearbyScooters(userLocation.lat, userLocation.lng);
        
        // Show summary
        alert(`Fahrt beendet!\nGesamt: €${data.summary.total_cost.toFixed(2)}\nDauer: ${data.summary.total_minutes} Min`);
      } else {
        const err = await res.json();
        setError(err.detail || 'Beenden fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Fetch history
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRentalHistory(data.rentals || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (view === 'history') fetchHistory();
  }, [view]);

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
            <h1 className="text-xl font-bold">BidBlitz Scooter</h1>
            <div className="text-sm text-green-400 font-medium">€{userBalance.toFixed(2)}</div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {['map', 'riding', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                disabled={tab === 'riding' && !activeRental}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  view === tab
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30'
                }`}
              >
                {tab === 'map' ? 'Karte' : tab === 'riding' ? 'Fahrt' : 'Verlauf'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* MAP VIEW */}
          {view === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Map Placeholder */}
              <div className="relative h-64 bg-[#111] rounded-2xl overflow-hidden border border-white/10">
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-5xl mb-2">🛴</div>
                    <p className="text-sm">{scooters.length} Scooter in der Nähe</p>
                  </div>
                </div>
                <button
                  onClick={getCurrentLocation}
                  className="absolute bottom-4 right-4 p-3 bg-green-500 rounded-full shadow-lg hover:bg-green-600"
                >
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </button>
              </div>

              {/* Wallet Balance Card */}
              <div className={`p-4 rounded-xl border mb-4 ${
                userBalance >= pricing.unlock_fee
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Dein Wallet</p>
                    <p className={`text-xl font-bold ${userBalance >= pricing.unlock_fee ? 'text-green-400' : 'text-red-400'}`}>
                      €{userBalance.toFixed(2)}
                    </p>
                  </div>
                  {userBalance < pricing.unlock_fee && (
                    <button
                      onClick={() => navigate('/wallet')}
                      className="px-4 py-2 bg-green-500 text-black text-sm font-semibold rounded-lg"
                    >
                      Aufladen
                    </button>
                  )}
                </div>
                {userBalance < pricing.unlock_fee && (
                  <p className="text-xs text-red-400 mt-2">
                    Mindestens €{pricing.unlock_fee?.toFixed(2)} für Entsperren benötigt
                  </p>
                )}
              </div>

              {/* Pricing Info */}
              <div className="p-4 bg-[#111] rounded-xl border border-white/10">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm">Entsperren</p>
                    <p className="font-bold text-green-400">€{pricing.unlock_fee?.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Pro Minute</p>
                    <p className="font-bold">€{pricing.per_minute?.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Tagesmax</p>
                    <p className="font-bold">€{pricing.daily_cap?.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Scooter List */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-300">Verfügbare Scooter</h3>
                
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Lädt...</div>
                ) : scooters.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Keine Scooter in der Nähe</div>
                ) : (
                  scooters.map((scooter) => (
                    <motion.button
                      key={scooter.scooter_id}
                      onClick={() => setSelectedScooter(scooter)}
                      className={`w-full p-4 rounded-xl border transition-all text-left ${
                        selectedScooter?.scooter_id === scooter.scooter_id
                          ? 'bg-green-500/10 border-green-500/50'
                          : 'bg-[#111] border-white/10 hover:border-white/20'
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">🛴</div>
                          <div>
                            <p className="font-semibold">{scooter.scooter_id}</p>
                            <p className="text-sm text-gray-400">{scooter.model}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">{scooter.distance_km} km</span>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-gray-500">{scooter.walk_minutes} Min zu Fuß</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <div className={`w-8 h-4 rounded-full border-2 border-gray-600 overflow-hidden relative`}>
                              <div
                                className={`absolute left-0 top-0 bottom-0 ${getBatteryBg(scooter.battery_percent)}`}
                                style={{ width: `${scooter.battery_percent}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium ${getBatteryColor(scooter.battery_percent)}`}>
                              {scooter.battery_percent}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{scooter.range_km} km Reichweite</p>
                        </div>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Unlock Button */}
              {selectedScooter && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto"
                >
                  <div className="p-4 bg-[#111]/95 backdrop-blur-xl rounded-2xl border border-green-500/30 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold">{selectedScooter.scooter_id}</p>
                        <p className="text-sm text-gray-400">{selectedScooter.model} • {selectedScooter.battery_percent}%</p>
                      </div>
                      <button onClick={() => setSelectedScooter(null)} className="text-gray-500">✕</button>
                    </div>
                    
                    {userBalance < pricing.unlock_fee ? (
                      <div className="text-center py-4">
                        <p className="text-red-400 mb-2">Nicht genug Guthaben</p>
                        <button
                          onClick={() => navigate('/wallet')}
                          className="px-6 py-2 bg-green-500/20 text-green-400 rounded-xl"
                        >
                          Aufladen
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => unlockScooter(selectedScooter)}
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-black text-lg disabled:opacity-50"
                      >
                        {loading ? 'Entsperren...' : `Entsperren (€${pricing.unlock_fee?.toFixed(2)})`}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
                  {error}
                </div>
              )}
            </motion.div>
          )}

          {/* RIDING VIEW */}
          {view === 'riding' && activeRental && (
            <motion.div
              key="riding"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Timer Display */}
              <div className="p-8 bg-[#111] rounded-2xl border border-green-500/30 text-center">
                <div className="text-6xl font-mono font-bold text-green-400 mb-2">
                  {formatTime(rideTimer)}
                </div>
                <p className="text-gray-400">Fahrzeit</p>
                
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-gray-400 text-sm">Aktueller Preis</p>
                  <p className="text-4xl font-bold text-white mt-1">€{rideCost.toFixed(2)}</p>
                </div>
                
                {activeRental.status === 'paused' && (
                  <div className="mt-4 p-3 bg-yellow-500/20 rounded-xl">
                    <p className="text-yellow-400 font-medium">⏸️ Pausiert (€{pricing.pause_rate}/Min)</p>
                  </div>
                )}
              </div>

              {/* Scooter Info */}
              <div className="p-4 bg-[#111] rounded-xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🛴</div>
                  <div>
                    <p className="font-bold">{activeRental.scooter_id}</p>
                    <p className="text-sm text-gray-400">{activeRental.scooter_model}</p>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="p-4 bg-[#111] rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Entsperrgebühr</span>
                  <span>€{pricing.unlock_fee?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fahrzeit ({Math.floor(rideTimer / 60)} Min)</span>
                  <span>€{(rideCost - pricing.unlock_fee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-white/10">
                  <span>Gesamt</span>
                  <span className="text-green-400">€{rideCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-2 gap-4">
                {activeRental.status === 'active' ? (
                  <button
                    onClick={pauseRide}
                    disabled={loading}
                    className="py-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 font-semibold"
                  >
                    ⏸️ Pausieren
                  </button>
                ) : (
                  <button
                    onClick={resumeRide}
                    disabled={loading}
                    className="py-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-semibold"
                  >
                    ▶️ Fortsetzen
                  </button>
                )}
                
                <button
                  onClick={endRide}
                  disabled={loading}
                  className="py-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold"
                >
                  {loading ? 'Beenden...' : '⏹️ Beenden'}
                </button>
              </div>

              {/* Safety Tips */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-400 font-medium mb-2">🛡️ Sicherheitstipps</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Helm tragen empfohlen</li>
                  <li>• Auf Radwegen fahren</li>
                  <li>• Max. 20 km/h in Fußgängerzonen</li>
                </ul>
              </div>
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
              
              {rentalHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🛴</div>
                  <p className="text-gray-400">Noch keine Fahrten</p>
                </div>
              ) : (
                rentalHistory.map((rental) => (
                  <div
                    key={rental.rental_id}
                    className="p-4 bg-[#111] rounded-xl border border-white/10"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">{rental.scooter_id}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(rental.created_at).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400">
                        Abgeschlossen
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>⏱️ {rental.total_minutes || 0} Min</span>
                      </div>
                      <span className="font-bold text-green-400">
                        €{(rental.total_cost || 0).toFixed(2)}
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
