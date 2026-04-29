import React from 'react';
import { motion } from 'framer-motion';

// Status badge colors & labels
const STATUS_COLORS = {
  requested: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-blue-500/20 text-blue-400',
  arriving: 'bg-cyan-500/20 text-cyan-400',
  started: 'bg-green-500/20 text-green-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS = {
  requested: 'Suche Fahrer...',
  accepted: 'Fahrer gefunden',
  arriving: 'Fahrer kommt',
  started: 'Fahrt läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

/**
 * ActiveRideTracker — Live-Fahrt-Anzeige mit Fahrer-Info & Status
 */
export default function ActiveRideTracker({
  ride,
  onCancel,
  onOpenLiveChat,
  onOpenSplit,
  onSimulateArrival,
  onSimulateStart,
  onSimulateComplete,
  loading = false,
}) {
  if (!ride) return null;

  const status = ride.status || 'requested';
  const canCancel = ['requested', 'accepted', 'arriving'].includes(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Status Badge */}
      <div className="flex items-center justify-center mb-6">
        <span className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold ${STATUS_COLORS[status]}`}>
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Driver Card */}
      {ride.driver_name && (
        <div className="bg-[#111] rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-2xl font-bold text-cyan-300">
              {ride.driver_name.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">{ride.driver_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.floor(ride.driver_rating || 5) ? 'text-yellow-400' : 'text-gray-600'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-1.5 text-xs text-gray-400">{(ride.driver_rating || 5.0).toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Fahrzeug</p>
              <p className="text-sm font-medium text-white">{ride.vehicle_model || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Kennzeichen</p>
              <p className="text-sm font-medium text-white font-mono">{ride.vehicle_plate || '—'}</p>
            </div>
          </div>

          {ride.eta_minutes && status === 'arriving' && (
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-between">
              <span className="text-sm text-cyan-300 font-medium">Ankunft in</span>
              <span className="text-2xl font-bold text-cyan-400">{ride.eta_minutes} Min</span>
            </div>
          )}
        </div>
      )}

      {/* Route Info */}
      <div className="bg-[#111] rounded-2xl border border-white/10 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Abholung</p>
            <p className="text-sm text-white font-medium">{ride.pickup_address || 'Aktueller Standort'}</p>
          </div>
        </div>

        <div className="pl-4 border-l-2 border-dashed border-gray-700 h-6" />

        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Ziel</p>
            <p className="text-sm text-white font-medium">{ride.dropoff_address || '—'}</p>
          </div>
        </div>
      </div>

      {/* Cost */}
      <div className="bg-[#111] rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Geschätzter Preis</span>
          <span className="text-2xl font-bold text-cyan-400">€{(ride.estimated_price || 0).toFixed(2)}</span>
        </div>
        {ride.surge_multiplier > 1 && (
          <p className="text-xs text-yellow-400 mt-2">🔥 {ride.surge_multiplier}x Surge aktiv</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onOpenLiveChat}
          className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat
        </button>
        {status === 'completed' && (
          <button
            onClick={onOpenSplit}
            className="flex-1 py-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 font-semibold text-sm"
          >
            💳 Teilen
          </button>
        )}
        {canCancel && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold text-sm disabled:opacity-50"
          >
            {loading ? '...' : 'Stornieren'}
          </button>
        )}
      </div>

      {/* Demo Sim Buttons */}
      {status !== 'completed' && status !== 'cancelled' && (
        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-3">Demo-Simulation</p>
          <div className="flex flex-wrap gap-2">
            {status === 'accepted' && (
              <button
                onClick={onSimulateArrival}
                className="px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-xs font-medium"
              >
                → Fahrer kommt
              </button>
            )}
            {status === 'arriving' && (
              <button
                onClick={onSimulateStart}
                className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs font-medium"
              >
                → Fahrt starten
              </button>
            )}
            {status === 'started' && (
              <button
                onClick={onSimulateComplete}
                className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium"
              >
                → Abschließen
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
