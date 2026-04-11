/**
 * BidBlitz V2 - Real Driver Dashboard
 * For verified/approved drivers only
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Power, MapPin, Navigation, Clock, DollarSign,
  CheckCircle, XCircle, Phone, MessageSquare, Loader2,
  Car, User, Star, TrendingUp, AlertCircle, ChevronRight,
  Play, Square, Map, Bell, RefreshCw, Wallet
} from "lucide-react";
import { api } from "../services/api";

const panelBg = "rgba(12, 14, 26, 0.95)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const DriverDashboardPage = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home"); // home | requests | history

  // Location
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    loadStatus();
    getUserLocation();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 52.52, lng: 13.405 }) // Berlin fallback
      );
    }
  };

  const loadStatus = async () => {
    try {
      const data = await api("/api/driver-dashboard/status");
      setStatus(data);
      setError(null);
    } catch (err) {
      if (err.message?.includes("Kein verifizierter")) {
        setError("Du bist kein verifizierter Fahrer. Bitte beantrage die Fahrer-Verifizierung.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!userLocation) {
      setError("Standort wird benötigt");
      return;
    }
    
    setActionLoading(true);
    try {
      if (status?.is_online) {
        await api("/api/driver-dashboard/go-offline", { method: "POST" });
        setSuccess("Du bist jetzt offline");
      } else {
        await api("/api/driver-dashboard/go-online", {
          method: "POST",
          body: JSON.stringify(userLocation)
        });
        setSuccess("Du bist jetzt online");
      }
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const acceptRide = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await api(`/api/driver-dashboard/ride-requests/${requestId}/accept`, { method: "POST" });
      setSuccess(res.message);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const rejectRide = async (requestId) => {
    setActionLoading(true);
    try {
      await api(`/api/driver-dashboard/ride-requests/${requestId}/reject`, { method: "POST" });
      setSuccess("Anfrage abgelehnt");
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const updateRideStatus = async (rideId, newStatus) => {
    setActionLoading(true);
    try {
      await api(`/api/driver-dashboard/rides/${rideId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus })
      });
      setSuccess(newStatus === "completed" ? "Fahrt abgeschlossen!" : "Status aktualisiert");
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-500" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="min-h-screen bg-[#060810] p-4">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => onNavigate("/more")} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/50" />
          </button>
          <h1 className="text-lg font-bold text-white">Fahrer Dashboard</h1>
        </div>
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-sm">{error}</p>
          <button 
            onClick={() => onNavigate("/more")}
            className="mt-4 px-6 py-2 bg-white/10 rounded-lg text-white text-sm"
          >
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060810] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-[max(env(safe-area-inset-top,0px),16px)] pb-3" style={{ background: "linear-gradient(to bottom, #060810 60%, transparent)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate("/more")} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/50" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Fahrer Dashboard</h1>
            <p className="text-[11px] text-white/40">Willkommen, {status?.name}</p>
          </div>
          <button onClick={loadStatus} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <RefreshCw size={16} className="text-white/50" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-xs text-red-400 flex-1">{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mb-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-xs text-green-400">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 space-y-4">
        {/* Online/Offline Toggle */}
        <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status?.is_online ? "bg-green-500/20" : "bg-gray-500/20"}`}>
                <Power size={24} className={status?.is_online ? "text-green-400" : "text-gray-400"} />
              </div>
              <div>
                <p className="text-white font-semibold">{status?.is_online ? "Online" : "Offline"}</p>
                <p className="text-[11px] text-white/40">
                  {status?.is_busy ? "Aktive Fahrt" : status?.is_online ? "Bereit für Fahrten" : "Nicht verfügbar"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleOnline}
              disabled={actionLoading || status?.is_busy}
              className={`px-6 py-3 rounded-xl font-semibold text-sm ${
                status?.is_online 
                  ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                  : "bg-green-500 text-white"
              }`}
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : status?.is_online ? "Offline gehen" : "Online gehen"}
            </button>
          </div>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }}>
            <p className="text-[10px] text-white/40 mb-1">Heute</p>
            <p className="text-lg font-bold text-green-400">€{status?.earnings?.today?.toFixed(2) || "0.00"}</p>
            <p className="text-[10px] text-white/30">{status?.earnings?.today_rides || 0} Fahrten</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }}>
            <p className="text-[10px] text-white/40 mb-1">Diese Woche</p>
            <p className="text-lg font-bold text-blue-400">€{status?.earnings?.week?.toFixed(2) || "0.00"}</p>
            <p className="text-[10px] text-white/30">{status?.earnings?.week_rides || 0} Fahrten</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }}>
            <p className="text-[10px] text-white/40 mb-1">Guthaben</p>
            <p className="text-lg font-bold text-purple-400">€{status?.balance?.toFixed(2) || "0.00"}</p>
            <p className="text-[10px] text-white/30">{status?.earnings?.total_rides || 0} gesamt</p>
          </div>
        </div>

        {/* Active Ride */}
        {status?.active_ride && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))", border: "1px solid rgba(139,92,246,0.3)" }}>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Car size={18} className="text-purple-400" />
                <span className="text-sm font-semibold text-white">Aktive Fahrt</span>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 uppercase">
                  {status.active_ride.status}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
                  <div className="flex-1">
                    <p className="text-[10px] text-white/40">Abholung</p>
                    <p className="text-xs text-white">{status.active_ride.pickup?.address || "Abholpunkt"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
                  <div className="flex-1">
                    <p className="text-[10px] text-white/40">Ziel</p>
                    <p className="text-xs text-white">{status.active_ride.destination?.address || "Ziel"}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <User size={14} className="text-white/40" />
                <span className="text-xs text-white">{status.active_ride.customer_name}</span>
                {status.active_ride.customer_phone && (
                  <a href={`tel:${status.active_ride.customer_phone}`} className="ml-auto p-2 bg-white/10 rounded-lg">
                    <Phone size={14} className="text-white" />
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                {status.active_ride.status === "accepted" && (
                  <button
                    onClick={() => updateRideStatus(status.active_ride.ride_id, "arriving")}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-blue-500 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Navigation size={16} /> Bin unterwegs
                  </button>
                )}
                {status.active_ride.status === "arriving" && (
                  <button
                    onClick={() => updateRideStatus(status.active_ride.ride_id, "started")}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-green-500 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> Fahrt starten
                  </button>
                )}
                {status.active_ride.status === "started" && (
                  <button
                    onClick={() => updateRideStatus(status.active_ride.ride_id, "completed")}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-green-500 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} /> Fahrt beenden
                  </button>
                )}
                <button
                  onClick={() => updateRideStatus(status.active_ride.ride_id, "canceled")}
                  disabled={actionLoading}
                  className="px-4 py-3 bg-red-500/20 rounded-xl text-red-400 text-sm font-semibold"
                >
                  <XCircle size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Ride Requests */}
        {status?.pending_requests?.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
            <div className="flex items-center gap-2 mb-3">
              <Bell size={16} className="text-yellow-400" />
              <span className="text-sm font-semibold text-white">Neue Fahrtanfragen</span>
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400">
                {status.pending_requests.length}
              </span>
            </div>
            
            <div className="space-y-3">
              {status.pending_requests.map((req) => (
                <div key={req.request_id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-green-400" />
                      <span className="text-xs text-white">{req.distance_km?.toFixed(1)}km entfernt</span>
                    </div>
                    <span className="text-sm font-bold text-green-400">€{req.estimated_fare?.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-white/40 mb-3">ETA: {req.eta_minutes} Min.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRide(req.request_id)}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-green-500 rounded-lg text-white text-xs font-semibold"
                    >
                      Annehmen
                    </button>
                    <button
                      onClick={() => rejectRide(req.request_id)}
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-red-500/20 rounded-lg text-red-400 text-xs font-semibold"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Activity */}
        {!status?.active_ride && (!status?.pending_requests || status.pending_requests.length === 0) && status?.is_online && (
          <div className="rounded-2xl p-8 text-center" style={{ background: panelBg, border: panelBorder }}>
            <Car size={48} className="text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">Warten auf Fahrtanfragen...</p>
            <p className="text-xs text-white/20 mt-1">Neue Anfragen erscheinen hier</p>
          </div>
        )}

        {/* Vehicle Info */}
        {status?.vehicle && (
          <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Mein Fahrzeug</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <Car size={24} className="text-white/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{status.vehicle.model || "Fahrzeug"}</p>
                <p className="text-xs text-white/40">{status.vehicle.license_plate || "Kennzeichen"}</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Star size={14} className="text-yellow-400" />
                <span className="text-sm font-bold text-white">{status.rating?.toFixed(1) || "5.0"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDashboardPage;
