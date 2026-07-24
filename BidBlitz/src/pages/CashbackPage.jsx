import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Percent, ShoppingBag, TrendingUp, ExternalLink } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CashbackPage({ onBack }) {
  const [shops, setShops] = useState([]);
  const [myCashback, setMyCashback] = useState({ claims: [], total_earned: 0 });
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("shops");
  const [selected, setSelected] = useState(null);
  const [claimAmount, setClaimAmount] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { loadShops(); }, [category, search]);
  useEffect(() => { if (tab === "my") loadMyCashback(); }, [tab]);

  const loadShops = async () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`${API}/api/cashback/shops?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setShops(d.shops || []); setCategories(d.categories || []); }
    } catch {}
  };

  const loadMyCashback = async () => {
    try {
      const res = await fetch(`${API}/api/cashback/my-cashback`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyCashback(d); }
    } catch {}
  };

  const claimCashback = async () => {
    if (!selected || !claimAmount) return;
    try {
      const res = await fetch(`${API}/api/cashback/claim`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: selected.id, amount: parseFloat(claimAmount) }),
      });
      const d = await res.json();
      if (res.ok) { setMsg(d.message); setSelected(null); setClaimAmount(""); loadMyCashback(); }
      else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="cashback-page">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-base font-bold">Cashback</h1>
            <p className="text-[10px] text-yellow-400">2-8% bei jedem Einkauf sparen</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-yellow-400">€{myCashback.total_earned?.toFixed(2)}</p>
            <p className="text-[9px] text-gray-500">verdient</p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          {[{ id: "shops", label: "Partner-Shops" }, { id: "my", label: "Mein Cashback" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "shops" && (
          <>
            <div className="mt-3 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Shop suchen..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-yellow-500/30 placeholder-gray-600" />
            </div>
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setCategory("")} className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${!category ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>Alle</button>
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c === category ? "" : c)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${category === c ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>{c}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Shop Grid */}
      {tab === "shops" && (
        <div className="px-4 pt-4 grid grid-cols-2 gap-3">
          {shops.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => setSelected(s)}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:border-yellow-500/20 transition-all text-center" data-testid={`cashback-shop-${s.id}`}>
              <div className="w-12 h-12 rounded-xl mx-auto mb-2 overflow-hidden bg-white/10 flex items-center justify-center">
                <img src={s.logo} alt={s.name} className="w-full h-full object-contain p-1" onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span class="text-lg font-bold">${s.name[0]}</span>`; }} />
              </div>
              <p className="text-xs font-bold truncate">{s.name}</p>
              <p className="text-lg font-black text-yellow-400 mt-1">{s.cashback_pct}%</p>
              <p className="text-[9px] text-gray-500">Cashback</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* My Cashback */}
      {tab === "my" && (
        <div className="px-4 pt-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 mb-4 text-center">
            <p className="text-sm text-gray-400">Gesamt verdient</p>
            <p className="text-4xl font-black text-yellow-400">€{myCashback.total_earned?.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{myCashback.claims?.length || 0} Transaktionen</p>
          </div>
          <div className="space-y-2">
            {myCashback.claims?.map((c, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{c.shop_name}</p>
                  <p className="text-[10px] text-gray-500">€{c.purchase_amount?.toFixed(2)} Einkauf · {c.cashback_pct}%</p>
                </div>
                <p className="text-sm font-bold text-green-400">+€{c.cashback_amount?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setSelected(null)}>
          <motion.div initial={{ y: 300 }} animate={{ y: 0 }} className="w-full bg-[#111] rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center">
                <img src={selected.logo} alt={selected.name} className="w-full h-full object-contain p-2" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <p className="text-yellow-400 font-bold">{selected.cashback_pct}% Cashback</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">Gib deinen Einkaufsbetrag ein und erhalte {selected.cashback_pct}% zurück in dein Wallet.</p>
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">€</span>
              <input value={claimAmount} onChange={e => setClaimAmount(e.target.value)} placeholder="0.00" type="number"
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-xl font-bold outline-none focus:border-yellow-500/30" />
            </div>
            {claimAmount && (
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4 text-center">
                <p className="text-sm text-gray-400">Du erhältst</p>
                <p className="text-2xl font-black text-yellow-400">€{(parseFloat(claimAmount || 0) * selected.cashback_pct / 100).toFixed(2)}</p>
                <p className="text-xs text-gray-500">Cashback</p>
              </div>
            )}
            <button onClick={claimCashback} disabled={!claimAmount} className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-bold text-black text-base disabled:opacity-40" data-testid="cashback-claim-btn">
              <Percent size={18} className="inline mr-2" />Cashback einlösen
            </button>
          </motion.div>
        </motion.div>
      )}

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm text-center font-medium z-50">{msg}</div>}
    </div>
  );
}
