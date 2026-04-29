/**
 * POS Features / Add-Ons Management
 * - Merchant: sieht eigene Features, kann Trial starten
 * - Admin: kann alle Features pro Merchant freischalten/sperren
 */
import { useState, useEffect } from "react";
import { Check, Lock, Loader2, Sparkles, Search, ShieldCheck, Clock, Euro } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

const CATEGORY_LABELS = {
  gastro: "Gastronomie",
  retail: "Einzelhandel",
  payments: "Zahlung",
  marketing: "Marketing",
  compliance: "Compliance",
  ai: "KI",
  selfcheckout: "Self-Checkout",
  developer: "Entwickler",
  analytics: "Analytics",
};

const CATEGORY_COLORS = {
  gastro: "#FF4060", retail: "#00C2FF", payments: "#10B981",
  marketing: "#A855F7", compliance: "#F59E0B", ai: "#00E89D",
  selfcheckout: "#FB7185", developer: "#60A5FA", analytics: "#FBBF24",
};

// ═══════════════════════════════════════════════════════════
// MERCHANT-VIEW — eigene Add-Ons sehen + Trial starten
// ═══════════════════════════════════════════════════════════
export function POSMerchantFeatures() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiCall("/api/pos/features/me");
      setFeatures(d.features || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startTrial = async (feature_key) => {
    try {
      const d = await apiCall("/api/pos/features/trial", {
        method: "POST", body: { feature_key, days: 14 },
      });
      toast.success(d.message || "Trial gestartet");
      load();
    } catch (e) { toast.error(e.message); }
  };

  const cats = ["all", ...new Set(features.map((f) => f.category))];
  const visible = filter === "all" ? features : features.filter((f) => f.category === filter);
  const activeCount = features.filter((f) => f.enabled).length;
  const monthlyTotal = features.filter((f) => f.enabled).reduce((s, f) => s + (f.monthly_price || 0), 0);

  if (loading) return <div className="py-8 text-center"><Loader2 size={20} className="animate-spin text-[#00C2FF] mx-auto" /></div>;

  return (
    <div className="space-y-3" data-testid="pos-merchant-features">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-3 border border-white/10">
          <p className="text-[10px] text-white/50 uppercase">Aktive Add-Ons</p>
          <p className="text-2xl font-black text-[#00C2FF]">{activeCount}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 border border-white/10">
          <p className="text-[10px] text-white/50 uppercase">Mtl. Kosten</p>
          <p className="text-2xl font-black text-[#10B981]">€{monthlyTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 hide-scrollbar">
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className="px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap"
            style={{
              background: filter === c ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
              color: filter === c ? "#00C2FF" : "rgba(255,255,255,0.6)",
            }}
            data-testid={`pos-feat-cat-${c}`}>
            {c === "all" ? "Alle" : (CATEGORY_LABELS[c] || c)}
          </button>
        ))}
      </div>

      {visible.map((f) => (
        <FeatureCard key={f.key} feature={f} onTrial={() => startTrial(f.key)} />
      ))}

      <div className="text-[10px] text-white/40 text-center py-2">
        Add-Ons buchen oder erweitern? → Admin / Support kontaktieren
      </div>
    </div>
  );
}

function FeatureCard({ feature, onTrial }) {
  const isActive = feature.enabled;
  const isTrial = feature.trial && isActive;
  const categoryColor = CATEGORY_COLORS[feature.category] || "#888";
  const validUntil = feature.valid_until ? new Date(feature.valid_until) : null;

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4"
      style={{ borderLeftColor: isActive ? categoryColor : "transparent", borderLeftWidth: 3 }}
      data-testid={`pos-feat-${feature.key}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
              style={{ background: `${categoryColor}22`, color: categoryColor }}>
              {CATEGORY_LABELS[feature.category] || feature.category}
            </span>
            {isActive && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"
                style={{ background: isTrial ? "#F59E0B22" : "#10B98122", color: isTrial ? "#F59E0B" : "#10B981" }}>
                {isTrial ? <Clock size={9} /> : <Check size={9} />}
                {isTrial ? "Trial" : "Aktiv"}
              </span>
            )}
            {!isActive && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 bg-white/5 text-white/40">
                <Lock size={9} /> Inaktiv
              </span>
            )}
          </div>
          <p className="text-[13px] font-bold text-white">{feature.name}</p>
          <p className="text-[11px] text-white/60 mt-1">{feature.description}</p>
          {validUntil && (
            <p className="text-[10px] text-amber-400 mt-1">
              Gültig bis {validUntil.toLocaleDateString("de-DE")}
            </p>
          )}
        </div>
        <div className="text-right ml-2 flex-shrink-0">
          <p className="text-[10px] text-white/40">€/Monat</p>
          <p className="text-base font-black text-white">{feature.monthly_price.toFixed(2)}</p>
        </div>
      </div>
      {!isActive && !feature.trial_used && (
        <button onClick={onTrial}
          className="w-full mt-2 py-2 rounded-xl bg-[#00C2FF]/15 text-[#00C2FF] text-[11px] font-bold flex items-center justify-center gap-1.5"
          data-testid={`pos-feat-trial-${feature.key}`}>
          <Sparkles size={11} /> 14 Tage gratis testen
        </button>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
// ADMIN-VIEW — alle Merchants + ihre Features schalten
// ═══════════════════════════════════════════════════════════
export function POSAdminFeatures() {
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [merchantFeatures, setMerchantFeatures] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiCall("/api/pos/admin/merchants")
      .then((d) => setMerchants(d.merchants || []))
      .catch((e) => toast.error(e.message));
  }, []);

  const loadMerchantFeatures = async (merchant_id) => {
    setLoading(true);
    try {
      const d = await apiCall(`/api/pos/features/admin/merchant/${merchant_id}`);
      setMerchantFeatures(d.features || []);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const selectMerchant = (m) => {
    setSelectedMerchant(m);
    loadMerchantFeatures(m.merchant_id);
  };

  const toggle = async (feature_key, enabled) => {
    try {
      await apiCall("/api/pos/features/admin/toggle", {
        method: "POST",
        body: { merchant_id: selectedMerchant.merchant_id, feature_key, enabled },
      });
      toast.success(enabled ? "Aktiviert" : "Deaktiviert");
      loadMerchantFeatures(selectedMerchant.merchant_id);
    } catch (e) { toast.error(e.message); }
  };

  const bulkSet = async (enabled) => {
    if (!window.confirm(`Wirklich ALLE Features ${enabled ? "aktivieren" : "deaktivieren"}?`)) return;
    try {
      await apiCall("/api/pos/features/admin/bulk-toggle", {
        method: "POST",
        body: {
          merchant_id: selectedMerchant.merchant_id,
          features: merchantFeatures.map((f) => f.key),
          enabled,
        },
      });
      toast.success("Aktualisiert");
      loadMerchantFeatures(selectedMerchant.merchant_id);
    } catch (e) { toast.error(e.message); }
  };

  const filtered = merchants.filter((m) =>
    !search || (m.business_name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (selectedMerchant) {
    const activeCount = merchantFeatures.filter((f) => f.enabled).length;
    const monthly = merchantFeatures.filter((f) => f.enabled).reduce((s, f) => s + f.monthly_price, 0);
    return (
      <div className="space-y-3" data-testid="pos-admin-features-detail">
        <button onClick={() => setSelectedMerchant(null)}
          className="text-[11px] text-white/60 mb-2" data-testid="pos-admin-feat-back">← Zurück</button>
        <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
          <p className="text-[14px] font-bold">{selectedMerchant.business_name}</p>
          <p className="text-[10px] text-white/50">{selectedMerchant.merchant_id} · {selectedMerchant.status}</p>
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            <span><b className="text-[#00C2FF]">{activeCount}</b> aktiv</span>
            <span className="text-white/40">·</span>
            <span><Euro size={9} className="inline" /> <b className="text-[#10B981]">{monthly.toFixed(2)}</b>/Monat</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => bulkSet(true)}
              className="py-2 rounded-lg bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold"
              data-testid="pos-admin-feat-all-on">Alle aktivieren</button>
            <button onClick={() => bulkSet(false)}
              className="py-2 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold"
              data-testid="pos-admin-feat-all-off">Alle deaktivieren</button>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center"><Loader2 size={18} className="animate-spin text-[#00C2FF] mx-auto" /></div>
        ) : (
          merchantFeatures.map((f) => (
            <div key={f.key} className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 flex items-center gap-3"
              data-testid={`pos-admin-feat-${f.key}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold truncate">{f.name}</p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase"
                    style={{ background: `${CATEGORY_COLORS[f.category]}22`, color: CATEGORY_COLORS[f.category] }}>
                    {CATEGORY_LABELS[f.category] || f.category}
                  </span>
                </div>
                <p className="text-[10px] text-white/50 truncate">{f.description}</p>
                <p className="text-[10px] text-white/40">€{f.monthly_price.toFixed(2)}/Monat</p>
              </div>
              <button onClick={() => toggle(f.key, !f.enabled)}
                className="relative w-12 h-6 rounded-full transition-all"
                style={{ background: f.enabled ? "#10B981" : "rgba(255,255,255,0.1)" }}
                data-testid={`pos-admin-feat-toggle-${f.key}`}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: f.enabled ? "26px" : "2px" }} />
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="pos-admin-features">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
        <Search size={13} className="text-white/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Merchant suchen..." className="flex-1 bg-transparent text-[12px] outline-none"
          data-testid="pos-admin-feat-search" />
      </div>
      {filtered.map((m) => (
        <button key={m.merchant_id} onClick={() => selectMerchant(m)}
          className="w-full text-left rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 hover:bg-white/[0.05] flex items-center gap-3"
          data-testid={`pos-admin-feat-merchant-${m.merchant_id}`}>
          <ShieldCheck size={14} className="text-[#00C2FF] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold truncate">{m.business_name}</p>
            <p className="text-[9px] text-white/40">{m.merchant_id} · {m.status} · Fee {(m.fee_rate * 100).toFixed(2)}%</p>
          </div>
          <span className="text-[#00C2FF] text-[14px]">→</span>
        </button>
      ))}
      {filtered.length === 0 && (
        <p className="text-[11px] text-white/40 text-center py-6">Keine Merchants</p>
      )}
    </div>
  );
}
