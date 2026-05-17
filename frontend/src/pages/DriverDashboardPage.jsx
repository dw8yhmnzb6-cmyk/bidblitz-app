/**
 * BidBlitz Driver Mode - Unified Dashboard
 * Tabs: Home (online/offline + active ride + requests)
 *       Verlauf (ride history)
 *       Profil (driver profile + vehicle + stats)
 * Access: only verified & active drivers (backend 403 for others)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Power, MapPin, Navigation, CheckCircle, XCircle,
  Phone, Loader2, Car, Star, AlertCircle, Play, Bell, RefreshCw,
  Wallet, Home, History, User as UserIcon, Euro, TrendingUp,
  ChevronRight, Clock, FileText
} from "lucide-react";
import { toast } from "sonner";
import { DriverDocumentsPanel } from "../components/taxi/DriverDocumentsPanel";

const API = process.env.REACT_APP_BACKEND_URL;
const panelBg = "rgba(12, 14, 26, 0.95)";
const panelBorder = "1px solid rgba(255,255,255,0.06)";

const STATUS_LABELS = {
  accepted: { label: "Angenommen", color: "#00C2FF" },
  arriving: { label: "Unterwegs", color: "#3B82F6" },
  started: { label: "Fahrt läuft", color: "#FFB800" },
  completed: { label: "Abgeschlossen", color: "#00D26A" },
  canceled: { label: "Storniert", color: "#EF4444" },
  cancelled: { label: "Storniert", color: "#EF4444" },
  pending: { label: "Offen", color: "#A855F7" },
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Anfrage fehlgeschlagen");
  return data;
}

// ═══════════════ Tabs ═══════════════

const HomeTab = ({ status, onToggleOnline, onAccept, onReject, onUpdateStatus, busy, location }) => (
  <div className="space-y-4">
    {/* Online/Offline Toggle */}
    <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }} data-testid="driver-online-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${status?.is_online ? "bg-[#00D26A]/20" : "bg-white/5"}`}>
            <Power size={24} className={status?.is_online ? "text-[#00D26A]" : "text-white/40"} />
          </div>
          <div>
            <p className="text-white font-bold text-[15px]">{status?.is_online ? "Online" : "Offline"}</p>
            <p className="text-[11px] text-white/50">
              {status?.is_busy ? "In Fahrt" : status?.is_online ? "Bereit für Fahrten" : "Nicht verfügbar"}
            </p>
          </div>
        </div>
        <motion.button
          data-testid="driver-toggle-online-btn"
          onClick={onToggleOnline}
          disabled={busy || status?.is_busy || !location}
          className="px-5 py-3 rounded-xl font-bold text-[13px] disabled:opacity-50"
          style={{
            background: status?.is_online ? "rgba(239,68,68,0.15)" : "#00D26A",
            color: status?.is_online ? "#EF4444" : "#000",
            border: status?.is_online ? "1px solid rgba(239,68,68,0.3)" : "none",
          }}
          whileTap={{ scale: 0.96 }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : status?.is_online ? "Offline gehen" : "Online gehen"}
        </motion.button>
      </div>
      {!location && (
        <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
          <AlertCircle size={11} /> Standort wird benötigt
        </p>
      )}
    </div>

    {/* Earnings Summary */}
    <div className="grid grid-cols-3 gap-2">
      <StatCard label="Heute" value={`€${(status?.earnings?.today || 0).toFixed(2)}`} sub={`${status?.earnings?.today_rides || 0} Fahrten`} color="#00D26A" testid="stat-today"/>
      <StatCard label="Diese Woche" value={`€${(status?.earnings?.week || 0).toFixed(2)}`} sub={`${status?.earnings?.week_rides || 0} Fahrten`} color="#00C2FF" testid="stat-week"/>
      <StatCard label="Gesamt" value={status?.earnings?.total_rides || 0} sub="Fahrten" color="#A855F7" testid="stat-total"/>
    </div>

    {/* Active Ride */}
    {status?.active_ride && (
      <ActiveRideCard ride={status.active_ride} onUpdateStatus={onUpdateStatus} busy={busy} />
    )}

    {/* Pending Requests */}
    {status?.pending_requests?.length > 0 && (
      <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
        <div className="flex items-center gap-2 mb-3">
          <Bell size={15} className="text-[#FFB800]" />
          <span className="text-[13px] font-bold text-white">Neue Anfragen</span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFB800]/20 text-[#FFB800]">
            {status.pending_requests.length}
          </span>
        </div>
        <div className="space-y-2.5">
          {status.pending_requests.map((req) => (
            <RideRequestCard key={req.request_id} req={req} onAccept={onAccept} onReject={onReject} busy={busy} />
          ))}
        </div>
      </div>
    )}

    {/* Empty state */}
    {!status?.active_ride && !status?.pending_requests?.length && status?.is_online && (
      <div className="rounded-2xl p-8 text-center" style={{ background: panelBg, border: panelBorder }} data-testid="driver-empty-state">
        <Car size={42} className="text-white/10 mx-auto mb-3" />
        <p className="text-[13px] text-white/50 font-semibold">Warten auf Fahrtanfragen…</p>
        <p className="text-[11px] text-white/30 mt-1">Neue Anfragen erscheinen hier</p>
      </div>
    )}

    {!status?.is_online && (
      <div className="rounded-2xl p-8 text-center" style={{ background: panelBg, border: panelBorder }}>
        <Power size={42} className="text-white/10 mx-auto mb-3" />
        <p className="text-[13px] text-white/50 font-semibold">Gehe online, um Fahrten zu bekommen</p>
      </div>
    )}
  </div>
);

const StatCard = ({ label, value, sub, color, testid }) => (
  <div className="rounded-2xl p-3 text-center" style={{ background: panelBg, border: panelBorder }} data-testid={testid}>
    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-[17px] font-black tabular-nums" style={{ color }}>{value}</p>
    <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
  </div>
);

const ActiveRideCard = ({ ride, onUpdateStatus, busy }) => {
  const s = STATUS_LABELS[ride.status] || STATUS_LABELS.accepted;
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg,rgba(168,85,247,0.18),rgba(168,85,247,0.05))",
        border: "1px solid rgba(168,85,247,0.3)",
      }}
      data-testid="driver-active-ride"
    >
      <div className="flex items-center gap-2 mb-3">
        <Car size={16} className="text-[#A855F7]" />
        <span className="text-[13px] font-bold text-white">Aktive Fahrt</span>
        <span
          className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
          style={{ background: `${s.color}20`, color: s.color }}
        >
          {s.label}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00D26A] mt-1.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[9px] text-white/40 uppercase">Abholung</p>
            <p className="text-[12px] text-white">{ride.pickup?.address || `${ride.pickup?.lat?.toFixed?.(3)}, ${ride.pickup?.lng?.toFixed?.(3)}`}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444] mt-1.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[9px] text-white/40 uppercase">Ziel</p>
            <p className="text-[12px] text-white">{ride.destination?.address || `${ride.destination?.lat?.toFixed?.(3)}, ${ride.destination?.lng?.toFixed?.(3)}`}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
        <UserIcon size={13} className="text-white/40" />
        <span className="text-[12px] text-white">{ride.customer_name || "Kunde"}</span>
        <span className="ml-auto text-[14px] font-black text-[#00D26A]">€{(ride.estimated_fare || 0).toFixed(2)}</span>
        {ride.customer_phone && (
          <a href={`tel:${ride.customer_phone}`} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center" data-testid="ride-call-customer">
            <Phone size={13} className="text-white" />
          </a>
        )}
      </div>

      <div className="flex gap-2">
        {ride.status === "accepted" && (
          <StatusActionBtn onClick={() => onUpdateStatus(ride.ride_id, "arriving")} busy={busy} color="#3B82F6" icon={Navigation} label="Bin unterwegs" testid="ride-btn-arriving"/>
        )}
        {ride.status === "arriving" && (
          <StatusActionBtn onClick={() => onUpdateStatus(ride.ride_id, "started")} busy={busy} color="#FFB800" icon={Play} label="Fahrt starten" testid="ride-btn-start"/>
        )}
        {ride.status === "started" && (
          <StatusActionBtn onClick={() => onUpdateStatus(ride.ride_id, "completed")} busy={busy} color="#00D26A" icon={CheckCircle} label="Fahrt beenden" testid="ride-btn-complete"/>
        )}
        <motion.button
          data-testid="ride-btn-cancel"
          onClick={() => window.confirm("Fahrt wirklich stornieren?") && onUpdateStatus(ride.ride_id, "canceled")}
          disabled={busy}
          className="px-4 py-3 rounded-xl font-bold text-[13px] bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/25 disabled:opacity-50"
          whileTap={{ scale: 0.96 }}
        >
          <XCircle size={15} />
        </motion.button>
      </div>
    </div>
  );
};

const StatusActionBtn = ({ onClick, busy, color, icon: Icon, label, testid }) => (
  <motion.button
    data-testid={testid}
    onClick={onClick}
    disabled={busy}
    className="flex-1 py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 text-white disabled:opacity-50"
    style={{ background: color }}
    whileTap={{ scale: 0.96 }}
  >
    {busy ? <Loader2 size={15} className="animate-spin" /> : <><Icon size={15} />{label}</>}
  </motion.button>
);

const RideRequestCard = ({ req, onAccept, onReject, busy }) => (
  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]" data-testid={`req-${req.request_id}`}>
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        <MapPin size={12} className="text-[#00D26A]" />
        <span className="text-[11px] text-white font-semibold">{req.distance_km?.toFixed(1) || "?"} km entfernt</span>
      </div>
      <span className="text-[14px] font-black text-[#00D26A] tabular-nums">€{req.estimated_fare?.toFixed(2) || "—"}</span>
    </div>
    <p className="text-[10px] text-white/40 mb-2">ETA: {req.eta_minutes || "?"} Min.</p>
    <div className="flex gap-2">
      <motion.button
        data-testid={`req-accept-${req.request_id}`}
        onClick={() => onAccept(req.request_id)}
        disabled={busy}
        className="flex-1 py-2.5 bg-[#00D26A] rounded-lg text-black text-[12px] font-black disabled:opacity-50"
        whileTap={{ scale: 0.96 }}
      >
        Annehmen
      </motion.button>
      <motion.button
        data-testid={`req-reject-${req.request_id}`}
        onClick={() => onReject(req.request_id)}
        disabled={busy}
        className="flex-1 py-2.5 bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/25 rounded-lg text-[12px] font-bold disabled:opacity-50"
        whileTap={{ scale: 0.96 }}
      >
        Ablehnen
      </motion.button>
    </div>
  </div>
);

const HistoryTab = ({ rides, total, totalEarned, loading, onRefresh }) => (
  <div className="space-y-3">
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "linear-gradient(135deg,rgba(0,210,106,0.15),rgba(0,194,255,0.05))", border: "1px solid rgba(0,210,106,0.25)" }}
      data-testid="history-summary">
      <TrendingUp size={20} className="text-[#00D26A]" />
      <div>
        <p className="text-[10px] text-white/60 uppercase tracking-wider">Gesamt verdient</p>
        <p className="text-[22px] font-black text-[#00D26A] tabular-nums font-outfit leading-none mt-0.5">€{totalEarned.toFixed(2)}</p>
      </div>
      <p className="ml-auto text-[11px] text-white/60">{total} Fahrten</p>
    </div>

    {loading ? (
      <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/40"/></div>
    ) : rides.length === 0 ? (
      <div className="rounded-2xl p-8 text-center" style={{ background: panelBg, border: panelBorder }}>
        <History size={36} className="text-white/10 mx-auto mb-2"/>
        <p className="text-[12px] text-white/40">Noch keine Fahrten</p>
      </div>
    ) : (
      rides.map((r) => {
        const s = STATUS_LABELS[r.status] || STATUS_LABELS.completed;
        const date = r.completed_at || r.created_at;
        return (
          <div key={r.ride_id} className="rounded-xl p-3" style={{ background: panelBg, border: panelBorder }} data-testid={`history-ride-${r.ride_id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock size={11} className="text-white/40"/>
                <span className="text-[11px] text-white/60">
                  {date ? new Date(date).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase" style={{ background: `${s.color}20`, color: s.color }}>
                {s.label}
              </span>
            </div>
            <div className="space-y-1 mb-2">
              <p className="text-[11px] text-white truncate">
                <span className="text-[#00D26A]">●</span> {r.pickup?.address || "Abholung"}
              </p>
              <p className="text-[11px] text-white truncate">
                <span className="text-[#EF4444]">●</span> {r.destination?.address || "Ziel"}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-white/40">
                {r.distance_km?.toFixed(1) || "—"} km
              </span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: r.status === "completed" ? "#00D26A" : "#666" }}>
                {r.status === "completed" ? `+€${(r.driver_earnings || 0).toFixed(2)}` : "—"}
              </span>
            </div>
          </div>
        );
      })
    )}
    <button onClick={onRefresh} className="w-full py-2.5 rounded-xl text-[11px] text-white/50 hover:text-white/80" data-testid="history-refresh">
      <RefreshCw size={11} className="inline mr-1.5"/> Aktualisieren
    </button>
  </div>
);

const ProfileTab = ({ profile, onNavigate }) => {
  if (!profile) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/40"/></div>;
  return (
    <div className="space-y-3" data-testid="profile-tab">
      {/* Driver Hero */}
      <div className="rounded-2xl p-5 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}>
        <div className="w-16 h-16 rounded-full bg-white/20 mx-auto mb-2 flex items-center justify-center text-[22px] font-black text-white">
          {profile.name?.[0]?.toUpperCase() || "F"}
        </div>
        <p className="text-[16px] font-black text-white">{profile.name}</p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <Star size={12} className="text-white fill-white"/>
          <span className="text-[12px] font-bold text-white">{profile.rating?.toFixed(1)}</span>
          <span className="text-[11px] text-white/70">· {profile.stats.total_rides} Fahrten</span>
        </div>
        {profile.is_verified && (
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/25 text-white">
            ✓ Verifiziert
          </span>
        )}
      </div>

      {/* Wallet Card */}
      <motion.button
        data-testid="profile-wallet-btn"
        onClick={() => onNavigate("/wallet")}
        className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
        style={{ background: "linear-gradient(135deg,rgba(0,210,106,0.15),rgba(0,194,255,0.05))", border: "1px solid rgba(0,210,106,0.25)" }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="w-11 h-11 rounded-xl bg-[#00D26A]/20 flex items-center justify-center">
          <Wallet size={20} className="text-[#00D26A]"/>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-white/60 uppercase tracking-wider">Wallet Guthaben</p>
          <p className="text-[20px] font-black text-white tabular-nums font-outfit leading-none mt-0.5">€{profile.stats.wallet_balance.toFixed(2)}</p>
          <p className="text-[10px] text-white/50 mt-0.5">Verdienst: €{profile.stats.total_earned.toFixed(2)} gesamt</p>
        </div>
        <ChevronRight size={16} className="text-white/40"/>
      </motion.button>

      {/* Vehicle */}
      {profile.vehicle && (
        <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Fahrzeug</p>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
              <Car size={20} className="text-white/50"/>
            </div>
            <div>
              <p className="text-[14px] font-bold text-white">{profile.vehicle.model || "—"}</p>
              <p className="text-[11px] text-white/50">
                {profile.vehicle.license_plate || "—"}
                {profile.vehicle.color ? ` · ${profile.vehicle.color}` : ""}
                {profile.vehicle.year ? ` · ${profile.vehicle.year}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: panelBg, border: panelBorder }}>
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Kontakt</p>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-white/60">E-Mail</span>
          <span className="text-[12px] text-white">{profile.email}</span>
        </div>
        {profile.phone && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-white/60">Telefon</span>
            <span className="text-[12px] text-white">{profile.phone}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-white/60">Fahrer-ID</span>
          <span className="text-[11px] text-white font-mono">{profile.driver_id}</span>
        </div>
        {profile.joined_at && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-white/60">Seit</span>
            <span className="text-[12px] text-white">{new Date(profile.joined_at).toLocaleDateString("de-DE")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════ Main Page ═══════════════

const DriverDashboardPage = ({ onNavigate }) => {
  const [tab, setTab] = useState("home");
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState({ rides: [], total: 0, total_earned: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState(null);

  // Get location once
  useEffect(() => {
    if (!navigator.geolocation) { setLocation({ lat: 52.52, lng: 13.405 }); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setLocation({ lat: 52.52, lng: 13.405 }),
      { timeout: 5000 }
    );
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const d = await api("/api/driver-dashboard/status");
      setStatus(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api("/api/driver-dashboard/profile");
      setProfile(p);
    } catch (e) {
      // silently fail on profile, status error is primary
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const h = await api("/api/driver-dashboard/history?limit=50");
      setHistory(h);
    } catch {}
    setLoadingHistory(false);
  }, []);

  // Initial load + poll
  useEffect(() => {
    loadStatus();
    loadProfile();
    const i = setInterval(loadStatus, 10000);
    return () => clearInterval(i);
  }, [loadStatus, loadProfile]);

  // Load history when opening that tab
  useEffect(() => {
    if (tab === "history") loadHistory();
    if (tab === "profile") loadProfile();
  }, [tab, loadHistory, loadProfile]);

  const toggleOnline = async () => {
    if (!location) { toast.error("Standort wird benötigt"); return; }
    setBusy(true);
    try {
      if (status?.is_online) {
        await api("/api/driver-dashboard/go-offline", { method: "POST" });
        toast.success("Du bist jetzt offline");
      } else {
        await api("/api/driver-dashboard/go-online", { method: "POST", body: JSON.stringify(location) });
        toast.success("Du bist jetzt online — bereit für Fahrten!");
      }
      await loadStatus();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const acceptRide = async (id) => {
    setBusy(true);
    try { await api(`/api/driver-dashboard/ride-requests/${id}/accept`, { method: "POST" }); toast.success("Fahrt angenommen"); await loadStatus(); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const rejectRide = async (id) => {
    setBusy(true);
    try { await api(`/api/driver-dashboard/ride-requests/${id}/reject`, { method: "POST" }); toast("Anfrage abgelehnt"); await loadStatus(); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const updateStatus = async (rideId, newStatus) => {
    setBusy(true);
    try {
      await api(`/api/driver-dashboard/rides/${rideId}/status`, { method: "POST", body: JSON.stringify({ status: newStatus }) });
      const msgs = { arriving: "Kunde informiert", started: "Fahrt gestartet", completed: "Fahrt abgeschlossen · Verdienst im Wallet", canceled: "Fahrt storniert" };
      toast.success(msgs[newStatus] || "Status aktualisiert");
      await loadStatus();
      if (newStatus === "completed") { loadProfile(); loadHistory(); }
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  // Access denied → message
  if (error && !status) {
    return (
      <div className="min-h-screen bg-[#060810] p-4">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button onClick={() => onNavigate("/more")} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center" data-testid="driver-back-noaccess">
            <ArrowLeft size={18} className="text-white/50" />
          </button>
          <h1 className="text-[15px] font-bold text-white">Fahrer-Modus</h1>
        </div>
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center" data-testid="driver-no-access">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-[13px] font-semibold mb-2">Kein Zugriff</p>
          <p className="text-[12px] text-white/60">{error}</p>
          <p className="text-[11px] text-white/40 mt-3">Nur verifizierte Fahrer haben Zugang. Kontaktiere den Support für die Freischaltung.</p>
          <button
            onClick={() => onNavigate("/more")}
            className="mt-4 px-5 py-2 bg-white/10 rounded-lg text-white text-[12px]"
          >
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#A855F7]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060810] pb-24" data-testid="driver-dashboard">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={() => onNavigate("/more")} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="driver-back">
            <ArrowLeft size={16} className="text-white/70" />
          </button>
          <div className="flex-1">
            <h1 className="text-[14px] font-bold text-white">Fahrer-Modus</h1>
            <p className="text-[10px] text-white/40 leading-tight">Willkommen, {status?.name || "Fahrer"}</p>
          </div>
          <button onClick={loadStatus} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="driver-refresh">
            <RefreshCw size={14} className={`text-white/50 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pb-2">
          {[
            { id: "home", label: "Start", icon: Home },
            { id: "history", label: "Verlauf", icon: History },
            { id: "docs", label: "Dokumente", icon: FileText },
            { id: "profile", label: "Profil", icon: UserIcon },
          ].map((t) => (
            <button
              key={t.id}
              data-testid={`driver-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
              style={{
                background: tab === t.id ? "rgba(168,85,247,0.15)" : "transparent",
                color: tab === t.id ? "#A855F7" : "rgba(255,255,255,0.5)",
                border: tab === t.id ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent",
              }}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "home" && (
              <HomeTab
                status={status}
                onToggleOnline={toggleOnline}
                onAccept={acceptRide}
                onReject={rejectRide}
                onUpdateStatus={updateStatus}
                busy={busy}
                location={location}
              />
            )}
            {tab === "history" && (
              <HistoryTab
                rides={history.rides || []}
                total={history.total || 0}
                totalEarned={history.total_earned || 0}
                loading={loadingHistory}
                onRefresh={loadHistory}
              />
            )}
            {tab === "docs" && <DriverDocumentsPanel api={api} panelBg={panelBg} panelBorder={panelBorder} />}
            {tab === "profile" && <ProfileTab profile={profile} onNavigate={onNavigate} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DriverDashboardPage;
