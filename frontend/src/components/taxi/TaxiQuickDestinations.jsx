/**
 * TaxiQuickDestinations — Three rows of hard-coded popular destinations
 * (Berlin "Schnellauswahl", Prishtina, Dubai).
 * Includes optional "Ziel speichern" button when dropoff is set.
 */
import React from "react";

const SCHNELLAUSWAHL = [
  { name: "Flughafen BER", lat: 52.3667, lng: 13.5033 },
  { name: "Hauptbahnhof", lat: 52.5251, lng: 13.3694 },
  { name: "Alexanderplatz", lat: 52.5219, lng: 13.4132 },
  { name: "Brandenburger Tor", lat: 52.5163, lng: 13.3777 },
];

const PRISHTINA = [
  { name: "Flughafen Prishtina", lat: 42.5728, lng: 21.0358 },
  { name: "Skanderbeg-Platz", lat: 42.6629, lng: 21.1655 },
  { name: "Newborn Monument", lat: 42.6598, lng: 21.1596 },
  { name: "Germia Park", lat: 42.674, lng: 21.191 },
  { name: "Kathedrale Mutter Teresa", lat: 42.6608, lng: 21.1573 },
  { name: "Grand Hotel Prishtina", lat: 42.6622, lng: 21.1645 },
  { name: "Bulevardi Nënë Tereza", lat: 42.661, lng: 21.162 },
  { name: "Albi Mall", lat: 42.6484, lng: 21.1544 },
];

const DUBAI = [
  { name: "Dubai Airport (DXB)", lat: 25.2532, lng: 55.3657 },
  { name: "Burj Khalifa", lat: 25.1972, lng: 55.2744 },
  { name: "Dubai Mall", lat: 25.1985, lng: 55.2796 },
  { name: "Palm Jumeirah", lat: 25.1124, lng: 55.139 },
  { name: "Burj Al Arab", lat: 25.1413, lng: 55.1853 },
  { name: "Dubai Marina", lat: 25.0805, lng: 55.1403 },
  { name: "Dubai Frame", lat: 25.235, lng: 55.3006 },
  { name: "Mall of Emirates", lat: 25.1182, lng: 55.2006 },
];

function ChipGroup({ label, items, suffix = "", colorClass, testidPrefix, onPick }) {
  return (
    <div className="mb-2">
      <span className="text-[9px] text-gray-600 uppercase tracking-wider">{label}</span>
      <div className="flex gap-2 flex-wrap mt-1">
        {items.map((dest) => (
          <button
            key={dest.name}
            onClick={() => onPick({ lat: dest.lat, lng: dest.lng, address: dest.name + suffix })}
            className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors border ${colorClass}`}
            data-testid={`${testidPrefix}-${dest.name}`}
          >
            {dest.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TaxiQuickDestinations({
  hasDropoff,
  onOpenSaveModal,
  onPick,
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          Schnellauswahl
        </span>
        {hasDropoff && (
          <button
            onClick={onOpenSaveModal}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            data-testid="taxi-save-place-btn"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ziel speichern
          </button>
        )}
      </div>

      <div className="flex gap-2.5 flex-wrap mb-3">
        {SCHNELLAUSWAHL.map((dest) => (
          <button
            key={dest.name}
            onClick={() => onPick({ lat: dest.lat, lng: dest.lng, address: dest.name })}
            className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors border border-white/5"
            data-testid={`taxi-quick-${dest.name}`}
          >
            {dest.name}
          </button>
        ))}
      </div>

      <ChipGroup
        label="Prishtina"
        items={PRISHTINA}
        suffix=", Prishtina"
        colorClass="bg-emerald-500/8 text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400 border-emerald-500/10"
        testidPrefix="taxi-pri"
        onPick={onPick}
      />

      <ChipGroup
        label="Dubai"
        items={DUBAI}
        suffix=", Dubai"
        colorClass="bg-amber-500/8 text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-400 border-amber-500/10"
        testidPrefix="taxi-dub"
        onPick={onPick}
      />
    </div>
  );
}
