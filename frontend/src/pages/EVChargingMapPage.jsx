/**
 * EVChargingMapPage — Mapbox-based map of all charging stations with filters.
 * Click a marker → station detail sheet → "Jetzt laden" deep-links into
 * EVStartChargingPage at /ev/start/{cp}/{connector}.
 */
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_DOT = {
  Available: "#10B981",
  Preparing: "#FBBF24",
  Charging: "#00C2FF",
  Reserved: "#8B5CF6",
  Faulted: "#EF4444",
  Unavailable: "#6B7280",
};

export default function EVChargingMapPage({ onNavigate }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({
    online_only: false,
    available_only: false,
    city: "",
  });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Load stations from API ────────────────────────────────────────────────
  const reload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("online_only", String(filters.online_only));
      params.set("available_only", String(filters.available_only));
      if (filters.city) params.set("city", filters.city);
      const r = await fetch(`${API}/api/ev/stations?${params}`, { credentials: "include" });
      const data = await r.json();
      setStations((data.stations || []).filter((s) => s.location?.lat && s.location?.lng));
    } catch (e) {
      toast.error("Stationen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [filters.online_only, filters.available_only, filters.city]);

  // ── Init Map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      toast.error("Mapbox-Token fehlt");
      return;
    }
    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [10.0, 51.0],
      zoom: 5.2,
      attributionControl: false,
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }), "top-right");
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  // ── Render markers when stations change ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];
    if (stations.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    stations.forEach((s) => {
      const lng = Number(s.location.lng);
      const lat = Number(s.location.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      bounds.extend([lng, lat]);
      const dotColor = s.online ? (STATUS_DOT[s.status] || "#10B981") : "#6B7280";
      const el = document.createElement("button");
      el.className = "ev-cp-marker";
      el.setAttribute("data-testid", `ev-map-marker-${s.charge_point_id}`);
      el.style.cssText = `
        width:34px;height:34px;border-radius:50%;background:${dotColor};
        border:3px solid #0A0A0F;box-shadow:0 2px 12px ${dotColor}80;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:14px;color:white;font-weight:bold;padding:0;
      `;
      el.textContent = "⚡";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(s);
        map.flyTo({ center: [lng, lat], zoom: 13, duration: 600 });
      });
      const mk = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push(mk);
    });
    if (stations.length > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 800 });
    }
  }, [stations]);

  return (
    <div className="fixed inset-0 bg-[#0A0A0F]">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0" data-testid="ev-map-container" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-3 bg-gradient-to-b from-[#0A0A0F] to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("/")}
            data-testid="ev-map-back"
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white"
          >←</button>
          <h1 className="text-lg font-bold text-white flex-1">EV Ladestationen</h1>
          <button
            onClick={() => onNavigate("/ev/history")}
            data-testid="ev-map-history-btn"
            className="px-3 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-white font-semibold hover:bg-white/10 transition-colors"
          >Historie</button>
          <span className="text-xs text-gray-400" data-testid="ev-map-count">{stations.length}</span>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          <FilterChip
            active={filters.online_only}
            onClick={() => setFilters((f) => ({ ...f, online_only: !f.online_only }))}
            testid="ev-filter-online"
          >🟢 Nur online</FilterChip>
          <FilterChip
            active={filters.available_only}
            onClick={() => setFilters((f) => ({ ...f, available_only: !f.available_only }))}
            testid="ev-filter-available"
          >🔌 Nur frei</FilterChip>
          <input
            value={filters.city}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
            placeholder="Stadt…"
            data-testid="ev-filter-city"
            className="px-3 py-1.5 rounded-full text-xs bg-black/60 backdrop-blur-md border border-white/10 text-white placeholder-gray-500 outline-none focus:border-cyan-500 min-w-[120px]"
          />
        </div>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-500/50 z-20 animate-pulse" />
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-white/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Dot c="#10B981" /> Frei</span>
          <span className="flex items-center gap-1"><Dot c="#00C2FF" /> Lädt</span>
          <span className="flex items-center gap-1"><Dot c="#EF4444" /> Defekt</span>
          <span className="flex items-center gap-1"><Dot c="#6B7280" /> Offline</span>
        </div>
      </div>

      {/* Detail Bottom Sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-5"
            data-testid="ev-map-detail-sheet"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-lg font-bold text-white" data-testid="ev-map-detail-name">
                  {selected.name || selected.charge_point_id}
                </p>
                <p className="text-xs text-gray-400">
                  {selected.location?.address || selected.location?.city || ""}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"
                data-testid="ev-map-detail-close"
              >×</button>
            </div>
            <div className="flex items-center gap-2 text-xs mt-2">
              <span className={`px-2 py-1 rounded-full font-bold uppercase ${
                selected.online
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}>
                {selected.online ? "Online" : "Offline"}
              </span>
              <span className="text-gray-400">{selected.status}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">CP-ID: {selected.charge_point_id}</span>
            </div>
            <button
              onClick={() => onNavigate(`/ev/start/${selected.charge_point_id}/1`)}
              disabled={!selected.online}
              className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold text-base disabled:opacity-50"
              data-testid="ev-map-detail-start"
            >
              Jetzt laden
            </button>
            {!selected.online && (
              <p className="text-center text-[11px] text-gray-500 mt-2">
                Station ist gerade offline — Laden derzeit nicht möglich.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ children, active, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
        active
          ? "bg-cyan-500 text-black"
          : "bg-black/60 backdrop-blur-md border border-white/10 text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function Dot({ c }) {
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />;
}
