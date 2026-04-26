/**
 * BidBlitz V2 - In der Nähe (Nearby)
 * Leaflet Karte (kostenlos via CartoCDN) + Restaurants, Termine, Hotels, Events
 * + Adress-Suche via Nominatim + Gespeicherte Standorte
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft, Search, MapPin, Star, UtensilsCrossed, Calendar,
  Hotel, Ticket, Filter, X, Home, Briefcase, Heart, Plus,
  Loader2, Navigation, Trash2, Save, Check
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_CONFIG = {
  restaurant: { icon: "🍽️", color: "#F59E0B", label: "Restaurant", Icon: UtensilsCrossed },
  appointment: { icon: "📅", color: "#3B82F6", label: "Termine", Icon: Calendar },
  hotel: { icon: "🏨", color: "#6366F1", label: "Hotels", Icon: Hotel },
  event: { icon: "🎫", color: "#A855F7", label: "Events", Icon: Ticket },
};

const NearbyPage = ({ onBack, onNavigate }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ restaurant: true, appointment: true, hotel: true, event: true });
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [userLoc, setUserLoc] = useState({ lat: 25.2048, lng: 55.2708 }); // Default Dubai

  // Saved locations
  const [savedLocs, setSavedLocs] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [newLocLabel, setNewLocLabel] = useState("");
  const [newLocAddr, setNewLocAddr] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Load saved locations
  useEffect(() => {
    fetch(`${API}/api/places/saved-locations`, { credentials: "include" })
      .then(r => r.json()).then(d => setSavedLocs(d.locations || [])).catch(() => {});
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Load nearby markers
  const loadMarkers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/places/all?lat=${userLoc.lat}&lng=${userLoc.lng}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMarkers(d.markers || []); }
    } catch {}
    setLoading(false);
  }, [userLoc]);

  useEffect(() => { loadMarkers(); }, [loadMarkers]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([userLoc.lat, userLoc.lng], 11);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // User location marker
    const userIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#00C2FF;border:3px solid white;box-shadow:0 0 8px rgba(0,194,255,0.5)"></div>`,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([userLoc.lat, userLoc.lng], { icon: userIcon }).addTo(map);

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers on map
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = markers.filter(m => filters[m.type]);
    filtered.forEach(m => {
      const cfg = TYPE_CONFIG[m.type] || {};
      const icon = L.divIcon({
        html: `<div style="width:28px;height:28px;border-radius:8px;background:${cfg.color || "#666"};display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;box-shadow:0 2px 8px ${cfg.color}44;border:2px solid white;">${cfg.icon || "📍"}</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(mapRef.current);
      marker.on("click", () => setSelectedMarker(m));
      markersRef.current.push(marker);
    });
  }, [markers, filters]);

  // Address search via OpenStreetMap Nominatim (free, no key required)
  const searchAddress = async (q) => {
    if (!q || q.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&accept-language=de`,
        { headers: { "Accept": "application/json" } }
      );
      if (res.ok) {
        const d = await res.json();
        // Normalize to Mapbox-style features so the rest of the code keeps working
        const features = (d || []).map((p) => ({
          place_name: p.display_name,
          center: [parseFloat(p.lon), parseFloat(p.lat)],
        }));
        setSearchResults(features);
      }
    } catch {}
    setSearching(false);
  };

  const flyTo = (lng, lat, zoom = 14) => {
    if (mapRef.current) mapRef.current.flyTo([lat, lng], zoom, { duration: 1.5 });
  };

  const selectSearchResult = (feature) => {
    const [lng, lat] = feature.center;
    flyTo(lng, lat);
    setSearchQuery(feature.place_name);
    setSearchResults([]);
    setNewLocAddr(feature.place_name);
  };

  const saveLocation = async () => {
    if (!newLocLabel) return;
    const center = mapRef.current?.getCenter();
    const newLoc = {
      label: newLocLabel,
      address: newLocAddr || "",
      lat: center?.lat ?? userLoc.lat,
      lng: center?.lng ?? userLoc.lng,
    };
    const updated = [...savedLocs, newLoc];
    setSavedLocs(updated);
    setNewLocLabel("");
    setNewLocAddr("");
    try {
      await fetch(`${API}/api/places/saved-locations`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: updated }),
      });
    } catch {}
  };

  const deleteLocation = async (idx) => {
    const updated = savedLocs.filter((_, i) => i !== idx);
    setSavedLocs(updated);
    try {
      await fetch(`${API}/api/places/saved-locations`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: updated }),
      });
    } catch {}
  };

  const goToSaved = (loc) => {
    if (loc.lat && loc.lng) flyTo(loc.lng, loc.lat);
    setShowSaved(false);
  };

  const filteredCount = markers.filter(m => filters[m.type]).length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white" data-testid="nearby-page">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3">
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2.5 rounded-xl bg-white shadow-lg border border-gray-100" data-testid="nearby-back">
            <ArrowLeft size={18} className="text-gray-800" />
          </motion.button>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); searchAddress(e.target.value); }}
              placeholder="Adresse oder Ort suchen..."
              className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white shadow-lg border border-gray-100 text-xs text-gray-800 outline-none"
              data-testid="nearby-search" />
            {searchQuery && (
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-gray-400" /></motion.button>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSaved(!showSaved)}
            className="p-2.5 rounded-xl bg-white shadow-lg border border-gray-100" data-testid="nearby-saved-btn">
            <Heart size={18} className={showSaved ? "text-red-500 fill-red-500" : "text-gray-800"} />
          </motion.button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden ml-12 mr-12">
            {searchResults.map((f, i) => (
              <motion.button key={f.id} whileTap={{ scale: 0.98 }} onClick={() => selectSearchResult(f)}
                className="w-full px-3 py-2.5 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50 flex items-center gap-2">
                <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-700 truncate">{f.place_name}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-2 ml-12">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <motion.button key={type} whileTap={{ scale: 0.9 }}
              onClick={() => setFilters(prev => ({ ...prev, [type]: !prev[type] }))}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold flex items-center gap-1 shadow-md ${
                filters[type] ? "text-white" : "bg-white/80 text-gray-500"
              }`}
              style={filters[type] ? { background: cfg.color } : {}}
              data-testid={`filter-${type}`}>
              <cfg.Icon size={10} /> {cfg.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="w-full h-screen" data-testid="nearby-map" />

      {/* Saved Locations Panel */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl max-h-[60vh] overflow-hidden"
            data-testid="saved-locations-panel">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Gespeicherte Standorte</h3>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowSaved(false)}>
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>
              {/* Add new */}
              <div className="flex gap-2">
                <input value={newLocLabel} onChange={e => setNewLocLabel(e.target.value)} placeholder="Label (z.B. Zuhause, Arbeit)"
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-800 outline-none" data-testid="saved-label" />
                <motion.button whileTap={{ scale: 0.9 }} onClick={saveLocation} disabled={!newLocLabel}
                  className="px-3 py-2 rounded-lg bg-[#6366F1] text-white text-xs font-bold disabled:opacity-30" data-testid="saved-add-btn">
                  <Plus size={14} />
                </motion.button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[40vh] space-y-2">
              {/* Preset buttons */}
              {savedLocs.length === 0 && (
                <div className="flex gap-2 mb-3">
                  {["Zuhause", "Arbeit", "Gym", "Schule"].map(label => (
                    <motion.button key={label} whileTap={{ scale: 0.9 }}
                      onClick={() => { setNewLocLabel(label); }}
                      className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[10px] text-gray-600 font-medium">
                      {label === "Zuhause" ? "🏠" : label === "Arbeit" ? "🏢" : label === "Gym" ? "💪" : "🎓"} {label}
                    </motion.button>
                  ))}
                </div>
              )}
              {savedLocs.map((loc, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-9 h-9 rounded-lg bg-[#6366F1]/10 flex items-center justify-center text-sm">
                    {loc.label === "Zuhause" ? "🏠" : loc.label === "Arbeit" ? "🏢" : loc.label === "Gym" ? "💪" : "📍"}
                  </div>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => goToSaved(loc)} className="flex-1 text-left">
                    <p className="text-[11px] font-bold text-gray-800">{loc.label}</p>
                    <p className="text-[9px] text-gray-500 truncate">{loc.address || `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}`}</p>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => deleteLocation(i)}>
                    <Trash2 size={14} className="text-gray-400" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Marker Info */}
      <AnimatePresence>
        {selectedMarker && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-3 right-3 z-30" data-testid="marker-detail">
            <div className="bg-white rounded-2xl shadow-2xl p-3.5 flex items-center gap-3">
              {selectedMarker.image ? (
                <img src={selectedMarker.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${TYPE_CONFIG[selectedMarker.type]?.color || "#666"}15` }}>
                  {TYPE_CONFIG[selectedMarker.type]?.icon || "📍"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-800 truncate">{selectedMarker.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{selectedMarker.subtitle}</p>
                {selectedMarker.rating > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" />
                    <span className="text-[10px] text-[#F59E0B] font-medium">{selectedMarker.rating}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate?.(selectedMarker.route)}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white"
                  style={{ background: TYPE_CONFIG[selectedMarker.type]?.color || "#666" }}>
                  Öffnen
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedMarker(null)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-[9px] text-gray-500">
                  Schließen
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counter badge */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-white/90 shadow-lg text-[10px] text-gray-600 font-medium backdrop-blur-sm">
        {filteredCount} Orte in der Nähe
      </div>
    </div>
  );
};

export default NearbyPage;
