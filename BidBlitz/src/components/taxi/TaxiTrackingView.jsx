/**
 * TaxiTrackingView — Live ride tracking, driver info, route, fare, actions.
 * Extracted from TaxiPage.jsx.
 */
import React from "react";
import { motion } from "framer-motion";
import { STATUS_COLORS, STATUS_LABELS } from "./TaxiConstants";

export default function TaxiTrackingView({
  activeRide,
  loading,
  cancelRide,
  simulateDriverArrival,
  simulateStartTrip,
  simulateCompleteTrip,
  onOpenLiveChat,
  onOpenSplit,
  onOpenReview,
  onResetToBook,
}) {
  return (
    <motion.div
      key="tracking"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {activeRide ? (
        <>
          {/* Live Map (placeholder) */}
          <div className="relative h-56 bg-[#111] rounded-2xl overflow-hidden border border-white/10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-3">
                  {activeRide.status === "started" ? "🚗💨" : "📍"}
                </div>
                <p className="text-gray-400">Live Tracking</p>
              </div>
            </div>
            <div className="absolute top-4 left-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[activeRide.status]}`}
                data-testid="taxi-status-badge"
              >
                {STATUS_LABELS[activeRide.status]}
              </span>
            </div>
          </div>

          {/* Driver Info */}
          {activeRide.driver && (
            <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
              <div className="flex items-center gap-4">
                <img
                  src={activeRide.driver.photo_url || "https://via.placeholder.com/60"}
                  alt={activeRide.driver.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/30"
                />
                <div className="flex-1">
                  <p className="font-bold text-lg">{activeRide.driver.name}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="text-yellow-400">★</span>
                    <span>{activeRide.driver.rating}</span>
                    <span>•</span>
                    <span>{activeRide.driver.total_rides} Fahrten</span>
                  </div>
                </div>
                <button
                  className="p-3 bg-green-500/20 rounded-full text-green-400"
                  data-testid="taxi-driver-call"
                  type="button"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Fahrzeug</p>
                  <p className="font-semibold">{activeRide.driver.vehicle?.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Kennzeichen</p>
                  <p className="font-mono font-bold text-cyan-400">{activeRide.driver.vehicle?.plate}</p>
                </div>
              </div>

              {activeRide.driver.eta_minutes && activeRide.status !== "started" && (
                <div className="mt-4 p-3 bg-cyan-500/10 rounded-xl text-center">
                  <p className="text-cyan-400 font-bold text-2xl">{activeRide.driver.eta_minutes} Min</p>
                  <p className="text-sm text-gray-400">bis zur Ankunft</p>
                </div>
              )}
            </div>
          )}

          {/* Route Info */}
          <div className="p-4 bg-[#111] rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
              <div>
                <p className="text-gray-400 text-sm">Abholung</p>
                <p className="font-medium">{activeRide.pickup?.address || "Startpunkt"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
              <div>
                <p className="text-gray-400 text-sm">Ziel</p>
                <p className="font-medium">{activeRide.dropoff?.address || "Zielpunkt"}</p>
              </div>
            </div>
          </div>

          {/* Fare Info */}
          <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Geschätzter Preis</span>
              <span className="text-2xl font-bold text-cyan-400">
                €{(activeRide.final_fare || activeRide.fare_estimate || 0).toFixed(2)}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-500">
              <span>{activeRide.distance_km} km</span>
              <span>~{activeRide.duration_min} Min</span>
              <span>{activeRide.vehicle_name}</span>
            </div>
          </div>

          {/* Demo Controls */}
          {activeRide.status !== "completed" && activeRide.status !== "cancelled" && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-400 text-sm font-medium mb-3">Demo Steuerung:</p>
              <div className="flex gap-2 flex-wrap">
                {activeRide.status === "accepted" && (
                  <button
                    onClick={simulateDriverArrival}
                    className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm"
                    data-testid="taxi-sim-arriving"
                  >
                    Fahrer kommt
                  </button>
                )}
                {activeRide.status === "arriving" && (
                  <button
                    onClick={simulateStartTrip}
                    className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm"
                    data-testid="taxi-sim-start"
                  >
                    Fahrt starten
                  </button>
                )}
                {activeRide.status === "started" && (
                  <button
                    onClick={simulateCompleteTrip}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm"
                    data-testid="taxi-sim-complete"
                  >
                    Fahrt beenden
                  </button>
                )}
              </div>
            </div>
          )}

          {!["completed", "cancelled"].includes(activeRide.status) && (
            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="taxi-livechat-btn"
                onClick={onOpenLiveChat}
                className="py-3 bg-[#121218] border border-[#00C2FF]/40 text-[#00C2FF] rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                💬 Chat mit Fahrer
              </button>
              <button
                data-testid="taxi-split-btn"
                onClick={onOpenSplit}
                className="py-3 bg-[#121218] border border-purple-500/40 text-purple-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                👥 Split Pay
              </button>
            </div>
          )}

          {!["completed", "cancelled", "started"].includes(activeRide.status) && (
            <button
              onClick={cancelRide}
              disabled={loading}
              className="w-full py-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold"
              data-testid="taxi-cancel-btn"
            >
              {loading ? "Wird storniert..." : "Fahrt stornieren"}
            </button>
          )}

          {activeRide.status === "completed" && (
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-emerald-400">Fahrt abgeschlossen!</h3>
              <p className="text-gray-400 mt-2">
                Bezahlt: €{(activeRide.final_fare || activeRide.fare_estimate).toFixed(2)}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  data-testid="taxi-rate-after-btn"
                  onClick={onOpenReview}
                  className="px-4 py-3 bg-yellow-500/20 text-yellow-400 rounded-xl font-bold"
                >
                  ⭐ Bewerten
                </button>
                <button
                  onClick={onResetToBook}
                  className="px-4 py-3 bg-cyan-500 rounded-xl text-black font-semibold"
                  data-testid="taxi-new-ride-btn"
                >
                  Neue Fahrt
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🚕</div>
          <p className="text-gray-400">Keine aktive Fahrt</p>
          <button
            onClick={onResetToBook}
            className="mt-4 px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl"
            data-testid="taxi-no-ride-book-btn"
          >
            Fahrt buchen
          </button>
        </div>
      )}
    </motion.div>
  );
}
