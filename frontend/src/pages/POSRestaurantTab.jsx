/**
 * POSRestaurantTab — Restaurant operations management
 * (P1: Sections + Tisch-Grid + Rename + Move + Storno/Werbung,
 *  P2: Kellner-PIN-Login + Abrechnung + Bonweiterleitung)
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, ArrowRightLeft, Send, Trash2, RefreshCw, KeyRound, Receipt, FileText, Download, Zap } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
  return data;
}

const useRestaurantTr = () => {
  const { lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  return (values) => values?.[locale] ?? values?.en ?? values?.de ?? "";
};

export default function POSRestaurantTab({ storeId }) {
  const tr = useRestaurantTr();
  const [tab, setTab] = useState("tables");
  const subTabs = [
    { key: "tables", label: tr({ de: "Tische + Bereiche", en: "Tables + sections", sq: "Tavolina + zona", ar: "الطاولات + المناطق" }) },
    { key: "voids", label: tr({ de: "Storno / Werbung", en: "Voids / comps", sq: "Storno / komp", ar: "الإلغاء / المجاني" }) },
    { key: "waiters", label: tr({ de: "Kellner", en: "Waiters", sq: "Kamarierët", ar: "النوادل" }) },
    { key: "abrechnung", label: tr({ de: "Kellner-Abrechnung", en: "Waiter settlement", sq: "Shlyerja e kamarierit", ar: "تسوية النادل" }) },
    { key: "bon", label: tr({ de: "Bonweiterleitung", en: "Receipt routing", sq: "Rrugëtimi i bonit", ar: "توجيه الإيصال" }) },
    { key: "autodispatch", label: tr({ de: "Auto-Dispatch", en: "Auto dispatch", sq: "Auto-dispatch", ar: "التوزيع التلقائي" }) },
    { key: "rksv", label: tr({ de: "RKSV (AT)", en: "RKSV (AT)", sq: "RKSV (AT)", ar: "RKSV (AT)" }) },
  ];
  if (!storeId) {
    return <div className="text-center text-sm text-gray-400 py-12">{tr({ de: "Bitte einen Store auswählen.", en: "Please select a store.", sq: "Ju lutem zgjidhni një dyqan.", ar: "يرجى اختيار متجر." })}</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {subTabs.map((t) => (
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
      {tab === "autodispatch" && <AutoDispatchView storeId={storeId} />}
      {tab === "rksv" && <RksvView storeId={storeId} />}
    </div>
  );
}

// ─── Tables + Sections ──────────────────────────────────────────────────
function TablesView({ storeId }) {
  const tr = useRestaurantTr();
  const [sections, setSections] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeSection, setActiveSection] = useState("ALL");
  const [moveFrom, setMoveFrom] = useState(null);

  const reload = useCallback(async () => {
    const [s, t] = await Promise.all([
      api(`/api/pos/sections?store_id=${storeId}`),
      api(`/api/pos/tables?store_id=${storeId}`),
    ]);
    setSections(s.sections || []);
    setTables(t.tables || []);
  }, [storeId]);
  useEffect(() => { reload(); }, [reload]);

  const addSection = async () => {
    const name = prompt(tr({ de: "Name des Bereichs (z.B. Restaurant, Terrasse):", en: "Section name (e.g. restaurant, terrace):", sq: "Emri i zonës (p.sh. restorant, tarracë):", ar: "اسم المنطقة (مثلاً المطعم أو التراس):" }));
    if (!name) return;
    try {
      await api("/api/pos/sections/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, name }),
      });
      toast.success(tr({ de: "Bereich angelegt", en: "Section created", sq: "Zona u krijua", ar: "تم إنشاء المنطقة" }));
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const addTable = async () => {
    const name = prompt(tr({ de: "Tisch-Name (z.B. Tisch 1):", en: "Table name (e.g. Table 1):", sq: "Emri i tavolinës (p.sh. Tavolina 1):", ar: "اسم الطاولة (مثلاً الطاولة 1):" }));
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
    const name = prompt(tr({ de: `Neuen Namen für "${table.name}":`, en: `New name for "${table.name}":`, sq: `Emër i ri për "${table.name}":`, ar: `اسم جديد لـ "${table.name}":` }), table.name);
    if (!name || name === table.name) return;
    try {
      await api("/api/pos/tables/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: table.table_id, new_name: name }),
      });
      toast.success(tr({ de: "Umbenannt", en: "Renamed", sq: "U riemërua", ar: "تمت إعادة التسمية" }));
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const startMove = (table) => {
    setMoveFrom(table);
    toast.info(tr({ de: `"${table.name}" wird verschoben — Zieltisch antippen`, en: `Moving "${table.name}" — tap target table`, sq: `"${table.name}" po zhvendoset — prek tavolinën e synuar`, ar: `يتم نقل "${table.name}" — اضغط على الطاولة الهدف` }));
  };
  const finishMove = async (target) => {
    if (!moveFrom || target.table_id === moveFrom.table_id) {
      setMoveFrom(null);
      return;
    }
    try {
      const merge = target.status === "occupied"
        ? window.confirm(tr({ de: "Zieltisch belegt. Bestellungen zusammenführen?", en: "Target table occupied. Merge orders?", sq: "Tavolina e synuar është e zënë. Të bashkohen porositë?", ar: "الطاولة الهدف مشغولة. هل تدمج الطلبات؟" }))
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
      toast.success(merge ? tr({ de: "Tische zusammengeführt", en: "Tables merged", sq: "Tavolinat u bashkuan", ar: "تم دمج الطاولات" }) : tr({ de: "Tisch verschoben", en: "Table moved", sq: "Tavolina u zhvendos", ar: "تم نقل الطاولة" }));
      setMoveFrom(null);
      reload();
    } catch (e) { toast.error(e.message); setMoveFrom(null); }
  };

  const releaseTable = async (table) => {
    if (!window.confirm(tr({ de: `"${table.name}" freigeben?`, en: `Release "${table.name}"?`, sq: `Të lirohet "${table.name}"?`, ar: `تحرير "${table.name}"؟` }))) return;
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
        >{tr({ de: "Alle", en: "All", sq: "Të gjitha", ar: "الكل" })}</button>
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
        ><Plus className="w-3.5 h-3.5 inline mr-1" />{tr({ de: "Bereich", en: "Section", sq: "Zona", ar: "المنطقة" })}</button>
        <button
          onClick={addTable}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 ml-auto"
          data-testid="pos-table-add"
        ><Plus className="w-3.5 h-3.5 inline mr-1" />{tr({ de: "Tisch", en: "Table", sq: "Tavolinë", ar: "طاولة" })}</button>
      </div>

      {moveFrom && (
        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300">
          {tr({ de: "Verschiebe", en: "Moving", sq: "Po zhvendoset", ar: "جاري نقل" })} <b>{moveFrom.name}</b> — {tr({ de: "auf Zieltisch tippen.", en: "tap target table.", sq: "prek tavolinën e synuar.", ar: "اضغط على الطاولة الهدف." })}
          <button onClick={() => setMoveFrom(null)} className="ml-2 underline">{tr({ de: "Abbrechen", en: "Cancel", sq: "Anulo", ar: "إلغاء" })}</button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {visible.length === 0 && (
          <div className="col-span-full text-center text-gray-500 text-sm py-8">
            {tr({ de: "Noch keine Tische — auf '+ Tisch' tippen.", en: "No tables yet — tap '+ Table'.", sq: "Ende nuk ka tavolina — prek '+ Tavolinë'.", ar: "لا توجد طاولات بعد — اضغط '+ طاولة'." })}
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
              <p className="text-[10px] text-gray-400 mt-1">{t.capacity} {tr({ de: "Pers.", en: "seats", sq: "vende", ar: "مقاعد" })}</p>
              {occupied && (
                <p className="text-[10px] text-red-400 font-semibold">● {tr({ de: "Belegt", en: "Occupied", sq: "E zënë", ar: "مشغولة" })}</p>
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
  const tr = useRestaurantTr();
  const [voids, setVoids] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/pos/voids/log?store_id=${storeId}&limit=200`);
      setVoids(d.voids || []);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [storeId]);
  useEffect(() => { reload(); }, [reload]);
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">{voids.length} {tr({ de: "Storno/Werbung-Buchungen", en: "void/comp bookings", sq: "rezervime anulim/komp", ar: "حجوزات إلغاء/مجاني" })}</p>
        <button onClick={reload} className="p-1.5 rounded bg-white/5 border border-white/10">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {voids.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-8">{tr({ de: "Keine Storno-Buchungen", en: "No void bookings", sq: "Nuk ka anulime", ar: "لا توجد عمليات إلغاء" })}</p>
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
  const tr = useRestaurantTr();
  const [waiters, setWaiters] = useState([]);
  const [form, setForm] = useState({ name: "", pin: "", email: "", color: "#84cc16" });
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const d = await api(`/api/pos/waiters?store_id=${storeId}`);
    setWaiters(d.waiters || []);
  }, [storeId]);
  useEffect(() => { reload(); }, [reload]);
  const submit = async () => {
    if (!form.name || !/^\d{4,6}$/.test(form.pin)) {
      toast.error(tr({ de: "Name + 4-6-stellige PIN erforderlich", en: "Name + 4-6 digit PIN required", sq: "Kërkohet emri + PIN 4-6 shifror", ar: "الاسم + PIN من 4 إلى 6 أرقام مطلوب" }));
      return;
    }
    setBusy(true);
    try {
      await api("/api/pos/waiters/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, ...form }),
      });
      toast.success(tr({ de: "Kellner angelegt", en: "Waiter created", sq: "Kamarieri u krijua", ar: "تم إنشاء النادل" }));
      setForm({ name: "", pin: "", email: "", color: "#84cc16" });
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const deactivate = async (w) => {
    if (!window.confirm(tr({ de: `"${w.name}" deaktivieren?`, en: `Deactivate "${w.name}"?`, sq: `Të çaktivizohet "${w.name}"?`, ar: `تعطيل "${w.name}"؟` }))) return;
    try {
      await api(`/api/pos/waiters/${w.waiter_id}/deactivate`, { method: "POST" });
      reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
        <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4" /> {tr({ de: "Neuen Kellner anlegen", en: "Create new waiter", sq: "Krijo kamarier të ri", ar: "إنشاء نادل جديد" })}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder={tr({ de: "Name", en: "Name", sq: "Emri", ar: "الاسم" })}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
            data-testid="waiter-name"
          />
          <input
            placeholder={tr({ de: "PIN (4-6 Ziffern)", en: "PIN (4-6 digits)", sq: "PIN (4-6 shifra)", ar: "PIN (4-6 أرقام)" })}
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            inputMode="numeric"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
            data-testid="waiter-pin"
          />
          <input
            placeholder={tr({ de: "E-Mail (optional)", en: "Email (optional)", sq: "Email (opsionale)", ar: "البريد الإلكتروني (اختياري)" })}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
          />
          <button
            onClick={submit}
            disabled={busy}
            className="py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold disabled:opacity-50"
            data-testid="waiter-save"
          >{busy ? tr({ de: "Speichern…", en: "Saving…", sq: "Po ruhet…", ar: "جارٍ الحفظ…" }) : tr({ de: "Anlegen", en: "Create", sq: "Krijo", ar: "إنشاء" })}</button>
        </div>
      </div>
      <p className="text-xs text-gray-400">{waiters.length} {tr({ de: "aktive Kellner", en: "active waiters", sq: "kamarierë aktivë", ar: "نوادل نشطون" })}</p>
      {waiters.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-6">{tr({ de: "Noch keine Kellner", en: "No waiters yet", sq: "Ende nuk ka kamarierë", ar: "لا يوجد نُدُل بعد" })}</p>
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
            {tr({ de: "Deaktivieren", en: "Deactivate", sq: "Çaktivizo", ar: "تعطيل" })}
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
  const tr = useRestaurantTr();
  const [routes, setRoutes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [form, setForm] = useState({
    name: "", mode: "bondruck", request_url: "", betrieb: "",
    request_interval_s: 60, response_check_interval_s: 60,
  });
  const reload = useCallback(async () => {
    const [r, d] = await Promise.all([
      api(`/api/pos/bonweiterleitung?store_id=${storeId}`),
      api(`/api/pos/bonweiterleitung/dispatches?store_id=${storeId}&limit=50`),
    ]);
    setRoutes(r.routes || []);
    setDispatches(d.dispatches || []);
  }, [storeId]);
  useEffect(() => { reload(); }, [reload]);
  const submit = async () => {
    if (!form.name) return toast.error(tr({ de: "Name fehlt", en: "Name missing", sq: "Mungon emri", ar: "الاسم مفقود" }));
    try {
      await api("/api/pos/bonweiterleitung/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, ...form }),
      });
      toast.success(tr({ de: "Bonweiterleitung angelegt", en: "Receipt route created", sq: "Rruga e bonit u krijua", ar: "تم إنشاء توجيه الإيصال" }));
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
          <Send className="w-4 h-4" /> {tr({ de: "Neue Bonweiterleitung", en: "New receipt route", sq: "Rrugë e re boni", ar: "مسار إيصال جديد" })}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input placeholder={tr({ de: "Name (z.B. Küche)", en: "Name (e.g. kitchen)", sq: "Emri (p.sh. kuzhina)", ar: "الاسم (مثلاً المطبخ)" })} value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="bon-name" />
          <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="bon-mode">
            <option value="bondruck">{tr({ de: "Bondruck", en: "Receipt print", sq: "Printimi i bonit", ar: "طباعة الإيصال" })}</option>
            <option value="umsatzuebergabe">{tr({ de: "Umsatzübergabe", en: "Sales handoff", sq: "Dorëzimi i shitjes", ar: "تسليم المبيعات" })}</option>
          </select>
          <input placeholder={tr({ de: "Betrieb (z.B. Eiscafé Valentina)", en: "Business (e.g. Eiscafé Valentina)", sq: "Biznesi (p.sh. Eiscafé Valentina)", ar: "المنشأة (مثلاً Eiscafé Valentina)" })} value={form.betrieb}
                 onChange={(e) => setForm({ ...form, betrieb: e.target.value })}
                 className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
          <input placeholder={tr({ de: "Request-URL (https://…)", en: "Request URL (https://…)", sq: "Request URL (https://…)", ar: "رابط الطلب (https://…)" })} value={form.request_url}
                 onChange={(e) => setForm({ ...form, request_url: e.target.value })}
                 className="md:col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" data-testid="bon-url" />
          <button onClick={submit} className="md:col-span-3 py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold" data-testid="bon-save">
            {tr({ de: "Anlegen", en: "Create", sq: "Krijo", ar: "إنشاء" })}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">{routes.length} {tr({ de: "aktive Routen", en: "active routes", sq: "rrugë aktive", ar: "مسارات نشطة" })}</p>
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
                {tr({ de: "Deaktivieren", en: "Deactivate", sq: "Çaktivizo", ar: "تعطيل" })}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">{tr({ de: "Letzte Dispatches", en: "Latest dispatches", sq: "Dispatch-et e fundit", ar: "آخر عمليات الإرسال" })} ({dispatches.length})</p>
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

// ─── Auto-Dispatch (category → route mapping) ───────────────────────────
function AutoDispatchView({ storeId }) {
  const tr = useRestaurantTr();
  const [routes, setRoutes] = useState([]);
  const [map, setMap] = useState([]);
  const [form, setForm] = useState({ category: "", route_id: "" });
  const reload = useCallback(async () => {
    const [r, m] = await Promise.all([
      api(`/api/pos/bonweiterleitung?store_id=${storeId}`),
      api(`/api/pos/bonweiterleitung/category-map?store_id=${storeId}`),
    ]);
    setRoutes(r.routes || []);
    setMap(m.map || []);
  }, [storeId]);
  useEffect(() => { reload(); }, [reload]);
  const submit = async () => {
    if (!form.category || !form.route_id) return toast.error(tr({ de: "Kategorie + Route nötig", en: "Category + route required", sq: "Kërkohet kategori + rrugë", ar: "الفئة + المسار مطلوبان" }));
    try {
      await api("/api/pos/bonweiterleitung/category-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, ...form }),
      });
      toast.success(tr({ de: "Mapping gespeichert", en: "Mapping saved", sq: "Mapimi u ruajt", ar: "تم حفظ الربط" }));
      setForm({ category: "", route_id: "" });
      reload();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
        <h3 className="text-sm font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
          <Zap className="w-4 h-4" /> Automatische Bon-Verteilung
        </h3>
        <p className="text-[11px] text-gray-400 mb-3">
          Beim Cart-Senden werden Items automatisch nach <code>category</code> auf konfigurierte Routen verteilt. Speisen → Küche, Getränke → Theke, Eis → Eis-Theke etc.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            placeholder="Kategorie (z.B. speisen)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value.toLowerCase() })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
            data-testid="autodisp-category"
          />
          <select
            value={form.route_id}
            onChange={(e) => setForm({ ...form, route_id: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
            data-testid="autodisp-route"
          >
            <option value="">— Route wählen —</option>
            {routes.map((r) => (
              <option key={r.route_id} value={r.route_id}>{r.name} · {r.mode}</option>
            ))}
          </select>
          <button onClick={submit} className="py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold" data-testid="autodisp-save">
            Mapping speichern
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">{map.length} Mappings konfiguriert</p>
      {map.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-6">Noch keine Mappings — Kategorie + Route oben hinzufügen.</p>
      )}
      {map.map((m, i) => {
        const route = routes.find((r) => r.route_id === m.route_id);
        return (
          <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3" data-testid={`autodisp-map-${m.category}`}>
            <span className="px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-300 text-xs font-bold">
              {m.category}
            </span>
            <ArrowRightLeft className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-white">{route?.name || m.route_id}</span>
            <span className="ml-auto text-[11px] text-gray-500">
              {m.updated_at && new Date(m.updated_at).toLocaleString("de-DE")}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ─── RKSV (AT-Compliance) ───────────────────────────────────────────────
function RksvView({ storeId }) {
  const tr = useRestaurantTr();
  const [state, setState] = useState(null);
  const [dep, setDep] = useState([]);
  const [verify, setVerify] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const settle = async (p) => {
      try { return await p; } catch { return null; }
    };
    const [s, d, v] = await Promise.all([
      settle(api(`/api/pos/rksv/state?store_id=${storeId}`)),
      settle(api(`/api/pos/rksv/dep?store_id=${storeId}&limit=200`)),
      settle(api(`/api/pos/rksv/dep/verify?store_id=${storeId}`)),
    ]);
    if (s) {
      setState(s);
    } else {
      toast.error(tr({ de: "RKSV-Status konnte nicht geladen werden", en: "Could not load RKSV status", sq: "Statusi RKSV nuk u ngarkua", ar: "تعذر تحميل حالة RKSV" }));
    }
    setDep((d && d.dep) || []);
    setVerify(v);
  }, [storeId, tr]);
  useEffect(() => { reload(); }, [reload]);

  const action = async (path, label) => {
    if (!window.confirm(`"${label}" jetzt erzeugen?`)) return;
    setBusy(true);
    try {
      await api(`/api/pos/rksv/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId }),
      });
      toast.success(`${label} erfolgreich`);
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const dl = (kind) => {
    window.open(`${API}/api/pos/rksv/dep.${kind}?store_id=${storeId}`, "_blank");
  };

  if (!state) {
    return <p className="text-center text-gray-500 text-sm py-8">Lade RKSV-Status…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className={`p-4 rounded-2xl border ${
        state.active
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-amber-500/5 border-amber-500/30"
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Kassen-ID</p>
            <p className="font-bold text-white" data-testid="rksv-kassen-id">{state.kassen_id}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Umsatzzähler</p>
            <p className="font-bold text-cyan-400" data-testid="rksv-umsatz">€ {Number(state.umsatzzaehler || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Status</p>
            <p className={`font-bold ${state.active ? "text-emerald-400" : "text-amber-400"}`} data-testid="rksv-status">
              {state.active ? "● AKTIV" : "○ INAKTIV"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Belege</p>
            <p className="font-bold text-white">{state.last_receipt_no || 0}</p>
          </div>
          {verify && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Chain-Integrität</p>
              <p className={`font-bold ${verify.valid ? "text-emerald-400" : "text-red-400"}`} data-testid="rksv-chain-valid">
                {verify.valid ? "✓ OK" : `✗ defekt @ #${verify.broken_at}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Belege actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {!state.active && (
          <button
            onClick={() => action("start-beleg", "Start-Beleg")}
            disabled={busy}
            className="p-3 rounded-xl bg-emerald-500 text-black text-sm font-bold disabled:opacity-50"
            data-testid="rksv-start"
          >Start-Beleg</button>
        )}
        <button
          onClick={() => action("null-beleg", "Null-Beleg")}
          disabled={busy || !state.active}
          className="p-3 rounded-xl bg-white/10 text-gray-200 text-sm font-bold disabled:opacity-50 hover:bg-white/20"
          data-testid="rksv-null"
        >Null-Beleg</button>
        <button
          onClick={() => action("monats-beleg", "Monats-Beleg")}
          disabled={busy}
          className="p-3 rounded-xl bg-white/10 text-gray-200 text-sm font-bold disabled:opacity-50 hover:bg-white/20"
          data-testid="rksv-monats"
        >Monats-Beleg</button>
        <button
          onClick={() => action("jahres-beleg", "Jahres-Beleg")}
          disabled={busy}
          className="p-3 rounded-xl bg-white/10 text-gray-200 text-sm font-bold disabled:opacity-50 hover:bg-white/20"
          data-testid="rksv-jahres"
        >Jahres-Beleg</button>
        {state.active && (
          <button
            onClick={() => action("schluss-beleg", "Schluss-Beleg")}
            disabled={busy}
            className="p-3 rounded-xl bg-red-500/20 text-red-300 text-sm font-bold disabled:opacity-50 hover:bg-red-500/30"
            data-testid="rksv-schluss"
          >Schluss-Beleg</button>
        )}
      </div>

      {/* DEP export */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> DEP-Export (Finanzamt)
          </h3>
          <button
            onClick={reload}
            className="p-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10"
            data-testid="rksv-reload"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => dl("pdf")}
            className="px-3 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-bold hover:bg-cyan-500/25 inline-flex items-center gap-1.5"
            data-testid="rksv-dl-pdf"
          ><Download className="w-3.5 h-3.5" />PDF</button>
          <button
            onClick={() => dl("csv")}
            className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 inline-flex items-center gap-1.5"
            data-testid="rksv-dl-csv"
          ><Download className="w-3.5 h-3.5" />CSV</button>
          <span className="text-[11px] text-gray-500 ml-auto self-center">
            {dep.length} Belege geladen (max. 200) · Vollständige Liste via CSV
          </span>
        </div>
      </div>

      {/* DEP table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="rksv-dep-table">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              <th className="text-left py-2 px-2">Nr.</th>
              <th className="text-left py-2 px-2">Typ</th>
              <th className="text-left py-2 px-2">Zeit</th>
              <th className="text-right py-2 px-2">Brutto</th>
              <th className="text-right py-2 px-2">Umsatz</th>
              <th className="text-left py-2 px-2">Signatur</th>
            </tr>
          </thead>
          <tbody>
            {dep.slice().reverse().slice(0, 100).map((r) => (
              <tr key={r.receipt_no} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-1.5 px-2 font-mono">{r.receipt_no}</td>
                <td className="py-1.5 px-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.beleg_typ === "START" ? "bg-emerald-500/20 text-emerald-400"
                    : r.beleg_typ === "SCHLUSS" ? "bg-red-500/20 text-red-400"
                    : r.beleg_typ === "NORMAL" ? "bg-cyan-500/20 text-cyan-300"
                    : "bg-purple-500/20 text-purple-300"
                  }`}>{r.beleg_typ}</span>
                </td>
                <td className="py-1.5 px-2 text-gray-400">{(r.ts || "").slice(0, 19).replace("T", " ")}</td>
                <td className="py-1.5 px-2 text-right">€ {Number(r.payload?.brutto || 0).toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right">€ {Number(r.umsatzzaehler_nach || 0).toFixed(2)}</td>
                <td className="py-1.5 px-2 font-mono text-[10px] text-gray-500">{(r.signature || "").slice(0, 22)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

