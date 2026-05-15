/**
 * LiveActivityTimeline — moderner Activity Stream für Manager-Views.
 *
 * Kombiniert staff_clock_events + staff_geofence_events zu einem
 * chronologischen, animierten Feed mit großen, lesbaren Items.
 *
 * Props:
 *   events: [{ id, staff_id, staff_name, action|event_type, timestamp|ts, geofence_name }]
 *   limit:  number (default 25)
 *   compact: boolean (kleinere Items)
 *   testid:  string
 */
import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, Coffee, RotateCw, MapPin, CheckCircle2, AlertTriangle, Activity,
} from "lucide-react";

const KIND = {
  // clock events
  clock_in:    { label: "Shift gestartet", icon: Play,         color: "#10B981" },
  clock_out:   { label: "Feierabend",      icon: Square,       color: "#64748B" },
  break_start: { label: "Pause begonnen",  icon: Coffee,       color: "#F59E0B" },
  break_end:   { label: "Pause beendet",   icon: RotateCw,     color: "#06B6D4" },
  // geofence events
  entered:     { label: "Angekommen",      icon: MapPin,       color: "#0EA5E9" },
  checked_in:  { label: "Auto-Check-In",   icon: CheckCircle2, color: "#10B981" },
  skipped:     { label: "Übersprungen",    icon: AlertTriangle,color: "#94A3B8" },
  exited:      { label: "Verlassen",       icon: MapPin,       color: "#64748B" },
};

function relativeTime(iso) {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

export default function LiveActivityTimeline({ events = [], limit = 25, compact = false, testid = "live-activity-timeline" }) {
  const items = useMemo(() => {
    const flat = (events || []).map((e) => ({
      id: e.id || `${e.staff_id}-${e.timestamp || e.ts}`,
      staff_id: e.staff_id,
      staff_name: e.staff_name || (e.staff_id ? `${e.staff_id.slice(0, 6)}…` : "Unbekannt"),
      kind: e.action || e.event_type || "unknown",
      ts: e.timestamp || e.ts,
      geofence_name: e.geofence_name,
      suspected_spoof: !!e.suspected_spoof,
    }));
    flat.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    return flat.slice(0, limit);
  }, [events, limit]);

  if (items.length === 0) {
    return (
      <div data-testid={`${testid}-empty`} className="py-10 px-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Activity size={22} className="text-slate-400" strokeWidth={1.6} />
        </div>
        <p className="text-sm font-semibold text-slate-900">Noch keine Aktivität</p>
        <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
          Sobald Mitarbeiter ankommen, ein- oder auschecken, erscheinen die Ereignisse hier live.
        </p>
      </div>
    );
  }

  return (
    <ol data-testid={testid} className="relative space-y-3">
      {/* vertical rail */}
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" aria-hidden />
      <AnimatePresence initial={false}>
        {items.map((it, idx) => {
          const cfg = KIND[it.kind] || { label: it.kind, icon: Activity, color: "#94A3B8" };
          const Icon = cfg.icon;
          return (
            <motion.li
              key={it.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.025, 0.4) }}
              data-testid={`timeline-item-${it.kind}`}
              className="relative flex items-start gap-3"
            >
              {/* Icon node */}
              <div className="relative z-10 shrink-0">
                <div
                  className={`${compact ? "w-9 h-9" : "w-10 h-10"} rounded-full flex items-center justify-center shadow-sm border-2 border-white`}
                  style={{ background: `${cfg.color}1A`, color: cfg.color }}
                >
                  <Icon size={compact ? 14 : 16} strokeWidth={2.4} />
                </div>
                {idx === 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse"
                    style={{ background: cfg.color }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`${compact ? "text-xs" : "text-sm"} font-bold text-slate-900 truncate`}>
                    <span>{it.staff_name}</span>{" "}
                    <span className="font-medium text-slate-500">hat </span>
                    <span style={{ color: cfg.color }}>{cfg.label}</span>
                  </p>
                  <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                    {relativeTime(it.ts)}
                  </span>
                </div>
                {(it.geofence_name || it.suspected_spoof) && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    {it.geofence_name && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={10} /> {it.geofence_name}
                      </span>
                    )}
                    {it.suspected_spoof && (
                      <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                        <AlertTriangle size={10} /> Spoof verdächtig
                      </span>
                    )}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
