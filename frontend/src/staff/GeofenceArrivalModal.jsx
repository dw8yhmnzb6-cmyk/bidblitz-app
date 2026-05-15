/**
 * GeofenceArrivalModal — Premium iOS-Style Fullscreen Smart Arrival.
 * ==================================================================
 * Wenn der Mitarbeiter ein Geofence betritt: großes Fullscreen-Sheet
 * mit Live-Animation, Distanz, Standort-Pin, großem CTA.
 *
 * Konkurrenz-Look: Uber Driver, Connecteam, Apple Find My.
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Play, Loader2, Sparkles, ShieldCheck, Signal } from "lucide-react";
import { confirmGeofenceCheckin } from "./useGeofenceWatch";
import { toast } from "sonner";

export function GeofenceArrivalModal({ open, fence, position, nextShift, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const accuracyLabel = useMemo(() => {
    const a = position?.accuracy_m;
    if (!a) return "GPS aktiv";
    if (a <= 15) return "Exzellent";
    if (a <= 35) return "Gut";
    if (a <= 70) return "OK";
    return "Schwach";
  }, [position]);

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
        className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-md flex items-end sm:items-center justify-center"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          data-testid="geofence-arrival-modal"
          className="w-full sm:max-w-md bg-white sm:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl overflow-hidden h-[92vh] sm:h-auto sm:max-h-[88vh] flex flex-col"
        >
          {/* Drag Indicator (mobile only) */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-slate-300" />
          </div>

          {/* Close */}
          <button
            onClick={handleSkip}
            data-testid="geofence-close"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md hover:bg-white flex items-center justify-center transition z-10"
          >
            <X size={18} className="text-slate-700" />
          </button>

          {/* Hero — Animated Pin + Pulse */}
          <div className="relative bg-gradient-to-br from-emerald-50 via-blue-50 to-violet-50 px-8 pt-10 pb-8 flex-shrink-0">
            <div className="relative w-32 h-32 mx-auto mb-5">
              {/* Pulse rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.6, opacity: 0.6 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    delay: i * 0.6,
                    ease: "easeOut",
                  }}
                  className="absolute inset-0 rounded-full bg-emerald-400"
                />
              ))}
              {/* Static glow */}
              <div className="absolute inset-4 rounded-full bg-emerald-200 blur-2xl opacity-60" />
              {/* Icon disc */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
              >
                <MapPin size={44} className="text-white drop-shadow" strokeWidth={2.5} />
              </motion.div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold uppercase tracking-[0.18em] mb-3">
                <Sparkles size={12} />
                Du bist angekommen
              </div>
              <h2 className="text-[28px] leading-tight font-bold text-slate-900">Willkommen bei</h2>
              <p className="text-[28px] leading-tight font-extrabold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mt-1" data-testid="geofence-fence-name">
                {fence.name}
              </p>
              <p className="text-xs text-slate-500 mt-3 tabular-nums">
                {now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {now.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              {nextShift && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur shadow-sm border border-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-700">
                    Deine Schicht beginnt um{" "}
                    <span className="text-slate-900 tabular-nums">
                      {new Date(nextShift.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pt-6 pb-8 flex-1 flex flex-col justify-between">
            {/* Signal info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  <Signal size={11} /> GPS-Signal
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1" data-testid="geofence-accuracy">
                  {accuracyLabel}
                  {position?.accuracy_m && <span className="font-medium text-slate-500 ml-1">±{Math.round(position.accuracy_m)}m</span>}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  <ShieldCheck size={11} /> Geofence
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  Im Radius
                  <span className="font-medium text-slate-500 ml-1">· {fence.radius_m}m</span>
                </p>
              </div>
            </div>

            <p className="text-center text-base text-slate-600 mb-5">
              Möchtest du jetzt deine Schicht starten?
            </p>

            {/* Primary CTA — large, satisfying */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              disabled={loading}
              data-testid="geofence-confirm-btn"
              className="w-full h-16 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white text-base font-bold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  WIRD VERARBEITET …
                </>
              ) : (
                <>
                  <Play size={22} strokeWidth={2.5} />
                  SHIFT JETZT STARTEN
                </>
              )}
            </motion.button>

            <button
              onClick={handleSkip}
              disabled={loading}
              data-testid="geofence-skip-btn"
              className="w-full mt-3 py-3.5 rounded-2xl text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
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
