/**
 * BidBlitz V2 - Real Taxi Page
 * Production-ready taxi booking with real map and driver system
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, MapPin, Navigation, Car, Clock, Euro, Star, 
  Phone, MessageSquare, X, Check, Loader2, History, AlertCircle
} from 'lucide-react';
import { useI18n, useUser } from '../store';
import { TaxiMap, ICONS } from '../components/RealMap';

const API = process.env.REACT_APP_BACKEND_URL;

// Status configuration
const STATUS_CONFIG = {
  requested: { label: 'Suche Fahrer...', color: '#FFB800', pulse: true },
  accepted: { label: 'Fahrer gefunden', color: '#00C2FF', pulse: false },
  arriving: { label: 'Fahrer kommt', color: '#00C2FF', pulse: true },
  started: { label: 'Fahrt läuft', color: '#00D26A', pulse: false },
  completed: { label: 'Abgeschlossen', color: '#00D26A', pulse: false },
  cancelled: { label: 'Storniert', color: '#FF4757', pulse: false },
};

const VEHICLE_TYPES = [
  { id: 'standard', label: 'Standard', icon: '🚗', multiplier: 1.0 },
  { id: 'comfort', label: 'Comfort', icon: '🚙', multiplier: 1.3 },
  { id: 'xl', label: 'XL', icon: '🚐', multiplier: 1.5 },
];

export default function TaxiPage({ onNavigate }) {
  const { t } = useI18n();
  const user = useUser();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // State
  const [view, setView] = useState('book'); // book, tracking, history
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('standard');
  const [fareEstimate, setFareEstimate] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  
  const pollingRef = useRef(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPickup(loc);
          reverseGeocode(loc, setPickupAddress);
        },
        () => {
          // Default to Berlin if geolocation fails
          setPickup({ lat: 52.52, lng: 13.405 });
          setPickupAddress('Berlin Mitte');
        }
      );
    }
    
    // Check for active ride
    checkActiveRide();
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Reverse geocode coordinates to address
  const reverseGeocode = async (coords, setAddress) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`
      );
      const data = await res.json();
      const addr = data.address;
      const short = addr.road || addr.pedestrian || addr.suburb || 'Unbekannt';
      const full = `${short}${addr.house_number ? ' ' + addr.house_number : ''}, ${addr.city || addr.town || addr.village || ''}`;
      setAddress(full);
    } catch (err) {
      console.error('Geocode error:', err);
    }
  };

  // Check for active ride
  const checkActiveRide = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/active`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.ride) {
          setActiveRide(data.ride);
          setView('tracking');
          startPolling(data.ride.ride_id);
        }
      }
    } catch (err) {
      console.error('Check active ride error:', err);
    }
  };

  // Start polling for ride updates
  const startPolling = (rideId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/taxi/ride/${rideId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setActiveRide(data.ride);
          
          if (data.ride.status === 'completed' || data.ride.status === 'cancelled') {
            clearInterval(pollingRef.current);
            setTimeout(() => {
              setActiveRide(null);
              setView('book');
            }, 3000);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  // Calculate fare estimate
  const calculateFare = useCallback(async () => {
    if (!pickup || !dropoff) return;
    
    try {
      const res = await fetch(`${API}/api/taxi/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pickup: { ...pickup, address: pickupAddress },
          dropoff: { ...dropoff, address: dropoffAddress },
          vehicle_type: vehicleType,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setFareEstimate(data);
        setNearbyDrivers(data.nearby_drivers || 0);
      }
    } catch (err) {
      console.error('Fare estimate error:', err);
    }
  }, [pickup, dropoff, pickupAddress, dropoffAddress, vehicleType]);

  useEffect(() => {
    if (pickup && dropoff) {
      calculateFare();
    }
  }, [pickup, dropoff, vehicleType, calculateFare]);

  // Navigate to wallet for top-up
  const goToWallet = () => {
    window.location.href = '/wallet';
  };

  // Book ride
  const bookRide = async () => {
    if (!pickup || !dropoff) {
      setError('Bitte Abholung und Ziel eingeben');
      return;
    }
    
    const requiredAmount = fareEstimate?.fare || 0;
    const currentBalance = user.balance || 0;
    
    if (currentBalance < requiredAmount) {
      setError(`Nicht genug Guthaben. Du brauchst €${requiredAmount.toFixed(2)}, hast aber nur €${currentBalance.toFixed(2)}. Bitte lade dein Wallet auf.`);
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
          pickup: { ...pickup, address: pickupAddress },
          dropoff: { ...dropoff, address: dropoffAddress },
          vehicle_type: vehicleType,
          payment_method: 'wallet',
        }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.ride) {
        setActiveRide(data.ride);
        setView('tracking');
        startPolling(data.ride.ride_id);
      } else {
        setError(data.detail || 'Buchung fehlgeschlagen');
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
        clearInterval(pollingRef.current);
        setActiveRide(null);
        setView('book');
      } else {
        const data = await res.json();
        setError(data.detail || 'Stornierung fehlgeschlagen');
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
      console.error('History fetch error:', err);
    }
  };

  useEffect(() => {
    if (view === 'history') fetchHistory();
  }, [view]);

  // Handle map click for location selection
  const handleSetDropoff = () => {
    // For V1, use a simple prompt. In production, use a proper location picker
    const addr = prompt('Zieladresse eingeben:');
    if (addr) {
      // Geocode the address
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data[0]) {
            setDropoff({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
            setDropoffAddress(data[0].display_name.split(',').slice(0, 2).join(','));
          } else {
            setError('Adresse nicht gefunden');
          }
        })
        .catch(() => setError('Geocoding fehlgeschlagen'));
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400 hover:text-white">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold">BidBlitz Taxi</h1>
            <button 
              onClick={() => setView(view === 'history' ? 'book' : 'history')}
              className="p-2 text-gray-400 hover:text-white"
            >
              <History size={20} />
            </button>
          </div>
          
          {/* View Tabs */}
          {!activeRide && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setView('book')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  view === 'book' ? 'bg-[#00C2FF] text-black' : 'bg-white/5 text-gray-400'
                }`}
              >
                Buchen
              </button>
              <button
                onClick={() => setView('history')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  view === 'history' ? 'bg-[#00C2FF] text-black' : 'bg-white/5 text-gray-400'
                }`}
              >
                Verlauf
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2"
          >
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Booking View */}
        {view === 'book' && !activeRide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Map */}
            <div className="rounded-2xl overflow-hidden mb-4">
              <TaxiMap
                pickup={pickup}
                dropoff={dropoff}
                height="200px"
              />
            </div>

            {/* Location Inputs */}
            <div className="space-y-3 mb-4">
              {/* Pickup */}
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="w-8 h-8 rounded-full bg-[#00C2FF]/20 flex items-center justify-center">
                  <MapPin size={16} className="text-[#00C2FF]" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase">Abholung</p>
                  <p className="text-sm font-medium truncate">{pickupAddress || 'Wird ermittelt...'}</p>
                </div>
              </div>

              {/* Dropoff */}
              <button
                onClick={handleSetDropoff}
                className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-[#FF4757]/20 flex items-center justify-center">
                  <Navigation size={16} className="text-[#FF4757]" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase">Ziel</p>
                  <p className="text-sm font-medium truncate">
                    {dropoffAddress || 'Wohin möchtest du?'}
                  </p>
                </div>
              </button>
            </div>

            {/* Vehicle Selection */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 uppercase mb-2">Fahrzeugtyp</p>
              <div className="flex gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVehicleType(v.id)}
                    className={`flex-1 p-3 rounded-xl border transition ${
                      vehicleType === v.id
                        ? 'bg-[#00C2FF]/10 border-[#00C2FF]/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <span className="text-2xl">{v.icon}</span>
                    <p className="text-xs mt-1">{v.label}</p>
                    <p className="text-[10px] text-gray-500">x{v.multiplier}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fare Estimate */}
            {fareEstimate && dropoff && (
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Geschätzte Kosten</span>
                  <span className="text-2xl font-bold text-[#00C2FF]">
                    €{fareEstimate.fare?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{fareEstimate.distance_km?.toFixed(1)} km</span>
                  <span>~{fareEstimate.duration_minutes} min</span>
                </div>
                {nearbyDrivers > 0 ? (
                  <p className="text-xs text-green-400 mt-2">
                    {nearbyDrivers} Fahrer in der Nähe
                  </p>
                ) : (
                  <p className="text-xs text-yellow-400 mt-2">
                    Keine Fahrer verfügbar - Buchung wartet auf Fahrer
                  </p>
                )}
              </div>
            )}

            {/* Wallet Balance Card */}
            <div className={`p-4 rounded-xl border mb-4 ${
              (user.balance || 0) >= (fareEstimate?.fare || 0)
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400">Dein Wallet-Guthaben</p>
                  <p className={`text-xl font-bold ${
                    (user.balance || 0) >= (fareEstimate?.fare || 0) ? 'text-green-400' : 'text-red-400'
                  }`}>
                    €{(user.balance || 0).toFixed(2)}
                  </p>
                </div>
                {(user.balance || 0) < (fareEstimate?.fare || 0) && (
                  <button
                    onClick={goToWallet}
                    className="px-4 py-2 bg-[#00C2FF] text-black text-sm font-semibold rounded-lg"
                  >
                    Aufladen
                  </button>
                )}
              </div>
              {fareEstimate && (user.balance || 0) < (fareEstimate?.fare || 0) && (
                <p className="text-xs text-red-400 mt-2">
                  Du brauchst noch €{((fareEstimate?.fare || 0) - (user.balance || 0)).toFixed(2)} mehr
                </p>
              )}
            </div>

            {/* Book Button */}
            <motion.button
              onClick={bookRide}
              disabled={loading || !pickup || !dropoff || (user.balance || 0) < (fareEstimate?.fare || 0)}
              className="w-full py-4 bg-[#00C2FF] text-black font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Car size={20} />
                  {(user.balance || 0) < (fareEstimate?.fare || 0) ? 'Guthaben aufladen' : 'Taxi buchen'}
                </>
              )}
            </motion.button>
          </motion.div>
        )}

        {/* Tracking View */}
        {view === 'tracking' && activeRide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Status Badge */}
            <div className="mb-4">
              <div 
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full`}
                style={{ 
                  background: `${STATUS_CONFIG[activeRide.status]?.color}15`,
                  border: `1px solid ${STATUS_CONFIG[activeRide.status]?.color}30`
                }}
              >
                {STATUS_CONFIG[activeRide.status]?.pulse && (
                  <span className="w-2 h-2 rounded-full animate-pulse" 
                    style={{ background: STATUS_CONFIG[activeRide.status]?.color }} 
                  />
                )}
                <span style={{ color: STATUS_CONFIG[activeRide.status]?.color }}>
                  {STATUS_CONFIG[activeRide.status]?.label}
                </span>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-2xl overflow-hidden mb-4">
              <TaxiMap
                pickup={activeRide.pickup}
                dropoff={activeRide.dropoff}
                driverLocation={activeRide.driver?.location}
                height="250px"
              />
            </div>

            {/* Ride Details */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <MapPin size={16} className="text-[#00C2FF] mt-1" />
                <div>
                  <p className="text-[10px] text-gray-500">Abholung</p>
                  <p className="text-sm">{activeRide.pickup?.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Navigation size={16} className="text-[#FF4757] mt-1" />
                <div>
                  <p className="text-[10px] text-gray-500">Ziel</p>
                  <p className="text-sm">{activeRide.dropoff?.address}</p>
                </div>
              </div>
            </div>

            {/* Driver Info */}
            {activeRide.driver && (
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#00C2FF]/20 flex items-center justify-center text-xl">
                    🚗
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{activeRide.driver.name}</p>
                    <p className="text-sm text-gray-400">
                      {activeRide.driver.vehicle?.model} · {activeRide.driver.vehicle?.plate}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={12} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs">{activeRide.driver.rating?.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-10 h-10 rounded-full bg-[#00C2FF]/20 flex items-center justify-center">
                      <Phone size={16} className="text-[#00C2FF]" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-[#00C2FF]/20 flex items-center justify-center">
                      <MessageSquare size={16} className="text-[#00C2FF]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fare */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Fahrpreis</span>
                <span className="text-xl font-bold">
                  €{(activeRide.final_fare || activeRide.fare_estimate)?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            {['requested', 'accepted', 'arriving'].includes(activeRide.status) && (
              <motion.button
                onClick={cancelRide}
                disabled={loading}
                className="w-full py-3 bg-red-500/10 text-red-400 font-medium rounded-xl border border-red-500/20"
                whileTap={{ scale: 0.98 }}
              >
                {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Fahrt stornieren'}
              </motion.button>
            )}

            {/* Completed Message */}
            {activeRide.status === 'completed' && (
              <div className="text-center py-4">
                <Check size={48} className="text-green-400 mx-auto mb-2" />
                <p className="text-lg font-semibold">Fahrt abgeschlossen!</p>
                <p className="text-sm text-gray-400">Danke für deine Fahrt</p>
              </div>
            )}
          </motion.div>
        )}

        {/* History View */}
        {view === 'history' && !activeRide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-lg font-semibold mb-4">Fahrtenverlauf</h2>
            
            {rideHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Car size={48} className="mx-auto mb-3 opacity-50" />
                <p>Noch keine Fahrten</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rideHistory.map((ride) => (
                  <div
                    key={ride.ride_id}
                    className="p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium">{ride.dropoff?.address}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(ride.created_at).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">€{(ride.final_fare || ride.fare_estimate)?.toFixed(2)}</p>
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ 
                            background: `${STATUS_CONFIG[ride.status]?.color}20`,
                            color: STATUS_CONFIG[ride.status]?.color
                          }}
                        >
                          {STATUS_CONFIG[ride.status]?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
