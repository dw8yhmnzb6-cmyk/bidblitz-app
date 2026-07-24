/**
 * StaffShiftAssistant — AI-Schichtplan-Empfehlungen (P3)
 * Liest /api/staff/shift-assistant/suggestions, gruppiert nach Wochentag,
 * zeigt empfohlene Schichten + Unterbesetzungs-Warnungen.
 */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Loader2, Sparkles, AlertTriangle, Users, Clock, TrendingUp, Send, Check, X } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const CONFIDENCE_STYLE = {
  high: "border-emerald-500/30 bg-emerald-500/5",
  low: "border-amber-500/30 bg-amber-500/5",
};

export default function StaffShiftAssistant() {
  const [days, setDays] = useState(30);
  const [coverage, setCoverage] = useState(1.1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [published, setPublished] = useState([]);
  const [publishingKey, setPublishingKey] = useState(null);

  const loadPublished = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/staff/shift-assistant/open-shifts`, { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        setPublished(j.items || []);
      }
    } catch {}
  }, []);

  useEffect(() => { loadPublished(); }, [loadPublished]);

  const isAlreadyPublished = useCallback(
    (s) => published.some(
      (p) => p.status !== "cancelled"
        && p.weekday === s.weekday
        && p.start_hour === s.start_hour
        && p.end_hour === s.end_hour,
    ),
    [published],
  );

  const publish = async (s) => {
    const key = `${s.weekday}-${s.start_hour}-${s.end_hour}`;
    setPublishingKey(key);
    try {
      const r = await fetch(`${API}/api/staff/shift-assistant/open-shifts/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekday: s.weekday,
          start_hour: s.start_hour,
          end_hour: s.end_hour,
          needed_staff: s.needed_staff,
          note: s.reason || "",
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      toast.success(`Open Shift ${s.weekday_label} ${s.start_hour}–${s.end_hour} publiziert`);
      loadPublished();
    } catch (e) {
      toast.error(e?.message || "Fehler beim Publizieren");
    } finally {
      setPublishingKey(null);
    }
  };

  const cancelPublished = async (id) => {
    try {
      const r = await fetch(`${API}/api/staff/shift-assistant/open-shifts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Open Shift storniert");
      loadPublished();
    } catch (e) {
      toast.error(e?.message || "Fehler");
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ days: String(days), coverage: String(coverage) });
        const r = await fetch(`${API}/api/staff/shift-assistant/suggestions?${qs}`, {
          credentials: "include",
          signal: ac.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setData(json);
        setError(null);
      } catch (e) {
        if (e.name !== "AbortError") setError(e?.message || "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [days, coverage]);

  const byWeekday = useMemo(() => {
    const m = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    (data?.suggestions || []).forEach((s) => m[s.weekday].push(s));
    return m;
  }, [data]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1019] p-4" data-testid="staff-shift-assistant">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/30 to-cyan-500/20 border border-purple-500/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-tight">AI-Schichtplan-Assistent</h3>
            <p className="text-[10px] text-white/50">Empfehlung aus historischer Heatmap</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                days === d ? "bg-cyan-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
              data-testid={`shift-assist-days-${d}`}
            >
              {d}T
            </button>
          ))}
        </div>
      </div>

      {/* Coverage slider */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <Users className="w-3.5 h-3.5 text-white/50 shrink-0" />
        <input
          type="range"
          min="1.0" max="2.0" step="0.05"
          value={coverage}
          onChange={(e) => setCoverage(parseFloat(e.target.value))}
          className="flex-1 accent-cyan-500"
          data-testid="shift-assist-coverage"
        />
        <span className="text-[10px] font-bold text-cyan-300 tabular-nums shrink-0">
          {coverage.toFixed(2)}× Coverage
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        </div>
      )}
      {error && (
        <div className="text-center text-xs text-red-400 py-6" data-testid="shift-assist-error">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center" data-testid="shift-assist-kpi-shifts">
              <p className="text-base font-extrabold text-cyan-300 leading-none">{data.totals.shifts}</p>
              <p className="text-[9px] text-white/55 uppercase tracking-wider mt-1">Schichten</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center" data-testid="shift-assist-kpi-hours">
              <p className="text-base font-extrabold text-emerald-300 leading-none">{data.totals.weekly_staff_hours}h</p>
              <p className="text-[9px] text-white/55 uppercase tracking-wider mt-1">Personal/Wo.</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2 text-center" data-testid="shift-assist-kpi-warnings">
              <p className={`text-base font-extrabold leading-none ${data.totals.warnings > 0 ? "text-amber-300" : "text-white/40"}`}>
                {data.totals.warnings}
              </p>
              <p className="text-[9px] text-white/55 uppercase tracking-wider mt-1">Warnungen</p>
            </div>
          </div>

          {/* Suggestions by weekday */}
          <div className="space-y-3" data-testid="shift-assist-suggestions">
            {WEEKDAYS.map((label, w) => {
              const shifts = byWeekday[w];
              if (!shifts || shifts.length === 0) return null;
              return (
                <div key={w}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 text-[11px] font-bold text-white/80">{label}</span>
                    <span className="text-[10px] text-white/40">{shifts.length} Schicht{shifts.length !== 1 ? "en" : ""}</span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {shifts.map((s, i) => {
                      const key = `${s.weekday}-${s.start_hour}-${s.end_hour}`;
                      const alreadyPub = isAlreadyPublished(s);
                      const busy = publishingKey === key;
                      return (
                        <div
                          key={`${w}-${i}`}
                          className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 ${CONFIDENCE_STYLE[s.confidence] || CONFIDENCE_STYLE.low}`}
                          data-testid={`shift-assist-suggestion-${w}-${i}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-white/50 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white">
                                {String(s.start_hour).padStart(2, "0")}:00 – {String(s.end_hour).padStart(2, "0")}:00
                                <span className="text-white/40 font-normal ml-1.5">({s.duration_h}h)</span>
                              </p>
                              <p className="text-[10px] text-white/55 truncate">
                                ø {s.avg_demand.toFixed(1)} aktiv · Peak {s.peak_demand}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-cyan-300" />
                              <span className="text-sm font-extrabold text-cyan-300 tabular-nums">{s.needed_staff}</span>
                            </div>
                            {alreadyPub ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold"
                                data-testid={`shift-assist-published-${w}-${i}`}
                              >
                                <Check className="w-3 h-3" /> Live
                              </span>
                            ) : (
                              <button
                                onClick={() => publish(s)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black text-[10px] font-extrabold transition-colors"
                                data-testid={`shift-assist-publish-${w}-${i}`}
                                title="Als Open Shift publizieren"
                              >
                                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Publizieren
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {data.totals.shifts === 0 && (
              <div className="text-center text-xs text-white/45 py-6">
                Noch nicht genug Daten — sammle Clock-Events der letzten Tage, dann generiert der Assistent Vorschläge.
              </div>
            )}
          </div>

          {/* Warnings */}
          {data.warnings && data.warnings.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <h4 className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Unterbesetzungs-Warnungen
                </h4>
              </div>
              <div className="space-y-1" data-testid="shift-assist-warnings">
                {data.warnings.slice(0, 6).map((w, i) => (
                  <div
                    key={i}
                    className="text-[11px] text-white/65 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15"
                    data-testid={`shift-assist-warning-${i}`}
                  >
                    {w.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Open Shifts (manager view) */}
          {published.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <Send className="w-3.5 h-3.5 text-cyan-300" />
                <h4 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                  Live Open Shifts ({published.filter((p) => p.status !== "cancelled").length})
                </h4>
              </div>
              <div className="space-y-1.5" data-testid="shift-assist-published-list">
                {published.filter((p) => p.status !== "cancelled").map((p) => {
                  const filled = (p.claimed_by || []).length;
                  const isFilled = p.status === "filled";
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 ${
                        isFilled ? "bg-emerald-500/5 border-emerald-500/25" : "bg-cyan-500/5 border-cyan-500/25"
                      }`}
                      data-testid={`shift-assist-published-row-${p.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">
                          {p.weekday_label} {p.shift_date.slice(5)} · {String(p.start_hour).padStart(2, "0")}:00–{String(p.end_hour).padStart(2, "0")}:00
                        </p>
                        <p className="text-[10px] text-white/55">
                          {filled}/{p.needed_staff} besetzt {isFilled && "✓"}
                        </p>
                      </div>
                      <button
                        onClick={() => cancelPublished(p.id)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 flex items-center justify-center transition-colors"
                        data-testid={`shift-assist-cancel-${p.id}`}
                        title="Storno"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer hint */}
          <p className="mt-3 text-[10px] text-white/35 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Basierend auf {data.days} Tagen Clock-Daten · Coverage-Faktor {data.coverage_factor}×
          </p>
        </>
      )}
    </div>
  );
}
