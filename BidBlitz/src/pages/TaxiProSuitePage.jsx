/**
 * TaxiProSuitePage — Konsolidiertes Premium-Feature-Hub (iter123).
 * Tabs: Geplante Fahrten | Pendlerfahrten | Firmenkonto | Lost & Found
 *
 * Designed mobile-first. Reuse-Patterns: Lazy-Tabs, fetch-on-mount per Tab,
 * sonner toast für Bestätigungen.
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Calendar, Repeat, Building2, Search, Plus, Trash2,
  ArrowLeft, Clock, MapPin, CheckCircle2, AlertCircle, FileText
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const Tab = ({ active, onClick, icon: Icon, label, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className={`min-w-[144px] inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
      active
        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
        : "bg-white/[0.03] text-gray-400 border-white/[0.04] hover:bg-white/5"
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
);

// ─── Scheduled Rides Tab ───────────────────────────────────────────
function ScheduledTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    pickup_address: "", dropoff_address: "",
    pickup_lat: 52.52, pickup_lng: 13.405,
    dropoff_lat: 52.53, dropoff_lng: 13.38,
    scheduled_for: "", vehicle_type: "standard",
    auto_dispatch_minutes_before: 10,
  });
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/taxi/scheduled`, { credentials: "include" });
      const j = await r.json();
      setItems(j.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.pickup_address || !form.dropoff_address || !form.scheduled_for) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    const iso = new Date(form.scheduled_for).toISOString();
    try {
      const r = await fetch(`${API}/api/taxi/scheduled`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: +form.pickup_lat, lng: +form.pickup_lng, address: form.pickup_address },
          dropoff: { lat: +form.dropoff_lat, lng: +form.dropoff_lng, address: form.dropoff_address },
          vehicle_type: form.vehicle_type,
          scheduled_for: iso,
          auto_dispatch_minutes_before: +form.auto_dispatch_minutes_before,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
      toast.success("Fahrt geplant");
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.message || "Fehler"); }
  };
  const cancel = async (id) => {
    await fetch(`${API}/api/taxi/scheduled/${id}`, { method: "DELETE", credentials: "include" });
    toast.success("Storniert");
    load();
  };
  return (
    <div className="space-y-3" data-testid="scheduled-tab">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{items.length} geplante Fahrten</p>
        <button onClick={() => setShowForm((s) => !s)} data-testid="scheduled-new-btn"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold">
          <Plus className="w-3 h-3" /> Neu
        </button>
      </div>
      {showForm && (
        <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2" data-testid="scheduled-form">
          <input value={form.pickup_address} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                 placeholder="Abholung Adresse" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" data-testid="scheduled-pickup-input" />
          <input value={form.dropoff_address} onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
                 placeholder="Ziel Adresse" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" data-testid="scheduled-dropoff-input" />
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
                   className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" data-testid="scheduled-time-input" />
            <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
              <option value="standard">Standard</option>
              <option value="comfort">Comfort</option>
              <option value="premium">Premium</option>
              <option value="van">Van</option>
              <option value="ev">EV (Elektro)</option>
            </select>
          </div>
          <button onClick={create} data-testid="scheduled-create-submit"
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs">
            Fahrt planen
          </button>
        </div>
      )}
      {loading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>}
      {!loading && items.length === 0 && (
        <p className="text-center text-xs text-gray-500 py-6">Noch keine geplanten Fahrten</p>
      )}
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl" data-testid={`scheduled-item-${r.id}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                r.status === "pending" ? "bg-cyan-500/20 text-cyan-300" :
                r.status === "ready_to_book" ? "bg-amber-500/20 text-amber-300" :
                r.status === "cancelled" ? "bg-gray-500/20 text-gray-300" :
                "bg-emerald-500/20 text-emerald-300"
              }`}>{r.status}</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{new Date(r.scheduled_for).toLocaleString("de-DE")}</span>
            </div>
            <p className="text-xs text-gray-300 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {r.pickup?.address}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 ml-4">→ {r.dropoff?.address}</p>
            {r.status === "pending" && (
              <button onClick={() => cancel(r.id)} data-testid={`scheduled-cancel-${r.id}`}
                      className="mt-2 text-[10px] text-red-300 hover:text-red-200 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Stornieren
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recurring Tab ───────────────────────────────────────────
function RecurringTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    pickup_address: "", dropoff_address: "",
    time_hhmm: "08:00", weekdays: [0, 1, 2, 3, 4],
    vehicle_type: "standard",
  });
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/taxi/recurring`, { credentials: "include" });
      const j = await r.json();
      setItems(j.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.pickup_address || !form.dropoff_address) return toast.error("Adressen fehlen");
    try {
      const r = await fetch(`${API}/api/taxi/recurring`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { lat: 52.52, lng: 13.405, address: form.pickup_address },
          dropoff: { lat: 52.53, lng: 13.38, address: form.dropoff_address },
          weekdays: form.weekdays,
          time_hhmm: form.time_hhmm,
          vehicle_type: form.vehicle_type,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
      toast.success("Pendlerfahrt angelegt");
      setShow(false); load();
    } catch (e) { toast.error(e.message); }
  };
  const toggle = async (id, active) => {
    await fetch(`${API}/api/taxi/recurring/${id}?active=${active}`, { method: "PATCH", credentials: "include" });
    load();
  };
  const del = async (id) => {
    await fetch(`${API}/api/taxi/recurring/${id}`, { method: "DELETE", credentials: "include" });
    toast.success("Gelöscht"); load();
  };
  const toggleDay = (d) => {
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d] }));
  };
  return (
    <div className="space-y-3" data-testid="recurring-tab">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{items.length} Pendlerfahrten</p>
        <button onClick={() => setShow((s) => !s)} data-testid="recurring-new-btn"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold">
          <Plus className="w-3 h-3" /> Neu
        </button>
      </div>
      {show && (
        <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2" data-testid="recurring-form">
          <input value={form.pickup_address} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                 placeholder="Abholung (z.B. Zuhause)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" />
          <input value={form.dropoff_address} onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
                 placeholder="Ziel (z.B. Arbeit)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" />
          <div className="flex gap-1.5">
            {WEEKDAY_LABELS.map((l, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                      data-testid={`recurring-weekday-${i}`}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${
                        form.weekdays.includes(i) ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/[0.04] border-white/[0.06] text-gray-500"
                      }`}>{l}</button>
            ))}
          </div>
          <input type="time" value={form.time_hhmm} onChange={(e) => setForm({ ...form, time_hhmm: e.target.value })}
                 className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" data-testid="recurring-time-input" />
          <button onClick={create} data-testid="recurring-create-submit"
                  className="w-full py-2 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-lg text-xs">
            Pendlerfahrt anlegen
          </button>
        </div>
      )}
      {loading && <Loader2 className="w-5 h-5 animate-spin text-purple-400 mx-auto" />}
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center gap-2" data-testid={`recurring-item-${r.id}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${r.active ? "bg-emerald-400" : "bg-gray-500"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">{r.pickup?.address} → {r.dropoff?.address}</p>
              <p className="text-[10px] text-gray-400">{r.time_hhmm} · {(r.weekdays || []).map((d) => WEEKDAY_LABELS[d]).join(", ")}</p>
            </div>
            <button onClick={() => toggle(r.id, !r.active)} className="text-[10px] text-cyan-400 hover:text-cyan-300">
              {r.active ? "Pause" : "Start"}
            </button>
            <button onClick={() => del(r.id)} className="text-red-300 hover:text-red-200"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Corporate Tab ───────────────────────────────────────────
function CorporateTab() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ company_name: "", billing_email: "", vat_id: "", billing_address: "", cost_centers: "" });
  const [summary, setSummary] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/taxi/corporate/accounts/mine`, { credentials: "include" });
      const j = await r.json();
      setAccount(j.account);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.company_name || !form.billing_email) return toast.error("Pflichtfelder fehlen");
    try {
      const r = await fetch(`${API}/api/taxi/corporate/accounts`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cost_centers: form.cost_centers.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
      toast.success("Firmenkonto angelegt");
      setShow(false); load();
    } catch (e) { toast.error(e.message); }
  };
  const loadSummary = async () => {
    if (!account) return;
    const now = new Date();
    const r = await fetch(`${API}/api/taxi/corporate/accounts/${account.id}/summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { credentials: "include" });
    setSummary(await r.json());
  };
  useEffect(() => { if (account) loadSummary(); /* eslint-disable-next-line */ }, [account]);
  return (
    <div className="space-y-3" data-testid="corporate-tab">
      {loading && <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" />}
      {!loading && !account && !show && (
        <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center">
          <Building2 className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-white mb-1">Firmenkonto anlegen</p>
          <p className="text-xs text-gray-400 mb-3">Konsolidierte Monatsabrechnung mit MwSt + Cost-Center für alle Mitarbeiter.</p>
          <button onClick={() => setShow(true)} data-testid="corporate-create-btn"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs">
            Konto erstellen
          </button>
        </div>
      )}
      {show && (
        <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2" data-testid="corporate-form">
          <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Firma *" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" data-testid="corp-name" />
          <input value={form.billing_email} onChange={(e) => setForm({ ...form, billing_email: e.target.value })} placeholder="Rechnungs-Email *" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" data-testid="corp-email" />
          <input value={form.vat_id} onChange={(e) => setForm({ ...form, vat_id: e.target.value })} placeholder="USt-IdNr (DE…)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
          <input value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} placeholder="Rechnungsadresse" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
          <input value={form.cost_centers} onChange={(e) => setForm({ ...form, cost_centers: e.target.value })} placeholder="Cost-Center (komma-getrennt: MKT, SALES)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
          <button onClick={create} data-testid="corporate-submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs">
            Anlegen
          </button>
        </div>
      )}
      {account && (
        <>
          <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl" data-testid="corporate-account-card">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-amber-300" />
              <p className="text-base font-bold text-white">{account.company_name}</p>
            </div>
            {account.vat_id && <p className="text-[11px] text-gray-400">USt-IdNr: {account.vat_id}</p>}
            <p className="text-[11px] text-gray-400">📧 {account.billing_email}</p>
            {account.cost_centers?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {account.cost_centers.map((cc) => (
                  <span key={cc} className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded-md">{cc}</span>
                ))}
              </div>
            )}
          </div>
          {summary && (
            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl" data-testid="corporate-summary">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
                Monat {summary.month}/{summary.year}
              </p>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold text-amber-300 tabular-nums">€{summary.total_eur?.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{summary.ride_count} Fahrten</span>
              </div>
              {summary.by_cost_center?.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-white/[0.05]">
                  {summary.by_cost_center.map((cc) => (
                    <div key={cc.cost_center} className="flex justify-between text-xs">
                      <span className="text-gray-300">{cc.cost_center}</span>
                      <span className="text-white tabular-nums">€{cc.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Lost & Found Tab ───────────────────────────────────────────
function LostFoundTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ ride_id: "", item_description: "", contact_phone: "" });
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/taxi/lostfound/cases/mine`, { credentials: "include" });
      const j = await r.json();
      setItems(j.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.ride_id || !form.item_description) return toast.error("Bitte Fahrt-ID + Beschreibung");
    try {
      const r = await fetch(`${API}/api/taxi/lostfound/cases`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Fehler");
      toast.success("Case geöffnet — Fahrer wird informiert");
      setShow(false); load();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-3" data-testid="lostfound-tab">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{items.length} Cases</p>
        <button onClick={() => setShow((s) => !s)} data-testid="lostfound-new-btn"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold">
          <Plus className="w-3 h-3" /> Melden
        </button>
      </div>
      {show && (
        <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2" data-testid="lostfound-form">
          <input value={form.ride_id} onChange={(e) => setForm({ ...form, ride_id: e.target.value })}
                 placeholder="Fahrt-ID (aus History)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" data-testid="lf-rideid" />
          <textarea value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })}
                    placeholder="Was hast du vergessen? z.B. 'Schwarzer Rucksack, Laptop drin'"
                    rows={3} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" data-testid="lf-desc" />
          <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                 placeholder="Kontakt-Tel (optional)" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500" />
          <button onClick={create} data-testid="lostfound-submit"
                  className="w-full py-2 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg text-xs">
            Case öffnen
          </button>
        </div>
      )}
      {loading && <Loader2 className="w-5 h-5 animate-spin text-red-400 mx-auto" />}
      {!loading && items.length === 0 && (
        <p className="text-center text-xs text-gray-500 py-6">Keine offenen Cases — alles gut!</p>
      )}
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl" data-testid={`lostfound-item-${c.id}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                c.status === "open" ? "bg-amber-500/20 text-amber-300" :
                c.status === "driver_responded" ? "bg-cyan-500/20 text-cyan-300" :
                c.status === "returned" ? "bg-emerald-500/20 text-emerald-300" :
                "bg-gray-500/20 text-gray-300"
              }`}>{c.status}</span>
              <span className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleDateString("de-DE")}</span>
            </div>
            <p className="text-xs text-white">{c.item_description}</p>
            <p className="text-[10px] text-gray-400 mt-1">Fahrt: {c.ride_id?.slice(0, 8)}</p>
            {c.messages?.length > 0 && (
              <p className="text-[10px] text-cyan-300 mt-1">💬 {c.messages.length} Nachrichten</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function TaxiProSuitePage({ onBack }) {
  const [tab, setTab] = useState("scheduled");
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col" data-testid="taxi-pro-suite">
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/[0.06] px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="pro-back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold">BidBlitz Pro</h1>
          <p className="text-[11px] text-gray-400">Geplante Fahrten, Pendler & Firmenkonto</p>
        </div>
      </div>

      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+68px)] z-20 bg-[#050505]/96 border-b border-white/[0.04]">
        <div className="px-3 pt-2 pb-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="pro-tabs-strip">
        <Tab active={tab === "scheduled"} onClick={() => setTab("scheduled")} icon={Calendar} label="Geplant" testId="pro-tab-scheduled" />
        <Tab active={tab === "recurring"} onClick={() => setTab("recurring")} icon={Repeat} label="Pendler" testId="pro-tab-recurring" />
        <Tab active={tab === "corporate"} onClick={() => setTab("corporate")} icon={Building2} label="Firma" testId="pro-tab-corporate" />
        <Tab active={tab === "lostfound"} onClick={() => setTab("lostfound")} icon={Search} label="Lost+Found" testId="pro-tab-lostfound" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom,0px)+28px)]">
        {tab === "scheduled" && <ScheduledTab />}
        {tab === "recurring" && <RecurringTab />}
        {tab === "corporate" && <CorporateTab />}
        {tab === "lostfound" && <LostFoundTab />}
      </div>
    </div>
  );
}
