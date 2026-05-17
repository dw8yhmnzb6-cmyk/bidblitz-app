/**
 * TaxiQuickActions — Big-Touch Welcome-Sheet Buttons (iter124 Phase B).
 * Zeigt 3 wichtigste 1-Tap-Aktionen direkt unter „Wohin möchtest du fahren?":
 *   🏠 Heim · 💼 Arbeit · 🔁 Letzte Fahrt
 * Plus optional „Jetzt | Später"-Toggle (Später navigiert zu /taxi/pro).
 *
 * Bricht das „Stammkunden müssen durchs Side-Menu"-Problem.
 */
import React from "react";
import { Home, Briefcase, RotateCcw, Clock, Zap } from "lucide-react";

function ActionTile({ icon: Icon, label, sub, color, onClick, disabled, testId }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`flex-1 flex items-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all active:scale-[0.97] ${
        disabled
          ? "bg-white/[0.02] border-white/[0.04] text-gray-600 cursor-not-allowed"
          : `bg-gradient-to-br ${color.bg} border-white/[0.06] hover:border-white/15 text-white`
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${disabled ? "text-gray-600" : color.icon}`} />
      <div className="min-w-0 text-left">
        <span className="block text-[11px] font-bold leading-tight">{label}</span>
        {sub && <span className="block text-[9px] text-gray-400 truncate">{sub}</span>}
      </div>
    </button>
  );
}

export default function TaxiQuickActions({
  savedPlaces = [],
  lastRide,
  onPickPlace,
  onUseLastRide,
  scheduleMode = "now",
  onScheduleModeChange,
  onOpenScheduled,
}) {
  const home = savedPlaces.find((p) => p.icon === "home" || (p.name || "").toLowerCase().includes("heim") || (p.name || "").toLowerCase().includes("home"));
  const work = savedPlaces.find((p) => p.icon === "work" || (p.name || "").toLowerCase().includes("arbeit") || (p.name || "").toLowerCase().includes("work"));

  const lastDropAddr = lastRide?.dropoff_address || lastRide?.dropoff?.address || lastRide?.dropoff;

  return (
    <div className="space-y-2" data-testid="taxi-quick-actions">
      {/* Jetzt / Später toggle */}
      <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl">
        <button
          onClick={() => onScheduleModeChange?.("now")}
          data-testid="taxi-mode-now"
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            scheduleMode === "now"
              ? "bg-cyan-500 text-black"
              : "text-gray-300 hover:bg-white/5"
          }`}
        >
          <Zap className="w-3.5 h-3.5" /> Jetzt
        </button>
        <button
          onClick={() => {
            onScheduleModeChange?.("later");
            onOpenScheduled?.();
          }}
          data-testid="taxi-mode-later"
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            scheduleMode === "later"
              ? "bg-purple-500 text-white"
              : "text-gray-300 hover:bg-white/5"
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Später
        </button>
      </div>

      {/* 3 Quick-Action-Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ActionTile
          icon={Home}
          label="Heim"
          sub={home?.address ? home.address.split(",")[0] : "Adresse speichern"}
          color={{ bg: "from-emerald-500/15 to-emerald-500/5", icon: "text-emerald-300" }}
          onClick={() => home && onPickPlace?.(home)}
          disabled={!home}
          testId="taxi-quick-home"
        />
        <ActionTile
          icon={Briefcase}
          label="Arbeit"
          sub={work?.address ? work.address.split(",")[0] : "Adresse speichern"}
          color={{ bg: "from-amber-500/15 to-amber-500/5", icon: "text-amber-300" }}
          onClick={() => work && onPickPlace?.(work)}
          disabled={!work}
          testId="taxi-quick-work"
        />
        <ActionTile
          icon={RotateCcw}
          label="Letzte Fahrt"
          sub={lastDropAddr ? lastDropAddr.split(",")[0] : "Noch keine Fahrt"}
          color={{ bg: "from-cyan-500/15 to-cyan-500/5", icon: "text-cyan-300" }}
          onClick={() => lastRide && onUseLastRide?.(lastRide)}
          disabled={!lastRide}
          testId="taxi-quick-last"
        />
      </div>
    </div>
  );
}
