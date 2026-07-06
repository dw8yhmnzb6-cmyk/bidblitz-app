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
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Search, Store, ShieldCheck, Loader2, ToggleLeft,
  ToggleRight, CheckCircle2, Tag, Filter, Package, Sparkles,
  Plus, Edit3, Trash2, X, Save, Ban, Unlock, Euro, Building2,
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
  const [editingBundle, setEditingBundle] = useState(null);  // null | "new" | bundle object
  const [savingBundle, setSavingBundle] = useState(false);
  const [search, setSearch] = useState("");
  const [activeMerchant, setActiveMerchant] = useState(null);
  const [merchantFeatures, setMerchantFeatures] = useState({}); // {feature_key: {enabled, effective_price, custom_price,...}}
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceDrafts, setPriceDrafts] = useState({}); // {feature_key: "0.00"} — uncommitted user input
  const [editingMerchant, setEditingMerchant] = useState(null);
  const [savingMerchant, setSavingMerchant] = useState(false);
  const [provisioningMerchant, setProvisioningMerchant] = useState(false);

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

  const reloadBundles = useCallback(async () => {
    try {
      const b = await api("/api/pos/features/bundles");
      setBundles(b.bundles || []);
    } catch (err) {
      /* ignore */
    }
  }, []);

  const handleSaveBundle = async (draft) => {
    setSavingBundle(true);
    try {
      await api("/api/pos/features/admin/bundles", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      toast.success(`Bundle gespeichert: ${draft.name}`);
      setEditingBundle(null);
      await reloadBundles();
    } catch (err) {
      toast.error(err.message || "Speichern fehlgeschlagen");
    } finally {
      setSavingBundle(false);
    }
  };

  const handleDeleteBundle = async (bundle) => {
    if (!window.confirm(`Bundle "${bundle.name}" wirklich löschen?`)) return;
    try {
      await api(`/api/pos/features/admin/bundles/${bundle.key}`, { method: "DELETE" });
      toast.success(`Bundle gelöscht: ${bundle.name}`);
      await reloadBundles();
    } catch (err) {
      toast.error(err.message || "Löschen fehlgeschlagen");
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

  const patchMerchantInList = useCallback((updated) => {
    if (!updated?.merchant_id) return;
    setMerchants((prev) => prev.map((m) => (m.merchant_id === updated.merchant_id ? { ...m, ...updated } : m)));
    setActiveMerchant((prev) => (prev?.merchant_id === updated.merchant_id ? { ...prev, ...updated } : prev));
  }, []);

  const handleSaveMerchant = async (draft) => {
    if (!activeMerchant) return;
    setSavingMerchant(true);
    try {
      const res = await api(`/api/pos/admin/merchants/${activeMerchant.merchant_id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      patchMerchantInList(res.merchant);
      setEditingMerchant(null);
      toast.success("Händler gespeichert");
    } catch (err) {
      toast.error(err.message || "Händler konnte nicht gespeichert werden");
    } finally {
      setSavingMerchant(false);
    }
  };

  const handleMerchantStatus = async (status) => {
    if (!activeMerchant) return;
    const reason = status === "blocked"
      ? window.prompt("Warum blockieren? z. B. Rechnung nicht bezahlt", activeMerchant.status_reason || "Rechnung nicht bezahlt")
      : window.prompt("Notiz zur Freigabe/Statusänderung", status === "approved" ? "Freigegeben durch Admin" : "Status geändert");
    if (reason === null) return;
    setSavingKey(`merchant-status-${status}`);
    try {
      const res = await api(`/api/pos/admin/merchants/${activeMerchant.merchant_id}/status`, {
        method: "POST",
        body: JSON.stringify({ status, reason }),
      });
      patchMerchantInList(res.merchant);
      toast.success(status === "approved" ? "Händler freigeschaltet" : status === "blocked" ? "Händler blockiert" : "Status aktualisiert");
    } catch (err) {
      toast.error(err.message || "Status konnte nicht geändert werden");
    } finally {
      setSavingKey(null);
    }
  };

  const handleProvisionMerchant = async (bundleKey, mode = "merge") => {
    if (!activeMerchant) return;
    setProvisioningMerchant(true);
    try {
      const res = await api("/api/pos/features/admin/provision-merchant", {
        method: "POST",
        body: JSON.stringify({
          merchant_id: activeMerchant.merchant_id,
          bundle_key: bundleKey,
          mode,
          billing_status: "paid",
          create_api_key: true,
          api_key_name: `${bundleKey} POS API`,
          scopes: ["read", "write"],
        }),
      });
      toast.success(`${res.bundle}: ${res.activated?.length || 0} Module freigeschaltet${res.api_key ? " + API-Key erstellt" : ""}`);
      if (res.api_key?.key_secret) {
        window.prompt("API-Key nur jetzt kopieren", res.api_key.key_secret);
      }
      await loadMerchantFeatures(activeMerchant.merchant_id);
      patchMerchantInList({
        ...activeMerchant,
        status: "approved",
        access_blocked: false,
        is_blocked: false,
        billing_status: "paid",
        business_type: bundleKey,
      });
    } catch (err) {
      toast.error(err.message || "Freischaltung fehlgeschlagen");
    } finally {
      setProvisioningMerchant(false);
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
                        m.is_blocked || m.status === "blocked" || m.status === "suspended"
                          ? "bg-red-500/10 text-red-400"
                          : m.status === "approved"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {m.is_blocked ? "blockiert" : (m.status || "pending")}
                      </span>
                      <span className="text-[9px] text-green-400" data-testid={`merchant-row-mrr-${m.merchant_id}`}>
                        {(Number(m.feature_mrr || 0)).toFixed(2)}€/M
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${activeMerchant.is_blocked || activeMerchant.status === "blocked" || activeMerchant.status === "suspended" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`} data-testid="active-merchant-access-status">
                          {activeMerchant.is_blocked || activeMerchant.status === "blocked" || activeMerchant.status === "suspended" ? "ZUGANG BLOCKIERT" : "FREIGESCHALTET"}
                        </span>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-300" data-testid="active-merchant-business-type">
                          {activeMerchant.business_type || "keine Branche"}
                        </span>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-300" data-testid="active-merchant-billing-status">
                          Zahlung: {activeMerchant.billing_status || "paid"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => setEditingMerchant(activeMerchant)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition"
                        data-testid="merchant-edit-btn"
                      >
                        <Edit3 size={13} /> Bearbeiten
                      </button>
                      <button
                        onClick={() => handleMerchantStatus(activeMerchant.is_blocked || activeMerchant.status === "blocked" || activeMerchant.status === "suspended" ? "approved" : "blocked")}
                        disabled={String(savingKey || "").startsWith("merchant-status")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition disabled:opacity-50 ${activeMerchant.is_blocked || activeMerchant.status === "blocked" || activeMerchant.status === "suspended" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-red-500/10 border-red-500/25 text-red-300"}`}
                        data-testid="merchant-block-toggle-btn"
                      >
                        {activeMerchant.is_blocked || activeMerchant.status === "blocked" || activeMerchant.status === "suspended" ? <Unlock size={13} /> : <Ban size={13} />}
                        {activeMerchant.is_blocked || activeMerchant.status === "blocked" || activeMerchant.status === "suspended" ? "Freigeben" : "Blockieren"}
                      </button>
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
                      <button
                        onClick={() => setEditingBundle("new")}
                        className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition"
                        data-testid="bundle-new-btn"
                      >
                        <Plus size={12} /> Neu
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {bundles.map((b) => {
                        const applying = applyingBundle === b.key;
                        return (
                          <div
                            key={b.key}
                            className="group relative text-left p-3 rounded-xl bg-gradient-to-br from-amber-500/5 to-amber-500/0 border border-amber-500/20 hover:border-amber-400/40 hover:bg-amber-500/10 transition"
                            data-testid={`bundle-${b.key}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleApplyBundle(b, "merge")}
                              onContextMenu={(e) => { e.preventDefault(); handleApplyBundle(b, "replace"); }}
                              disabled={applying}
                              className="w-full text-left disabled:opacity-50"
                              title="Klick: hinzufügen   •   Rechtsklick: ersetzen (alle anderen aus)"
                            >
                              <div className="flex items-center gap-2 mb-1 pr-12">
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
                            {/* Edit / Delete actions */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingBundle(b); }}
                                className="p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300"
                                data-testid={`bundle-edit-${b.key}`}
                                aria-label="Bearbeiten"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteBundle(b); }}
                                className="p-1 rounded bg-red-500/10 hover:bg-red-500/30 text-red-300"
                                data-testid={`bundle-delete-${b.key}`}
                                aria-label="Löschen"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                      <Sparkles size={10} />
                      Klick = hinzufügen. Rechtsklick = ersetzen. Hover für Bearbeiten/Löschen.
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
                    <select
                      onChange={(e) => e.target.value && handleProvisionMerchant(e.target.value, "merge")}
                      disabled={provisioningMerchant}
                      defaultValue=""
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#111827] border border-cyan-500/20 text-cyan-200 disabled:opacity-50"
                      data-testid="merchant-provision-select"
                    >
                      <option value="" disabled>Freischalten + API</option>
                      {bundles.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
                    </select>
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

      {/* ═══ Bundle Editor Modal ═══ */}
      <AnimatePresence>
        {editingBundle !== null && (
          <BundleEditor
            initial={editingBundle === "new" ? null : editingBundle}
            catalog={catalog}
            saving={savingBundle}
            onCancel={() => setEditingBundle(null)}
            onSave={handleSaveBundle}
          />
        )}
        {editingMerchant !== null && (
          <MerchantEditor
            merchant={editingMerchant}
            saving={savingMerchant}
            onCancel={() => setEditingMerchant(null)}
            onSave={handleSaveMerchant}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function MerchantEditor({ merchant, saving, onCancel, onSave }) {
  const [businessName, setBusinessName] = useState(merchant.business_name || "");
  const [businessType, setBusinessType] = useState(merchant.business_type || "kiosk");
  const [contactEmail, setContactEmail] = useState(merchant.contact_email || merchant.owner_email || "");
  const [contactPhone, setContactPhone] = useState(merchant.contact_phone || "");
  const [country, setCountry] = useState(merchant.country || "XK");
  const [feeRate, setFeeRate] = useState(Number(merchant.fee_rate ?? 0.015));
  const [billingStatus, setBillingStatus] = useState(merchant.billing_status || "paid");
  const [adminNote, setAdminNote] = useState(merchant.admin_note || "");

  const submit = () => {
    if (!businessName.trim()) {
      toast.error("Firmenname fehlt");
      return;
    }
    onSave({
      business_name: businessName.trim(),
      business_type: businessType,
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
      country: country.trim().toUpperCase(),
      fee_rate: Math.max(0, Math.min(0.2, Number(feeRate) || 0)),
      billing_status: billingStatus,
      admin_note: adminNote.trim(),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
      data-testid="merchant-editor-modal"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a0a14] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 size={18} className="text-cyan-400" /> Händler bearbeiten
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg" data-testid="merchant-editor-close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[10px] uppercase text-gray-400">Firmenname</span>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" data-testid="merchant-editor-business-name" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-gray-400">Branche</span>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm" data-testid="merchant-editor-business-type">
              <option value="gastro">Gastronomie</option>
              <option value="restaurant">Restaurant</option>
              <option value="kiosk">Kiosk</option>
              <option value="retail">Einzelhandel</option>
              <option value="bakery">Bäckerei</option>
              <option value="service">Service</option>
              <option value="other">Andere</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-gray-400">Land</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm uppercase" data-testid="merchant-editor-country" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-gray-400">Kontakt E-Mail</span>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" data-testid="merchant-editor-contact-email" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-gray-400">Telefon</span>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" data-testid="merchant-editor-contact-phone" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-gray-400 flex items-center gap-1"><Euro size={11} /> Gebühr</span>
            <input type="number" step="0.001" min="0" max="0.2" value={feeRate} onChange={(e) => setFeeRate(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" data-testid="merchant-editor-fee-rate" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-gray-400">Zahlstatus</span>
            <select value={billingStatus} onChange={(e) => setBillingStatus(e.target.value)} className="w-full px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm" data-testid="merchant-editor-billing-status">
              <option value="paid">bezahlt</option>
              <option value="trial">Testphase</option>
              <option value="manual">manuell</option>
              <option value="overdue">überfällig</option>
              <option value="blocked">gesperrt</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[10px] uppercase text-gray-400">Admin-Notiz</span>
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none" data-testid="merchant-editor-admin-note" />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10 bg-white/[0.02]">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm" data-testid="merchant-editor-cancel">Abbrechen</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-semibold text-sm disabled:opacity-50" data-testid="merchant-editor-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Speichern
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


// ════════════════════════════════════════════════════════════════════
// Bundle Editor — inline component
// ════════════════════════════════════════════════════════════════════
function BundleEditor({ initial, catalog, saving, onCancel, onSave }) {
  const [key, setKey] = useState(initial?.key || "");
  const [name, setName] = useState(initial?.name || "");
  const [icon, setIcon] = useState(initial?.icon || "📦");
  const [description, setDescription] = useState(initial?.description || "");
  const [items, setItems] = useState(
    () => (initial?.features || []).map((f) => ({ key: f.key, price: Number(f.price) || 0 })),
  );

  const isNew = !initial;
  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0), 0),
    [items],
  );

  // Inline validation — recomputed live, shown as user types
  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];
    if (!key) errors.push({ field: "key", msg: "Key fehlt" });
    else if (!key.match(/^[a-z0-9_]+$/)) errors.push({ field: "key", msg: "Key: nur a-z, 0-9, _ (lowercase)" });
    else if (key.length < 2) errors.push({ field: "key", msg: "Key min. 2 Zeichen" });
    else if (key.length > 40) errors.push({ field: "key", msg: "Key max. 40 Zeichen" });

    if (!name.trim()) errors.push({ field: "name", msg: "Name fehlt" });
    else if (name.trim().length > 120) errors.push({ field: "name", msg: "Name max. 120 Zeichen" });

    if (items.length === 0) errors.push({ field: "features", msg: "Mindestens 1 Feature auswählen" });

    // Validate each feature item exists in catalog
    const catalogKeys = new Set(catalog.map((c) => c.key));
    const unknownFeatures = items.filter((it) => !catalogKeys.has(it.key));
    if (unknownFeatures.length > 0) {
      errors.push({
        field: "features",
        msg: `Unbekannte Feature-Keys: ${unknownFeatures.map((u) => u.key).join(", ")}`,
      });
    }

    // Warnings (non-blocking)
    const freeFeatures = items.filter((it) => Number(it.price) === 0);
    if (items.length > 0 && freeFeatures.length === items.length) {
      warnings.push("Alle Features sind kostenlos — Bundle hat €0 Preis");
    }
    if (description.length > 500) errors.push({ field: "description", msg: "Beschreibung max. 500 Zeichen" });

    return { errors, warnings, isValid: errors.length === 0 };
  }, [key, name, items, catalog, description]);

  const fieldError = (field) => validation.errors.find((e) => e.field === field)?.msg;

  const toggleFeature = (fkey) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.key === fkey);
      if (idx >= 0) return prev.filter((p) => p.key !== fkey);
      const cat = catalog.find((c) => c.key === fkey);
      return [...prev, { key: fkey, price: cat?.monthly_price ?? 0 }];
    });
  };

  const setItemPrice = (fkey, value) => {
    const num = Number(String(value).replace(",", "."));
    setItems((prev) =>
      prev.map((p) => (p.key === fkey ? { ...p, price: Number.isFinite(num) ? Math.max(0, num) : 0 } : p)),
    );
  };

  const submit = () => {
    if (!validation.isValid) {
      toast.error(validation.errors[0].msg);
      return;
    }
    onSave({ key, name: name.trim(), icon: icon || "📦", description: description.trim(), features: items, order: initial?.order ?? 100 });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
      data-testid="bundle-editor-modal"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a0a14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package size={18} className="text-amber-400" />
            {isNew ? "Neues Bundle erstellen" : `Bundle bearbeiten: ${initial.name}`}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-lg" data-testid="bundle-editor-close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase">Emoji</label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-2xl text-center"
                data-testid="bundle-editor-icon"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Restaurant Premium 2026"
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-amber-500/50 focus:outline-none"
                data-testid="bundle-editor-name"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase">Bundle-Key (URL-safe)</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              disabled={!isNew}
              placeholder="restaurant_premium"
              className={`w-full mt-1 px-3 py-2 bg-white/5 border rounded-lg text-sm font-mono disabled:opacity-50 ${
                fieldError("key") ? "border-red-500/60" : "border-white/10"
              }`}
              data-testid="bundle-editor-key"
            />
            {fieldError("key") && (
              <p className="mt-1 text-[10px] text-red-400" data-testid="bundle-editor-key-error">
                {fieldError("key")}
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Was beinhaltet dieses Bundle?"
              className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs resize-none"
              data-testid="bundle-editor-description"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase mb-2 block">Features im Bundle ({items.length})</label>
            <div className="grid sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-1">
              {catalog.map((f) => {
                const item = items.find((p) => p.key === f.key);
                const checked = !!item;
                return (
                  <div
                    key={f.key}
                    className={`p-2 rounded-lg border transition flex items-center gap-2 ${
                      checked ? "bg-amber-500/10 border-amber-500/30" : "bg-white/[0.02] border-white/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeature(f.key)}
                      className="accent-amber-400 shrink-0"
                      data-testid={`bundle-editor-feat-${f.key}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{f.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">
                        Standard: {f.monthly_price?.toFixed(2)} €
                      </p>
                    </div>
                    {checked && (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => setItemPrice(f.key, e.target.value)}
                        className="w-16 text-xs px-1.5 py-1 bg-white/10 border border-white/10 rounded text-right"
                        data-testid={`bundle-editor-price-${f.key}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.02]">
          <div>
            <p className="text-[10px] text-gray-400 uppercase">Bundle-Total</p>
            <p className="text-2xl font-bold text-amber-400" data-testid="bundle-editor-total">
              {total.toFixed(2)} €<span className="text-xs text-gray-500"> /Monat</span>
            </p>
            {validation.warnings.length > 0 && (
              <div className="mt-1 flex gap-2" data-testid="bundle-editor-warnings">
                {validation.warnings.map((w, i) => (
                  <span key={i} className="text-[10px] text-amber-300">⚠ {w}</span>
                ))}
              </div>
            )}
            {validation.errors.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2" data-testid="bundle-editor-errors">
                {validation.errors.slice(0, 3).map((e, i) => (
                  <span key={i} className="text-[10px] text-red-400">✗ {e.msg}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
              data-testid="bundle-editor-cancel"
            >
              Abbrechen
            </button>
            <button
              onClick={submit}
              disabled={saving || !validation.isValid}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="bundle-editor-save"
              title={!validation.isValid ? validation.errors[0]?.msg : ""}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isNew ? "Erstellen" : "Speichern"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
