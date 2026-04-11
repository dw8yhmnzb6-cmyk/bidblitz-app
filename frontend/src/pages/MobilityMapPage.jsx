/**
 * BidBlitz V2 - Unified Mobility Map Page
 * Shows all nearby services: Scooters, Drivers, Restaurants
 * Click markers to see details and take actions
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Bike, Car, UtensilsCrossed, Filter, RefreshCw,
  Loader2, MapPin, Wallet
} from "lucide-react";
import UnifiedRealMap from "../components/UnifiedRealMap";
import MapActionSheet from "../components/MapActionSheet";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const panelBg = "rgba(10, 10, 15, 0.95)";

const MobilityMapPage = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userBalance, setUserBalance] = useState(0);

  // Data
  const [scooters, setScooters] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);

  // Filters
  const [showScooters, setShowScooters] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showRestaurants, setShowRestaurants] = useState(true);

  // Action Sheet
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [markerType, setMarkerType] = useState(null);

  // Success/Error messages
  const [message, setMessage] = useState(null);

  const fetchAPI = async (path) => {
    const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error("Fehler beim Laden");
    return res.json();
  };

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      // Fetch all nearby data in parallel
      const [scooterRes, driverRes, restaurantRes, userRes] = await Promise.all([
        fetchAPI("/api/nearby/scooters?radius=5000").catch(() => ({ scooters: [] })),
        fetchAPI("/api/nearby/drivers?radius=5000").catch(() => ({ drivers: [] })),
        fetchAPI("/api/nearby/restaurants?radius=5000").catch(() => ({ restaurants: [] })),
        fetchAPI("/api/auth/me").catch(() => ({ balance: 0 })),
      ]);

      setScooters(scooterRes.scooters || []);
      setDrivers(driverRes.drivers || []);
      setRestaurants(restaurantRes.restaurants || []);
      setUserBalance(userRes.balance || 0);
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleMarkerClick = ({ type, data }) => {
    setMarkerType(type);
    setSelectedMarker(data);
  };

  const handleAction = async (actionType, data) => {
    try {
      switch (actionType) {
        case "unlock_scooter":
          const unlockRes = await fetch(`${API_URL}/api/scooter/unlock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ scooter_id: data.scooter_id }),
          });
          if (!unlockRes.ok) {
            const err = await unlockRes.json();
            throw new Error(err.detail || "Entsperren fehlgeschlagen");
          }
          setMessage({ type: "success", text: "Scooter entsperrt! Gute Fahrt!" });
          loadData(false);
          break;

        case "reserve_scooter":
          const reserveRes = await fetch(`${API_URL}/api/scooter/reserve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ scooter_id: data.scooter_id }),
          });
          if (!reserveRes.ok) {
            const err = await reserveRes.json();
            throw new Error(err.detail || "Reservierung fehlgeschlagen");
          }
          setMessage({ type: "success", text: "Scooter für 15 Min reserviert!" });
          break;

        case "request_ride":
          // Navigate to taxi page with driver pre-selected
          onNavigate?.(`/taxi?driver_id=${data.driver_id}`);
          break;

        case "view_menu":
          // Navigate to food page with restaurant pre-selected
          onNavigate?.(`/food?restaurant_id=${data.restaurant_id}`);
          break;

        case "get_directions":
          // Open in Google Maps
          const lat = data.lat || data.current_lat;
          const lng = data.lng || data.current_lng;
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
          break;

        default:
          console.log("Unknown action:", actionType);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }

    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  // Filter counts
  const scooterCount = scooters.filter(s => s.status === "available").length;
  const driverCount = drivers.filter(d => d.is_online && !d.is_busy).length;
  const restaurantCount = restaurants.filter(r => r.is_open !== false).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="mobility-map-page" className="min-h-screen bg-[#030303]">
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{ background: panelBg, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => onNavigate?.("/")}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={16} className="text-white/60" />
          </motion.button>
          <div>
            <h1 className="text-[15px] font-bold text-white">Mobilität</h1>
            <p className="text-[11px] text-gray-500">Scooter, Taxi, Essen</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 text-[12px]">
            <Wallet size={12} className="text-green-400" />
            <span className="text-green-400 font-semibold">€{userBalance.toFixed(2)}</span>
          </div>
          <motion.button
            onClick={() => loadData()}
            disabled={refreshing}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw size={14} className={`text-white/50 ${refreshing ? "animate-spin" : ""}`} />
          </motion.button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        <FilterChip
          active={showScooters}
          onClick={() => setShowScooters(!showScooters)}
          icon={Bike}
          label="Scooter"
          count={scooterCount}
          color="green"
        />
        <FilterChip
          active={showDrivers}
          onClick={() => setShowDrivers(!showDrivers)}
          icon={Car}
          label="Taxi"
          count={driverCount}
          color="purple"
        />
        <FilterChip
          active={showRestaurants}
          onClick={() => setShowRestaurants(!showRestaurants)}
          icon={UtensilsCrossed}
          label="Essen"
          count={restaurantCount}
          color="orange"
        />
      </div>

      {/* Success/Error Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mx-4 mb-2 p-3 rounded-xl flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-500/20 border border-green-500/30 text-green-400"
                : "bg-red-500/20 border border-red-500/30 text-red-400"
            }`}
          >
            <span className="text-[13px] font-medium">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl overflow-hidden border border-white/5">
          <UnifiedRealMap
            height="calc(100vh - 220px)"
            scooters={showScooters ? scooters : []}
            drivers={showDrivers ? drivers : []}
            restaurants={showRestaurants ? restaurants : []}
            showUserLocation
            radius={2000}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="fixed bottom-20 left-4 right-4 z-30">
        <div className="grid grid-cols-3 gap-2">
          {showScooters && scooterCount > 0 && (
            <motion.div
              className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Bike size={18} className="text-green-400 mx-auto mb-1" />
              <p className="text-[18px] font-bold text-green-400">{scooterCount}</p>
              <p className="text-[9px] text-gray-500">Scooter</p>
            </motion.div>
          )}
          {showDrivers && driverCount > 0 && (
            <motion.div
              className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Car size={18} className="text-purple-400 mx-auto mb-1" />
              <p className="text-[18px] font-bold text-purple-400">{driverCount}</p>
              <p className="text-[9px] text-gray-500">Fahrer</p>
            </motion.div>
          )}
          {showRestaurants && restaurantCount > 0 && (
            <motion.div
              className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <UtensilsCrossed size={18} className="text-orange-400 mx-auto mb-1" />
              <p className="text-[18px] font-bold text-orange-400">{restaurantCount}</p>
              <p className="text-[9px] text-gray-500">Restaurants</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Action Sheet */}
      <MapActionSheet
        isOpen={!!selectedMarker}
        onClose={() => setSelectedMarker(null)}
        markerType={markerType}
        markerData={selectedMarker}
        onAction={handleAction}
        userBalance={userBalance}
      />
    </div>
  );
};

// Filter Chip Component
const FilterChip = ({ active, onClick, icon: Icon, label, count, color }) => {
  const colors = {
    green: active ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-white/5 border-white/10 text-gray-400",
    purple: active ? "bg-purple-500/20 border-purple-500/40 text-purple-400" : "bg-white/5 border-white/10 text-gray-400",
    orange: active ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "bg-white/5 border-white/10 text-gray-400",
  };

  return (
    <motion.button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[12px] font-medium whitespace-nowrap ${colors[color]}`}
      whileTap={{ scale: 0.95 }}
    >
      <Icon size={14} />
      {label}
      {count > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px]">{count}</span>
      )}
    </motion.button>
  );
};

export default MobilityMapPage;
