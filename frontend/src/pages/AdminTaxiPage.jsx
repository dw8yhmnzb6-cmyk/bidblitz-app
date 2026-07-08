/**
 * AdminTaxiPage - Admin Taxi-Panel mit 4 Tabs:
 * Overview, Drivers, Rides, Fare Settings
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Users, Car, DollarSign, Settings,
  Check, X, AlertCircle, Clock, MapPin, Euro, Save,
  RefreshCw, Ban, UserCheck, Pause, FileText, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { TaxiTariffZonesAdmin } from "../components/taxi/TaxiTariffZonesAdmin";
import { TaxiCityPricingAdmin } from "../components/taxi/TaxiCityPricingAdmin";

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


// ═══════════ Modes Tab (Unternehmer / Privat) ═══════════

const ModesTab = () => {
  const [modes, setModes] = useState({ business: null, private: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/api/admin/taxi/mode-settings");
      setModes(data.settings || {});
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveMode = async (mode, patch) => {
    setSaving(mode);
    try {
      await api("/api/admin/taxi/mode-settings", {
        method: "POST",
        body: JSON.stringify({ mode, ...patch }),
      });
      toast.success(`${mode === "business" ? "Unternehmer" : "Privat"}-Modus aktualisiert`);
      await load();
    } catch (e) { toast.error(e.message); }
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/40"/></div>;

  return (
    <div className="space-y-4" data-testid="admin-taxi-modes">
      <p className="text-[11px] text-white/50 leading-relaxed">
        Steuere die beiden Taxi-Modi (Unternehmer vs. Privat): An/Aus, Provision, Preis-Multiplikator und Labels.
        Änderungen wirken sofort auf der Kunden-Taxi-Seite.
      </p>

      {(["business", "private"]).map((key) => {
        const m = modes[key] || {};
        const color = key === "business" ? "#00C2FF" : "#A855F7";
        const title = key === "business" ? "Unternehmer-Taxi" : "Privat-Taxi";
        return (
          <div key={key} className="rounded-2xl p-4 border"
               style={{ background: panelBg, borderColor: `${color}33` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.enabled ? color : "#4a4a4a" }}/>
                  <h3 className="font-bold text-white text-[15px]">{title}</h3>
                </div>
                <p className="text-[10px] text-white/40 mt-0.5">
                  {m.enabled ? "Aktiv – Kunden können diesen Modus wählen" : "Deaktiviert – Modus ist für Kunden ausgeblendet"}
                </p>
              </div>
              <button
                onClick={() => saveMode(key, { enabled: !m.enabled })}
                disabled={saving === key}
                data-testid={`mode-toggle-${key}`}
                className="relative w-14 h-7 rounded-full transition-colors"
                style={{ background: m.enabled ? color : "rgba(255,255,255,0.1)" }}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${m.enabled ? "left-[30px]" : "left-0.5"}`}/>
              </button>
            </div>

            <div className="space-y-3">
              <LabelInput
                label="Label"
                value={m.label || ""}
                testid={`mode-label-${key}`}
                onSave={(val) => saveMode(key, { label: val })}
                saving={saving === key}
                color={color}
              />
              <LabelInput
                label="Beschreibung"
                value={m.description || ""}
                testid={`mode-desc-${key}`}
                onSave={(val) => saveMode(key, { description: val })}
                saving={saving === key}
                color={color}
              />
              <SliderRow
                label="Provision"
                unit="%"
                value={(m.commission_rate || 0) * 100}
                min={0} max={30} step={0.5}
                testid={`mode-commission-${key}`}
                onCommit={(val) => saveMode(key, { commission_rate: val / 100 })}
                color={color}
                helper={`Plattform-Provision pro Fahrt (${((m.commission_rate || 0) * 100).toFixed(1)}% vom Fahrpreis)`}
              />
              <SliderRow
                label="Preis-Multiplikator"
                unit="×"
                value={m.price_multiplier || 1}
                min={0.5} max={2} step={0.05}
                testid={`mode-price-mult-${key}`}
                onCommit={(val) => saveMode(key, { price_multiplier: val })}
                color={color}
                helper={`Basis-Preis × ${(m.price_multiplier || 1).toFixed(2)} (1.0 = normal, 0.85 = 15% günstiger)`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LabelInput = ({ label, value, onSave, saving, testid, color }) => {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  const changed = v !== value;
  return (
    <div>
      <label className="text-[10px] text-white/50 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2 mt-1">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          data-testid={testid}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none"
          style={{ borderColor: changed ? color : undefined }}
        />
        {changed && (
          <button
            onClick={() => onSave(v.trim())}
            disabled={saving}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-black"
            style={{ background: color }}
          >
            {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
          </button>
        )}
      </div>
    </div>
  );
};

const SliderRow = ({ label, unit, value, min, max, step, onCommit, color, helper, testid }) => {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-white/50 uppercase tracking-wider">{label}</label>
        <span className="text-sm font-bold" style={{ color }}>
          {typeof v === "number" ? v.toFixed(unit === "×" ? 2 : 1) : v}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={v}
        onChange={(e) => setV(parseFloat(e.target.value))}
        onMouseUp={(e) => onCommit(parseFloat(e.target.value))}
        onTouchEnd={(e) => onCommit(parseFloat(e.target.value))}
        data-testid={testid}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color, background: "rgba(255,255,255,0.1)" }}
      />
      {helper && <p className="text-[9px] text-white/40 mt-1">{helper}</p>}
    </div>
  );
};

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


// ═══════════ Driver Applications Tab ═══════════

const ApplicationsTab = () => {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/api/admin/taxi/driver-applications${filter !== 'all' ? `?status=${filter}` : ''}`);
      setApplications(data.applications || []);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (appId) => {
    setActionLoading(appId);
    try {
      await api(`/api/admin/taxi/driver-applications/${appId}/approve`, { method: 'POST' });
      toast.success("Bewerbung genehmigt");
      load();
    } catch (e) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const handleReject = async (appId, reason = "") => {
    const confirmed = window.confirm("Bewerbung ablehnen?");
    if (!confirmed) return;

    setActionLoading(appId);
    try {
      await api(`/api/admin/taxi/driver-applications/${appId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      toast.success("Bewerbung abgelehnt");
      load();
    } catch (e) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const handleDelete = async (appId) => {
    const confirmed = window.confirm("Bewerbung endgültig löschen?");
    if (!confirmed) return;

    setActionLoading(appId);
    try {
      await api(`/api/admin/taxi/driver-applications/${appId}`, { method: 'DELETE' });
      toast.success("Bewerbung gelöscht");
      load();
    } catch (e) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-4" data-testid="admin-taxi-applications">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-3" style={{ background: panelBg, border: panelBorder }}>
          <p className="text-[9px] text-white/40 uppercase tracking-wider">Ausstehend</p>
          <p className="text-[20px] font-black text-[#FFB800] tabular-nums mt-1">{stats.pending}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: panelBg, border: panelBorder }}>
          <p className="text-[9px] text-white/40 uppercase tracking-wider">Genehmigt</p>
          <p className="text-[20px] font-black text-[#00D26A] tabular-nums mt-1">{stats.approved}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: panelBg, border: panelBorder }}>
          <p className="text-[9px] text-white/40 uppercase tracking-wider">Abgelehnt</p>
          <p className="text-[20px] font-black text-[#EF4444] tabular-nums mt-1">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { id: 'pending', label: 'Ausstehend', color: '#FFB800' },
          { id: 'approved', label: 'Genehmigt', color: '#00D26A' },
          { id: 'rejected', label: 'Abgelehnt', color: '#EF4444' },
          { id: 'all', label: 'Alle', color: '#fff' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex-1 py-2 rounded-xl text-[11px] font-bold"
            style={{
              background: filter === f.id ? `${f.color}20` : 'transparent',
              color: filter === f.id ? f.color : 'rgba(255,255,255,0.5)',
              border: filter === f.id ? `1px solid ${f.color}40` : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading && applications.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-white/40" />
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">Keine Bewerbungen</div>
      ) : (
        <div className="space-y-2">
          {applications.map(app => {
            const statusColors = {
              pending: { bg: 'rgba(255,184,0,0.1)', border: 'rgba(255,184,0,0.3)', text: '#FFB800' },
              approved: { bg: 'rgba(0,210,106,0.1)', border: 'rgba(0,210,106,0.3)', text: '#00D26A' },
              rejected: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#EF4444' },
            };
            const colors = statusColors[app.status] || statusColors.pending;

            return (
              <div
                key={app.application_id}
                className="rounded-2xl p-4"
                style={{ background: panelBg, border: panelBorder }}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase"
                    style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                  >
                    {app.status === 'pending' ? 'Ausstehend' : app.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                  </div>
                  <p className="text-[10px] text-white/40">
                    {new Date(app.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>

                {/* Driver Info */}
                <div className="space-y-2 mb-3">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Name</p>
                    <p className="text-[13px] text-white font-bold">{app.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Email</p>
                      <p className="text-[11px] text-white/70">{app.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Telefon</p>
                      <p className="text-[11px] text-white/70">{app.phone}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Führerschein</p>
                      <p className="text-[11px] text-white/70">{app.license_number}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Fahrzeug</p>
                      <p className="text-[11px] text-white/70 capitalize">{app.vehicle_type}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Typ</p>
                      <p className="text-[11px] text-white/70 capitalize">
                        {app.driver_type === 'business' ? 'Unternehmer' : 'Privat'}
                      </p>
                    </div>
                    {app.city && (
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Stadt</p>
                        <p className="text-[11px] text-white/70">{app.city}</p>
                      </div>
                    )}
                  </div>
                  {app.message && (
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Nachricht</p>
                      <p className="text-[11px] text-white/70">{app.message}</p>
                    </div>
                  )}
                </div>

                {/* Review Info */}
                {app.reviewed_at && (
                  <div className="mb-3 p-2 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/40">
                      Geprüft am {new Date(app.reviewed_at).toLocaleDateString('de-DE')} von {app.reviewed_by}
                    </p>
                    {app.rejection_reason && (
                      <p className="text-[10px] text-red-400 mt-1">Grund: {app.rejection_reason}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(app.application_id)}
                      disabled={actionLoading === app.application_id}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-[#00D26A]/20 text-[#00D26A] border border-[#00D26A]/30 hover:bg-[#00D26A]/30 disabled:opacity-50"
                    >
                      {actionLoading === app.application_id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Genehmigen
                    </button>
                    <button
                      onClick={() => handleReject(app.application_id)}
                      disabled={actionLoading === app.application_id}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/30 disabled:opacity-50"
                    >
                      {actionLoading === app.application_id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                      Ablehnen
                    </button>
                  </div>
                )}

                {app.status !== 'pending' && (
                  <button
                    onClick={() => handleDelete(app.application_id)}
                    disabled={actionLoading === app.application_id}
                    className="w-full py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-white/5 text-white/40 border border-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50"
                  >
                    {actionLoading === app.application_id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Löschen
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
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
            { id: "applications", label: "Bewerbungen", icon: FileText },
            { id: "modes", label: "Modi", icon: UserCheck },
            { id: "zones", label: "Zonen", icon: MapPin },
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
            {tab === "applications" && <ApplicationsTab/>}
            {tab === "modes" && <ModesTab/>}
            {tab === "zones" && <TaxiTariffZonesAdmin api={api} panelBg={panelBg} panelBorder={panelBorder} />}
            {tab === "drivers" && <DriversTab/>}
            {tab === "rides" && <RidesTab/>}
            {tab === "settings" && (
              <div className="space-y-4">
                <FareSettingsTab/>
                <TaxiCityPricingAdmin api={api} panelBg={panelBg} panelBorder={panelBorder} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
