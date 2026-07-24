import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { STATUS_COLORS, STATUS_LABELS, VEHICLE_ICONS } from './TaxiConstants';

const FILTERS = [
  { key: 'all',       label: 'Alle' },
  { key: 'week',      label: 'Diese Woche' },
  { key: 'business',  label: 'Geschäftlich' },
  { key: 'cancelled', label: 'Storniert' },
];

function startOfWeekISO() {
  const d = new Date();
  const day = d.getDay() || 7; // Mo=1..So=7
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString();
}

/**
 * Ride history view extracted from TaxiPage.jsx (iter57c).
 * Stateless — receives all data via props. Filter-Tabs added in iter124 Phase C.
 */
export default function TaxiHistoryView({ rideHistory, onRefresh, onReview }) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return rideHistory;
    if (filter === 'cancelled') return rideHistory.filter((r) => r.status === 'cancelled');
    if (filter === 'business') {
      return rideHistory.filter((r) =>
        r.corporate_account_id || r.cost_center || r.is_business || r.taxi_type === 'business'
      );
    }
    if (filter === 'week') {
      const cut = startOfWeekISO();
      return rideHistory.filter((r) => (r.created_at || '') >= cut);
    }
    return rideHistory;
  }, [rideHistory, filter]);

  const counts = useMemo(() => {
    const cut = startOfWeekISO();
    return {
      all: rideHistory.length,
      week: rideHistory.filter((r) => (r.created_at || '') >= cut).length,
      business: rideHistory.filter((r) =>
        r.corporate_account_id || r.cost_center || r.is_business || r.taxi_type === 'business'
      ).length,
      cancelled: rideHistory.filter((r) => r.status === 'cancelled').length,
    };
  }, [rideHistory]);

  const totalSpent = filtered
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + (r.final_fare || r.fare_estimate || 0), 0);

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
      data-testid="taxi-history-view"
    >
      {/* Stats Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
          <p className="text-[10px] text-cyan-400/70 uppercase tracking-wider font-semibold mb-1">Fahrten gesamt</p>
          <p className="text-2xl font-bold text-white tabular-nums">{filtered.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
          <p className="text-[10px] text-purple-400/70 uppercase tracking-wider font-semibold mb-1">Ausgegeben</p>
          <p className="text-2xl font-bold text-white tabular-nums">€{totalSpent.toFixed(2)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" data-testid="taxi-history-filters">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const c = counts[f.key] || 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`taxi-history-filter-${f.key}`}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-cyan-500 text-black border-cyan-400'
                  : 'bg-white/[0.04] text-gray-300 border-white/[0.06] hover:bg-white/[0.08]'
              }`}
            >
              {f.label}
              <span className={`text-[10px] tabular-nums ${active ? 'text-black/70' : 'text-gray-500'}`}>{c}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-bold text-white">Deine Fahrten</h3>
        <button
          data-testid="taxi-history-refresh"
          onClick={onRefresh}
          className="text-xs text-cyan-400 font-semibold"
        >
          ↻ Aktualisieren
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.02]" data-testid="taxi-history-empty">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M3 6h18M3 12h18M3 18h12" />
            </svg>
          </div>
          <p className="text-gray-300 text-sm font-medium mb-1">
            {filter === 'all' ? 'Noch keine Fahrten' : 'Keine Fahrten in dieser Auswahl'}
          </p>
          <p className="text-xs text-gray-500">
            {filter === 'all'
              ? 'Deine abgeschlossenen Fahrten erscheinen hier'
              : 'Versuche einen anderen Filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ride, idx) => {
            const dateStr = ride.created_at
              ? new Date(ride.created_at).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';
            const fare = ride.final_fare || ride.fare_estimate || 0;
            const isCancelled = ride.status === 'cancelled';
            const rideKey = ride.ride_id || ride.id || `ride-${idx}-${ride.created_at || ''}`;
            return (
              <div
                key={rideKey}
                className="p-4 rounded-2xl bg-[#0e0e10] border border-white/5 hover:border-cyan-500/20 transition-colors"
                data-testid={`taxi-history-card-${idx}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500">{dateStr}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_COLORS[ride.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {STATUS_LABELS[ride.status] || ride.status}
                  </span>
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <div className="w-px flex-1 bg-white/10 my-1" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Start</p>
                      <p className="text-sm text-white truncate">{ride.pickup?.address || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Ziel</p>
                      <p className="text-sm text-white truncate">{ride.dropoff?.address || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{VEHICLE_ICONS[ride.vehicle_type] || ''}</span>
                    <span className="font-medium">{ride.vehicle_name || ride.vehicle_type || 'Standard'}</span>
                    {ride.distance_km != null && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span>{Number(ride.distance_km).toFixed(1)} km</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCancelled ? (
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-500 line-through tabular-nums">€{fare.toFixed(2)}</span>
                        <p className="text-[10px] text-red-300/80">nicht berechnet</p>
                      </div>
                    ) : (
                      <span className="text-base font-bold text-cyan-400 tabular-nums">€{fare.toFixed(2)}</span>
                    )}
                    {ride.status === 'completed' && (
                      <button
                        data-testid={`taxi-review-btn-${rideKey}`}
                        onClick={() => onReview && onReview(ride.ride_id)}
                        className="w-8 h-8 rounded-lg bg-yellow-500/15 text-yellow-400 text-sm flex items-center justify-center hover:bg-yellow-500/25 transition-colors"
                        title="Bewerten"
                      >★</button>
                    )}
                    {ride.status === 'completed' && (
                      <a
                        data-testid={`taxi-pdf-receipt-${rideKey}`}
                        href={`${process.env.REACT_APP_BACKEND_URL}/api/taxi/rides/${ride.ride_id}/receipt.pdf`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 transition-colors"
                        title="PDF-Quittung herunterladen"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
