/**
 * GeofenceArrivalModal — modernes Bottom-Sheet Popup.
 * "Du bist angekommen — Shift starten?"
 *
 * Mobile-first, großer Confirm-Button, smooth Animation.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Play, Loader2, Sparkles } from "lucide-react";
import { confirmGeofenceCheckin } from "./useGeofenceWatch";
import { StaffActionButton } from "./components";
import { toast } from "sonner";

export function GeofenceArrivalModal({ open, fence, position, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);

  if (!open || !fence) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmGeofenceCheckin({
        geofence_id: fence.id,
        lat: position.lat,
        lng: position.lng,
        accuracy_m: position.accuracy_m,
        confirmed: true,
      });
      toast.success(`Willkommen bei ${fence.name} — Shift gestartet`);
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e.message || "Check-in fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await confirmGeofenceCheckin({
        geofence_id: fence.id,
        lat: position.lat,
        lng: position.lng,
        accuracy_m: position.accuracy_m,
        confirmed: false,
      });
    } catch {}
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          onClick={(e) => e.stopPropagation()}
          data-testid="geofence-arrival-modal"
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-emerald-50 to-blue-50 px-6 pt-6 pb-5">
            <button
              onClick={handleSkip}
              data-testid="geofence-close"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition"
            >
              <X size={16} className="text-slate-600" />
            </button>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
              className="w-16 h-16 mb-4 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
            >
              <MapPin size={28} className="text-white" strokeWidth={2.5} />
            </motion.div>

            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles size={12} />
              Du bist angekommen
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Willkommen bei</h2>
            <p className="text-3xl font-bold text-slate-900 mt-0.5">{fence.name}</p>
            {position && (
              <p className="text-xs text-slate-500 mt-2">
                Standort-Genauigkeit: ±{Math.round(position.accuracy_m || 0)}m
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-base text-slate-700 text-center">
              Möchtest du jetzt deine Schicht starten?
            </p>

            <StaffActionButton
              color="green"
              icon={loading ? <Loader2 size={22} className="text-white animate-spin" /> : <Play size={22} className="text-white" />}
              title={loading ? "MOMENT..." : "SHIFT STARTEN"}
              subtitle={loading ? "Wird verarbeitet" : "Tippe zum Einchecken"}
              onClick={handleConfirm}
              disabled={loading}
              testid="geofence-confirm-btn"
            />

            <button
              onClick={handleSkip}
              disabled={loading}
              data-testid="geofence-skip-btn"
              className="w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              Später, danke
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GeofenceArrivalModal;
