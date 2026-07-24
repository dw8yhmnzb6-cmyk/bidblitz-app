/**
 * BidBlitz V2 - Insurance Marketplace
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Shield, Car, Plane, Smartphone, Home, Heart,
  Umbrella, PawPrint, Loader2, Check, Calculator, FileWarning,
  Camera
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_ICONS = { auto: Car, travel: Plane, phone: Smartphone, household: Home, liability: Shield, health: Heart, life: Umbrella, pet: PawPrint };
const CAT_COLORS = { auto: "#3B82F6", travel: "#10B981", phone: "#A855F7", household: "#F59E0B", liability: "#EF4444", health: "#EC4899", life: "#06B6D4", pet: "#F97316" };
const CAT_LABELS = { auto: "Kfz", travel: "Reise", phone: "Handy", household: "Hausrat", liability: "Haftpflicht", health: "Kranken", life: "Leben", pet: "Tier" };

const NumberInput = ({ label, value, onChange, step = 1, testId }) => (
  <div>
    <label className="text-[9px] text-gray-500 mb-1 block">{label}</label>
    <input type="number" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none"
      data-testid={testId} />
  </div>
);

const InsurancePage = ({ onBack }) => {
  const [view, setView] = useState("list");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [myPolicies, setMyPolicies] = useState([]);
  const [billing, setBilling] = useState("monthly");
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState(null);
  const [error, setError] = useState("");

  // Quote calculator
  const [quoteCat, setQuoteCat] = useState("auto");
  const [quoteParams, setQuoteParams] = useState({});
  const [quoteResult, setQuoteResult] = useState(null);
  const [quoting, setQuoting] = useState(false);

  // Claims
  const [myClaims, setMyClaims] = useState([]);
  const [claimPolicy, setClaimPolicy] = useState(null);
  const [claimForm, setClaimForm] = useState({ claim_type: "damage", description: "", incident_date: "", amount_estimate: 0 });
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/insurance/products?category=${catFilter}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setProducts(d.products || []); }
    } catch {}
    setLoading(false);
  }, [catFilter]);

  const loadPolicies = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/insurance/my-policies`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyPolicies(d.policies || []); }
    } catch {}
  }, []);

  const loadClaims = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/insurance/my-claims`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyClaims(d.claims || []); }
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); loadPolicies(); loadClaims(); }, [load, loadPolicies, loadClaims]);

  const calcQuote = async () => {
    setQuoting(true); setQuoteResult(null);
    try {
      const r = await fetch(`${API}/api/insurance/quote`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: quoteCat, params: quoteParams }),
      });
      if (r.ok) setQuoteResult(await r.json());
    } catch { /* noop */ }
    setQuoting(false);
  };

  const submitClaim = async () => {
    if (!claimPolicy || !claimForm.description || claimForm.description.length < 10) {
      setError("Bitte mindestens 10 Zeichen Beschreibung eingeben"); return;
    }
    setClaimSubmitting(true); setError("");
    try {
      const r = await fetch(`${API}/api/insurance/claim`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_id: claimPolicy.policy_id, ...claimForm }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setClaimPolicy(null);
        setClaimForm({ claim_type: "damage", description: "", incident_date: "", amount_estimate: 0 });
        loadClaims(); setView("claims");
      } else setError(d.detail || "Fehler");
    } catch { setError("Netzwerkfehler"); }
    setClaimSubmitting(false);
  };

  const buy = async () => {
    if (!selected) return;
    setBuying(true); setError("");
    try {
      const res = await fetch(`${API}/api/insurance/purchase`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: selected.product_id, billing }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setBuyResult(d.policy); loadPolicies(); }
      else setError(d.detail || "Kauf fehlgeschlagen");
    } catch { setError("Netzwerkfehler"); }
    setBuying(false);
  };

  const price = selected ? (billing === "yearly" ? selected.yearly_price : selected.monthly_price) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="insurance-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <div><h1 className="text-[15px] font-bold">Versicherungen</h1><p className="text-[10px] text-gray-500">{products.length} Angebote</p></div>
          </div>
          <div className="flex gap-1.5">
            {[
              { id: "list", label: "Markt" },
              { id: "quote", label: "Rechner" },
              { id: "policies", label: "Policen" },
              { id: "claims", label: "Schäden" },
            ].map(v => (
              <motion.button key={v.id} whileTap={{ scale: 0.95 }} onClick={() => { setView(v.id); setSelected(null); setBuyResult(null); setClaimPolicy(null); }}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${view === v.id ? "bg-[#EF4444] text-white" : "bg-white/5 text-gray-500"}`}
                data-testid={`ins-tab-${v.id}`}>{v.label}</motion.button>
            ))}
          </div>
        </div>
        {view === "list" && !selected && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCatFilter("")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${!catFilter ? "bg-[#EF4444] text-white" : "bg-white/5 text-gray-500"}`}>Alle</motion.button>
            {Object.entries(CAT_LABELS).map(([id, label]) => {
              const Icon = CAT_ICONS[id];
              return (
                <motion.button key={id} whileTap={{ scale: 0.95 }} onClick={() => setCatFilter(id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap flex items-center gap-1 ${catFilter === id ? "text-white" : "bg-white/5 text-gray-500"}`}
                  style={catFilter === id ? { background: CAT_COLORS[id] } : {}}><Icon size={10} /> {label}</motion.button>
              );
            })}
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#EF4444]" /></div>}

      {/* Product List */}
      {view === "list" && !loading && !selected && (
        <div className="p-4 space-y-3">
          {products.length === 0 ? (
            <div className="text-center py-16"><Shield size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Versicherungen gefunden</p></div>
          ) : products.map((p, i) => {
            const Icon = CAT_ICONS[p.category] || Shield;
            const color = CAT_COLORS[p.category] || "#666";
            return (
              <motion.div key={p.product_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => { setSelected(p); setBuyResult(null); setError(""); }}
                className="bg-[#111118] rounded-2xl border border-white/5 p-4 cursor-pointer hover:border-white/10 transition-colors"
                data-testid={`insurance-${p.product_id}`}>
                <div className="flex items-start gap-3">
                  {p.image_url ? <img src={p.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" /> : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                      <Icon size={20} style={{ color }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="px-2 py-0.5 rounded text-[8px] font-bold text-white" style={{ background: color }}>{CAT_LABELS[p.category]}</span>
                      <span className="text-[9px] text-gray-500">{p.provider}</span>
                    </div>
                    <p className="text-[13px] font-bold truncate">{p.title}</p>
                    <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{p.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color }}>€{p.monthly_price}/Mo</p>
                    <p className="text-[9px] text-gray-500">€{p.yearly_price}/Jahr</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Product Detail */}
      {selected && !buyResult && (
        <div className="p-4 space-y-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-xs text-[#EF4444] font-medium"><ArrowLeft size={14} /> Zurück</motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
            <h2 className="text-base font-bold mb-1">{selected.title}</h2>
            <p className="text-[10px] text-gray-500 mb-2">{selected.provider}</p>
            <p className="text-[11px] text-gray-400 mb-3">{selected.description}</p>
            {selected.coverage && <p className="text-[10px] text-gray-500 mb-2"><span className="font-semibold text-white">Deckung:</span> {selected.coverage}</p>}
            {selected.deductible > 0 && <p className="text-[10px] text-gray-500 mb-2">Selbstbeteiligung: €{selected.deductible}</p>}
            {selected.features?.length > 0 && (
              <div className="space-y-1 mt-3">
                {selected.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2"><Check size={12} className="text-[#10B981]" /><span className="text-[10px] text-gray-400">{f}</span></div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Abschließen</h3>
            <div className="grid grid-cols-2 gap-2">
              {["monthly", "yearly"].map(b => (
                <motion.button key={b} whileTap={{ scale: 0.95 }} onClick={() => setBilling(b)}
                  className={`p-3 rounded-xl border text-center ${billing === b ? "bg-[#EF4444]/10 border-[#EF4444]" : "bg-white/[0.03] border-white/10"}`}>
                  <p className="text-[11px] font-bold">{b === "monthly" ? "Monatlich" : "Jährlich"}</p>
                  <p className="text-sm font-bold" style={{ color: billing === b ? "#EF4444" : "#666" }}>
                    €{b === "yearly" ? selected.yearly_price : selected.monthly_price}
                  </p>
                  {b === "yearly" && <p className="text-[8px] text-[#10B981]">10% sparen</p>}
                </motion.button>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/20">
              <div className="flex justify-between"><span className="text-[10px] text-gray-400">Preis</span><span className="text-sm font-bold text-[#EF4444]">€{price}</span></div>
              <div className="flex justify-between"><span className="text-[10px] text-[#10B981]">Cashback (2%)</span><span className="text-[10px] text-[#10B981]">+€{(price * 0.02).toFixed(2)}</span></div>
            </div>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={buy} disabled={buying}
              className="w-full py-3.5 rounded-xl bg-[#EF4444] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              data-testid="ins-buy-btn">{buying ? <Loader2 size={18} className="animate-spin" /> : <><Shield size={16} /> Jetzt abschließen</>}</motion.button>
          </div>
        </div>
      )}

      {/* Buy Success */}
      {buyResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#10B981]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-[#10B981]" /></div>
            <h3 className="text-lg font-bold mb-1">Versicherung abgeschlossen!</h3>
            <p className="text-sm text-gray-400">{buyResult.product_title}</p>
            <p className="text-xl font-bold text-[#EF4444] mt-2">€{buyResult.price}/{buyResult.billing === "yearly" ? "Jahr" : "Monat"}</p>
            {buyResult.cashback > 0 && <p className="text-xs text-[#10B981] mt-1">+€{buyResult.cashback.toFixed(2)} Cashback</p>}
            <p className="text-[9px] text-gray-600 mt-2 font-mono">{buyResult.reference}</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelected(null); setBuyResult(null); setView("policies"); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm" data-testid="ins-goto-policies">Meine Policen</motion.button>
          </div>
        </div>
      )}

      {/* My Policies */}
      {view === "policies" && (
        <div className="p-4 space-y-3">
          {myPolicies.length === 0 ? (
            <div className="text-center py-16"><Shield size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Policen</p></div>
          ) : myPolicies.map((p, i) => {
            const color = CAT_COLORS[p.category] || "#666";
            const Icon = CAT_ICONS[p.category] || Shield;
            return (
              <motion.div key={p.policy_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-[#111118] rounded-2xl border border-white/5 p-3.5" data-testid={`policy-${p.policy_id}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color }} />
                    <p className="text-[12px] font-bold">{p.product_title}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${p.status === "active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {p.status === "active" ? "Aktiv" : "Gekündigt"}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500">{p.provider} — {p.billing === "yearly" ? "Jährlich" : "Monatlich"}</span>
                  <span className="text-sm font-bold" style={{ color }}>€{p.price}</span>
                </div>
                {p.status === "active" && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setClaimPolicy(p); setView("claim-new"); }}
                    className="w-full py-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-semibold flex items-center justify-center gap-1"
                    data-testid={`policy-claim-${p.policy_id}`}>
                    <FileWarning size={11} /> Schaden melden
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Quote Calculator */}
      {view === "quote" && (
        <div className="p-4 space-y-4">
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-[#EF4444]" />
              <h3 className="text-sm font-bold">Versicherungs-Schnellrechner</h3>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(CAT_LABELS).map(([id, label]) => {
                const Icon = CAT_ICONS[id];
                const active = quoteCat === id;
                return (
                  <motion.button key={id} whileTap={{ scale: 0.95 }} onClick={() => { setQuoteCat(id); setQuoteParams({}); setQuoteResult(null); }}
                    className={`p-2 rounded-xl flex flex-col items-center gap-1 ${active ? "" : "bg-white/5"}`}
                    style={active ? { background: CAT_COLORS[id] } : {}}
                    data-testid={`quote-cat-${id}`}>
                    <Icon size={14} style={{ color: active ? "#fff" : CAT_COLORS[id] }} />
                    <span className="text-[9px] font-medium" style={{ color: active ? "#fff" : "#888" }}>{label}</span>
                  </motion.button>
                );
              })}
            </div>

            <div className="space-y-2">
              {quoteCat === "auto" && (
                <>
                  <NumberInput label="Fahreralter" value={quoteParams.driver_age || 35} onChange={v => setQuoteParams(p => ({ ...p, driver_age: v }))} testId="q-driver-age" />
                  <NumberInput label="Fahrzeugalter (Jahre)" value={quoteParams.vehicle_age || 5} onChange={v => setQuoteParams(p => ({ ...p, vehicle_age: v }))} testId="q-vehicle-age" />
                </>
              )}
              {quoteCat === "travel" && (
                <NumberInput label="Reisedauer (Tage)" value={quoteParams.trip_days || 7} onChange={v => setQuoteParams(p => ({ ...p, trip_days: v }))} testId="q-trip-days" />
              )}
              {quoteCat === "phone" && (
                <NumberInput label="Gerätewert (€)" value={quoteParams.device_value || 600} onChange={v => setQuoteParams(p => ({ ...p, device_value: v }))} testId="q-device-value" />
              )}
              {quoteCat === "household" && (
                <NumberInput label="Wohnfläche (m²)" value={quoteParams.living_sqm || 60} onChange={v => setQuoteParams(p => ({ ...p, living_sqm: v }))} testId="q-living-sqm" />
              )}
              {quoteCat === "liability" && (
                <p className="text-[10px] text-gray-500">Haftpflicht Pauschalpreis</p>
              )}
              {quoteCat === "health" && (
                <NumberInput label="Alter" value={quoteParams.age || 30} onChange={v => setQuoteParams(p => ({ ...p, age: v }))} testId="q-age" />
              )}
              {quoteCat === "life" && (
                <>
                  <NumberInput label="Alter" value={quoteParams.age || 30} onChange={v => setQuoteParams(p => ({ ...p, age: v }))} testId="q-age" />
                  <NumberInput label="Versicherungssumme (€)" value={quoteParams.coverage_amount || 100000} step={10000} onChange={v => setQuoteParams(p => ({ ...p, coverage_amount: v }))} testId="q-coverage" />
                </>
              )}
              {quoteCat === "pet" && (
                <NumberInput label="Tieralter (Jahre)" value={quoteParams.pet_age || 3} onChange={v => setQuoteParams(p => ({ ...p, pet_age: v }))} testId="q-pet-age" />
              )}
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={calcQuote} disabled={quoting}
              className="w-full py-3 rounded-xl bg-[#EF4444] text-white font-bold text-sm flex items-center justify-center gap-2"
              data-testid="quote-calc-btn">
              {quoting ? <Loader2 size={14} className="animate-spin" /> : <><Calculator size={14} /> Beitrag berechnen</>}
            </motion.button>

            {quoteResult && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 bg-[#EF4444]/5 border border-[#EF4444]/20" data-testid="quote-result">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Geschätzter Beitrag</p>
                <p className="text-2xl font-black text-[#EF4444]">€{quoteResult.monthly_price}/Mo</p>
                <p className="text-[10px] text-gray-400">€{quoteResult.yearly_price}/Jahr · {quoteResult.yearly_savings > 0 ? `Spare €${quoteResult.yearly_savings}` : ""}</p>
                <button onClick={() => { setView("list"); setCatFilter(quoteCat); }}
                  className="mt-3 w-full py-2 rounded-lg bg-white/5 text-[11px] font-semibold text-white"
                  data-testid="quote-show-products">Passende Angebote ansehen</button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Claims List */}
      {view === "claims" && (
        <div className="p-4 space-y-3">
          {myClaims.length === 0 ? (
            <div className="text-center py-16"><FileWarning size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Schäden gemeldet</p></div>
          ) : myClaims.map((c, i) => {
            const color = CAT_COLORS[c.category] || "#666";
            const Icon = CAT_ICONS[c.category] || Shield;
            const statusColors = { submitted: "#F59E0B", in_review: "#3B82F6", approved: "#10B981", paid: "#10B981", rejected: "#EF4444" };
            const statusLabels = { submitted: "Eingereicht", in_review: "Prüfung", approved: "Genehmigt", paid: "Ausgezahlt", rejected: "Abgelehnt" };
            return (
              <motion.div key={c.claim_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-[#111118] rounded-2xl border border-white/5 p-3.5" data-testid={`claim-${c.claim_id}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color }} />
                    <p className="text-[12px] font-bold">{c.policy_title}</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded font-medium" style={{ background: `${statusColors[c.status]}1A`, color: statusColors[c.status] }}>
                    {statusLabels[c.status] || c.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mb-1">{c.claim_type} · {c.incident_date}</p>
                <p className="text-[11px] text-gray-400 line-clamp-2">{c.description}</p>
                {c.amount_estimate > 0 && <p className="text-[10px] text-gray-500 mt-1">Geschätzt: €{c.amount_estimate}</p>}
                {c.payout_amount > 0 && <p className="text-[10px] text-[#10B981] font-bold mt-1">Auszahlung: €{c.payout_amount}</p>}
                <p className="text-[9px] font-mono text-gray-600 mt-1">{c.reference}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Claim */}
      {view === "claim-new" && claimPolicy && (
        <div className="p-4 space-y-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setClaimPolicy(null); setView("policies"); }}
            className="flex items-center gap-1 text-xs text-[#EF4444] font-medium" data-testid="claim-back">
            <ArrowLeft size={14} /> Zurück
          </motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><FileWarning size={14} className="text-[#EF4444]" /> Schaden melden</h3>
            <p className="text-[11px] text-gray-500">Police: {claimPolicy.product_title}</p>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Schadenart</label>
              <select value={claimForm.claim_type} onChange={e => setClaimForm(f => ({ ...f, claim_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none"
                data-testid="claim-type">
                {[
                  { v: "accident", l: "Unfall" }, { v: "theft", l: "Diebstahl" },
                  { v: "damage", l: "Beschädigung" }, { v: "illness", l: "Krankheit" },
                  { v: "other", l: "Sonstiges" },
                ].map(o => <option key={o.v} value={o.v} style={{ background: "#111" }}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Schadensdatum</label>
              <input type="date" value={claimForm.incident_date} onChange={e => setClaimForm(f => ({ ...f, incident_date: e.target.value }))}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none"
                data-testid="claim-date" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Beschreibung *</label>
              <textarea value={claimForm.description} onChange={e => setClaimForm(f => ({ ...f, description: e.target.value }))}
                rows={4} placeholder="Beschreibe den Schaden so detailliert wie möglich..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none"
                data-testid="claim-desc" />
              <p className="text-[8px] text-gray-600 mt-1">{claimForm.description.length}/10 Zeichen min.</p>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Geschätzter Schaden (€)</label>
              <input type="number" min={0} value={claimForm.amount_estimate} onChange={e => setClaimForm(f => ({ ...f, amount_estimate: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none"
                data-testid="claim-amount" />
            </div>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={submitClaim} disabled={claimSubmitting}
              className="w-full py-3.5 rounded-xl bg-[#EF4444] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              data-testid="claim-submit">
              {claimSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Camera size={14} /> Schaden einreichen</>}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsurancePage;
