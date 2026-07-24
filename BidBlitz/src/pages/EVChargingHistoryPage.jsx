/**
 * EVChargingHistoryPage — Customer-facing list of past EV charging sessions.
 * GET /api/ev/history → renders cards with kWh, cost, duration, station, status.
 * PDF receipt download via /api/ev/receipt/:id/pdf when available.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Zap, Clock, MapPin, Download, ChevronRight, BatteryCharging } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_META = {
  completed: { label: "Abgeschlossen", color: "text-emerald-400", dot: "bg-emerald-400" },
  cancelled: { label: "Abgebrochen", color: "text-amber-400", dot: "bg-amber-400" },
  failed: { label: "Fehlgeschlagen", color: "text-red-400", dot: "bg-red-400" },
  settle_failed: { label: "Abrechnung offen", color: "text-orange-400", dot: "bg-orange-400" },
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
};

const fmtDuration = (min) => {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m} Min`;
};

export default function EVChargingHistoryPage({ onNavigate }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/ev/history?limit=100`, { credentials: "include" });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }
        const data = await res.json();
        if (!cancelled) setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalKwh = sessions.reduce((s, x) => s + Number(x.kwh_charged || 0), 0);
  const totalCost = sessions.reduce((s, x) => s + Number(x.final_cost || 0), 0);

  const downloadReceipt = (sessionId, receiptNo) => {
    if (!receiptNo) {
      toast.error("Keine Quittung verfügbar");
      return;
    }
    window.open(`${API}/api/ev/receipt/${sessionId}/pdf`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-5 pt-12 pb-24 max-w-2xl mx-auto">
        {/* Header */}
        <button
          onClick={() => onNavigate("/ev")}
          data-testid="ev-history-back"
          className="text-gray-400 text-sm hover:text-white transition-colors"
        >
          ← Zurück zur Karte
        </button>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <BatteryCharging className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="ev-history-title">Ladehistorie</h1>
            <p className="text-sm text-gray-400">{sessions.length} Sitzungen</p>
          </div>
        </div>

        {/* Summary */}
        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Gesamt geladen</p>
              <p className="text-2xl font-bold" data-testid="ev-history-total-kwh">
                {totalKwh.toFixed(2)} <span className="text-sm font-normal text-gray-400">kWh</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Gesamt Kosten</p>
              <p className="text-2xl font-bold text-cyan-400" data-testid="ev-history-total-cost">
                €{totalCost.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="mt-10 flex items-center justify-center" data-testid="ev-history-loading">
            <p className="text-gray-400">Lade Historie…</p>
          </div>
        )}

        {!loading && error && (
          <div
            className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300"
            data-testid="ev-history-error"
          >
            {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div
            className="mt-10 p-8 rounded-2xl bg-white/5 border border-white/10 text-center"
            data-testid="ev-history-empty"
          >
            <Zap className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-base font-semibold">Noch keine Ladevorgänge</p>
            <p className="text-sm text-gray-400 mt-1">
              Starte deine erste Session über die EV-Ladekarte.
            </p>
            <button
              onClick={() => onNavigate("/ev")}
              className="mt-5 px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
              data-testid="ev-history-go-map"
            >
              Stationen anzeigen
            </button>
          </div>
        )}

        {/* Sessions list */}
        {!loading && !error && sessions.length > 0 && (
          <div className="mt-6 space-y-3" data-testid="ev-history-list">
            {sessions.map((s, i) => {
              const meta = STATUS_META[s.status] || {
                label: s.status || "—",
                color: "text-gray-400",
                dot: "bg-gray-500",
              };
              const kwh = Number(s.kwh_charged || 0);
              const cost = Number(s.final_cost || 0);
              const receiptNo = s.receipt_no;
              return (
                <motion.div
                  key={s.session_id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                  data-testid={`ev-history-item-${i}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${meta.color}`}>
                          {meta.label}
                        </span>
                        {receiptNo && (
                          <span className="text-[10px] text-gray-500 truncate">· {receiptNo}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-300 truncate">
                        <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span className="truncate" data-testid={`ev-history-cp-${i}`}>
                          {s.charge_point_id} · Stecker {s.connector_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{fmtDate(s.started_at || s.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-cyan-400" data-testid={`ev-history-cost-${i}`}>
                        €{cost.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{kwh.toFixed(2)} kWh</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span>Dauer: {fmtDuration(s.duration_min)}</span>
                      {s.settlement_ref && (
                        <span className="truncate">Ref. {s.settlement_ref}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {receiptNo && (
                        <button
                          onClick={() => downloadReceipt(s.session_id, receiptNo)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
                          data-testid={`ev-history-pdf-${i}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate(`/ev/session/${s.session_id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs font-semibold hover:bg-white/10 transition-colors"
                        data-testid={`ev-history-detail-${i}`}
                      >
                        Details
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
