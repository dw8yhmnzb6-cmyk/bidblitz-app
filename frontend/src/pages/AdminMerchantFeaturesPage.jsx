/**
 * AdminMerchantFeaturesPage — Admin schaltet Software-Module pro Händler frei.
 *
 * Route: /admin/merchant-features
 *
 * Flow:
 *   1) Linke Spalte: alle Händler (Search + Click → select)
 *   2) Rechte Spalte: Feature-Katalog mit Toggle pro Feature
 *      (gruppiert nach Kategorie). Live-Save (Toggle = sofortiger Backend-Call).
 *
 * Backend:
 *   GET  /api/pos/admin/merchants               — Liste aller Händler
 *   GET  /api/pos/features/catalog              — Feature-Katalog
 *   GET  /api/pos/features/admin/merchant/:id   — aktive Features pro Händler
 *   POST /api/pos/features/admin/toggle         — Einzelnes Feature schalten
 *   POST /api/pos/features/admin/bulk-toggle    — Mehrere Features auf einmal
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Search, Store, ShieldCheck, Loader2, ToggleLeft,
  ToggleRight, CheckCircle2, Tag, Filter, Package, Sparkles,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let d = {};
  try { d = await r.clone().json(); } catch (_) { /* non-json */ }
  if (!r.ok) throw new Error(d.detail || d.message || `Error ${r.status}`);
  return d;
}

const CATEGORY_META = {
  staff:        { label: "Mitarbeiter",   color: "#00C2FF" },
  retail:       { label: "Handel",        color: "#10B981" },
  gastro:       { label: "Gastro",        color: "#F59E0B" },
  payments:     { label: "Zahlungen",     color: "#A855F7" },
  marketing:    { label: "Marketing",     color: "#EC4899" },
  compliance:   { label: "Compliance",    color: "#EF4444" },
  ai:           { label: "KI-Tools",      color: "#8B5CF6" },
  selfcheckout: { label: "Self-Checkout", color: "#06B6D4" },
  developer:    { label: "Entwickler",    color: "#64748B" },
  analytics:    { label: "Reports",       color: "#FBBF24" },
};

export default function AdminMerchantFeaturesPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [applyingBundle, setApplyingBundle] = useState(null);
  const [search, setSearch] = useState("");
  const [activeMerchant, setActiveMerchant] = useState(null);
  const [merchantFeatures, setMerchantFeatures] = useState({}); // {feature_key: {enabled, effective_price, custom_price,...}}
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceDrafts, setPriceDrafts] = useState({}); // {feature_key: "0.00"} — uncommitted user input

  // Initial load — merchants + catalog + bundles
  useEffect(() => {
    (async () => {
      try {
        const [m, c, b] = await Promise.all([
          api("/api/pos/admin/merchants"),
          api("/api/pos/features/catalog"),
          api("/api/pos/features/bundles"),
        ]);
        setMerchants(m.merchants || []);
        setCatalog(c.features || []);
        setBundles(b.bundles || []);
      } catch (err) {
        toast.error(err.message || "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reload features whenever an active merchant changes
  const loadMerchantFeatures = useCallback(async (merchant_id) => {
    if (!merchant_id) return;
    setLoadingFeatures(true);
    try {
      const d = await api(`/api/pos/features/admin/merchant/${merchant_id}`);
      const map = {};
      (d.features || []).forEach((f) => { map[f.key] = f; });
      setMerchantFeatures(map);
      setPriceDrafts({}); // reset drafts on merchant change
    } catch (err) {
      toast.error(err.message || "Konnte Features nicht laden");
    } finally {
      setLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    if (activeMerchant?.merchant_id) {
      loadMerchantFeatures(activeMerchant.merchant_id);
    }
  }, [activeMerchant, loadMerchantFeatures]);

  const handleToggle = async (feature_key, enabled) => {
    if (!activeMerchant) return;
    setSavingKey(feature_key);
    // Optimistic update
    setMerchantFeatures((prev) => ({
      ...prev,
      [feature_key]: { ...(prev[feature_key] || {}), enabled },
    }));
    try {
      await api("/api/pos/features/admin/toggle", {
        method: "POST",
        body: JSON.stringify({
          merchant_id: activeMerchant.merchant_id,
          feature_key,
          enabled,
        }),
      });
      toast.success(`${enabled ? "Aktiviert" : "Deaktiviert"}: ${feature_key}`);
    } catch (err) {
      // Rollback
      setMerchantFeatures((prev) => ({
        ...prev,
        [feature_key]: { ...(prev[feature_key] || {}), enabled: !enabled },
      }));
      toast.error(err.message || "Speichern fehlgeschlagen");
    } finally {
      setSavingKey(null);
    }
  };

  const handleBulk = async (enabled) => {
    if (!activeMerchant) return;
    const keys = filteredCatalog.map((f) => f.key);
    if (!keys.length) return;
    setSavingKey("__bulk__");
    try {
      await api("/api/pos/features/admin/bulk-toggle", {
        method: "POST",
        body: JSON.stringify({
          merchant_id: activeMerchant.merchant_id,
          features: keys,
          enabled,
        }),
      });
      toast.success(`${keys.length} Feature(s) ${enabled ? "aktiviert" : "deaktiviert"}`);
      await loadMerchantFeatures(activeMerchant.merchant_id);
    } catch (err) {
      toast.error(err.message || "Bulk-Update fehlgeschlagen");
    } finally {
      setSavingKey(null);
    }
  };

  const handleApplyBundle = async (bundle, mode = "merge") => {
    if (!activeMerchant) return;
    if (!window.confirm(
      `${bundle.name} jetzt anwenden?\n\n` +
      `Modus: ${mode === "replace" ? "ERSETZEN (alle anderen Features werden deaktiviert)" : "HINZUFÜGEN"}\n` +
      `Features: ${bundle.features.length}\n` +
      `Monatspreis: ${bundle.monthly_total?.toFixed(2)} €`
    )) return;
    setApplyingBundle(bundle.key);
    try {
      const res = await api("/api/pos/features/admin/apply-bundle", {
        method: "POST",
        body: JSON.stringify({
          merchant_id: activeMerchant.merchant_id,
          bundle_key: bundle.key,
          mode,
        }),
      });
      const act = (res.activated || []).length;
      const deact = (res.deactivated || []).length;
      toast.success(
        `${bundle.name}: ${act} aktiviert${deact ? `, ${deact} deaktiviert` : ""}`,
      );
      await loadMerchantFeatures(activeMerchant.merchant_id);
    } catch (err) {
      toast.error(err.message || "Bundle-Apply fehlgeschlagen");
    } finally {
      setApplyingBundle(null);
    }
  };

  const handlePriceCommit = async (feature_key, rawValue) => {
    if (!activeMerchant) return;
    const value = String(rawValue ?? "").replace(",", ".").trim();
    const numeric = value === "" ? null : Number(value);
    // Skip if not a finite number
    if (numeric !== null && !Number.isFinite(numeric)) {
      toast.error("Ungültiger Preis");
      return;
    }
    const current = merchantFeatures[feature_key] || {};
    const oldPrice = current.custom_price ?? null;
    // Skip no-op
    if (numeric === oldPrice) {
      setPriceDrafts((p) => { const c = { ...p }; delete c[feature_key]; return c; });
      return;
    }
    setSavingKey(`price-${feature_key}`);
    try {
      const finalPrice = numeric === null ? current.catalog_price : Math.max(0, numeric);
      const res = await api("/api/pos/features/admin/set-price", {
        method: "POST",
        body: JSON.stringify({
          merchant_id: activeMerchant.merchant_id,
          feature_key,
          custom_price: finalPrice,
        }),
      });
      // Update local cache
      setMerchantFeatures((prev) => ({
        ...prev,
        [feature_key]: {
          ...(prev[feature_key] || {}),
          custom_price: numeric === null ? null : finalPrice,
          effective_price: finalPrice,
          monthly_price: finalPrice,
        },
      }));
      setPriceDrafts((p) => { const c = { ...p }; delete c[feature_key]; return c; });
      toast.success(`Preis: ${finalPrice.toFixed(2)} €/Monat`);
    } catch (err) {
      toast.error(err.message || "Preis-Update fehlgeschlagen");
    } finally {
      setSavingKey(null);
    }
  };

  const filteredMerchants = useMemo(() => {
    if (!search.trim()) return merchants;
    const q = search.toLowerCase();
    return merchants.filter((m) =>
      [m.business_name, m.email, m.merchant_id, m.owner_email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [merchants, search]);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((f) => f.category));
    return Array.from(set);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (categoryFilter === "all") return catalog;
    return catalog.filter((f) => f.category === categoryFilter);
  }, [catalog, categoryFilter]);

  const activeCount = Object.values(merchantFeatures).filter((f) => f.enabled).length;
  const totalCount = catalog.length;
  const totalMRR = Object.values(merchantFeatures)
    .filter((f) => f.enabled)
    .reduce((sum, f) => sum + (Number(f.effective_price ?? f.monthly_price ?? 0) || 0), 0);

  return (
    <div className="min-h-screen bg-[#05050a] text-white" data-testid="admin-merchant-features-page">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#05050a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-lg transition"
            data-testid="back-btn"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck size={20} className="text-cyan-400" />
              Händler-Module freischalten
            </h1>
            <p className="text-xs text-gray-400">
              Welche Software-Module darf der Händler nutzen?
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-cyan-400" size={32} />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[360px_1fr] gap-6">
          {/* LEFT — Merchant list */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Händler suchen..."
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-cyan-500/50 focus:outline-none"
                data-testid="merchant-search"
              />
            </div>
            <p className="text-[11px] text-gray-500 px-1">
              {filteredMerchants.length} von {merchants.length} Händlern
            </p>

            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filteredMerchants.map((m) => {
                const isActive = activeMerchant?.merchant_id === m.merchant_id;
                return (
                  <button
                    key={m.merchant_id}
                    onClick={() => setActiveMerchant(m)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      isActive
                        ? "bg-cyan-500/10 border-cyan-500/40"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    }`}
                    data-testid={`merchant-row-${m.merchant_id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Store size={14} className="text-cyan-400 shrink-0" />
                      <span className="font-semibold text-sm truncate">
                        {m.business_name || m.email || m.merchant_id}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {m.owner_email || m.email}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        m.status === "approved"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {m.status || "pending"}
                      </span>
                      <span className="text-[9px] text-gray-500 truncate">
                        {m.merchant_id}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredMerchants.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8">
                  Keine Händler gefunden
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — Feature toggles */}
          <div>
            {!activeMerchant ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                <ShieldCheck size={48} className="mb-3 opacity-30" />
                <p className="text-sm">Wähle links einen Händler aus</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Merchant header card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/5 border border-cyan-500/20">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold truncate" data-testid="active-merchant-name">
                        {activeMerchant.business_name || activeMerchant.email}
                      </h2>
                      <p className="text-xs text-gray-400 truncate">
                        {activeMerchant.owner_email || activeMerchant.email}  •  {activeMerchant.merchant_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-cyan-400" data-testid="active-feature-count">
                          {activeCount}<span className="text-sm text-gray-500">/{totalCount}</span>
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase">aktiv</p>
                      </div>
                      <div className="text-right pl-6 border-l border-white/10">
                        <p className="text-2xl font-bold text-green-400" data-testid="active-merchant-mrr">
                          {totalMRR.toFixed(2)}<span className="text-sm text-gray-500"> €</span>
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase">MRR / Monat</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branchen-Bundles — 1-Klick Standard-Pakete */}
                {bundles.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Package size={16} className="text-amber-400" />
                      <h3 className="text-sm font-semibold">Standard-Paket pro Branche</h3>
                      <span className="text-[10px] text-gray-500">— 1 Klick = mehrere Features mit fertigen Preisen</span>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {bundles.map((b) => {
                        const applying = applyingBundle === b.key;
                        return (
                          <button
                            key={b.key}
                            onClick={() => handleApplyBundle(b, "merge")}
                            onContextMenu={(e) => { e.preventDefault(); handleApplyBundle(b, "replace"); }}
                            disabled={applying}
                            className="text-left p-3 rounded-xl bg-gradient-to-br from-amber-500/5 to-amber-500/0 border border-amber-500/20 hover:border-amber-400/40 hover:bg-amber-500/10 transition disabled:opacity-50"
                            data-testid={`bundle-${b.key}`}
                            title="Klick: hinzufügen   •   Rechtsklick: ersetzen (alle anderen aus)"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{b.icon}</span>
                              <span className="font-semibold text-xs truncate">{b.name}</span>
                              {applying && <Loader2 className="animate-spin text-amber-400 ml-auto" size={12} />}
                            </div>
                            <p className="text-[10px] text-gray-400 leading-snug line-clamp-2 mb-2">
                              {b.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-gray-500">
                                {b.features.length} Module
                              </span>
                              <span className="text-xs font-bold text-amber-400">
                                {b.monthly_total?.toFixed(2)} €/M
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                      <Sparkles size={10} />
                      Klick = nur hinzufügen. Rechtsklick = ersetzen (deaktiviert alle anderen Features).
                    </p>
                  </div>
                )}

                {/* Filter bar + Bulk actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <Filter size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-400">Kategorie:</span>
                  </div>
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      categoryFilter === "all"
                        ? "bg-white/10 border-white/30 text-white"
                        : "border-white/10 text-gray-400 hover:text-white"
                    }`}
                    data-testid="cat-filter-all"
                  >Alle</button>
                  {categories.map((cat) => {
                    const meta = CATEGORY_META[cat] || { label: cat, color: "#64748B" };
                    const active = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${
                          active ? "border-white/30" : "border-white/10 hover:border-white/20"
                        }`}
                        style={active ? { backgroundColor: `${meta.color}20`, color: meta.color } : {}}
                        data-testid={`cat-filter-${cat}`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => handleBulk(true)}
                      disabled={savingKey === "__bulk__"}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition disabled:opacity-50"
                      data-testid="bulk-enable-btn"
                    >
                      Alle aktivieren
                    </button>
                    <button
                      onClick={() => handleBulk(false)}
                      disabled={savingKey === "__bulk__"}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50"
                      data-testid="bulk-disable-btn"
                    >
                      Alle deaktivieren
                    </button>
                  </div>
                </div>

                {/* Features list */}
                {loadingFeatures ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-cyan-400" />
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {filteredCatalog.map((f) => {
                      const state = merchantFeatures[f.key] || {};
                      const enabled = !!state.enabled;
                      const meta = CATEGORY_META[f.category] || { label: f.category, color: "#64748B" };
                      const isSaving = savingKey === f.key;
                      return (
                        <div
                          key={f.key}
                          className={`p-4 rounded-xl border transition ${
                            enabled
                              ? "bg-white/[0.04] border-white/15"
                              : "bg-white/[0.02] border-white/5"
                          }`}
                          data-testid={`feature-card-${f.key}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                                  style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                                >
                                  {meta.label}
                                </span>
                                {enabled && (
                                  <CheckCircle2 size={12} className="text-green-400" />
                                )}
                              </div>
                              <h3 className="font-semibold text-sm mb-1">{f.name}</h3>
                              <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
                                {f.description}
                              </p>

                              {/* Preis-Input — Admin kann hier Override setzen (auch 0 = kostenlos) */}
                              <div className="flex items-center gap-2 mt-3">
                                <Tag size={12} className="text-gray-500 shrink-0" />
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={
                                    priceDrafts[f.key] !== undefined
                                      ? priceDrafts[f.key]
                                      : (state.custom_price !== null && state.custom_price !== undefined
                                          ? state.custom_price
                                          : (state.catalog_price ?? f.monthly_price ?? 0))
                                  }
                                  onChange={(e) =>
                                    setPriceDrafts((p) => ({ ...p, [f.key]: e.target.value }))
                                  }
                                  onBlur={(e) => {
                                    if (priceDrafts[f.key] !== undefined) {
                                      handlePriceCommit(f.key, e.target.value);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.target.blur();
                                  }}
                                  disabled={savingKey === `price-${f.key}`}
                                  className="w-20 text-xs px-2 py-1 bg-white/5 border border-white/10 rounded focus:border-cyan-500/50 focus:outline-none disabled:opacity-50"
                                  data-testid={`feature-price-${f.key}`}
                                  aria-label={`Preis für ${f.name}`}
                                />
                                <span className="text-[10px] text-gray-500">€/Monat</span>
                                {savingKey === `price-${f.key}` && (
                                  <Loader2 className="animate-spin text-cyan-400" size={12} />
                                )}
                                {state.custom_price !== null && state.custom_price !== undefined && (
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 cursor-help"
                                    title={`Katalog-Preis: ${f.monthly_price?.toFixed(2)} €`}
                                  >
                                    {Number(state.custom_price) === 0 ? "GRATIS" : "Custom"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggle(f.key, !enabled)}
                              disabled={isSaving}
                              className="shrink-0 disabled:opacity-50"
                              data-testid={`feature-toggle-${f.key}`}
                              aria-label={enabled ? "Deaktivieren" : "Aktivieren"}
                            >
                              {isSaving ? (
                                <Loader2 className="animate-spin text-cyan-400" size={28} />
                              ) : enabled ? (
                                <ToggleRight size={36} className="text-green-400" />
                              ) : (
                                <ToggleLeft size={36} className="text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
