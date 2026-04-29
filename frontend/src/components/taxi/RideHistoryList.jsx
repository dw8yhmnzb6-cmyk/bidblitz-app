import React from 'react';
import { motion } from 'framer-motion';
import VehicleIcon from './VehicleIcon';

// Status Colors
const STATUS_COLORS = {
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

/**
 * RideHistoryList — Fahrtenverlauf
 */
export default function RideHistoryList({ rides, onReview }) {
  if (!rides || rides.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🚕</div>
        <p className="text-gray-400">Noch keine Fahrten</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <h3 className="font-semibold text-gray-300">Deine Fahrten</h3>

      {rides.map((ride) => (
        <div
          key={ride.ride_id}
          className="bg-[#111] rounded-2xl border border-white/10 p-4"
        >
          <div className="flex items-start gap-4 mb-4">
            {/* Vehicle Icon */}
            <div className="flex-shrink-0 mt-1">
              <VehicleIcon type={ride.vehicle_type || 'standard'} className="w-16 h-8" />
            </div>

            {/* Ride Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500">
                  {new Date(ride.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${STATUS_COLORS[ride.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {ride.status === 'completed' ? 'Abgeschlossen' : ride.status === 'cancelled' ? 'Storniert' : ride.status}
                </span>
              </div>

              {/* Route */}
              <div className="space-y-1 mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-white truncate">{ride.pickup_address || 'Startpunkt'}</p>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-2 h-2 text-purple-400 mt-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  <p className="text-xs text-gray-400 truncate">{ride.dropoff_address || 'Ziel'}</p>
                </div>
              </div>

              {/* Price & Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {ride.distance_km > 0 && <span>📍 {ride.distance_km.toFixed(1)} km</span>}
                  {ride.duration_minutes > 0 && <span>⏱️ {ride.duration_minutes} Min</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-cyan-400">€{(ride.total_price || 0).toFixed(2)}</span>
                  {ride.status === 'completed' && (
                    <button
                      onClick={() => onReview(ride.ride_id)}
                      className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold"
                      data-testid={`review-btn-${ride.ride_id}`}
                    >
                      ⭐ Bewerten
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
