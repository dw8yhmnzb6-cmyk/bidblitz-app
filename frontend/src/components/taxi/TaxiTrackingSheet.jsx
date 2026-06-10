import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { STATUS_COLORS, STATUS_LABELS } from "./TaxiConstants";

function Dot({ color }) {
  return <div className={`w-3 h-3 rounded-full ring-4 ${color} shrink-0`} />;
}

function useLiveCountdown(etaMinutes, statusKey) {
  const [seconds, setSeconds] = useState(() => (etaMinutes != null ? etaMinutes * 60 : null));

  useEffect(() => {
    setSeconds(etaMinutes != null ? Math.max(0, Math.round(etaMinutes * 60)) : null);
  }, [etaMinutes, statusKey]);

  useEffect(() => {
    if (seconds == null) return;
    const id = setInterval(() => {
      setSeconds((s) => (s != null && s > 0 ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds == null]);

  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TaxiTrackingSheet({
  activeRide,
  loading,
  cancelRide,
  onRequestCancel,
  simulateDriverArrival,
  simulateStartTrip,
  simulateCompleteTrip,
  onOpenLiveChat,
  onOpenSplit,
  onOpenReview,
  onResetToBook,
}) {
  const etaText = useLiveCountdown(activeRide?.driver?.eta_minutes, activeRide?.status);

  if (!activeRide) {
    return (
      <div className="text-center py-10 font-taxi-body">
        <div className="text-5xl mb-3">🚕</div>
        <p className="text-zinc-500 text-sm">Keine aktive Fahrt</p>
        <button
          onClick={onResetToBook}
          className="mt-4 px-6 py-3 bg-[#002FA7] text-white rounded-2xl"
          data-testid="taxi-no-ride-book-btn"
        >
          Fahrt buchen
        </button>
      </div>
    );
  }

  const isCompleted = activeRide.status === "completed";
  const isCancelled = activeRide.status === "cancelled";
  const isStarted = activeRide.status === "started";
  const isFinished = isCompleted || isCancelled;
  const stops = activeRide.waypoints || [];
  const phoneRaw = activeRide.driver?.phone || activeRide.driver?.phone_proxy || activeRide.driver?.contact || "";
  const plate = activeRide.driver?.vehicle?.plate || "";
  const vehicleColor = activeRide.driver?.vehicle?.color || "";
  const vehicleModel = activeRide.driver?.vehicle?.model || "";

  return (
    <div className="space-y-4 pt-1 font-taxi-body">
      <div className="flex items-center justify-between">
        <span
          className={`px-3 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLORS[activeRide.status] || "bg-white/10 text-white"}`}
          data-testid="taxi-status-badge"
        >
          {STATUS_LABELS[activeRide.status] || activeRide.status}
        </span>
        {etaText != null && !isStarted && !isFinished && (
          <span className="text-xs text-[#002FA7] font-medium tabular-nums" data-testid="taxi-eta-live">
            ETA <strong className="text-[#002FA7]">{etaText}</strong>
          </span>
        )}
      </div>

      {activeRide.driver && (
        <div className="p-4 bg-zinc-50 rounded-[24px] border border-zinc-200">
          <div className="flex items-center gap-3">
            <img
              src={activeRide.driver.photo_url || "https://via.placeholder.com/60"}
              alt={activeRide.driver.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-[#002FA7]/15"
            />
            <div className="flex-1 min-w-0">
              <p className="font-taxi-heading font-black text-base text-zinc-950 truncate">{activeRide.driver.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="text-yellow-400">★</span>
                <span>{activeRide.driver.rating}</span>
                <span>·</span>
                <span>{activeRide.driver.total_rides} Fahrten</span>
              </div>
            </div>
            {phoneRaw ? (
              <a
                href={`tel:${phoneRaw.replace(/[^+0-9]/g, "")}`}
                className="w-11 h-11 bg-emerald-50 hover:bg-emerald-100 rounded-full text-emerald-600 flex items-center justify-center"
                data-testid="taxi-driver-call"
                aria-label="Fahrer anrufen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            ) : (
              <button
                disabled
                className="w-11 h-11 bg-zinc-100 rounded-full text-zinc-400 flex items-center justify-center cursor-not-allowed"
                data-testid="taxi-driver-call-disabled"
                title="Telefonnummer noch nicht freigegeben"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-200 flex items-center justify-between text-xs">
            <div className="min-w-0">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Fahrzeug</p>
              <p className="text-zinc-950 font-medium truncate">{vehicleModel || "—"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Kennzeichen</p>
              <p className="font-mono font-bold text-[#002FA7]" data-testid="taxi-driver-plate">{plate || "—"}</p>
            </div>
          </div>

          {(plate || vehicleColor || vehicleModel) && !isStarted && !isFinished && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] leading-snug text-amber-700 flex items-start gap-2" data-testid="taxi-plate-spotter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>
                Such nach <strong className="text-amber-800">{vehicleColor || ""} {vehicleModel}</strong>
                {plate && <> mit Kennzeichen <strong className="font-mono text-amber-800">{plate}</strong></>}.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-zinc-50 rounded-[24px] border border-zinc-200 space-y-3">
        <div className="flex items-start gap-3">
          <Dot color="bg-cyan-500 ring-cyan-500/20" />
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Abholung</p>
            <p className="text-sm text-zinc-950 truncate">{activeRide.pickup?.address || "—"}</p>
            {activeRide.pickup?.notes && (
              <p className="text-[11px] text-[#002FA7]/80 italic mt-0.5 truncate">↳ {activeRide.pickup.notes}</p>
            )}
          </div>
        </div>

        {stops.map((wp, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <Dot color="bg-amber-400 ring-amber-400/20" />
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Stop {idx + 1}</p>
              <p className="text-sm text-zinc-950 truncate">{wp.address}</p>
              {wp.notes && (
                <p className="text-[11px] text-amber-700/80 italic mt-0.5 truncate">↳ {wp.notes}</p>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-start gap-3">
          <Dot color="bg-red-500 ring-red-500/20" />
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Ziel</p>
            <p className="text-sm text-zinc-950 truncate">{activeRide.dropoff?.address || "—"}</p>
            {activeRide.dropoff?.notes && (
              <p className="text-[11px] text-red-500/80 italic mt-0.5 truncate">↳ {activeRide.dropoff.notes}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-zinc-50 rounded-[24px] border border-zinc-200 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {isCompleted ? "Bezahlt" : "Geschätzter Preis"}
          </p>
          <p className="text-2xl font-black text-[#002FA7] font-taxi-heading">
            €{(activeRide.final_fare || activeRide.fare_estimate || 0).toFixed(2)}
          </p>
        </div>
        <div className="text-right text-[11px] text-zinc-500 space-y-0.5">
          <p>{activeRide.distance_km_estimate ?? activeRide.distance_km ?? "—"} km</p>
          <p>~{activeRide.duration_estimate_minutes ?? activeRide.duration_min ?? "—"} Min</p>
          {activeRide.vehicle_name && <p>{activeRide.vehicle_name}</p>}
        </div>
      </div>

      {!isFinished && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-amber-700 text-xs font-medium mb-2">Demo-Steuerung</p>
          <div className="flex gap-2 flex-wrap">
            {activeRide.status === "accepted" && (
              <button
                onClick={simulateDriverArrival}
                className="px-3 py-1.5 bg-[#002FA7]/10 text-[#002FA7] rounded-lg text-xs"
                data-testid="taxi-sim-arriving"
              >
                Fahrer kommt
              </button>
            )}
            {activeRide.status === "arriving" && (
              <button
                onClick={simulateStartTrip}
                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs"
                data-testid="taxi-sim-start"
              >
                Fahrt starten
              </button>
            )}
            {isStarted && (
              <button
                onClick={simulateCompleteTrip}
                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs"
                data-testid="taxi-sim-complete"
              >
                Fahrt beenden
              </button>
            )}
          </div>
        </div>
      )}

      {!isFinished && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenLiveChat}
            className="py-3 bg-[#F6F8FF] border border-[#002FA7]/20 text-[#002FA7] rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            data-testid="taxi-livechat-btn"
          >
            💬 Chat mit Fahrer
          </button>
          <button
            onClick={onOpenSplit}
            className="py-3 bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            data-testid="taxi-split-btn"
          >
            👥 Split Pay
          </button>
        </div>
      )}

      {!['completed', 'cancelled', 'started'].includes(activeRide.status) && (
        <button
          onClick={() => (onRequestCancel ? onRequestCancel() : cancelRide())}
          disabled={loading}
          className="w-full py-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-semibold text-sm"
          data-testid="taxi-cancel-btn"
        >
          {loading ? "Wird storniert..." : "Fahrt stornieren"}
        </button>
      )}

      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-emerald-50 border border-emerald-200 rounded-[24px] text-center"
        >
          <div className="text-4xl mb-2">✅</div>
          <h3 className="text-base font-bold text-emerald-700">Fahrt abgeschlossen!</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Bezahlt: €{(activeRide.final_fare || activeRide.fare_estimate).toFixed(2)}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={onOpenReview}
              className="px-3 py-3 bg-amber-100 text-amber-700 rounded-2xl font-bold text-sm"
              data-testid="taxi-rate-after-btn"
            >
              ⭐ Bewerten
            </button>
            <button
              onClick={onResetToBook}
              className="px-3 py-3 bg-[#002FA7] rounded-2xl text-white font-bold text-sm"
              data-testid="taxi-new-ride-btn"
            >
              Neue Fahrt
            </button>
          </div>
        </motion.div>
      )}

      {isCancelled && (
        <button
          onClick={onResetToBook}
          className="w-full py-3 bg-[#002FA7] rounded-2xl text-white font-bold text-sm"
          data-testid="taxi-after-cancel-book-btn"
        >
          Neue Fahrt buchen
        </button>
      )}
    </div>
  );
}
