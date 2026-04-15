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
  const [view, setView] = useState('map'); // map, riding, history, plans
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
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [moduleMessage, setModuleMessage] = useState('');
  const [plans, setPlans] = useState([]);
  const [mySub, setMySub] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [shareDuration, setShareDuration] = useState(60);
  const [shareLoading, setShareLoading] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemResult, setRedeemResult] = useState(null);
  const [activeShares, setActiveShares] = useState([]);
  const sharePollingRef = useRef(null);
  
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
        // Check if module is enabled
        if (data.module_enabled === false) {
          setModuleEnabled(false);
          setModuleMessage(data.message || 'Scooter-Modul wird derzeit vorbereitet');
          setScooters([]);
        } else {
          setModuleEnabled(true);
          setScooters(data.scooters || []);
        }
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

  // Share scooter
  const createShareCode = async () => {
    if (!activeRental) return;
    setShareLoading(true);
    try {
      const res = await fetch(`${API}/api/scooter/share/create`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: activeRental.ride_id, duration_minutes: shareDuration }),
      });
      const data = await res.json();
      if (res.ok) {
        setShareCode(data.code);
      } else {
        setError(data.detail || 'Sharing fehlgeschlagen');
      }
    } catch { setError('Netzwerkfehler'); }
    setShareLoading(false);
  };

  const redeemShareCode = async () => {
    if (!redeemCode.trim()) return;
    setShareLoading(true);
    setRedeemResult(null);
    try {
      const res = await fetch(`${API}/api/scooter/share/redeem`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRedeemResult({ ok: true, message: data.message, host: data.host_name });
      } else {
        setRedeemResult({ ok: false, message: data.detail || 'Code ungültig' });
      }
    } catch { setRedeemResult({ ok: false, message: 'Netzwerkfehler' }); }
    setShareLoading(false);
  };

  // Live-Kosten Polling für aktive Shares
  const fetchActiveShares = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/share/active`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setActiveShares(data.shared_by_me || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (showShare) {
      fetchActiveShares();
      sharePollingRef.current = setInterval(fetchActiveShares, 5000);
    }
    return () => { if (sharePollingRef.current) clearInterval(sharePollingRef.current); };
  }, [showShare]);


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
    if (view === 'plans') { fetchPlans(); fetchMySub(); }
  }, [view]);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/subscription-plans`, { credentials: 'include' });
      if (res.ok) { const data = await res.json(); setPlans(data.plans || []); }
    } catch {}
  };

  const fetchMySub = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/my-subscription`, { credentials: 'include' });
      if (res.ok) { const data = await res.json(); setMySub(data.subscription); }
    } catch {}
  };

  const subscribePlan = async (planId) => {
    setSubLoading(true);
    try {
      const res = await fetch(`${API}/api/scooter/subscribe`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMySub(data.subscription);
        fetchUserData();
        alert(`${data.subscription.plan_name} aktiviert!`);
      } else {
        const err = await res.json();
        alert(err.detail || 'Fehler beim Abschließen');
      }
    } catch {} finally { setSubLoading(false); }
  };

  const cancelSub = async () => {
    if (!window.confirm('Abo wirklich kündigen?')) return;
    try {
      const res = await fetch(`${API}/api/scooter/cancel-subscription`, {
        method: 'POST', credentials: 'include',
      });
      if (res.ok) { setMySub(null); alert('Abo gekündigt'); }
    } catch {}
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
            <h1 className="text-xl font-bold">BidBlitz Scooter</h1>
            <div className="text-sm text-green-400 font-medium">€{userBalance.toFixed(2)}</div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {['map', 'riding', 'plans', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                disabled={tab === 'riding' && !activeRental}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                  view === tab
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30'
                }`}
                data-testid={`scooter-tab-${tab}`}
              >
                {tab === 'map' ? 'Karte' : tab === 'riding' ? 'Fahrt' : tab === 'plans' ? 'Abos' : 'Verlauf'}
              </button>
            ))}
          </div>
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
            <div className="w-24 h-24 mb-6 rounded-full bg-orange-500/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Scooter Demnächst</h2>
            <p className="text-gray-400 mb-6 max-w-sm">
              {moduleMessage || 'Das Scooter-Modul wird derzeit für echte IoT-Integration vorbereitet. Bald verfügbar!'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl font-semibold text-black"
            >
              Zur Startseite
            </button>
          </motion.div>
        )}

        {moduleEnabled && (
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
              {/* Map - Mapbox Dark Style with Scooter Pins */}
              <div className="relative h-64 bg-[#0A0A0F] rounded-2xl overflow-hidden border border-white/10">
                {(() => {
                  const pins = scooters.slice(0, 8).map(s =>
                    `pin-s+10B981(${s.location?.lng || userLocation.lng + (Math.random() - 0.5) * 0.01},${s.location?.lat || userLocation.lat + (Math.random() - 0.5) * 0.01})`
                  ).join(',');
                  const userPin = `pin-l+00C2FF(${userLocation.lng},${userLocation.lat})`;
                  const allPins = pins ? `${userPin},${pins}` : userPin;
                  return (
                    <img
                      src={`https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/static/${allPins}/${userLocation.lng},${userLocation.lat},14,0/800x400@2x?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`}
                      alt="Scooter Map"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  );
                })()}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium text-green-400">{scooters.length} Scooter in der Nähe</span>
                </div>
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-[#00C2FF]" />
                    <span className="text-[10px] text-gray-300">Du</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[10px] text-gray-300">Scooter</span>
                  </div>
                </div>
                <button
                  onClick={getCurrentLocation}
                  className="absolute bottom-3 right-3 p-3 bg-green-500 rounded-full shadow-lg hover:bg-green-600 transition-colors"
                  data-testid="scooter-locate"
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
                {/* Share code redeem shortcut */}
                <button
                  onClick={() => setShowShare(true)}
                  className="mt-3 w-full py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1.5"
                  data-testid="scooter-share-open"
                >
                  🔗 Freigabe-Code einlösen
                </button>
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
              <div className="grid grid-cols-3 gap-3">
                {activeRental.status === 'active' ? (
                  <button
                    onClick={pauseRide}
                    disabled={loading}
                    className="py-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 font-semibold text-sm"
                  >
                    ⏸️ Pause
                  </button>
                ) : (
                  <button
                    onClick={resumeRide}
                    disabled={loading}
                    className="py-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-semibold text-sm"
                  >
                    ▶️ Weiter
                  </button>
                )}
                
                <button
                  onClick={() => setShowShare(true)}
                  className="py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 font-semibold text-sm"
                  data-testid="scooter-share-btn"
                >
                  🔗 Teilen
                </button>
                
                <button
                  onClick={endRide}
                  disabled={loading}
                  className="py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold text-sm"
                >
                  {loading ? '...' : '⏹️ Ende'}
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

          {/* SHARE MODAL */}
          {showShare && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50"
              onClick={() => setShowShare(false)}
            >
              <motion.div
                initial={{ y: 300 }}
                animate={{ y: 0 }}
                exit={{ y: 300 }}
                className="w-full max-w-md bg-[#111] rounded-t-3xl p-6 space-y-5"
                onClick={e => e.stopPropagation()}
                data-testid="scooter-share-modal"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Scooter teilen</h3>
                  <button onClick={() => setShowShare(false)} className="text-gray-500 hover:text-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                {!shareCode ? (
                  <>
                    <p className="text-sm text-gray-400">Erstelle einen Code, mit dem ein Freund deinen Scooter nutzen kann. Abrechnung läuft über dein Wallet.</p>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Zeitlimit wählen:</p>
                      <div className="flex gap-2">
                        {[
                          { min: 30, label: "30 Min" },
                          { min: 60, label: "1 Std" },
                          { min: 120, label: "2 Std" },
                          { min: 1440, label: "24 Std" },
                        ].map(opt => (
                          <button
                            key={opt.min}
                            onClick={() => setShareDuration(opt.min)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                              shareDuration === opt.min
                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                : "bg-white/5 text-white/40 border border-white/5"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={createShareCode}
                      disabled={shareLoading}
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black disabled:opacity-50"
                      data-testid="scooter-create-share"
                    >
                      {shareLoading ? 'Generiere...' : '🔗 Code erstellen'}
                    </button>
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-400">Teile diesen Code mit deinem Freund:</p>
                    <div className="py-5 px-6 bg-cyan-500/10 border-2 border-cyan-500/30 rounded-2xl">
                      <p className="text-3xl font-mono font-black text-cyan-400 tracking-widest">{shareCode}</p>
                    </div>
                    <p className="text-xs text-gray-500">Gültig für {shareDuration < 60 ? `${shareDuration} Min` : shareDuration === 1440 ? '24 Stunden' : `${shareDuration / 60} Stunde(n)`}</p>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(shareCode); }}
                      className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-white font-medium text-sm"
                    >
                      Code kopieren
                    </button>
                    <button
                      onClick={() => { setShareCode(''); setShowShare(false); }}
                      className="text-xs text-gray-500 underline"
                    >Schließen</button>
                  </div>
                )}

                {/* Redeem Code Section */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-2">Freigabe-Code einlösen:</p>
                  <div className="flex gap-2">
                    <input
                      value={redeemCode}
                      onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                      placeholder="BLZ-XXXX"
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/40 font-mono tracking-wider"
                      data-testid="scooter-redeem-input"
                    />
                    <button
                      onClick={redeemShareCode}
                      disabled={shareLoading || !redeemCode.trim()}
                      className="px-5 py-2.5 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-bold text-sm disabled:opacity-40"
                      data-testid="scooter-redeem-btn"
                    >
                      Einlösen
                    </button>
                  </div>
                  {redeemResult && (
                    <p className={`text-xs mt-2 ${redeemResult.ok ? "text-green-400" : "text-red-400"}`}>
                      {redeemResult.message}
                    </p>
                  )}
                </div>

                {/* Live-Kosten aktive Shares */}
                {activeShares.length > 0 && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-500 mb-2">Deine aktiven Freigaben:</p>
                    <div className="space-y-2">
                      {activeShares.map((s, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-cyan-400">{s.code}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${s.is_redeemed ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                              {s.is_redeemed ? "GENUTZT" : "WARTEND"}
                            </span>
                          </div>
                          {s.guest_name && <p className="text-[10px] text-white/40">Gast: {s.guest_name}</p>}
                          {s.ride_active && (
                            <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                              <div>
                                <p className="text-[10px] text-gray-500">Live-Kosten</p>
                                <p className="text-lg font-bold text-cyan-400">€{s.live_cost?.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-500">Fahrzeit</p>
                                <p className="text-sm font-bold text-white">{Math.floor(s.live_minutes || 0)} Min</p>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
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

          {/* PLANS / ABOS VIEW */}
          {view === 'plans' && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Active Subscription */}
              {mySub && (
                <div className="p-4 rounded-2xl border-2" style={{ borderColor: '#10B981', background: 'rgba(16,185,129,0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-sm font-bold text-green-400">Aktives Abo</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">{mySub.plan_name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center"><div className="text-sm font-bold text-white">{mySub.free_minutes_per_day}</div><div className="text-[10px] text-gray-500">Min. frei/Tag</div></div>
                    <div className="text-center"><div className="text-sm font-bold text-white">{mySub.per_minute_rate}€</div><div className="text-[10px] text-gray-500">danach/Min.</div></div>
                    <div className="text-center"><div className="text-sm font-bold text-white">0€</div><div className="text-[10px] text-gray-500">Entsperren</div></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span>Gültig bis: {new Date(mySub.expires_at).toLocaleDateString('de-DE')}</span>
                    <span className="text-green-400">{mySub.price}€/{mySub.duration === 'weekly' ? 'Woche' : mySub.duration === 'monthly' ? 'Monat' : 'Jahr'}</span>
                  </div>
                  <button
                    onClick={cancelSub}
                    className="w-full py-2 rounded-xl text-xs font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
                    data-testid="scooter-cancel-sub"
                  >
                    Abo kündigen
                  </button>
                </div>
              )}

              <h3 className="font-semibold text-gray-300">{mySub ? 'Andere Pläne' : 'Scooter-Abos'}</h3>
              <p className="text-xs text-gray-500 -mt-2">Spare mit einem Abo — keine Entsperrgebühr & tägliche Freiminuten</p>

              {plans.map((plan) => (
                <div
                  key={plan.plan_id}
                  className={`relative p-4 rounded-2xl border transition-all ${
                    plan.popular ? 'border-green-500/50' : 'border-white/10'
                  }`}
                  style={{ background: plan.popular ? 'rgba(16,185,129,0.05)' : '#111' }}
                  data-testid={`scooter-plan-${plan.plan_id}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-4 px-3 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-black">
                      BELIEBTESTES ABO
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-3 mt-1">
                    <div>
                      <h4 className="text-base font-bold text-white">{plan.name}</h4>
                      <div className="text-xs text-gray-500">{plan.duration_days} Tage</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold" style={{ color: plan.color }}>{plan.price}€</div>
                      <div className="text-[10px] text-gray-500">
                        {plan.duration === 'weekly' ? '/Woche' : plan.duration === 'monthly' ? '/Monat' : '/Jahr'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs text-gray-400">{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => subscribePlan(plan.plan_id)}
                    disabled={subLoading || (mySub && mySub.status === 'active')}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{
                      background: mySub ? 'rgba(255,255,255,0.05)' : plan.color,
                      color: mySub ? '#888' : '#000',
                    }}
                    data-testid={`scooter-subscribe-${plan.plan_id}`}
                  >
                    {subLoading ? 'Wird abgeschlossen...' : mySub ? 'Bereits abonniert' : `${plan.name} abschließen`}
                  </button>
                </div>
              ))}

              {/* Price Comparison */}
              <div className="p-4 rounded-2xl bg-[#111] border border-white/10">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Preisvergleich</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div></div>
                  <div className="text-blue-400 font-medium">Woche</div>
                  <div className="text-green-400 font-medium">Monat</div>
                  <div className="text-yellow-400 font-medium">Jahr</div>
                  <div className="text-left text-gray-500">Entsperren</div>
                  <div className="text-white">0€</div><div className="text-white">0€</div><div className="text-white">0€</div>
                  <div className="text-left text-gray-500">Frei/Tag</div>
                  <div className="text-white">30 Min</div><div className="text-white">45 Min</div><div className="text-white">60 Min</div>
                  <div className="text-left text-gray-500">Danach</div>
                  <div className="text-white">0.15€</div><div className="text-white">0.12€</div><div className="text-white">0.10€</div>
                  <div className="text-left text-gray-500">Preis</div>
                  <div className="text-white">9.99€</div><div className="text-white">29.99€</div><div className="text-white">249.99€</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>
    </div>
  );
}
