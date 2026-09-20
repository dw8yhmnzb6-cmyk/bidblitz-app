import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Loader2, Package, Search, Save, Star, StarOff, Eye, EyeOff,
  RotateCcw, Store, Tags
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const CATEGORY_OPTIONS = [
  { value: "", label: "Automatisch" },
  { value: "charger", label: "Ladegeräte" },
  { value: "cable", label: "Kabel" },
  { value: "powerbank", label: "Powerbanks" },
  { value: "wireless", label: "Wireless / MagSafe" },
  { value: "dock", label: "Halterungen / Docks" },
  { value: "car", label: "Auto" },
  { value: "audio", label: "Audio" },
  { value: "charge-accessories", label: "Charge Zubehör" },
];

export default function AdminChargeCatalogPage({ onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState({ products: [], summary: {} });
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const response = await api.getChargeCatalogAdmin(q);
      setData(response || { products: [], summary: {} });
      const next = {};
      for (const item of response?.products || []) {
        next[item.product_id] = {
          visible: item.visible !== false,
          featured: Boolean(item.featured),
          charge_category: item.charge_category || "",
          sort_order: Number(item.sort_order || 100),
        };
      }
      setDrafts(next);
    } catch (error) {
      toast.error(error.message || "Charge-Katalog konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return data.products || [];
    const q = query.trim().toLowerCase();
    return (data.products || []).filter((item) =>
      [
        item.name,
        item.brand,
        item.category,
        item.merchant_name,
        item.product_id,
      ].join(" ").toLowerCase().includes(q)
    );
  }, [data.products, query]);

  const setDraft = useCallback((productId, patch) => {
    setDrafts((current) => ({
      ...current,
      [productId]: { ...(current[productId] || {}), ...patch },
    }));
  }, []);

  const save = useCallback(async (productId) => {
    const draft = drafts[productId];
    if (!draft) return;
    setBusyId(productId);
    try {
      await api.updateChargeCatalogProductAdmin(productId, {
        ...draft,
        sort_order: Number(draft.sort_order) || 100,
      });
      toast.success("Charge-Katalog aktualisiert");
      await load("");
    } catch (error) {
      toast.error(error.message || "Produktsteuerung konnte nicht gespeichert werden");
    } finally {
      setBusyId("");
    }
  }, [drafts, load]);

  const reset = useCallback(async (productId) => {
    if (!window.confirm("Charge-spezifische Steuerung für dieses Produkt zurücksetzen?")) return;
    setBusyId(productId);
    try {
      await api.resetChargeCatalogProductAdmin(productId);
      toast.success("Charge-Steuerung zurückgesetzt");
      await load("");
    } catch (error) {
      toast.error(error.message || "Steuerung konnte nicht zurückgesetzt werden");
    } finally {
      setBusyId("");
    }
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08131D]" data-testid="admin-charge-catalog-loading">
        <Loader2 size={26} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  const summary = data.summary || {};

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#08131D_0%,#102233_30%,#F4F0E8_30%,#F4F0E8_100%)] pb-24" data-testid="admin-charge-catalog-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="admin-charge-catalog-back">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#6EE7F9]">Charge Admin</p>
            <h1 className="truncate text-xl font-black text-white">Produktkatalog steuern</h1>
          </div>
          <button
            onClick={() => onNavigate?.("/admin/charge-offer-rules")}
            className="rounded-full border border-[#6EE7F9]/20 bg-[#6EE7F9]/10 px-4 py-2 text-xs font-black text-[#D8FCFF]"
            data-testid="admin-charge-catalog-offers-link"
          >
            Angebotsregeln
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(110,231,249,0.22),transparent_30%),linear-gradient(135deg,#08131D,#10283B)] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Produkte" value={summary.total || 0} icon={Package} />
            <Stat label="Sichtbar" value={summary.visible || 0} icon={Eye} />
            <Stat label="Ausgeblendet" value={summary.hidden || 0} icon={EyeOff} />
            <Stat label="Hervorgehoben" value={summary.featured || 0} icon={Star} />
          </div>
        </section>

        <section className="mt-6 rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Produkt, Marke oder Händler suchen"
              className="h-12 w-full rounded-2xl border border-[#D9CFC0] bg-white pl-11 pr-4 text-sm outline-none"
              data-testid="admin-charge-catalog-search"
            />
          </div>

          <div className="mt-5 space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-10 text-center text-sm text-slate-500">
                Keine Charge-Produkte gefunden
              </div>
            ) : filtered.map((item, index) => {
              const draft = drafts[item.product_id] || {
                visible: item.visible !== false,
                featured: Boolean(item.featured),
                charge_category: item.charge_category || "",
                sort_order: Number(item.sort_order || 100),
              };
              const busy = busyId === item.product_id;
              return (
                <div key={item.product_id} className="rounded-[26px] border border-[#E1D7C7] bg-white p-4" data-testid={`admin-charge-catalog-product-${index}`}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EFF5F6]">
                        {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Package size={28} className="text-slate-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.brand || "BidBlitz Charge"}</p>
                        <h2 className="truncate text-base font-black text-slate-900">{item.name}</h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Chip icon={Store} label={item.merchant_name || "Händler"} />
                          <Chip icon={Tags} label={item.category || "Charge"} />
                          <span className="rounded-full bg-[#0A1626] px-3 py-1 text-[11px] font-black text-[#6EE7F9]">€{Number(item.price || 0).toFixed(2)}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">Bestand {Number(item.stock || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:w-[470px]">
                      <label className="flex h-11 items-center justify-between rounded-2xl border border-[#D9CFC0] bg-[#FBF8F2] px-3 text-xs font-bold text-slate-700">
                        Sichtbar
                        <input
                          type="checkbox"
                          checked={draft.visible}
                          onChange={(e) => setDraft(item.product_id, { visible: e.target.checked })}
                          data-testid={`admin-charge-catalog-visible-${index}`}
                        />
                      </label>
                      <label className="flex h-11 items-center justify-between rounded-2xl border border-[#D9CFC0] bg-[#FBF8F2] px-3 text-xs font-bold text-slate-700">
                        Hervorheben
                        <input
                          type="checkbox"
                          checked={draft.featured}
                          onChange={(e) => setDraft(item.product_id, { featured: e.target.checked })}
                          data-testid={`admin-charge-catalog-featured-${index}`}
                        />
                      </label>
                      <select
                        value={draft.charge_category}
                        onChange={(e) => setDraft(item.product_id, { charge_category: e.target.value })}
                        className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-3 text-xs font-bold text-slate-700"
                        data-testid={`admin-charge-catalog-category-${index}`}
                      >
                        {CATEGORY_OPTIONS.map((option) => <option key={option.value || "auto"} value={option.value}>{option.label}</option>)}
                      </select>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={draft.sort_order}
                        onChange={(e) => setDraft(item.product_id, { sort_order: e.target.value })}
                        className="h-11 rounded-2xl border border-[#D9CFC0] bg-white px-3 text-xs font-bold text-slate-700"
                        placeholder="Sortierung"
                        data-testid={`admin-charge-catalog-sort-${index}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#EEE6DA] pt-3">
                    <button
                      onClick={() => setDraft(item.product_id, { featured: !draft.featured })}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-xs font-black text-slate-700"
                    >
                      {draft.featured ? <StarOff size={14} /> : <Star size={14} />}
                      {draft.featured ? "Highlight aus" : "Highlight an"}
                    </button>
                    <button
                      onClick={() => reset(item.product_id)}
                      disabled={busy}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-50"
                      data-testid={`admin-charge-catalog-reset-${index}`}
                    >
                      <RotateCcw size={14} />Zurücksetzen
                    </button>
                    <button
                      onClick={() => save(item.product_id)}
                      disabled={busy}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#0A1626] px-4 text-xs font-black text-[#D8FCFF] disabled:opacity-50"
                      data-testid={`admin-charge-catalog-save-${index}`}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Speichern
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{label}</span>
        <Icon size={16} className="text-[#6EE7F9]" />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function Chip({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F0E8] px-3 py-1 text-[11px] font-bold text-slate-600">
      <Icon size={11} />{label}
    </span>
  );
}
