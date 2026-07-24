/**
 * Manager Geofence Page — CRUD + Live-Arrivals.
 * Route: /merchant/staff/geofence
 */
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Plus, Trash2, Loader2, Activity, Users,
  CheckCircle2, AlertTriangle, Building2, Warehouse, Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import {
  StaffCard, StaffButton, StaffEmptyState, StaffSegmented, StaffListItem, StaffStatusBadge,
} from "./components";
import LiveActivityTimeline from "./LiveActivityTimeline";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_ICONS = { office: Briefcase, warehouse: Warehouse, branch: Building2, site: MapPin, other: MapPin };

export default function ManagerGeofencePage({ onBack }) {
  const [tab, setTab] = useState("timeline");
  const [fences, setFences] = useState([]);
  const [events, setEvents] = useState([]);
  const [clockEvents, setClockEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [fr, er, cr, mr] = await Promise.all([
        fetch(`${API}/api/staff/geofence?include_inactive=true`, { credentials: "include" }),
        fetch(`${API}/api/staff/geofence/events?limit=50`, { credentials: "include" }),
        fetch(`${API}/api/staff/clock/today`, { credentials: "include" }),
        fetch(`${API}/api/staff/members`, { credentials: "include" }),
      ]);
      if (fr.ok) setFences((await fr.json()).geofences || []);
      if (er.ok) setEvents((await er.json()).events || []);
      if (cr.ok) setClockEvents((await cr.json()).events || []);
      if (mr.ok) setMembers((await mr.json()).members || []);
    } catch (e) {
      toast.error(e.message || "Fehler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // Live refresh every 30s
    return () => clearInterval(id);
  }, []);

  const memberById = useMemo(() => {
    const m = {};
    members.forEach((mb) => { m[mb.id] = mb; });
    return m;
  }, [members]);
  const fenceById = useMemo(() => {
    const m = {};
    fences.forEach((f) => { m[f.id] = f; });
    return m;
  }, [fences]);

  // Unified timeline = clock_events ∪ geofence_events with staff name + fence name hydrated
  const timelineEvents = useMemo(() => {
    const hydrated = [];
    clockEvents.forEach((e) => hydrated.push({
      id: e.id || `${e.staff_id}-${e.timestamp}`,
      staff_id: e.staff_id,
      staff_name: memberById[e.staff_id]?.name,
      action: e.action,
      ts: e.timestamp,
      geofence_name: e.geofence_id ? fenceById[e.geofence_id]?.name : undefined,
    }));
    events.forEach((e) => hydrated.push({
      id: e.id,
      staff_id: e.staff_id,
      staff_name: memberById[e.staff_id]?.name,
      event_type: e.event_type,
      ts: e.ts,
      geofence_name: fenceById[e.geofence_id]?.name,
      suspected_spoof: e.suspected_spoof,
    }));
    return hydrated;
  }, [clockEvents, events, memberById, fenceById]);

  const arrivals = useMemo(() => events.filter(e => ["entered", "checked_in"].includes(e.event_type)), [events]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-lg border-b border-slate-200">
        <div className="px-5 py-4 flex items-center gap-3 max-w-5xl mx-auto">
          <button onClick={onBack} data-testid="geo-back" className="p-2 -ml-2 rounded-xl hover:bg-slate-200/60 transition">
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Standorte & Ankünfte</h1>
            <p className="text-xs text-slate-500">Smart Arrival Check-In</p>
          </div>
          {tab === "fences" && (
            <StaffButton variant="primary" size="sm" onClick={() => setShowForm(true)} icon={<Plus size={14} />} testid="geo-add-btn">
              Neu
            </StaffButton>
          )}
        </div>
        <div className="px-5 pb-3 max-w-5xl mx-auto">
          <StaffSegmented
            current={tab}
            onChange={setTab}
            options={[
              { id: "timeline", label: "Live-Stream" },
              { id: "fences", label: `Standorte (${fences.length})` },
              { id: "arrivals", label: `Ankünfte (${arrivals.length})` },
            ]}
            testid="geo-tabs"
          />
        </div>
      </div>

      <div className="px-5 py-6 max-w-5xl mx-auto space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        )}

        {!loading && tab === "timeline" && (
          <StaffCard testid="geo-timeline-card" className="!p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Live Activity</p>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-500" />
                  Was passiert gerade
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Live · alle 30s
              </span>
            </div>
            <LiveActivityTimeline events={timelineEvents} limit={30} testid="geo-live-timeline" />
          </StaffCard>
        )}

        {!loading && tab === "fences" && fences.length === 0 && (
          <StaffEmptyState
            icon={MapPin}
            title="Noch kein Standort definiert"
            description="Lege deinen ersten Geofence an. Mitarbeiter werden beim Ankommen automatisch erkannt."
            action={
              <StaffButton variant="primary" onClick={() => setShowForm(true)} icon={<Plus size={14} />} testid="geo-empty-add">
                Standort erstellen
              </StaffButton>
            }
            testid="geo-empty"
          />
        )}

        {!loading && tab === "fences" && fences.map((f) => {
          const Icon = TYPE_ICONS[f.type] || MapPin;
          return (
            <StaffCard key={f.id} testid={`geo-item-${f.id}`}>
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${f.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold truncate">{f.name}</h3>
                    {!f.active && <StaffStatusBadge status="off" label="Inaktiv" />}
                    {f.auto_checkin && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">AUTO</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                    {f.lat.toFixed(5)}, {f.lng.toFixed(5)} · Radius {f.radius_m}m
                  </p>
                  {(f.wifi_ssid || f.bluetooth_beacon_id) && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      {f.wifi_ssid && `WLAN: ${f.wifi_ssid}`} {f.bluetooth_beacon_id && `· BT: ${f.bluetooth_beacon_id}`}
                    </p>
                  )}
                </div>
                <StaffButton
                  variant="ghost"
                  size="xs"
                  onClick={async () => {
                    if (!window.confirm(`"${f.name}" deaktivieren?`)) return;
                    const r = await fetch(`${API}/api/staff/geofence/${f.id}`, { method: "DELETE", credentials: "include" });
                    if (r.ok) { toast.success("Deaktiviert"); load(); }
                  }}
                  icon={<Trash2 size={14} />}
                  testid={`geo-delete-${f.id}`}
                />
              </div>
            </StaffCard>
          );
        })}

        {!loading && tab === "arrivals" && events.length === 0 && (
          <StaffEmptyState icon={Activity} title="Noch keine Ankünfte" description="Sobald Mitarbeiter im Geofence-Radius ankommen, erscheinen sie hier in Echtzeit." testid="geo-arrivals-empty" />
        )}

        {!loading && tab === "arrivals" && events.map((e) => (
          <StaffListItem
            key={e.id}
            testid={`arrival-${e.id}`}
            avatar={
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                e.event_type === "checked_in" ? "bg-emerald-100 text-emerald-700" :
                e.event_type === "entered"    ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-400"
              }`}>
                {e.event_type === "checked_in" ? <CheckCircle2 size={16} /> : e.suspected_spoof ? <AlertTriangle size={16} /> : <MapPin size={16} />}
              </div>
            }
            title={
              <span>
                Staff <span className="font-mono text-xs">{(e.staff_id || "").slice(0, 8)}</span> ·{" "}
                {e.event_type === "checked_in" ? "Eingecheckt" : e.event_type === "entered" ? "Angekommen" : e.event_type === "skipped" ? "Übersprungen" : e.event_type}
              </span>
            }
            subtitle={
              <span className="flex items-center gap-2">
                {new Date(e.ts).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {e.suspected_spoof && <span className="text-red-500 text-[10px] font-bold">⚠ {e.spoof_reason || "Spoof?"}</span>}
              </span>
            }
          />
        ))}
      </div>

      {/* Form Modal */}
      {showForm && <GeofenceForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
function GeofenceForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "", lat: "", lng: "", radius_m: 100, type: "office",
    auto_checkin: false, wifi_ssid: "", bluetooth_beacon_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const useMyLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); setGeoLoading(false); },
      () => { toast.error("Standort konnte nicht ermittelt werden"); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/staff/geofence`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          lat: parseFloat(form.lat), lng: parseFloat(form.lng),
          radius_m: parseInt(form.radius_m, 10),
          type: form.type, auto_checkin: form.auto_checkin,
          wifi_ssid: form.wifi_ssid || undefined,
          bluetooth_beacon_id: form.bluetooth_beacon_id || undefined,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || "Fehler"); }
      toast.success("Standort erstellt");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl"
      >
        <form onSubmit={submit} className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Neuer Standort</h2>
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-semibold">Name</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Termokos HQ" data-testid="geo-form-name"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-semibold">Latitude</label>
              <input type="number" step="any" required value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })}
                data-testid="geo-form-lat"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:border-blue-400 focus:bg-white" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-semibold">Longitude</label>
              <input type="number" step="any" required value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })}
                data-testid="geo-form-lng"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:border-blue-400 focus:bg-white" />
            </div>
          </div>
          <button type="button" onClick={useMyLocation} disabled={geoLoading} data-testid="geo-form-use-location"
            className="w-full py-2.5 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold border border-blue-100 hover:bg-blue-100 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            Aktuelle Position übernehmen
          </button>
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-semibold">Radius (Meter)</label>
            <input type="number" min={10} max={5000} value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
              data-testid="geo-form-radius"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block font-semibold">Typ</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="geo-form-type"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-400 focus:bg-white">
              <option value="office">Büro</option>
              <option value="warehouse">Lager</option>
              <option value="branch">Filiale</option>
              <option value="site">Baustelle</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
            <input type="checkbox" checked={form.auto_checkin} onChange={(e) => setForm({ ...form, auto_checkin: e.target.checked })}
              data-testid="geo-form-auto" className="mt-0.5 w-4 h-4" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Auto Check-In</div>
              <div className="text-xs text-slate-500">Schicht automatisch starten ohne Bestätigung</div>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <StaffButton variant="ghost" fullWidth onClick={onClose} type="button" testid="geo-form-cancel">Abbrechen</StaffButton>
            <StaffButton variant="primary" fullWidth type="submit" loading={saving} testid="geo-form-save">Erstellen</StaffButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
