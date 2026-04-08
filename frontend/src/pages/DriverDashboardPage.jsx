/**
 * BidBlitz V2 - Driver Dashboard
 * Real driver dashboard for accepting rides
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Power, MapPin, Navigation, Phone, Euro, Star,
  CheckCircle, XCircle, Clock, Car, Loader2, AlertCircle
} from 'lucide-react';
import { DriverMap } from '../components/RealMap';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DriverDashboardPage() {
  const navigate = useNavigate();
  
  // State
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [earnings, setEarnings] = useState({ today: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  
  const pollingRef = useRef(null);
  const locationRef = useRef(null);

  // Load driver data
  useEffect(() => {
    loadDriver();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (locationRef.current) clearInterval(locationRef.current);
    };
  }, []);

  const loadDriver = async () => {
    try {
      const res = await fetch(`${API}/api/drivers/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDriver(data.driver);
        setIsOnline(data.driver.is_online);
        setCurrentRide(data.current_ride);
        setEarnings({
          today: data.driver.today_earnings || 0,
          total: data.driver.total_earnings || 0,
        });
      } else {
        setError('Fahrerprofil nicht gefunden');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Track location when online
  useEffect(() => {
    if (isOnline && driver) {
      // Update location every 10 seconds
      locationRef.current = setInterval(updateLocation, 10000);
      updateLocation(); // Initial update
      
      // Poll for ride requests
      pollingRef.current = setInterval(pollRideRequests, 5000);
      pollRideRequests();
    } else {
      if (locationRef.current) clearInterval(locationRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    
    return () => {
      if (locationRef.current) clearInterval(locationRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOnline, driver]);

  const updateLocation = () => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        
        try {
          await fetch(`${API}/api/drivers/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              driver_id: driver.driver_id,
              lat: loc.lat,
              lng: loc.lng,
            }),
          });
        } catch (err) {
          console.error('Location update error:', err);
        }
      },
      (err) => console.error('Geolocation error:', err)
    );
  };

  const pollRideRequests = async () => {
    if (!driver) return;
    
    try {
      const res = await fetch(`${API}/api/drivers/requests?driver_id=${driver.driver_id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRideRequests(data.requests || []);
        
        // Check for current ride
        if (data.current_ride) {
          setCurrentRide(data.current_ride);
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  };

  // Toggle online status
  const toggleOnline = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/drivers/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driver_id: driver.driver_id,
          is_online: !isOnline,
          location: location,
        }),
      });
      
      if (res.ok) {
        setIsOnline(!isOnline);
      } else {
        const data = await res.json();
        setError(data.detail || 'Status-Änderung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Accept ride
  const acceptRide = async (ride) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/drivers/accept-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driver_id: driver.driver_id,
          ride_id: ride.ride_id,
          eta_minutes: 5,
        }),
      });
      
      if (res.ok) {
        setCurrentRide(ride);
        setRideRequests([]);
      } else {
        const data = await res.json();
        setError(data.detail || 'Annahme fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Update ride status
  const updateRideStatus = async (status) => {
    if (!currentRide) return;
    
    setLoading(true);
    try {
      const endpoint = status === 'completed' 
        ? `${API}/api/drivers/complete-ride`
        : `${API}/api/taxi/driver/status`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driver_id: driver.driver_id,
          ride_id: currentRide.ride_id,
          status: status,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (status === 'completed') {
          setCurrentRide(null);
          setEarnings(prev => ({
            today: prev.today + (data.driver_earnings || 0),
            total: prev.total + (data.driver_earnings || 0),
          }));
        } else {
          setCurrentRide(prev => ({ ...prev, status }));
        }
      } else {
        const data = await res.json();
        setError(data.detail || 'Status-Update fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !driver) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 size={32} className="text-[#00C2FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold">Fahrer Dashboard</h1>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              isOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2"
          >
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-sm text-red-400 flex-1">{error}</span>
            <button onClick={() => setError('')}><XCircle size={16} className="text-red-400" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Driver Profile */}
        {driver && (
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[#00C2FF]/20 flex items-center justify-center text-2xl">
                🚗
              </div>
              <div className="flex-1">
                <p className="font-semibold">{driver.name}</p>
                <p className="text-sm text-gray-400">{driver.vehicle?.model} · {driver.vehicle?.plate}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs">{driver.rating?.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-500">{driver.total_rides} Fahrten</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Online Toggle */}
        <motion.button
          onClick={toggleOnline}
          disabled={loading || !driver?.is_verified}
          className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 mb-4 ${
            isOnline
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          <Power size={20} />
          {isOnline ? 'Offline gehen' : 'Online gehen'}
        </motion.button>

        {!driver?.is_verified && (
          <p className="text-center text-sm text-yellow-400 mb-4">
            Dein Konto muss erst verifiziert werden
          </p>
        )}

        {/* Earnings */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
            <p className="text-xs text-gray-500 mb-1">Heute</p>
            <p className="text-xl font-bold text-[#00D26A]">€{earnings.today.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
            <p className="text-xs text-gray-500 mb-1">Gesamt</p>
            <p className="text-xl font-bold">€{earnings.total.toFixed(2)}</p>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden mb-4">
          <DriverMap
            rideRequests={rideRequests}
            currentRide={currentRide}
            isOnline={isOnline}
            height="300px"
          />
        </div>

        {/* Current Ride */}
        {currentRide && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[#00C2FF]/10 rounded-2xl border border-[#00C2FF]/20 mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#00C2FF]">Aktive Fahrt</span>
              <span className="text-xs px-2 py-1 rounded-full bg-[#00C2FF]/20">
                {currentRide.status}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-[#00C2FF] mt-0.5" />
                <div>
                  <p className="text-[10px] text-gray-500">Abholung</p>
                  <p className="text-sm">{currentRide.pickup?.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Navigation size={14} className="text-[#FF4757] mt-0.5" />
                <div>
                  <p className="text-[10px] text-gray-500">Ziel</p>
                  <p className="text-sm">{currentRide.dropoff?.address}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">Fahrpreis</span>
              <span className="text-lg font-bold">€{currentRide.fare_estimate?.toFixed(2)}</span>
            </div>

            {/* Status Actions */}
            <div className="flex gap-2">
              {currentRide.status === 'accepted' && (
                <button
                  onClick={() => updateRideStatus('arriving')}
                  className="flex-1 py-3 bg-[#00C2FF] text-black font-medium rounded-xl"
                >
                  Bin unterwegs
                </button>
              )}
              {currentRide.status === 'arriving' && (
                <button
                  onClick={() => updateRideStatus('started')}
                  className="flex-1 py-3 bg-[#00C2FF] text-black font-medium rounded-xl"
                >
                  Fahrgast eingestiegen
                </button>
              )}
              {currentRide.status === 'started' && (
                <button
                  onClick={() => updateRideStatus('completed')}
                  className="flex-1 py-3 bg-[#00D26A] text-black font-medium rounded-xl"
                >
                  Fahrt abschließen
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Ride Requests */}
        {isOnline && !currentRide && rideRequests.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3">Neue Anfragen ({rideRequests.length})</h3>
            <div className="space-y-3">
              {rideRequests.map((ride) => (
                <motion.div
                  key={ride.ride_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium">{ride.pickup?.address}</p>
                      <p className="text-xs text-gray-500">→ {ride.dropoff?.address}</p>
                    </div>
                    <span className="text-lg font-bold">€{ride.fare_estimate?.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRide(ride)}
                      className="flex-1 py-2 bg-green-500 text-black font-medium rounded-lg flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={16} /> Annehmen
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* No Requests */}
        {isOnline && !currentRide && rideRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Car size={48} className="mx-auto mb-3 opacity-50" />
            <p>Warte auf Fahrtanfragen...</p>
          </div>
        )}

        {/* Offline Message */}
        {!isOnline && !currentRide && (
          <div className="text-center py-8 text-gray-500">
            <Power size={48} className="mx-auto mb-3 opacity-50" />
            <p>Du bist offline</p>
            <p className="text-sm">Gehe online um Fahrten zu erhalten</p>
          </div>
        )}
      </div>
    </div>
  );
}
