/**
 * BidBlitz V2 - Kids GPS Tracking Modal
 * Live GPS location with map, history, and zones management
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Navigation, Battery, Wifi, WifiOff, Clock,
  History, Plus, Trash2, Shield, AlertTriangle, ChevronRight,
  RefreshCw, Loader2, Target, Map, Check, Edit2
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GPS MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const KidsGPSModal = ({ isOpen, onClose, child, allChildren }) => {
  const [activeTab, setActiveTab] = useState("live"); // live | history | zones
  const [location, setLocation] = useState(null);
  const [history, setHistory] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Zone creation
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZone, setNewZone] = useState({
    name: "",
    zone_type: "safe",
    lat: 52.52,
    lng: 13.405,
    radius: 100,
  });

  // History settings
  const [historyDays, setHistoryDays] = useState(1);

  useEffect(() => {
    if (isOpen && child) {
      loadLocation();
      loadZones();
    }
  }, [isOpen, child]);

  useEffect(() => {
    if (activeTab === "history" && child) {
      loadHistory();
    }
  }, [activeTab, historyDays, child]);

  const fetchAPI = async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Fehler");
    }
    return res.json();
  };

  const loadLocation = async () => {
    try {
      const data = await fetchAPI(`/api/kids/gps/location/${child.child_id}`);
      setLocation(data);
    } catch (err) {
      console.error("Location load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchAPI(`/api/kids/gps/location/${child.child_id}/history?days=${historyDays}`);
      setHistory(data.locations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      const data = await fetchAPI(`/api/kids/gps/zones/${child.child_id}`);
      setZones(data.zones || []);
    } catch (err) {
      console.error("Zones load error:", err);
    }
  };

  const createZone = async () => {
    if (!newZone.name) {
      setError("Name erforderlich");
      return;
    }
    try {
      await fetchAPI("/api/kids/gps/zones", {
        method: "POST",
        body: JSON.stringify({ ...newZone, child_id: child.child_id }),
      });
      setSuccess("Zone erstellt!");
      setShowAddZone(false);
      setNewZone({ name: "", zone_type: "safe", lat: 52.52, lng: 13.405, radius: 100 });
      loadZones();
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => { setSuccess(null); setError(null); }, 3000);
  };

  const deleteZone = async (zoneId) => {
    if (!confirm("Zone wirklich löschen?")) return;
    try {
      await fetchAPI(`/api/kids/gps/zones/${zoneId}`, { method: "DELETE" });
      setSuccess("Zone gelöscht");
      loadZones();
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => { setSuccess(null); setError(null); }, 3000);
  };

  const simulateLocation = async (lat = 52.52, lng = 13.405) => {
    try {
      const data = await fetchAPI(`/api/kids/gps/simulate/${child.child_id}?lat=${lat}&lng=${lng}`, { method: "POST" });
      setSuccess(data.address ? `Standort: ${data.address}` : "Position aktualisiert");
      loadLocation();
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => { setSuccess(null); setError(null); }, 4000);
  };

  const GPS_PRESETS = [
    { name: "Zuhause", icon: "\u{1F3E0}", lat: 52.5196, lng: 13.3882, color: "#3B82F6" },
    { name: "Schule", icon: "\u{1F3EB}", lat: 52.5234, lng: 13.4024, color: "#10B981" },
    { name: "Spielplatz", icon: "\u{1F3A0}", lat: 52.5180, lng: 13.3950, color: "#F59E0B" },
    { name: "Sportverein", icon: "\u26BD", lat: 52.5140, lng: 13.4100, color: "#EF4444" },
    { name: "Oma & Opa", icon: "\u{1F475}", lat: 52.5300, lng: 13.4200, color: "#A855F7" },
    { name: "Freund/in", icon: "\u{1F46B}", lat: 52.5250, lng: 13.4080, color: "#EC4899" },
    { name: "Alexanderplatz", icon: "\u{1F5FC}", lat: 52.5219, lng: 13.4132, color: "#06B6D4" },
    { name: "Brandenburger Tor", icon: "\u{1F3DB}", lat: 52.5163, lng: 13.3777, color: "#F97316" },
    { name: "Zoo Berlin", icon: "\u{1F981}", lat: 52.5079, lng: 13.3377, color: "#84CC16" },
    { name: "Potsdamer Platz", icon: "\u{1F3AC}", lat: 52.5096, lng: 13.3761, color: "#8B5CF6" },
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.9)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg bg-[#0A0A0F] rounded-t-3xl max-h-[90vh] overflow-hidden"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0A0A0F] px-4 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-lg">
                {child?.emoji || child?.name?.[0] || "👤"}
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-white">{child?.name} - GPS</h2>
                <div className="flex items-center gap-2 text-[11px]">
                  {location?.is_online ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Wifi size={10} /> Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500">
                      <WifiOff size={10} /> Offline
                    </span>
                  )}
                  {location?.battery_level && (
                    <span className={`flex items-center gap-1 ${location.battery_level > 20 ? "text-green-400" : "text-red-400"}`}>
                      <Battery size={10} /> {location.battery_level}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <motion.button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} className="text-gray-400" />
            </motion.button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: "live", label: "Live", icon: MapPin },
              { key: "history", label: "Verlauf", icon: History },
              { key: "zones", label: "Zonen", icon: Shield },
            ].map((tab) => (
              <motion.button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 text-[12px] font-semibold ${
                  activeTab === tab.key
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-white/50"
                }`}
                whileTap={{ scale: 0.97 }}
              >
                <tab.icon size={14} />
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {(success || error) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mx-4 mt-3 p-3 rounded-xl text-sm font-medium ${
                success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}
            >
              {success || error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* ═══════════════════════════════════════════════════════════════════
              LIVE TAB
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "live" && (
            <div className="space-y-4">
              {/* Echte Mapbox Dark Map */}
              <div className="h-[220px] rounded-2xl overflow-hidden border border-blue-500/20 relative">
                {location?.lat && location?.lng ? (
                  <>
                    <img
                      src={`https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/static/pin-l+3B82F6(${location.lng},${location.lat})/${location.lng},${location.lat},15,0/600x400@2x?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`}
                      alt="GPS Map"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {/* Child indicator */}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                      <span className="text-xs font-medium text-blue-400">{child?.name} ist hier</span>
                    </div>
                    {/* Coordinates */}
                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                      <span className="text-[9px] font-mono text-gray-400">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                    </div>
                    {/* Accuracy badge */}
                    {location.accuracy && (
                      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                        <span className="text-[9px] text-gray-400">±{location.accuracy?.toFixed(0) || "?"}m</span>
                      </div>
                    )}
                    {/* Open in maps */}
                    <motion.a
                      href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 px-3 py-1.5 bg-blue-500/30 backdrop-blur-sm rounded-lg text-blue-300 text-[10px] font-medium flex items-center gap-1"
                      whileTap={{ scale: 0.95 }}
                    >
                      <Map size={12} /> Google Maps
                    </motion.a>
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-blue-800/5 flex items-center justify-center">
                    <div className="text-center">
                      <Navigation size={32} className="text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Kein GPS-Signal</p>
                      <p className="text-gray-600 text-[10px] mt-1">Tippe "Standort senden" um die Position zu aktualisieren</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Address (if available) */}
              {location?.address && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2">
                  <MapPin size={14} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-300">{location.address}</p>
                </div>
              )}

              {/* Location Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase">Letzte Aktualisierung</p>
                  <p className="text-[14px] font-semibold text-white mt-1">
                    {location?.last_update
                      ? new Date(location.last_update).toLocaleTimeString("de-DE")
                      : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase">Geschwindigkeit</p>
                  <p className="text-[14px] font-semibold text-white mt-1">
                    {location?.speed ? `${location.speed.toFixed(1)} km/h` : "0 km/h"}
                  </p>
                </div>
              </div>

              {/* Zone status */}
              {zones.length > 0 && location?.lat && (
                <div className="p-3 rounded-xl border border-green-500/20 bg-green-500/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={14} className="text-green-400" />
                    <span className="text-xs font-semibold text-green-400">Zonen-Status</span>
                  </div>
                  <div className="space-y-1">
                    {zones.map(z => {
                      const dist = location.lat ? Math.sqrt(Math.pow((z.lat - location.lat) * 111000, 2) + Math.pow((z.lng - location.lng) * 111000 * Math.cos(location.lat * Math.PI / 180), 2)) : 9999;
                      const inside = dist <= z.radius;
                      return (
                        <div key={z.zone_id || z.name} className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400">{z.name} ({z.zone_type === 'safe' ? 'Sicher' : 'Gesperrt'})</span>
                          <span className={inside ? "text-green-400 font-medium" : "text-gray-500"}>
                            {inside ? "Drin" : `${Math.round(dist)}m entfernt`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GPS Quick Locations */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Schnellstandorte</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {GPS_PRESETS.map((p) => (
                    <motion.button
                      key={p.name}
                      onClick={() => simulateLocation(p.lat, p.lng)}
                      className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                      style={{ border: `1px solid ${p.color}20` }}
                      whileTap={{ scale: 0.92 }}
                      data-testid={`gps-preset-${p.name}`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-[8px] text-gray-400 text-center leading-tight line-clamp-1">{p.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <motion.button
                  onClick={loadLocation}
                  className="flex-1 py-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 font-semibold text-[13px] flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                >
                  <RefreshCw size={14} /> Aktualisieren
                </motion.button>
                <motion.button
                  onClick={() => simulateLocation()}
                  className="flex-1 py-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400 font-semibold text-[13px] flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                >
                  <Target size={14} /> Standort senden
                </motion.button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              HISTORY TAB
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {/* Period Selector */}
              <div className="flex gap-2">
                {[
                  { days: 1, label: "24h" },
                  { days: 7, label: "7 Tage" },
                  { days: 30, label: "30 Tage" },
                ].map((opt) => (
                  <motion.button
                    key={opt.days}
                    onClick={() => setHistoryDays(opt.days)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-semibold ${
                      historyDays === opt.days
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-white/5 text-white/50"
                    }`}
                    whileTap={{ scale: 0.97 }}
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </div>

              {/* History List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="text-blue-400 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center">
                  <History size={32} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500">Keine Standortdaten</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {history.slice(0, 50).map((loc, i) => (
                    <div
                      key={loc.history_id || i}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <MapPin size={14} className="text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[12px] font-mono text-white/80">
                          {loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(loc.timestamp).toLocaleString("de-DE")}
                        </p>
                      </div>
                      {loc.speed > 0 && (
                        <span className="text-[10px] text-gray-400">
                          {loc.speed.toFixed(1)} km/h
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-gray-500 text-center">
                {history.length} Standorte in den letzten {historyDays} Tag(en)
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ZONES TAB
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "zones" && (
            <div className="space-y-4">
              {/* Add Zone Button */}
              {!showAddZone ? (
                <motion.button
                  onClick={() => setShowAddZone(true)}
                  className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-semibold text-[13px] flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={16} /> Neue Zone hinzufügen
                </motion.button>
              ) : (
                <motion.div
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <p className="text-[12px] font-semibold text-white">Neue Zone</p>
                  
                  <input
                    type="text"
                    value={newZone.name}
                    onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                    placeholder="Name (z.B. Schule, Zuhause)"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder-gray-600 outline-none"
                  />

                  {/* Zone Type */}
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => setNewZone({ ...newZone, zone_type: "safe" })}
                      className={`flex-1 py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 ${
                        newZone.zone_type === "safe"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-white/5 text-white/50"
                      }`}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Shield size={14} /> Sichere Zone
                    </motion.button>
                    <motion.button
                      onClick={() => setNewZone({ ...newZone, zone_type: "danger" })}
                      className={`flex-1 py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 ${
                        newZone.zone_type === "danger"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-white/5 text-white/50"
                      }`}
                      whileTap={{ scale: 0.97 }}
                    >
                      <AlertTriangle size={14} /> Gefahrenzone
                    </motion.button>
                  </div>

                  {/* Radius */}
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Radius: {newZone.radius}m</p>
                    <div className="flex gap-2">
                      {[50, 100, 200, 500, 1000].map((r) => (
                        <motion.button
                          key={r}
                          onClick={() => setNewZone({ ...newZone, radius: r })}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium ${
                            newZone.radius === r
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-white/5 text-white/50"
                          }`}
                          whileTap={{ scale: 0.95 }}
                        >
                          {r}m
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.0001"
                      value={newZone.lat}
                      onChange={(e) => setNewZone({ ...newZone, lat: parseFloat(e.target.value) || 0 })}
                      placeholder="Breitengrad"
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[12px] outline-none"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={newZone.lng}
                      onChange={(e) => setNewZone({ ...newZone, lng: parseFloat(e.target.value) || 0 })}
                      placeholder="Längengrad"
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[12px] outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <motion.button
                      onClick={createZone}
                      className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                      whileTap={{ scale: 0.98 }}
                    >
                      <Check size={14} /> Erstellen
                    </motion.button>
                    <motion.button
                      onClick={() => setShowAddZone(false)}
                      className="px-4 py-2.5 bg-white/5 text-gray-400 rounded-xl text-[12px]"
                      whileTap={{ scale: 0.98 }}
                    >
                      Abbrechen
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Zones List */}
              <div className="space-y-2">
                {zones.length === 0 ? (
                  <div className="py-8 text-center">
                    <Shield size={32} className="text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500">Keine Zonen eingerichtet</p>
                    <p className="text-[11px] text-gray-600 mt-1">
                      Füge sichere Orte oder Gefahrenzonen hinzu
                    </p>
                  </div>
                ) : (
                  zones.map((zone) => (
                    <div
                      key={zone.zone_id}
                      className={`p-4 rounded-xl border flex items-center gap-3 ${
                        zone.zone_type === "safe"
                          ? "bg-green-500/5 border-green-500/20"
                          : "bg-red-500/5 border-red-500/20"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        zone.zone_type === "safe" ? "bg-green-500/20" : "bg-red-500/20"
                      }`}>
                        {zone.zone_type === "safe" ? (
                          <Shield size={20} className="text-green-400" />
                        ) : (
                          <AlertTriangle size={20} className="text-red-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-white">{zone.name}</p>
                        <p className="text-[11px] text-gray-500">
                          Radius: {zone.radius}m • {zone.zone_type === "safe" ? "Sicher" : "Gefahr"}
                        </p>
                        {zone.child_is_inside && (
                          <span className={`text-[10px] font-semibold ${
                            zone.zone_type === "safe" ? "text-green-400" : "text-red-400"
                          }`}>
                            ● Aktuell in Zone
                          </span>
                        )}
                      </div>
                      <motion.button
                        onClick={() => deleteZone(zone.zone_id)}
                        className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </motion.button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default KidsGPSModal;
