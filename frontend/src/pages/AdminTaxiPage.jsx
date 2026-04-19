/**
 * AdminTaxiPage - Admin Taxi-Panel mit 4 Tabs:
 * Overview, Drivers, Rides, Fare Settings
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Users, Car, DollarSign, Settings,
  Check, X, AlertCircle, Clock, MapPin, Euro, Save,
  RefreshCw, Ban, UserCheck, Pause
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;
const panelBg = "rgba(12, 14, 26, 0.95)";
const panelBorder = "1px solid rgba(255,255,255,0.06)";

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

// ═══════════ Overview Tab ═══════════

const OverviewTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api("/api/admin/taxi/overview")); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  if (loading && !data) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/40"/></div>;
  if (!data) return null;

  const { drivers, rides, revenue } = data;
  return (
    <div className="space-y-4" data-testid="admin-taxi-overview">
      <div>
        <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Umsatz (Platform-Provision)</h3>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Heute" value={`€${(revenue.today || 0).toFixed(2)}`} color="#00D26A"/>
          <Metric label="Woche" value={`€${(revenue.week || 0).toFixed(2)}`} color="#00C2FF"/>
          <Metric label="Monat" value={`€${(revenue.month || 0).toFixed(2)}`} color="#A855F7"/>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Fahrer</h3>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Gesamt" value={drivers.total} color="#fff"/>
          <Metric label="Aktiv" value={drivers.active} color="#00D26A"/>
          <Metric label="Online" value={drivers.online} color="#00C2FF"/>
          <Metric label="In Fahrt" value={drivers.busy} color="#FFB800"/>
          {drivers.pending_approval > 0 && (
            <div className="col-span-2 rounded-2xl p-3 bg-[#FFB800]/10 border border-[#FFB800]/30 flex items-center gap-2">
              <AlertCircle size={14} className="text-[#FFB800]"/>
              <span className="text-[12px] text-[#FFB800] font-bold">{drivers.pending_approval} Bewerbungen warten</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Fahrten</h3>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Gesamt" value={rides.total} color="#fff"/>
          <Metric label="Heute" value={rides.today} color="#00C2FF"/>
          <Metric label="Aktiv" value={rides.active} color="#A855F7"/>
          <Metric label="Heute abgeschlossen" value={rides.completed_today} color="#00D26A"/>
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, color }) => (
  <div className="rounded-2xl p-3" style={{ background: panelBg, border: panelBorder }}>
    <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
    <p className="text-[20px] font-black tabular-nums mt-1" style={{ color }}>{value}</p>
  </div>
);

// ═══════════ Drivers Tab ═══════════

const DriversTab = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : "";
      const d = await api(`/api/admin/taxi/drivers${q}`);
      setDrivers(d.drivers || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const action = async (did, act, reason = "") => {
    setBusy(did + act);
    try {
      const q = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      await api(`/api/admin/taxi/drivers/${did}/${act}${q}`, { method: "POST" });
      toast.success(`Fahrer ${act === "approve" ? "freigegeben" : act === "reject" ? "abgelehnt" : act === "suspend" ? "gesperrt" : "reaktiviert"}`);
      await load();
    } catch (e) { toast.error(e.message); }
    setBusy(null);
  };

  return (
    <div className="space-y-3" data-testid="admin-taxi-drivers">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["", "active", "pending", "suspended", "rejected"].map(f => (
          <button key={f || "all"}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
            style={{
              background: filter === f ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
              color: filter === f ? "#A855F7" : "rgba(255,255,255,0.6)",
              border: filter === f ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.06)",
            }}
            data-testid={`drv-filter-${f || "all"}`}
          >
            {f || "Alle"}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <RefreshCw size={11} className="text-white/60"/>
        </button>
      </div>

      {loading ? <Loader2 className="animate-spin text-white/40 mx-auto my-6"/> :
       drivers.length === 0 ? <p className="text-center text-[12px] text-white/40 py-6">Keine Fahrer</p> :
       drivers.map(d => (
        <div key={d.driver_id} className="rounded-2xl p-3" style={{ background: panelBg, border: panelBorder }} data-testid={`drv-row-${d.driver_id}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-[13px] font-black text-white">
              {(d.user_name || d.name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{d.user_name || d.name || "—"}</p>
              <p className="text-[10px] text-white/50 truncate">{d.user_email || "—"} · {d.driver_id}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase"
              style={{
                background: d.status === "active" ? "rgba(0,210,106,0.15)" : d.status === "suspended" ? "rgba(239,68,68,0.15)" : d.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(255,184,0,0.15)",
                color: d.status === "active" ? "#00D26A" : d.status === "suspended" || d.status === "rejected" ? "#EF4444" : "#FFB800",
              }}>
              {d.status || "pending"}
            </span>
          </div>
          <div className="flex gap-2 text-[10px] text-white/50 mb-2">
            {d.vehicle?.model && <span>🚗 {d.vehicle.model}</span>}
            {d.vehicle?.license_plate && <span>· {d.vehicle.license_plate}</span>}
            {d.rating && <span>· ⭐ {d.rating.toFixed?.(1) || d.rating}</span>}
            {typeof d.total_rides === "number" && <span>· {d.total_rides} Fahrten</span>}
          </div>
          <div className="flex gap-1.5">
            {(d.status === "pending" || d.status === "pending_approval" || !d.is_verified) && (
              <>
                <button onClick={() => action(d.driver_id, "approve")} disabled={busy}
                  className="flex-1 py-2 rounded-lg bg-[#00D26A] text-black text-[11px] font-black disabled:opacity-50"
                  data-testid={`drv-approve-${d.driver_id}`}>
                  <Check size={12} className="inline mr-1"/>Freigeben
                </button>
                <button onClick={() => { const r = prompt("Grund für Ablehnung:"); if (r) action(d.driver_id, "reject", r); }} disabled={busy}
                  className="flex-1 py-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/25 text-[11px] font-bold disabled:opacity-50"
                  data-testid={`drv-reject-${d.driver_id}`}>
                  <X size={12} className="inline mr-1"/>Ablehnen
                </button>
              </>
            )}
            {d.status === "active" && (
              <button onClick={() => { const r = prompt("Grund für Sperre:"); if (r) action(d.driver_id, "suspend", r); }} disabled={busy}
                className="flex-1 py-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/25 text-[11px] font-bold disabled:opacity-50"
                data-testid={`drv-suspend-${d.driver_id}`}>
                <Pause size={12} className="inline mr-1"/>Sperren
              </button>
            )}
            {(d.status === "suspended" || d.status === "rejected") && (
              <button onClick={() => action(d.driver_id, "reactivate")} disabled={busy}
                className="flex-1 py-2 rounded-lg bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/25 text-[11px] font-bold disabled:opacity-50"
                data-testid={`drv-reactivate-${d.driver_id}`}>
                <UserCheck size={12} className="inline mr-1"/>Reaktivieren
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════ Rides Tab ═══════════

const RidesTab = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : "";
      const d = await api(`/api/admin/taxi/rides${q}`);
      setRides(d.rides || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const cancelRide = async (rid) => {
    const reason = prompt("Grund für Stornierung:");
    if (!reason || reason.length < 3) return;
    setBusy(rid);
    try {
      await api(`/api/admin/taxi/rides/${rid}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      toast.success("Fahrt storniert");
      await load();
    } catch (e) { toast.error(e.message); }
    setBusy(null);
  };

  return (
    <div className="space-y-3" data-testid="admin-taxi-rides">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["", "accepted", "started", "completed", "cancelled"].map(f => (
          <button key={f || "all"} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
            style={{
              background: filter === f ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
              color: filter === f ? "#A855F7" : "rgba(255,255,255,0.6)",
              border: filter === f ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.06)",
            }}>
            {f || "Alle"}
          </button>
        ))}
      </div>
      {loading ? <Loader2 className="animate-spin text-white/40 mx-auto my-6"/> :
       rides.length === 0 ? <p className="text-center text-[12px] text-white/40 py-6">Keine Fahrten</p> :
       rides.map(r => (
        <div key={r.ride_id} className="rounded-2xl p-3" style={{ background: panelBg, border: panelBorder }} data-testid={`ride-${r.ride_id}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-white/40">{r.ride_id?.slice(-8)}</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase"
              style={{
                background: r.status === "completed" ? "rgba(0,210,106,0.15)" : r.status?.includes("cancel") ? "rgba(239,68,68,0.15)" : "rgba(255,184,0,0.15)",
                color: r.status === "completed" ? "#00D26A" : r.status?.includes("cancel") ? "#EF4444" : "#FFB800",
              }}>
              {r.status}
            </span>
          </div>
          <p className="text-[11px] text-white truncate">👤 {r.customer_name || r.customer_email || "—"}</p>
          <p className="text-[11px] text-white truncate">🚗 Fahrer: {r.driver_id || "—"}</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-white/60 truncate"><span className="text-[#00D26A]">●</span> {r.pickup?.address || "—"}</p>
            <p className="text-[10px] text-white/60 truncate"><span className="text-[#EF4444]">●</span> {r.destination?.address || "—"}</p>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] text-white/40">
              {r.created_at ? new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "—"}
            </span>
            <span className="text-[12px] font-black text-[#00D26A] tabular-nums">
              €{(r.final_fare || r.estimated_fare || 0).toFixed(2)}
            </span>
          </div>
          {["accepted", "arriving", "started", "pending", "searching_driver"].includes(r.status) && (
            <button onClick={() => cancelRide(r.ride_id)} disabled={busy === r.ride_id}
              className="w-full mt-2 py-1.5 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/25 text-[10px] font-bold disabled:opacity-50"
              data-testid={`ride-cancel-${r.ride_id}`}>
              <Ban size={11} className="inline mr-1"/>Stornieren
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ═══════════ Fare Settings Tab ═══════════

const FareSettingsTab = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/api/admin/taxi/fare-settings");
      setSettings(d.settings || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (s) => {
    setSaving(s.vehicle_type);
    try {
      await api("/api/admin/taxi/fare-settings", {
        method: "POST",
        body: JSON.stringify({
          vehicle_type: s.vehicle_type,
          base_fare: parseFloat(s.base_fare),
          price_per_km: parseFloat(s.price_per_km),
          price_per_minute: parseFloat(s.price_per_minute),
          minimum_fare: parseFloat(s.minimum_fare),
          cancellation_fee: parseFloat(s.cancellation_fee),
          active: !!s.active,
        }),
      });
      toast.success(`${s.vehicle_type} gespeichert`);
      await load();
    } catch (e) { toast.error(e.message); }
    setSaving(null);
  };

  const update = (idx, field, val) => {
    const copy = [...settings];
    copy[idx] = { ...copy[idx], [field]: val };
    setSettings(copy);
  };

  if (loading) return <Loader2 className="animate-spin text-white/40 mx-auto my-8"/>;

  return (
    <div className="space-y-3" data-testid="admin-taxi-fare-settings">
      {settings.map((s, i) => (
        <div key={s.vehicle_type} className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }} data-testid={`fare-${s.vehicle_type}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-bold text-white uppercase">{s.vehicle_type}</h4>
            <label className="flex items-center gap-2 text-[11px] text-white/70">
              <input type="checkbox" checked={s.active} onChange={e => update(i, "active", e.target.checked)} data-testid={`fare-${s.vehicle_type}-active`}/>
              Aktiv
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["base_fare", "Grundgebühr €"],
              ["price_per_km", "€ pro km"],
              ["price_per_minute", "€ pro Min."],
              ["minimum_fare", "Mindestpreis €"],
              ["cancellation_fee", "Stornogebühr €"],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="text-[10px] text-white/50 uppercase tracking-wider">{label}</label>
                <input type="number" step="0.10" value={s[k]} onChange={e => update(i, k, e.target.value)}
                  data-testid={`fare-${s.vehicle_type}-${k}`}
                  className="w-full mt-1 px-2.5 py-2 bg-black/30 border border-white/10 rounded-lg text-[13px] text-white tabular-nums focus:border-[#A855F7] focus:outline-none"/>
              </div>
            ))}
          </div>
          <button onClick={() => save(s)} disabled={saving === s.vehicle_type}
            className="w-full mt-3 py-2.5 rounded-xl bg-[#A855F7] text-white text-[12px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid={`fare-${s.vehicle_type}-save`}>
            {saving === s.vehicle_type ? <Loader2 size={13} className="animate-spin"/> : <><Save size={13}/>Speichern</>}
          </button>
        </div>
      ))}
    </div>
  );
};

// ═══════════ Main ═══════════

export default function AdminTaxiPage({ onNavigate }) {
  const [tab, setTab] = useState("overview");

  return (
    <div className="min-h-screen bg-[#060810] pb-24" data-testid="admin-taxi-page">
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={() => onNavigate("/admin")} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="admin-taxi-back">
            <ArrowLeft size={16} className="text-white/70"/>
          </button>
          <h1 className="text-[14px] font-bold text-white">Taxi-Administration</h1>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {[
            { id: "overview", label: "Übersicht", icon: DollarSign },
            { id: "drivers", label: "Fahrer", icon: Users },
            { id: "rides", label: "Fahrten", icon: Car },
            { id: "settings", label: "Preise", icon: Settings },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-taxi-tab-${t.id}`}
              className="flex-1 min-w-[90px] py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
              style={{
                background: tab === t.id ? "rgba(168,85,247,0.15)" : "transparent",
                color: tab === t.id ? "#A855F7" : "rgba(255,255,255,0.5)",
                border: tab === t.id ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent",
              }}>
              <t.icon size={12}/>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {tab === "overview" && <OverviewTab/>}
            {tab === "drivers" && <DriversTab/>}
            {tab === "rides" && <RidesTab/>}
            {tab === "settings" && <FareSettingsTab/>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
