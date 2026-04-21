/**
 * BidBlitz V2 - Friends Map Page
 * Opt-in location sharing → see friends nearby on dark Leaflet map.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "framer-motion";
import { ArrowLeft, Users, MapPin, RefreshCw, Shield, Eye, EyeOff, Navigation } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const makeUserIcon = (color = "#00C2FF") =>
  L.divIcon({
    className: "friends-user-marker",
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:${color}33;animation:taxi-pulse 2s ease-out infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 12px ${color}99;"></div>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const makeFriendIcon = (initial) =>
  L.divIcon({
    className: "friends-friend-marker",
    html: `
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#A855F7,#7C3AED);border:3px solid #fff;box-shadow:0 4px 12px rgba(168,85,247,0.6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;">
        ${(initial || "?").toUpperCase()}
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

export default function FriendsMapPage({ onNavigate }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);

  const [settings, setSettings] = useState({ enabled: false, visibility: "friends", auto_expire_hours: 24 });
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myLocation, setMyLocation] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/friends-map/settings`, { credentials: "include" });
      if (res.ok) setSettings(await res.json());
    } catch (e) {}
  }, []);

  const loadFriendsNearby = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/friends-map/friends-nearby?radius_km=100`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (e) {}
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Init Leaflet map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [52.52, 13.405],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      crossOrigin: true,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (myLocation) {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.marker([myLocation.lat, myLocation.lng], { icon: makeUserIcon() }).addTo(map);
      map.setView([myLocation.lat, myLocation.lng], 13);
    }

    friends.forEach((f) => {
      const m = L.marker([f.latitude, f.longitude], {
        icon: makeFriendIcon(f.name ? f.name[0] : "?"),
      }).addTo(map);
      m.bindPopup(`<div style="color:#111"><strong>${f.name || "Freund"}</strong><br/><span style="font-size:10px">${f.distance_km} km entfernt</span></div>`);
      markersRef.current.push(m);
    });

    if (myLocation && friends.length > 0) {
      const bounds = L.latLngBounds([
        [myLocation.lat, myLocation.lng],
        ...friends.map((f) => [f.latitude, f.longitude]),
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [friends, myLocation]);

  const enableSharing = async () => {
    setLoading(true);
    try {
      // 1. request geolocation
      if (!navigator.geolocation) {
        toast.error("Geolocation wird nicht unterstützt");
        setLoading(false);
        return;
      }

      // 2. turn on sharing
      const settingsRes = await fetch(`${API}/api/friends-map/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, visibility: settings.visibility || "friends", auto_expire_hours: 24 }),
      });
      if (!settingsRes.ok) {
        const err = await settingsRes.json().catch(() => ({}));
        toast.error(err.detail || "Aktivierung fehlgeschlagen");
        setLoading(false);
        return;
      }

      // 3. send location
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        await fetch(`${API}/api/friends-map/update-location`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: loc.lat, longitude: loc.lng, accuracy: pos.coords.accuracy }),
        });
        await loadSettings();
        await loadFriendsNearby();
        toast.success("Standort-Sharing aktiviert");
        setLoading(false);
      }, () => {
        toast.error("Standort konnte nicht ermittelt werden");
        setLoading(false);
      }, { enableHighAccuracy: true, timeout: 10000 });
    } catch (e) {
      toast.error("Fehler");
      setLoading(false);
    }
  };

  const disableSharing = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/friends-map/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, visibility: settings.visibility, auto_expire_hours: settings.auto_expire_hours }),
      });
      setMyLocation(null);
      setFriends([]);
      await loadSettings();
      toast.success("Standort-Sharing deaktiviert");
    } catch (e) { toast.error("Fehler"); }
    setLoading(false);
  };

  const changeVisibility = async (vis) => {
    try {
      await fetch(`${API}/api/friends-map/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: settings.enabled, visibility: vis, auto_expire_hours: settings.auto_expire_hours }),
      });
      setSettings({ ...settings, visibility: vis });
    } catch (e) {}
  };

  return (
    <div className="h-screen flex flex-col bg-[#030303] text-white" data-testid="friends-map-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate && onNavigate("/more")} className="p-2 -ml-2" data-testid="friends-back">
              <ArrowLeft size={20} className="text-white/70"/>
            </button>
            <div>
              <h1 className="text-[15px] font-bold">Freunde in der Nähe</h1>
              <p className="text-[10px] text-gray-500">{friends.length} Freunde sichtbar</p>
            </div>
          </div>
          <button
            onClick={() => { loadSettings(); loadFriendsNearby(); }}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
            data-testid="friends-refresh"
          >
            <RefreshCw size={14} className="text-white/60"/>
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" data-testid="friends-map-container"/>

        {/* Onboarding overlay when not enabled */}
        {!settings.enabled && !loading && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] to-[#030303]/80 backdrop-blur-sm z-[500] flex items-end justify-center p-6">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md bg-[#0F1218] rounded-3xl p-6 border border-white/10">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Users size={28} className="text-purple-400"/>
              </div>
              <h2 className="text-lg font-bold text-center">Sieh Freunde in deiner Nähe</h2>
              <p className="text-xs text-gray-400 text-center mt-1 mb-5">
                Teile deinen Standort privat mit Freunden. Du kannst jederzeit wieder deaktivieren.
              </p>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-5">
                <Shield size={14} className="text-cyan-400 shrink-0 mt-0.5"/>
                <p className="text-[10px] text-gray-400">Deine Position wird nur an bestätigte Freunde geteilt und läuft automatisch nach 24h ab.</p>
              </div>

              <button
                onClick={enableSharing}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold text-white disabled:opacity-50"
                data-testid="enable-sharing-btn"
              >
                Standort-Sharing aktivieren
              </button>
            </motion.div>
          </div>
        )}

        {/* Bottom toolbar when enabled */}
        {settings.enabled && (
          <div className="absolute bottom-4 left-4 right-4 z-[400] flex items-center gap-2">
            <div className="flex-1 bg-[#0A0A0F]/90 backdrop-blur-xl rounded-2xl border border-white/10 p-2 flex items-center gap-1">
              <VisibilityChip active={settings.visibility === "friends"} onClick={() => changeVisibility("friends")} icon={<Users size={12}/>} label="Freunde" testid="vis-friends"/>
              <VisibilityChip active={settings.visibility === "public"} onClick={() => changeVisibility("public")} icon={<Eye size={12}/>} label="Öffentlich" testid="vis-public"/>
              <VisibilityChip active={settings.visibility === "private"} onClick={() => changeVisibility("private")} icon={<EyeOff size={12}/>} label="Privat" testid="vis-private"/>
            </div>
            <button
              onClick={disableSharing}
              disabled={loading}
              className="shrink-0 w-11 h-11 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center"
              data-testid="stop-sharing-btn"
              title="Standort-Sharing beenden"
            >
              <EyeOff size={16} className="text-red-400"/>
            </button>
          </div>
        )}
      </div>

      {/* Friends list bottom sheet (when enabled & has friends) */}
      {settings.enabled && friends.length > 0 && (
        <div className="bg-[#0A0A0F] border-t border-white/10 px-4 py-3 max-h-40 overflow-y-auto">
          <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Freunde</h3>
          <div className="space-y-2">
            {friends.slice(0, 10).map((f) => (
              <div key={f.user_id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-500/30 flex items-center justify-center text-[11px] font-bold text-purple-300">
                    {(f.name || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-sm">{f.name || "Freund"}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-cyan-400">
                  <MapPin size={10}/>
                  {f.distance_km} km
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const VisibilityChip = ({ active, onClick, icon, label, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
      active ? "bg-purple-500/20 text-purple-300 border border-purple-400/40" : "text-white/50 hover:bg-white/5"
    }`}
  >
    {icon}
    {label}
  </button>
);
