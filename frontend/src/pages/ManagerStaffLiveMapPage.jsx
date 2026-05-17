/**
 * ManagerStaffLiveMapPage — Live-Cockpit für Manager
 * ====================================================
 * Mapbox-Map mit allen aktiven Staff-Pins:
 *   - Grün = working im Geofence
 *   - Gelb = working aber outside oder GPS stale
 *   - Lila = on_break
 *   - Grau = off
 *   - Roter Ring = is_mock_suspected (Anomaly)
 *
 * Sortierte Liste rechts (Sheet auf Mobile) zeigt: Name, Shift-Dauer,
 * State-Badge, Distanz zum Geofence, Anomaly-Hinweis.
 * Auto-Refresh alle 10s.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle, MapPin, Users, RefreshCw, X, BarChart3, Radio } from "lucide-react";
import StaffShiftHeatmap from "../staff/StaffShiftHeatmap";
import StaffShiftAssistant from "../staff/StaffShiftAssistant";

const API = process.env.REACT_APP_BACKEND_URL;
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const REFRESH_MS = 10000;

let _mapbox = null;
const loadMapbox = async () => {
  if (_mapbox) return _mapbox;
  const [mod] = await Promise.all([
    import(/* webpackChunkName: "mapbox-gl" */ "mapbox-gl"),
    import(/* webpackChunkName: "mapbox-gl" */ "mapbox-gl/dist/mapbox-gl.css"),
  ]);
  _mapbox = mod.default;
  _mapbox.accessToken = MAPBOX_TOKEN;
  return _mapbox;
};

function pinColor(p) {
  if (p.state === "off") return "#6B7280";
  if (p.state === "on_break") return "#A855F7";
  // working
  if (p.stale) return "#F59E0B";
  if (p.geofence_status === "inside") return "#10B981";
  if (p.geofence_status === "outside") return "#EF4444";
  return "#F59E0B";
}

function formatDuration(iso) {
  if (!iso) return "—";
  const start = new Date(iso).getTime();
  const ms = Date.now() - start;
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATE_LABEL = {
  working: "Aktiv",
  on_break: "Pause",
  off: "Offline",
};

function StaffRow({ p, onFocus }) {
  const color = pinColor(p);
  return (
    <button
      onClick={() => onFocus(p)}
      data-testid={`live-staff-row-${p.staff_id}`}
      className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-left transition-colors"
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">{p.name}</p>
          {p.has_anomaly_today && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-gray-400 truncate">
          {STATE_LABEL[p.state]}
          {p.state === "working" && p.shift_started_at && (
            <> · seit {formatDuration(p.shift_started_at)}</>
          )}
          {p.nearest_geofence && p.last_position && (
            <>
              {" · "}
              <span className={p.geofence_status === "inside" ? "text-emerald-400" : "text-amber-400"}>
                {p.geofence_status === "inside" ? "im " : "außerh. "}
                {p.nearest_geofence.name}
              </span>
            </>
          )}
        </p>
      </div>
      {p.stale && (
        <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-wider">
          stale
        </span>
      )}
    </button>
  );
}

export default function ManagerStaffLiveMapPage({ onBack }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]); // {staff_id, marker}

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [anomalies, setAnomalies] = useState([]);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [view, setView] = useState("live"); // "live" | "heatmap"

  // Fetch positions
  const fetchPositions = async () => {
    try {
      const r = await fetch(`${API}/api/staff/live-map/positions`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e?.message || "Konnte Positionen nicht laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const r = await fetch(`${API}/api/staff/live-map/anomalies?limit=50`, {
        credentials: "include",
      });
      if (!r.ok) return;
      const json = await r.json();
      setAnomalies(json.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchPositions();
    fetchAnomalies();
    const id = setInterval(() => {
      fetchPositions();
      setRefreshTick((t) => t + 1);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Init map (once)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      setError("Mapbox Token fehlt in der Build-Konfiguration");
      return;
    }
    let cancelled = false;
    loadMapbox().then((mb) => {
      if (cancelled || mapRef.current) return;
      mapRef.current = new mb.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [13.405, 52.52], // Berlin default
        zoom: 11,
        language: "de",
        attributionControl: false,
      });
      mapRef.current.addControl(new mb.NavigationControl(), "top-right");
      // resize-safety + ready signal
      const r = () => { try { mapRef.current?.resize(); } catch {} };
      mapRef.current.on("load", () => { r(); setMapReady(true); });
      setTimeout(r, 250);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    };
  }, []);

  // Render markers + geofences
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapbox || !mapReady) return;
    if (!data) return;

    // Clear old markers
    markersRef.current.forEach(({ marker }) => { try { marker.remove(); } catch {} });
    markersRef.current = [];

    const bounds = new _mapbox.LngLatBounds();
    let hasBounds = false;

    // Staff markers
    (data.positions || []).forEach((p) => {
      if (!p.last_position) return;
      const { lat, lng } = p.last_position;
      const color = pinColor(p);
      const el = document.createElement("div");
      el.setAttribute("data-testid", `live-marker-${p.staff_id}`);
      el.style.cssText = `width:18px;height:18px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 0 8px ${color},0 2px 6px rgba(0,0,0,.4);cursor:pointer;${p.has_anomaly_today ? "outline:2px solid #EF4444;outline-offset:2px;" : ""}`;
      el.title = `${p.name} — ${STATE_LABEL[p.state]}`;
      const marker = new _mapbox.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push({ staff_id: p.staff_id, marker });
      bounds.extend([lng, lat]);
      hasBounds = true;
    });

    // Geofence circles (via source/layer)
    try {
      const geofences = data.geofences || [];
      const features = geofences
        .filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng))
        .map((g) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [g.lng, g.lat] },
          properties: { radius_m: g.radius_m || 100, name: g.name },
        }));
      const geojson = { type: "FeatureCollection", features };

      const add = () => {
        if (!map.getSource("manager-geofences")) {
          map.addSource("manager-geofences", { type: "geojson", data: geojson });
          map.addLayer({
            id: "manager-geofences-fill",
            type: "circle",
            source: "manager-geofences",
            paint: {
              "circle-radius": ["interpolate", ["exponential", 2], ["zoom"],
                10, ["/", ["get", "radius_m"], 50],
                16, ["/", ["get", "radius_m"], 1],
              ],
              "circle-color": "rgba(0,194,255,0.10)",
              "circle-stroke-color": "rgba(0,194,255,0.55)",
              "circle-stroke-width": 1.5,
            },
          });
        } else {
          map.getSource("manager-geofences").setData(geojson);
        }
      };
      if (map.isStyleLoaded()) add(); else map.once("style.load", add);
    } catch {}

    if (hasBounds) {
      try { map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 500 }); } catch {}
    }
  }, [data, mapReady]);

  const focusOn = (p) => {
    const map = mapRef.current;
    if (!map || !p?.last_position) return;
    map.flyTo({ center: [p.last_position.lng, p.last_position.lat], zoom: 15, duration: 700 });
  };

  const reviewAnomaly = async (id) => {
    try {
      await fetch(`${API}/api/staff/live-map/anomalies/${id}/review`, {
        method: "POST", credentials: "include",
      });
      setAnomalies((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  };

  const counters = useMemo(() => {
    if (!data) return { working: 0, on_break: 0, off: 0, anomalies: 0 };
    const c = { working: 0, on_break: 0, off: 0, anomalies: 0 };
    (data.positions || []).forEach((p) => {
      c[p.state] = (c[p.state] || 0) + 1;
      if (p.has_anomaly_today) c.anomalies++;
    });
    return c;
  }, [data]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col" data-testid="manager-staff-live-map">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
          data-testid="live-map-back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white">Live-Cockpit</h1>
          <p className="text-[11px] text-gray-400">
            {data ? (
              <>
                <span className="text-emerald-400 font-semibold">{counters.working}</span> aktiv ·{" "}
                <span className="text-purple-400 font-semibold">{counters.on_break}</span> Pause ·{" "}
                <span className="text-gray-500 font-semibold">{counters.off}</span> offline
                {counters.anomalies > 0 && (
                  <> · <span className="text-red-400 font-semibold">{counters.anomalies} Anomalie</span></>
                )}
              </>
            ) : "lade…"}
          </p>
        </div>
        <button
          onClick={() => setShowAnomalies(true)}
          data-testid="live-map-anomaly-inbox-btn"
          className={`relative w-9 h-9 rounded-full flex items-center justify-center ${anomalies.length > 0 ? "bg-red-500/15 hover:bg-red-500/25" : "bg-white/5 hover:bg-white/10"}`}
          title="Anomalie-Inbox"
        >
          <AlertTriangle className={`w-4 h-4 ${anomalies.length > 0 ? "text-red-400" : "text-gray-400"}`} />
          {anomalies.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {anomalies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { fetchPositions(); fetchAnomalies(); }}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
          data-testid="live-map-refresh"
          title="Aktualisieren"
        >
          <RefreshCw className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="px-3 pt-2 pb-1 flex gap-1.5 bg-[#050505] border-b border-white/[0.04]">
        <button
          onClick={() => setView("live")}
          data-testid="live-cockpit-tab-live"
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
            view === "live" ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "bg-white/[0.03] text-gray-400 border border-white/[0.04] hover:bg-white/5"
          }`}
        >
          <Radio className="w-3.5 h-3.5" /> Live-Karte
        </button>
        <button
          onClick={() => setView("heatmap")}
          data-testid="live-cockpit-tab-heatmap"
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
            view === "heatmap" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-white/[0.03] text-gray-400 border border-white/[0.04] hover:bg-white/5"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Shift-Heatmap
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-[260px]" style={{ display: view === "live" ? "block" : "none" }}>
        <div
          ref={mapContainerRef}
          data-testid="live-map-container"
          style={{ position: "absolute", inset: 0 }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute top-3 left-3 right-3 bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-xs text-red-300" data-testid="live-map-error">
            {error}
          </div>
        )}
        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-[10px] text-gray-300 space-y-1">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:"#10B981",boxShadow:"0 0 6px #10B981"}}/> Aktiv im Geofence</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:"#F59E0B"}}/> Aktiv außerhalb/Stale</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:"#A855F7"}}/> Pause</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full ring-1 ring-red-500" style={{background:"#10B981"}}/> Anomalie</div>
        </div>
      </div>

      {/* Bottom list */}
      <div className="border-t border-white/[0.06] bg-[#0A0A0F] max-h-[40vh] overflow-y-auto"
           data-testid="live-staff-list"
           style={{ display: view === "live" ? "block" : "none" }}>
        <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
          <Users className="w-3.5 h-3.5" /> Belegschaft ({data?.total || 0})
        </div>
        <div className="px-2 pb-3 space-y-1.5">
          {(data?.positions || []).map((p) => (
            <StaffRow key={p.staff_id} p={p} onFocus={focusOn} />
          ))}
          {!loading && data && data.positions.length === 0 && (
            <p className="text-center text-xs text-gray-500 py-6">Keine Mitarbeiter aktiv</p>
          )}
        </div>
      </div>

      {/* Heatmap View */}
      {view === "heatmap" && (
        <div className="flex-1 overflow-y-auto bg-[#0A0A0F] p-3 space-y-3" data-testid="heatmap-view">
          <StaffShiftHeatmap />
          <StaffShiftAssistant />
        </div>
      )}

      {/* Anomaly Inbox Modal */}
      {showAnomalies && (
        <div
          onClick={() => setShowAnomalies(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          data-testid="anomaly-inbox-modal"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#0A0A0F] border border-white/10 rounded-2xl max-h-[85vh] flex flex-col"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold">Anomalie-Inbox ({anomalies.length})</h3>
              </div>
              <button onClick={() => setShowAnomalies(false)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center" data-testid="anomaly-modal-close">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {anomalies.length === 0 && (
                <p className="text-center text-xs text-gray-500 py-8">Alle sauber — keine offenen Anomalien 👌</p>
              )}
              {anomalies.map((a) => (
                <div key={a.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl" data-testid={`anomaly-row-${a.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{a.staff_name}</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-red-400">{a.type}</p>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                      a.severity === "high" ? "bg-red-500/20 text-red-300" :
                      a.severity === "medium" ? "bg-amber-500/20 text-amber-300" :
                      "bg-gray-500/20 text-gray-300"
                    }`}>{a.severity}</span>
                  </div>
                  <pre className="text-[10px] text-gray-400 whitespace-pre-wrap leading-tight">
                    {JSON.stringify(a.details, null, 1).replace(/[{}"]/g, "")}
                  </pre>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(a.created_at).toLocaleString("de-DE")}</p>
                  <button
                    onClick={() => reviewAnomaly(a.id)}
                    data-testid={`anomaly-review-${a.id}`}
                    className="mt-2 w-full py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-[11px] font-semibold text-emerald-300"
                  >
                    Als geprüft markieren
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
