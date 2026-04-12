/**
 * BidBlitz V2 - Mobility Map Page (Mapbox)
 * Shows user location + nearby services on a real dark-themed map
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, RefreshCw, Loader2, MapPin, Wallet, Navigation,
  X, Star, ChevronRight, Fuel, Calendar, Users
} from "lucide-react";
import MapboxMap from "../components/MapboxMap";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Location permission gate
const LocationPermissionGate = ({ onGranted, onSkipped }) => {
  const [asking, setAsking] = useState(false);

  const requestLocation = () => {
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { onGranted({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setAsking(false); onSkipped(); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-[#0A0A0F] flex flex-col items-center justify-center p-8 text-center">
      <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="w-20 h-20 rounded-full bg-[#00C2FF]/10 border-2 border-[#00C2FF]/30 flex items-center justify-center mx-auto mb-6">
          <MapPin size={36} className="text-[#00C2FF]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Standort aktivieren</h2>
        <p className="text-sm text-gray-400 mb-2 max-w-xs">
          BidBlitz braucht deinen Standort, um Fahrzeuge und Services in deiner Nähe zu finden.
        </p>
        <p className="text-[10px] text-gray-600 mb-8 max-w-xs">
          Dein Standort wird nur für die Kartenanzeige verwendet und nicht gespeichert.
        </p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={requestLocation} disabled={asking}
          className="w-full max-w-xs py-4 rounded-2xl bg-[#00C2FF] text-black font-bold text-sm flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
          data-testid="grant-location-btn">
          {asking ? <Loader2 size={18} className="animate-spin" /> : <><Navigation size={18} /> Standort freigeben</>}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onSkipped}
          className="w-full max-w-xs py-3 rounded-2xl bg-white/5 text-gray-500 text-xs font-medium"
          data-testid="skip-location-btn">
          Ohne Standort fortfahren
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

const MobilityMapPage = ({ onNavigate }) => {
  const [locationGranted, setLocationGranted] = useState(null); // null=checking, true/false
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [cars, setCars] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);

  // Check if location permission was already granted
  useEffect(() => {
    if (!navigator.geolocation) { setLocationGranted(false); return; }
    // Check via permissions API if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then(result => {
        if (result.state === "granted") setLocationGranted(true);
        else if (result.state === "denied") setLocationGranted(false);
        else setLocationGranted(null); // prompt
      }).catch(() => setLocationGranted(null));
    } else {
      // No permissions API — try silently
      setLocationGranted(null);
    }
  }, []);

  const fetchAPI = async (path) => {
    const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error("Fehler");
    return res.json();
  };

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [carsRes, userRes] = await Promise.all([
        fetchAPI("/api/car-rental/cars/search?limit=50").catch(() => ({ cars: [] })),
        fetchAPI("/api/auth/me").catch(() => ({ balance: 0 })),
      ]);
      setCars(carsRes.cars || []);
      setUserBalance(userRes.balance || 0);
    } catch (err) {
      console.error(err);
    }
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleMarkerClick = ({ type, data }) => {
    if (type === "car") setSelectedCar(data);
  };

  const totalItems = cars.length;

  return (
    <div data-testid="mobility-map-page" className="h-screen flex flex-col bg-[#030303]">
      {/* Location Permission Gate */}
      <AnimatePresence>
        {locationGranted === null && (
          <LocationPermissionGate
            onGranted={() => setLocationGranted(true)}
            onSkipped={() => setLocationGranted(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate("/more")}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
              data-testid="map-back-btn">
              <ArrowLeft size={16} className="text-white/60" />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold text-white">Live Map</h1>
              <p className="text-[10px] text-gray-500">{totalItems} Services in deiner Nähe</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => loadData(true)}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
              data-testid="map-refresh-btn">
              <RefreshCw size={14} className={`text-white/60 ${refreshing ? "animate-spin" : ""}`} />
            </motion.button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/20">
              <Wallet size={12} className="text-[#00C2FF]" />
              <span className="text-[11px] font-semibold text-[#00C2FF]">€{userBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 px-4 pb-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C2FF]/10 border border-[#00C2FF]/20">
            <Car size={12} className="text-[#00C2FF]" />
            <span className="text-[10px] font-medium text-[#00C2FF]">{cars.length} Mietwagen</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center bg-[#0A0A0F]">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-[#00C2FF] mx-auto mb-3" />
              <p className="text-sm text-gray-500">Karte wird geladen...</p>
            </div>
          </div>
        ) : (
          <MapboxMap
            cars={cars}
            showUserLocation={true}
            radius={5000}
            height="100%"
            onMarkerClick={handleMarkerClick}
          />
        )}

        {/* Empty state overlay */}
        {!loading && totalItems === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
            <div className="bg-[#111118] rounded-2xl p-6 mx-6 text-center border border-white/5">
              <MapPin size={40} className="mx-auto text-gray-600 mb-3" />
              <h3 className="text-white font-semibold mb-1">Keine Services verfügbar</h3>
              <p className="text-xs text-gray-500">In deiner Nähe sind aktuell keine Fahrzeuge verfügbar.</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected Car Action Sheet */}
      <AnimatePresence>
        {selectedCar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setSelectedCar(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 overflow-hidden">
              {/* Car image/header */}
              <div className="relative h-40 bg-gradient-to-br from-[#00C2FF]/10 to-[#00C2FF]/5 flex items-center justify-center">
                {selectedCar.main_image ? (
                  <img src={selectedCar.main_image.startsWith("http") ? selectedCar.main_image : `${API_URL}${selectedCar.main_image}`}
                    alt={selectedCar.title} className="h-full w-full object-cover" />
                ) : (
                  <Car size={64} className="text-[#00C2FF]/30" />
                )}
                <button onClick={() => setSelectedCar(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                  data-testid="close-car-sheet">
                  <X size={16} className="text-white" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedCar.title || `${selectedCar.brand} ${selectedCar.model}`}</h3>
                    <p className="text-xs text-gray-500">{selectedCar.city || "Standort"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#00C2FF]">€{(selectedCar.price_per_day || 0).toFixed(0)}</p>
                    <p className="text-[10px] text-gray-500">/Tag</p>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  {selectedCar.fuel_type && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Fuel size={12} /> {selectedCar.fuel_type}
                    </div>
                  )}
                  {selectedCar.seats && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Users size={12} /> {selectedCar.seats} Sitze
                    </div>
                  )}
                  {selectedCar.rating > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
                      <Star size={12} /> {selectedCar.rating.toFixed(1)}
                    </div>
                  )}
                </div>

                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { setSelectedCar(null); onNavigate(`/car-rental/car/${selectedCar.car_id}`); }}
                  className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-bold text-sm flex items-center justify-center gap-2"
                  data-testid="view-car-detail-btn">
                  Details ansehen <ChevronRight size={16} />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobilityMapPage;
