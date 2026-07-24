/**
 * BidBlitz V2 - Order Tracking Page
 * Real-time tracking for food delivery orders
 * Shows: Restaurant, Driver location, Order status, ETA
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Phone, MessageSquare, Clock, CheckCircle,
  Package, Bike, UtensilsCrossed, User, Loader2, RefreshCw,
  Navigation, Star
} from "lucide-react";
import UnifiedRealMap from "../components/UnifiedRealMap";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_STEPS = [
  { key: "pending", label: "Bestellt", icon: Package },
  { key: "accepted", label: "Bestätigt", icon: CheckCircle },
  { key: "preparing", label: "Zubereitung", icon: UtensilsCrossed },
  { key: "ready", label: "Bereit", icon: Package },
  { key: "picked_up", label: "Unterwegs", icon: Bike },
  { key: "delivered", label: "Geliefert", icon: CheckCircle },
];

const OrderTrackingPage = ({ orderId, onNavigate, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState(null);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/restaurant-dashboard/orders/${orderId}/tracking`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Tracking nicht verfügbar");
      const data = await res.json();
      setTracking(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTracking();
    // Poll every 10 seconds for live updates
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <Loader2 size={32} className="text-orange-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#030303] p-4">
        <div className="flex items-center gap-3 mb-6">
          <motion.button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={18} className="text-white/60" />
          </motion.button>
          <h1 className="text-lg font-bold text-white">Bestellverfolgung</h1>
        </div>
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === tracking?.status) || 0;
  const isDelivered = tracking?.status === "delivered";
  const hasDriver = !!tracking?.driver;

  // Prepare map markers
  const restaurantMarker = tracking?.restaurant ? [{
    restaurant_id: "origin",
    name: tracking.restaurant.name,
    lat: tracking.restaurant.lat,
    lng: tracking.restaurant.lng,
    is_open: true,
  }] : [];

  const driverMarker = tracking?.driver?.lat ? [{
    driver_id: "delivery",
    name: tracking.driver.name,
    lat: tracking.driver.lat,
    lng: tracking.driver.lng,
    is_online: true,
    is_busy: true,
  }] : [];

  return (
    <div data-testid="order-tracking-page" className="min-h-screen bg-[#030303] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 bg-[#0A0A0F] border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={16} className="text-white/60" />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold text-white">Bestellung #{orderId?.slice(-6)}</h1>
              <p className="text-[11px] text-gray-500">Live-Verfolgung</p>
            </div>
          </div>
          <motion.button
            onClick={fetchTracking}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw size={14} className="text-white/50" />
          </motion.button>
        </div>
      </div>

      {/* Map */}
      <div className="h-[300px]">
        <UnifiedRealMap
          height="100%"
          restaurants={restaurantMarker}
          drivers={driverMarker}
          showUserLocation
          pickup={tracking?.restaurant ? { lat: tracking.restaurant.lat, lng: tracking.restaurant.lng } : null}
          dropoff={tracking?.delivery_address ? { lat: 52.52, lng: 13.405 } : null}
        />
      </div>

      {/* Status Timeline */}
      <div className="px-4 py-5">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-white/10" />
          <div
            className="absolute left-[19px] top-0 w-0.5 bg-orange-500 transition-all duration-500"
            style={{ height: `${Math.min((currentStepIndex / (STATUS_STEPS.length - 1)) * 100, 100)}%` }}
          />

          {/* Steps */}
          <div className="space-y-4">
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? isCurrent
                          ? "bg-orange-500"
                          : "bg-green-500"
                        : "bg-white/10"
                    }`}
                  >
                    <Icon size={18} className={isCompleted ? "text-white" : "text-white/30"} />
                    {isCurrent && !isDelivered && (
                      <span className="absolute inset-0 rounded-full border-2 border-orange-500 animate-ping" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[14px] font-medium ${isCompleted ? "text-white" : "text-white/40"}`}>
                      {step.label}
                    </p>
                    {isCurrent && tracking?.estimated_delivery && (
                      <p className="text-[11px] text-orange-400">
                        Geschätzte Ankunft: {new Date(tracking.estimated_delivery).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  {isCompleted && (
                    <CheckCircle size={16} className="text-green-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Driver Info */}
      {hasDriver && (
        <div className="px-4 pb-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">Dein Fahrer</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <User size={24} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-white">{tracking.driver.name}</p>
                <p className="text-[12px] text-gray-500">{tracking.driver.vehicle_type || "Fahrzeug"}</p>
              </div>
              {tracking.driver.phone && (
                <motion.a
                  href={`tel:${tracking.driver.phone}`}
                  className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <Phone size={18} className="text-green-400" />
                </motion.a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Info */}
      {tracking?.restaurant && (
        <div className="px-4 pb-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-3">Restaurant</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <UtensilsCrossed size={24} className="text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-white">{tracking.restaurant.name}</p>
                {tracking.restaurant.address && (
                  <p className="text-[12px] text-gray-500">{tracking.restaurant.address}</p>
                )}
              </div>
              <motion.button
                onClick={() => {
                  const { lat, lng } = tracking.restaurant;
                  window.open(`https://www.openstreetmap.org/directions?to=${lat},${lng}`, "_blank");
                }}
                className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                <Navigation size={18} className="text-blue-400" />
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Completed */}
      {isDelivered && (
        <div className="px-4">
          <motion.div
            className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Guten Appetit!</h3>
            <p className="text-sm text-gray-400 mb-4">Deine Bestellung wurde erfolgreich geliefert.</p>
            <motion.button
              onClick={onBack}
              className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl"
              whileTap={{ scale: 0.98 }}
            >
              Zurück zur Übersicht
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OrderTrackingPage;
