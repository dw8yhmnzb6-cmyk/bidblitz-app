/**
 * BidBlitz V2 - Map Action Sheet
 * Shows detailed info and actions when a map marker is clicked
 * Supports: Scooters, Drivers, Restaurants
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Battery, Clock, Star, Phone, Navigation,
  Bike, Car, UtensilsCrossed, ChevronRight, Loader2,
  CreditCard, Wallet, Euro
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MapActionSheet = ({ isOpen, onClose, markerType, markerData, onAction, userBalance = 0 }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !markerData) return null;

  const handleAction = async (actionType) => {
    setLoading(true);
    setError(null);
    try {
      if (onAction) {
        await onAction(actionType, markerData);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render content based on marker type
  const renderContent = () => {
    switch (markerType) {
      case "scooter":
        return <ScooterSheet data={markerData} onAction={handleAction} loading={loading} userBalance={userBalance} />;
      case "driver":
        return <DriverSheet data={markerData} onAction={handleAction} loading={loading} />;
      case "restaurant":
        return <RestaurantSheet data={markerData} onAction={handleAction} loading={loading} />;
      default:
        return <GenericSheet data={markerData} onClose={onClose} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[1002] bg-[#0A0A0F] rounded-t-3xl border-t border-white/10 max-h-[80vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Close button */}
            <motion.button
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-white/60" />
            </motion.button>

            {/* Content */}
            <div className="px-5 pb-8">
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              {renderContent()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCOOTER SHEET
// ═══════════════════════════════════════════════════════════════════════════════
const ScooterSheet = ({ data, onAction, loading, userBalance }) => {
  const batteryColor = data.battery > 50 ? "text-green-400" : data.battery > 20 ? "text-yellow-400" : "text-red-400";
  const unlockFee = data.unlock_fee || 1.0;
  const pricePerMin = data.price_per_minute || 0.25;
  const canAfford = userBalance >= unlockFee;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
          <Bike size={32} className="text-green-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">E-Scooter</h3>
          <p className="text-sm text-gray-400">ID: {data.scooter_id?.slice(-6) || "N/A"}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`flex items-center gap-1 text-sm ${batteryColor}`}>
              <Battery size={14} /> {data.battery}%
            </span>
            <span className="text-sm text-gray-500">
              {data.status === "available" ? "Verfügbar" : data.status}
            </span>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Preise</p>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-2xl font-bold text-white">€{unlockFee.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Entsperren</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-green-400">€{pricePerMin.toFixed(2)}/min</p>
            <p className="text-xs text-gray-500">Fahrtkosten</p>
          </div>
        </div>
      </div>

      {/* Balance Warning */}
      {!canAfford && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
          <Wallet size={16} className="text-yellow-400" />
          <p className="text-sm text-yellow-400">
            Guthaben zu niedrig (€{userBalance.toFixed(2)})
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <motion.button
          onClick={() => onAction("unlock_scooter")}
          disabled={loading || !canAfford || data.status !== "available"}
          className={`w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 ${
            canAfford && data.status === "available"
              ? "bg-green-500 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
          whileTap={canAfford ? { scale: 0.98 } : {}}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <CreditCard size={18} />
              Jetzt entsperren (€{unlockFee.toFixed(2)})
            </>
          )}
        </motion.button>

        <motion.button
          onClick={() => onAction("reserve_scooter")}
          disabled={loading || data.status !== "available"}
          className="w-full py-3 rounded-xl bg-white/5 text-white/70 font-medium text-sm flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}
        >
          <Clock size={16} />
          15 Min reservieren (kostenlos)
        </motion.button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER SHEET
// ═══════════════════════════════════════════════════════════════════════════════
const DriverSheet = ({ data, onAction, loading }) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center">
          <Car size={32} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{data.name || "Fahrer"}</h3>
          <p className="text-sm text-gray-400">{data.vehicle?.model || data.vehicle_type || "Fahrzeug"}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-sm text-yellow-400">
              <Star size={14} fill="currentColor" /> {data.rating?.toFixed(1) || "5.0"}
            </span>
            <span className="text-sm text-gray-500">
              {data.completed_rides || 0} Fahrten
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
          <p className="text-lg font-bold text-white">{data.eta || "~5"}</p>
          <p className="text-[10px] text-gray-500">Min entfernt</p>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
          <p className="text-lg font-bold text-green-400">€{data.base_fare || "3.50"}</p>
          <p className="text-[10px] text-gray-500">Grundpreis</p>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
          <p className="text-lg font-bold text-white">€{data.price_per_km || "1.50"}</p>
          <p className="text-[10px] text-gray-500">Pro km</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <motion.button
          onClick={() => onAction("request_ride")}
          disabled={loading || data.is_busy}
          className={`w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 ${
            !data.is_busy
              ? "bg-purple-500 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
          whileTap={!data.is_busy ? { scale: 0.98 } : {}}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : data.is_busy ? (
            "Fahrer beschäftigt"
          ) : (
            <>
              <Navigation size={18} />
              Diesen Fahrer buchen
            </>
          )}
        </motion.button>

        {data.phone && (
          <motion.a
            href={`tel:${data.phone}`}
            className="w-full py-3 rounded-xl bg-white/5 text-white/70 font-medium text-sm flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}
          >
            <Phone size={16} />
            Anrufen
          </motion.a>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESTAURANT SHEET
// ═══════════════════════════════════════════════════════════════════════════════
const RestaurantSheet = ({ data, onAction, loading }) => {
  const isOpen = data.is_open !== false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
          isOpen ? "bg-orange-500/20" : "bg-gray-500/20"
        }`}>
          <UtensilsCrossed size={32} className={isOpen ? "text-orange-400" : "text-gray-400"} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white">{data.name || "Restaurant"}</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isOpen ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}>
              {isOpen ? "GEÖFFNET" : "GESCHLOSSEN"}
            </span>
          </div>
          <p className="text-sm text-gray-400">{data.category || "Restaurant"}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-sm text-yellow-400">
              <Star size={14} fill="currentColor" /> {data.rating?.toFixed(1) || "4.5"}
            </span>
            <span className="text-sm text-gray-500">
              {data.delivery_time || "20-30"} min
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Mindestbestellung</span>
          <span className="text-sm font-semibold text-white">€{data.min_order || "10.00"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Liefergebühr</span>
          <span className="text-sm font-semibold text-green-400">
            {data.delivery_fee ? `€${data.delivery_fee.toFixed(2)}` : "Gratis"}
          </span>
        </div>
      </div>

      {/* Address */}
      {data.address && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <MapPin size={14} />
          {data.address}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <motion.button
          onClick={() => onAction("view_menu")}
          disabled={loading || !isOpen}
          className={`w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 ${
            isOpen
              ? "bg-orange-500 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
          whileTap={isOpen ? { scale: 0.98 } : {}}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <UtensilsCrossed size={18} />
              Speisekarte öffnen
            </>
          )}
        </motion.button>

        <motion.button
          onClick={() => onAction("get_directions")}
          className="w-full py-3 rounded-xl bg-white/5 text-white/70 font-medium text-sm flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}
        >
          <Navigation size={16} />
          Route anzeigen
        </motion.button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC SHEET (fallback)
// ═══════════════════════════════════════════════════════════════════════════════
const GenericSheet = ({ data, onClose }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white">Details</h3>
      <pre className="text-xs text-gray-400 bg-white/5 p-3 rounded-xl overflow-auto max-h-40">
        {JSON.stringify(data, null, 2)}
      </pre>
      <motion.button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-white/10 text-white font-medium"
        whileTap={{ scale: 0.98 }}
      >
        Schließen
      </motion.button>
    </div>
  );
};

export default MapActionSheet;
