/**
 * StaffShiftHeatmap — 7×24 Grid mit avg. concurrent staff pro Stunden-Slot.
 * Farb-Gradient: dunkelblau (0) → cyan (mid) → amber → rot (peak)
 * Filter: Tage (7/14/30/90), Geofence.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp, Users, Clock } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function cellColor(avg, peak) {
  if (!avg || avg <= 0) return "rgba(255,255,255,0.025)";
  const t = Math.min(1, avg / Math.max(peak, 1));
  // 0 → #0E1626 (dark navy), 0.4 → #00C2FF, 0.7 → #F59E0B, 1 → #EF4444
  if (t < 0.4) {
    const k = t / 0.4;
    return `rgba(0,${Math.round(120 + 74 * k)},${Math.round(255 * (0.5 + 0.5 * k))},${0.18 + 0.35 * k})`;
  } else if (t < 0.7) {
    const k = (t - 0.4) / 0.3;
    return `rgba(${Math.round(0 + 245 * k)},${Math.round(194 - 36 * k)},${Math.round(255 * (1 - k))},${0.55 + 0.25 * k})`;
  } else {
    const k = (t - 0.7) / 0.3;
    return `rgba(${Math.round(245 + 10 * k)},${Math.round(158 - 90 * k)},${Math.round(11 + 57 * k)},${0.8 + 0.2 * k})`;
  }
}

export default function StaffShiftHeatmap() {
  const [days, setDays] = useState(30);
  const [geofenceId, setGeofenceId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null); // {weekday, hour, avg, max, total_minutes}

  const fetchData = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (geofenceId) qs.set("geofence_id", geofenceId);
      const r = await fetch(`${API}/api/staff/heatmap/shifts?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [days, geofenceId]);

  const matrix = data?.matrix || [];
  const peakValue = useMemo(() => {
    if (matrix.length === 0) return 1;
    return Math.max(...matrix.map((c) => c.avg)) || 1;
  }, [matrix]);

  const grid = useMemo(() => {
    // [weekday][hour] = cell
    const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => null));
    matrix.forEach((c) => { g[c.weekday][c.hour] = c; });
    return g;
  }, [matrix]);

  return (
    <div className="space-y-4" data-testid="shift-heatmap">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-0.5">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              data-testid={`heatmap-days-${d}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                days === d ? "bg-cyan-500 text-black" : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {d}T
            </button>
          ))}
        </div>
        {data?.geofences?.length > 0 && (
          <select
            value={geofenceId}
            onChange={(e) => setGeofenceId(e.target.value)}
            data-testid="heatmap-geofence-select"
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="">Alle Standorte</option>
            {data.geofences.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
        {data?.totals && (
          <div className="ml-auto flex items-center gap-3 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {data.totals.total_hours}h</span>
            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {data.totals.unique_staff}</span>
            <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {data.totals.shifts_completed} Schichten</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300" data-testid="heatmap-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-3">
          {/* Grid */}
          <div className="overflow-x-auto -mx-2 px-2" data-testid="heatmap-grid">
            <div className="inline-block min-w-full">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "32px repeat(24, minmax(20px, 1fr))" }}>
                {/* Hour header */}
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={`h-${h}`} className="text-[9px] text-gray-500 text-center font-semibold tabular-nums">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
                {/* Rows */}
                {grid.map((row, w) => (
                  <React.Fragment key={`r-${w}`}>
                    <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-end pr-1">
                      {WEEKDAYS[w]}
                    </div>
                    {row.map((c, h) => {
                      const avg = c?.avg || 0;
                      const isUnder = c && c.samples > 0 && avg < (data.thresholds?.under ?? 2);
                      const isPeak = avg >= (data.thresholds?.peak ?? 5);
                      return (
                        <button
                          key={`c-${w}-${h}`}
                          onClick={() => setHovered(c)}
                          data-testid={`heatmap-cell-${w}-${h}`}
                          className={`aspect-square min-h-[20px] rounded-[3px] transition-all hover:ring-2 hover:ring-cyan-400/60 ${
                            isUnder ? "ring-1 ring-red-500/40" : ""
                          } ${isPeak ? "ring-1 ring-amber-300/60" : ""}`}
                          style={{ background: cellColor(avg, peakValue) }}
                          title={c ? `${WEEKDAYS[w]} ${h}:00 — Ø ${avg} Personen, max ${c.max}` : ""}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Legend + Hover info */}
          <div className="flex items-center justify-between gap-3 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <span>Weniger</span>
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: cellColor(0.3, peakValue) }} />
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: cellColor(peakValue * 0.5, peakValue) }} />
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: cellColor(peakValue * 0.8, peakValue) }} />
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: cellColor(peakValue, peakValue) }} />
              <span>Mehr</span>
            </div>
            {hovered && (
              <div className="text-white font-medium" data-testid="heatmap-hover-info">
                {WEEKDAYS[hovered.weekday]} {String(hovered.hour).padStart(2, "0")}:00 ·{" "}
                <span className="text-cyan-300">Ø {hovered.avg}</span> · max {hovered.max} · {hovered.total_minutes}min
              </div>
            )}
          </div>

          {/* Insights */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-red-500/[0.06] border border-red-500/20 p-3" data-testid="heatmap-under-list">
              <p className="text-[10px] uppercase tracking-widest font-bold text-red-300 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Unterbesetzt (Ø &lt; {data.thresholds?.under ?? 2})
              </p>
              {data.under_staffed.length === 0 && (
                <p className="text-xs text-gray-400">Keine kritischen Slots — gut ausgelastet 👌</p>
              )}
              <div className="space-y-1">
                {data.under_staffed.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/90">
                      {WEEKDAYS[c.weekday]} {String(c.hour).padStart(2, "0")}:00
                    </span>
                    <span className="text-red-300 font-semibold tabular-nums">Ø {c.avg}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 p-3" data-testid="heatmap-peak-list">
              <p className="text-[10px] uppercase tracking-widest font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Peaks (Ø ≥ {data.thresholds?.peak ?? 5})
              </p>
              {data.peak.length === 0 && (
                <p className="text-xs text-gray-400">Keine Peak-Slots — alle Stunden gleichmäßig.</p>
              )}
              <div className="space-y-1">
                {data.peak.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/90">
                      {WEEKDAYS[c.weekday]} {String(c.hour).padStart(2, "0")}:00
                    </span>
                    <span className="text-amber-300 font-semibold tabular-nums">Ø {c.avg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
