/**
 * TaxiAddressSearchSheet — Fullscreen address search overlay (taxi.eu parity).
 *
 * Props:
 *  - mode: 'pickup' | 'dropoff' | null   (null = closed)
 *  - currentLocation: { address, lat, lng } | null
 *  - pickup, dropoff: current values
 *  - onSelectPickup({lat, lng, address}), onSelectDropoff({...})
 *  - onUseCurrentLocation()
 *  - onPickOnMap()
 *  - onClose()
 *  - favorites: array
 *  - savedPlaces: array
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaxiGeocoder } from "./useTaxiGeocoder";

const FAV_ICONS = { home: "🏠", work: "💼", gym: "🏋️", school: "🎓", star: "⭐" };

const POI_QUICKS = [
  { key: "airport", icon: "✈️", label: "Flughäfen", query: "Flughafen" },
  { key: "train", icon: "🚆", label: "Bahnhof", query: "Hauptbahnhof" },
  { key: "hotel", icon: "🏨", label: "Hotels", query: "Hotel" },
  { key: "hospital", icon: "🏥", label: "Krankenhaus", query: "Krankenhaus" },
];

function PinIcon({ color = "#9CA3AF" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function TaxiAddressSearchSheet({
  mode, onClose,
  currentLocation,
  pickup, dropoff,
  onSelectPickup, onSelectDropoff,
  onSelectWaypoint,
  onUseCurrentLocation,
  onPickOnMap,
  favorites = [],
  savedPlaces = [],
  recentAddresses = [],
}) {
  const { search } = useTaxiGeocoder({ debounceMs: 120 });
  const computedSearchHint = mode === "pickup"
    ? "Abholadresse suchen oder auf der Karte setzen"
    : "Zieladresse suchen wie bei Uber oder Bolt";
  const [pickupVal, setPickupVal] = useState(pickup?.address || "");
  const [dropoffVal, setDropoffVal] = useState(dropoff?.address || "");
  const [pickupSugg, setPickupSugg] = useState([]);
  const [dropoffSugg, setDropoffSugg] = useState([]);
  const [showPickupSugg, setShowPickupSugg] = useState(false);
  const [showDropoffSugg, setShowDropoffSugg] = useState(false);
  const [focused, setFocused] = useState(mode || "dropoff");
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);

  useEffect(() => {
    if (!mode) return;
    const t = setTimeout(() => {
      setFocused(mode);
      setPickupVal(pickup?.address || "");
      setDropoffVal(dropoff?.address || "");
      const el = mode === "pickup" ? pickupRef.current : dropoffRef.current;
      el?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [mode, pickup?.address, dropoff?.address]);

  const onPickupChange = (v) => {
    setPickupVal(v);
    const prox = currentLocation && currentLocation.lat ? { lat: currentLocation.lat, lng: currentLocation.lng } : (pickup && pickup.lat ? { lat: pickup.lat, lng: pickup.lng } : null);
    search("sheet-pickup", v, setPickupSugg, setShowPickupSugg, prox);
  };
  const onDropoffChange = (v) => {
    setDropoffVal(v);
    const prox = (pickup && pickup.lat) ? { lat: pickup.lat, lng: pickup.lng } : (currentLocation && currentLocation.lat ? { lat: currentLocation.lat, lng: currentLocation.lng } : null);
    search("sheet-dropoff", v, setDropoffSugg, setShowDropoffSugg, prox);
  };

  // Universal "apply" — works for pickup, dropoff, or waypoint:N
  const applySelection = (sel) => {
    if (mode && mode.startsWith("waypoint:")) {
      const idx = Number(mode.split(":")[1]);
      onSelectWaypoint?.(idx, sel);
      onClose();
      return;
    }
    if (focused === "pickup") {
      onSelectPickup(sel);
      setPickupVal(sel.address);
      setShowPickupSugg(false);
      if (dropoff?.address) onClose();
    } else {
      onSelectDropoff(sel);
      setDropoffVal(sel.address);
      setShowDropoffSugg(false);
      if (pickup?.lat) onClose();
    }
  };

  const pickSuggestion = (s) =>
    applySelection({ lat: s.lat, lng: s.lng, address: s.address });

  const currentList = focused === "pickup" ? pickupSugg : dropoffSugg;
  const currentShow = focused === "pickup" ? showPickupSugg : showDropoffSugg;
  const currentVal = focused === "pickup" ? pickupVal : dropoffVal;

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 320 }}
          className="fixed inset-0 z-[90] bg-[#F3F4F6] flex flex-col font-taxi-body"
          data-testid="taxi-search-sheet"
        >
          {/* Header */}
          <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 border-b border-zinc-200 bg-white/92 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900"
                data-testid="search-close"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-taxi-heading font-black tracking-tight text-zinc-950">Adresse eingeben</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5" data-testid="taxi-search-sheet-hint">{computedSearchHint}</p>
              </div>
            </div>

            <div className="space-y-2">
              {/* Pickup row */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
                <input
                  ref={pickupRef}
                  type="text"
                  placeholder="Abholadresse"
                  value={pickupVal}
                  onChange={(e) => onPickupChange(e.target.value)}
                  onFocus={() => setFocused("pickup")}
                  className="w-full pl-10 pr-9 py-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl text-zinc-950 placeholder-zinc-400 text-sm focus:border-[#002FA7]/40 focus:bg-white focus:outline-none"
                  data-testid="search-pickup-input"
                />
                {pickupVal && (
                  <button
                    onClick={() => { setPickupVal(""); setPickupSugg([]); setShowPickupSugg(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-zinc-500 border border-zinc-200 flex items-center justify-center"
                    data-testid="search-clear-pickup"
                  >×</button>
                )}
              </div>
              {/* Dropoff row */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                <input
                  ref={dropoffRef}
                  type="text"
                  placeholder="Wohin möchtest du?"
                  value={dropoffVal}
                  onChange={(e) => onDropoffChange(e.target.value)}
                  onFocus={() => setFocused("dropoff")}
                  className="w-full pl-10 pr-9 py-3.5 bg-zinc-100 border border-zinc-200 rounded-2xl text-zinc-950 placeholder-zinc-400 text-sm focus:border-[#FF3B30]/30 focus:bg-white focus:outline-none"
                  data-testid="search-dropoff-input"
                />
                {dropoffVal && (
                  <button
                    onClick={() => { setDropoffVal(""); setDropoffSugg([]); setShowDropoffSugg(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-zinc-500 border border-zinc-200 flex items-center justify-center"
                    data-testid="search-clear-dropoff"
                  >×</button>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* When a query is active → show suggestions */}
            {currentShow && currentList.length > 0 ? (
              <div>
                <div className="px-4 py-2 text-[10px] text-[#002FA7] uppercase tracking-[0.18em] font-bold" data-testid="taxi-search-live-results-label">Live Treffer</div>
                {currentList.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => pickSuggestion(s)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 border-b border-zinc-200 hover:bg-white text-left"
                    data-testid={`search-sugg-${i}`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
                      <PinIcon color="#9CA3AF" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-950 truncate">{s.name}</div>
                      <div className="text-xs text-zinc-500 truncate">{s.cityZip || s.address}</div>
                      <div className="text-[10px] text-zinc-400 mt-1 truncate">{s.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-2">
                {/* Quick actions */}
                {focused === "pickup" && currentLocation && (
                  <button
                    onClick={() => { onUseCurrentLocation(); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200 hover:bg-white text-left"
                    data-testid="search-current-location"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-[#002FA7]/8 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-950">Aktueller Standort</div>
                      <div className="text-xs text-zinc-500 truncate">{currentLocation.address || "GPS verwenden"}</div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { onPickOnMap(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200 hover:bg-white text-left"
                  data-testid="search-pick-on-map"
                >
                  <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
                      <line x1="9" y1="3" x2="9" y2="18" />
                      <line x1="15" y1="6" x2="15" y2="21" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-950">Pin auf Karte setzen</div>
                    <div className="text-xs text-zinc-500">Wie bei Uber/Bolt: Position direkt auf der Karte anpassen</div>
                  </div>
                </button>

                {recentAddresses.length > 0 && (
                  <div className="py-2 border-b border-zinc-200">
                    <div className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center justify-between">
                      <span>Letzte Adressen</span>
                      <span className="text-zinc-400 normal-case tracking-normal text-[10px]">
                        {recentAddresses.length} {recentAddresses.length === 1 ? "Eintrag" : "Einträge"}
                      </span>
                    </div>
                    {recentAddresses.slice(0, 6).map((r, i) => (
                      <button
                        key={i}
                        onClick={() => pickSuggestion({ lat: r.lat, lng: r.lng, name: r.address.split(",")[0], cityZip: r.address.split(",").slice(1).join(",").trim(), address: r.address })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white text-left"
                        data-testid={`search-recent-${i}`}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-950 truncate">{r.address.split(",")[0]}</div>
                          <div className="text-xs text-zinc-500 truncate">
                            {r.address.split(",").slice(1).join(",").trim()}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {favorites.length > 0 && (
                  <div className="py-2 border-b border-zinc-200">
                    <div className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center justify-between">
                      <span>Favoriten</span>
                      <span className="text-[#002FA7] normal-case tracking-normal text-[10px]">
                        {favorites.length} {favorites.length === 1 ? "Ort" : "Orte"}
                      </span>
                    </div>
                    {favorites.slice(0, 6).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => pickSuggestion({ lat: f.latitude, lng: f.longitude, address: f.address, name: f.name, cityZip: f.address })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white text-left"
                        data-testid={`search-fav-${f.id}`}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                          <span className="text-base">{FAV_ICONS[f.icon] || "⭐"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-950 truncate">{f.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{f.address}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {savedPlaces.length > 0 && (
                  <div className="py-2 border-b border-zinc-200">
                    <div className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center justify-between">
                      <span>Gespeicherte Orte</span>
                      <span className="text-[#002FA7] normal-case tracking-normal text-[10px]">
                        {savedPlaces.length} {savedPlaces.length === 1 ? "Ort" : "Orte"}
                      </span>
                    </div>
                    {savedPlaces.slice(0, 6).map((p) => (
                      <button
                        key={p.place_id}
                        onClick={() => pickSuggestion({ lat: p.lat, lng: p.lng, address: p.address, name: p.name, cityZip: p.address })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white text-left"
                        data-testid={`search-saved-${p.place_id}`}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-[#002FA7]/8 flex items-center justify-center shrink-0">
                          <span className="text-base">{FAV_ICONS[p.icon] || "📍"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-950 truncate">{p.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{p.address}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="py-2">
                    <div className="px-4 py-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center justify-between">
                    <span>Points of Interest</span>
                      <span className="text-zinc-400 normal-case tracking-normal text-[10px]">
                      Schnellauswahl
                    </span>
                  </div>
                  <div className="px-3 grid grid-cols-4 gap-2">
                    {POI_QUICKS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => {
                          if (focused === "pickup") onPickupChange(p.query);
                          else onDropoffChange(p.query);
                        }}
                        className="flex flex-col items-center gap-1 py-3 bg-white rounded-2xl border border-zinc-200 hover:bg-zinc-50"
                        data-testid={`search-poi-${p.key}`}
                      >
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-[10px] text-zinc-700 font-medium">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
