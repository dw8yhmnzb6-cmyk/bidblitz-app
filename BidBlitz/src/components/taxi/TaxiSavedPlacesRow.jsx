/**
 * TaxiSavedPlacesRow — Chip row of user-saved destinations.
 */
import React from "react";

const ICONS = { home: "🏠", work: "💼", gym: "🏋️", school: "🎓", star: "⭐" };

export default function TaxiSavedPlacesRow({ savedPlaces, onPick }) {
  if (!savedPlaces.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          Gespeicherte Orte
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {savedPlaces.map((p) => (
          <button
            key={p.place_id}
            onClick={() => onPick(p)}
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 rounded-xl text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
            data-testid={`taxi-saved-${p.name}`}
          >
            <span>{ICONS[p.icon] || "📍"}</span>
            <span className="font-medium">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
