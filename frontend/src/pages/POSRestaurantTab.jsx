/**
 * POSRestaurantTab — Restaurant operations management
 * (P1: Sections + Tisch-Grid + Rename + Move + Storno/Werbung,
 *  P2: Kellner-PIN-Login + Abrechnung + Bonweiterleitung)
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, ArrowRightLeft, Users, Send, Trash2, RefreshCw, KeyRound, Receipt } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

const SUB_TABS = [
  { key: "tables", label: "Tische + Bereiche" },
  { key: "voids", label: "Storno / Werbung" },
  { key: "waiters", label: "Kellner" },
  { key: "abrechnung", label: "Kellner-Abrechnung" },
  { key: "bon", label: "Bonweiterleitung" },
];

export default function POSRestaurantTab({ storeId }) {
  const [tab, setTab] = useState("tables");
  if (!storeId) {
    return <div className="text-center text-sm text-gray-400 py-12">Bitte einen Store auswählen.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`pos-rest-tab-${t.key}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.key
                ? "bg-cyan-500 text-black"
                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "tables" && <TablesView storeId={storeId} />}
      {tab === "voids" && <VoidsView storeId={storeId} />}
      {tab === "waiters" && <WaitersView storeId={storeId} />}
      {tab === "abrechnung" && <AbrechnungView storeId={storeId} />}
      {tab === "bon" && <BonRouteView storeId={storeId} />}
    </div>
  );
}

// ─── Tables + Sections ──────────────────────────────────────────────────
function TablesView({ storeId }) {
  const [sections, setSections] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeSection, setActiveSection] = useState("ALL");
  const [moveFrom, setMoveFrom] = useState(null);

  const reload = async () => {
    const [s, t] = await Promise.all([
      api(`/api/pos/sections?store_id=${storeId}`),
      api(`/api/pos/tables?store_id=${storeId}`),
    ]);
    setSections(s.sections || []);
    setTables(t.tables || []);
  };
  useEffect(() => { reload(); }, [storeId]); // eslint-disable-line

  const addSection = async () => {
    const name = prompt("Name des Bereichs (z.B. Restaurant, Terrasse):");
    if (!name) return;
    try {
      await api("/api/pos/sections/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, name }),
      });
      toast.success("Bereich angelegt");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const addTable = async () => {
    const name = prompt("Tisch-Name (z.B. Tisch 1):");
    if (!name) return;
    const section = activeSection !== "ALL" ? activeSection : null;
    try {
      await api("/api/pos/tables/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, name, capacity: 4, section }),
      });
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const renameTable = async (table) => {
    const name = prompt(`Neuen Namen für "${table.name}":`, table.name);
    if (!name || name === table.name) return;
    try {
      await api("/api/pos/tables/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: table.table_id, new_name: name }),
      });
      toast.success("Umbenannt");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const startMove = (table) => {
    setMoveFrom(table);
    toast.info(`"${table.name}" wird verschoben — Zieltisch antippen`);
  };
  const finishMove = async (target) => {
    if (!moveFrom || target.table_id === moveFrom.table_id) {
      setMoveFrom(null);
      return;
    }
    try {
      const merge = target.status === "occupied"
        ? window.confirm(`Zieltisch belegt. Bestellungen zusammenführen?`)
        : false;
      if (target.status === "occupied" && !merge) {
        setMoveFrom(null);
        return;
      }
      await api("/api/pos/tables/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_table_id: moveFrom.table_id,
          to_table_id: target.table_id,
          merge,
        }),
      });
      toast.success(merge ? "Tische zusammengeführt" : "Tisch verschoben");
      setMoveFrom(null);
      reload();
    } catch (e) { toast.error(e.message); setMoveFrom(null); }
  };

  const releaseTable = async (table) => {
    if (!window.confirm(`"${table.name}" freigeben?`)) return;
    try {
      await api(`/api/pos/tables/${table.table_id}/release`, { method: "POST" });
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const visible = activeSection === "ALL"
    ? tables
    : tables.filter((t) => (t.section || "") === activeSection);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setActiveSection("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${activeSection === "ALL"
            ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-300 border border-white/10"}`}
          data-testid="pos-section-all"
        >Alle</button>
        {sections.map((s) => (
          <button
            key={s.section_id}
            onClick={() => setActiveSection(s.name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${activeSection === s.name
              ? "bg-cyan-500 text-black" : "bg-white/5 text-gray-300 border border-white/10"}`}
            data-testid={`pos-section-${s.name}`}
          >{s.name}</button>
        ))}
        <button
          onClick={addSection}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          data-testid="pos-section-add"
        ><Plus className="w-3.5 h-3.5 inline mr-1" />Bereich</button>
        <button
          onClick={addTable}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 ml-auto"
          data-testid="pos-table-add"
        ><Plus className="w-3.5 h-3.5 inline mr-1" />Tisch</button>
      </div>

      {moveFrom && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300">
          Verschiebe <b>{moveFrom.name}</b> — auf Zieltisch tippen.
          <button onClick={() => setMoveFrom(null)} className="ml-2 underline">Abbrechen</button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {visible.length === 0 && (
          <div className="col-span-full text-center text-gray-500 text-sm py-8">
            Noch keine Tische — auf "+ Tisch" tippen.
          </div>
        )}
        {visible.map((t) => {
          const occupied = t.status === "occupied";
          const isSource = moveFrom?.table_id === t.table_id;
          return (
            <div
              key={t.table_id}
              onClick={() => moveFrom ? finishMove(t) : null}
              className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer text-center min-h-[80px] ${
                isSource
                  ? "border-yellow-400 bg-yellow-500/10"
                  : occupied
                    ? "border-red-500/50 bg-red-500/10"
                    : "border-emerald-500/30 bg-emerald-500/5"
              }`}
              data-testid={`pos-table-${t.name}`}
            >
              <p className="font-bold text-sm text-white truncate">{t.name}</p>
              <p className="text-[10px] text-gray-400 mt-1">{t.capacity} Pers.</p>
              {occupied && (
                <p className="text-[10px] text-red-400 font-semibold">● Belegt</p>
              )}
              <div className="flex gap-1 mt-2 justify-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => renameTable(t)}
                  className="p-1 rounded bg-white/10 hover:bg-white/20"
                  title="Umbenennen"
                >
                  <Pencil className="w-3 h-3 text-gray-300" />
                </button>
                <button
                  onClick={() => startMove(t)}
                  className="p-1 rounded bg-white/10 hover:bg-white/20"
                  title="Verschieben"
                  disabled={!occupied}
                >
                  <ArrowRightLeft className={`w-3 h-3 ${occupied ? "text-cyan-400" : "text-gray-600"}`} />
                </button>
                {occupied && (
                  <button
                    onClick={() => releaseTable(t)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20"
                    title="Freigeben"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Voids (Storno / Werbung) ───────────────────────────────────────────
function VoidsView({ storeId }) {
  const [voids, setVoids] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    try {
      const d = await api(`/api/pos/voids/log?store_id=${storeId}&limit=200`);
      setVoids(d.voids || []);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [storeId]); // eslint-disable-line
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">{voids.length} Storno/Werbung-Buchungen</p>
        <button onClick={reload} className="p-1.5 rounded bg-white/5 border border-white/10">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {voids.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-8">Keine Storno-Buchungen</p>
      )}
      {voids.map((v, i) => (
        <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10" data-testid={`pos-void-${i}`}>
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  v.kind === "storno" ? "bg-red-500/20 text-red-400" : "bg-purple-500/20 text-purple-400"
                }`}>{v.kind}</span>
                <span className="text-xs text-gray-300 truncate">{v.voided_by_email || "—"}</span>
              </div>
              <p className="text-sm text-white mt-1 truncate">
                {v.item?.name || "(Item)"} · €{Number(v.item?.price || 0).toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{v.reason}</p>
              <p className="text-[10px] text-gray-500 mt-1">{new Date(v.ts).toLocaleString("de-DE")}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Waiters ────────────────────────────────────────────────────────────
function WaitersView({ storeId }) {
  const [waiters, setWaiters] = useState([]);
  const [form, setForm] = useState({ name: "", pin: "", email: "", color: "#84cc16" });
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    const d = await api(`/api/pos/waiters?store_id=${storeId}`);
    setWaiters(d.waiters || []);
  };
  useEffect(() => { reload(); }, [storeId]); // eslint-disable-line
  const submit = async () => {
    if (!form.name || !/^\d{4,6}$/.test(form.pin)) {
      toast.error("Name + 4-6-stellige PIN erforderlich");
      return;
    }
    setBusy(true);
    try {
      await api("/api/pos/waiters/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, ...form }),
      });
      toast.success("Kellner angelegt");
      setForm({ name: "", pin: "", email: "", color: "#84cc16" });
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const deactivate = async (w) => {
    if (!window.confirm(`"${w.name}" deaktivieren?`)) return;
    try {
      await api(`/api/pos/waiters/${w.waiter_id}/deactivate`, { method: "POST" });
      reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
        <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4" /> Neuen Kellner anlegen
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
            data-testid="waiter-name"
          />
          <input
            placeholder="PIN (4-6 Ziffern)"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            inputMode="numeric"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
            data-testid="waiter-pin"
          />
          <input
            placeholder="E-Mail (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold disabled:opacity-50"
            data-testid="waiter-save"
          >{busy ? "Speichern…" : "Anlegen"}</button>
        </div>
      </div>
      <p className="text-xs text-gray-400">{waiters.length} aktive Kellner</p>
      {waiters.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-6">Noch keine Kellner</p>
      )}
      {waiters.map((w) => (
        <div key={w.waiter_id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3" data-testid={`waiter-${w.waiter_id}`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-black flex-shrink-0"
                 style={{ background: w.color || "#84cc16" }}>
              {(w.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{w.name}</p>
              {w.email && <p className="text-xs text-gray-400 truncate">{w.email}</p>}
            </div>
          </div>
          <button onClick={() => deactivate(w)} className="text-xs text-red-400 hover:text-red-300">
            Deaktivieren
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Abrechnung ─────────────────────────────────────────────────────────
function AbrechnungView({ storeId }) {
  const [waiters, setWaiters] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [df, setDf] = useState(today);
  const [dt, setDt] = useState(today);
  useEffect(() => {
    api(`/api/pos/waiters?store_id=${storeId}`).then((d) => setWaiters(d.waiters || []));
  }, [storeId]);
  const load = async () => {
    if (!selected) return toast.error("Kellner wählen");
    try {
      const d = await api(`/api/pos/waiters/${selected}/abrechnung?date_from=${df}&date_to=${dt}`);
      setData(d);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="abr-waiter">
          <option value="">— Kellner wählen —</option>
          {waiters.map((w) => <option key={w.waiter_id} value={w.waiter_id}>{w.name}</option>)}
        </select>
        <input type="date" value={df} onChange={(e) => setDf(e.target.value)}
               className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="abr-df" />
        <input type="date" value={dt} onChange={(e) => setDt(e.target.value)}
               className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="abr-dt" />
        <button onClick={load} className="py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold" data-testid="abr-load">
          <Receipt className="w-4 h-4 inline mr-1" />Anzeigen
        </button>
      </div>
      {data && (
        <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
          <p className="text-sm font-bold text-cyan-300">{data.waiter_name} · {data.date_from} → {data.date_to}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <Stat label="Sessions" value={data.summary.sale_count} />
            <Stat label="Items" value={data.summary.item_count} />
            <Stat label="Umsatz" value={`€${data.summary.total.toFixed(2)}`} color="emerald" />
            <Stat label="Trinkgeld" value={`€${data.summary.tips.toFixed(2)}`} color="purple" />
            <Stat label="Bar" value={`€${data.summary.cash.toFixed(2)}`} />
            <Stat label="Karte" value={`€${data.summary.card.toFixed(2)}`} />
            <Stat label="Sonstige" value={`€${data.summary.other.toFixed(2)}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "cyan" }) {
  const map = {
    cyan: "text-cyan-400", emerald: "text-emerald-400", purple: "text-purple-400",
  };
  return (
    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold ${map[color]}`}>{value}</p>
    </div>
  );
}

// ─── Bonweiterleitung ───────────────────────────────────────────────────
function BonRouteView({ storeId }) {
  const [routes, setRoutes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [form, setForm] = useState({
    name: "", mode: "bondruck", request_url: "", betrieb: "",
    request_interval_s: 60, response_check_interval_s: 60,
  });
  const reload = async () => {
    const [r, d] = await Promise.all([
      api(`/api/pos/bonweiterleitung?store_id=${storeId}`),
      api(`/api/pos/bonweiterleitung/dispatches?store_id=${storeId}&limit=50`),
    ]);
    setRoutes(r.routes || []);
    setDispatches(d.dispatches || []);
  };
  useEffect(() => { reload(); }, [storeId]); // eslint-disable-line
  const submit = async () => {
    if (!form.name) return toast.error("Name fehlt");
    try {
      await api("/api/pos/bonweiterleitung/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, ...form }),
      });
      toast.success("Bonweiterleitung angelegt");
      setForm({ ...form, name: "", request_url: "" });
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const deactivate = async (route_id) => {
    try {
      await api(`/api/pos/bonweiterleitung/${route_id}/deactivate`, { method: "POST" });
      reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
        <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
          <Send className="w-4 h-4" /> Neue Bonweiterleitung
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input placeholder="Name (z.B. Küche)" value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="bon-name" />
          <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="bon-mode">
            <option value="bondruck">Bondruck</option>
            <option value="umsatzuebergabe">Umsatzübergabe</option>
          </select>
          <input placeholder="Betrieb (z.B. Eiscafé Valentina)" value={form.betrieb}
                 onChange={(e) => setForm({ ...form, betrieb: e.target.value })}
                 className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
          <input placeholder="Request-URL (https://…)" value={form.request_url}
                 onChange={(e) => setForm({ ...form, request_url: e.target.value })}
                 className="md:col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="bon-url" />
          <button onClick={submit} className="md:col-span-3 py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold" data-testid="bon-save">
            Anlegen
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">{routes.length} aktive Routen</p>
        {routes.map((r) => (
          <div key={r.route_id} className="p-3 rounded-xl bg-white/5 border border-white/10 mb-2" data-testid={`bon-route-${r.route_id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{r.name}</p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                    {r.mode}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate mt-1">{r.request_url || "(kein Endpoint)"}</p>
                {r.betrieb && <p className="text-[11px] text-gray-500">{r.betrieb}</p>}
                <p className="text-[11px] text-gray-500">Serial: {r.serial_number}</p>
              </div>
              <button onClick={() => deactivate(r.route_id)} className="text-xs text-red-400">
                Deaktivieren
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Letzte Dispatches ({dispatches.length})</p>
        {dispatches.slice(0, 20).map((d, i) => (
          <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/10 mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate flex-1">
              #{d.serial_number} · Cart {d.cart_id}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              d.status === "delivered" ? "bg-emerald-500/20 text-emerald-400"
              : d.status === "network_error" ? "bg-red-500/20 text-red-400"
              : "bg-amber-500/20 text-amber-400"
            }`}>{d.status}</span>
            <span className="text-gray-500">{new Date(d.ts).toLocaleTimeString("de-DE")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
