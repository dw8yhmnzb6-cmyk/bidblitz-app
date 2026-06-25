import { motion } from 'framer-motion';
import { MessageCircle, Phone, Share2 } from 'lucide-react';

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

export default function ActiveRideTracker({
  ride,
  onCancel,
  onOpenLiveChat,
  onCallDriver,
  onShareTrip,
  onOpenSplit,
  onSimulateArrival,
  onSimulateStart,
  onSimulateComplete,
  canCall = false,
  liveMovementLabel = '',
  loading = false,
}) {
  if (!ride) return null;

  const status = ride.status || 'requested';
  const canCancel = ['requested', 'accepted', 'arriving'].includes(status);
  const driverName = ride.driver_name || ride.driver?.name || 'Fahrer';
  const driverRating = Number(ride.driver_rating || ride.driver?.rating || 5);
  const vehicleModel = ride.vehicle_model || ride.driver?.vehicle?.model || '—';
  const vehiclePlate = ride.vehicle_plate || ride.driver?.vehicle?.plate || '—';
  const pickupAddress = ride.pickup_address || ride.pickup?.address || 'Aktueller Standort';
  const dropoffAddress = ride.dropoff_address || ride.dropoff?.address || '—';
  const price = Number(ride.estimated_price || ride.final_fare || ride.fare_estimate || ride.estimated_fare || 0);
  const etaMinutes = ride.eta_minutes || ride.driver?.eta_minutes || 0;
  const showDemoControls = Boolean(
    (status === 'accepted' && onSimulateArrival)
    || (status === 'arriving' && onSimulateStart)
    || (status === 'started' && onSimulateComplete),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
      data-testid="taxi-active-ride-tracker"
    >
      <div className="mb-6 flex items-center justify-center">
        <span className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold ${STATUS_COLORS[status]}`} data-testid="taxi-active-ride-status-badge">
          <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
          {STATUS_LABELS[status]}
        </span>
      </div>

      {liveMovementLabel ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-300" data-testid="taxi-active-ride-live-movement-banner">
          {liveMovementLabel}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-2xl font-bold text-cyan-300" data-testid="taxi-active-ride-driver-avatar">
            {driverName.charAt(0)}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white" data-testid="taxi-active-ride-driver-name">{driverName}</h3>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`h-3.5 w-3.5 ${i < Math.floor(driverRating) ? 'text-yellow-400' : 'text-gray-600'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="ml-1.5 text-xs text-gray-400" data-testid="taxi-active-ride-driver-rating">{driverRating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-white/5 p-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Fahrzeug</p>
            <p className="text-sm font-medium text-white" data-testid="taxi-active-ride-vehicle-model">{vehicleModel}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Kennzeichen</p>
            <p className="font-mono text-sm font-medium text-white" data-testid="taxi-active-ride-vehicle-plate">{vehiclePlate}</p>
          </div>
        </div>

        {etaMinutes && status === 'arriving' ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
            <span className="text-sm font-medium text-cyan-300">Ankunft in</span>
            <span className="text-2xl font-bold text-cyan-400" data-testid="taxi-active-ride-driver-eta">{etaMinutes} Min</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#111] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
            <div className="h-3 w-3 rounded-full bg-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Abholung</p>
            <p className="text-sm font-medium text-white" data-testid="taxi-active-ride-pickup-address">{pickupAddress}</p>
          </div>
        </div>

        <div className="h-6 border-l-2 border-dashed border-gray-700 pl-4" />

        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20">
            <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Ziel</p>
            <p className="text-sm font-medium text-white" data-testid="taxi-active-ride-dropoff-address">{dropoffAddress}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Geschätzter Preis</span>
          <span className="text-2xl font-bold text-cyan-400" data-testid="taxi-active-ride-estimated-price">€{price.toFixed(2)}</span>
        </div>
        {ride.surge_multiplier > 1 ? (
          <p className="mt-2 text-xs text-yellow-400">🔥 {ride.surge_multiplier}x Surge aktiv</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={onOpenLiveChat}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white"
          data-testid="taxi-active-ride-chat-button"
        >
          <MessageCircle className="h-4 w-4" />
          Chat
        </button>
        <button
          onClick={onCallDriver}
          disabled={!canCall}
          className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 py-3 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="taxi-active-ride-call-button"
        >
          <Phone className="h-4 w-4" />
          Anrufen
        </button>
        <button
          onClick={onShareTrip}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white"
          data-testid="taxi-active-ride-share-button"
        >
          <Share2 className="h-4 w-4" />
          Teilen
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {status === 'completed' ? (
          <button
            onClick={onOpenSplit}
            className="rounded-xl border border-purple-500/30 bg-purple-500/20 px-5 py-3 text-sm font-semibold text-purple-300"
            data-testid="taxi-active-ride-split-button"
          >
            💳 Teilen
          </button>
        ) : null}
        {canCancel ? (
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-red-500/30 bg-red-500/20 px-6 py-3 text-sm font-semibold text-red-400 disabled:opacity-50"
            data-testid="taxi-active-ride-cancel-button"
          >
            {loading ? '...' : 'Stornieren'}
          </button>
        ) : null}
      </div>

      {status !== 'completed' && status !== 'cancelled' && showDemoControls ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-[10px] uppercase tracking-wide text-gray-500">Demo-Simulation</p>
          <div className="flex flex-wrap gap-2">
            {status === 'accepted' && onSimulateArrival ? (
              <button
                onClick={onSimulateArrival}
                className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400"
              >
                → Fahrer kommt
              </button>
            ) : null}
            {status === 'arriving' && onSimulateStart ? (
              <button
                onClick={onSimulateStart}
                className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400"
              >
                → Fahrt starten
              </button>
            ) : null}
            {status === 'started' && onSimulateComplete ? (
              <button
                onClick={onSimulateComplete}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400"
              >
                → Abschließen
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}