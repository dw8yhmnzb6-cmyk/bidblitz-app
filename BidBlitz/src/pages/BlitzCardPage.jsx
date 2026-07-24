import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Check, Loader2, Shield } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BlitzCardPage({ onBack }) {
  const [tiers, setTiers] = useState([]);
  const [myCard, setMyCard] = useState(null);
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/blitzcard/tiers`).then(r => r.json()).then(d => setTiers(d.tiers || [])).catch(() => {});
    fetch(`${API}/api/blitzcard/my-card`, { credentials: "include" }).then(r => r.json()).then(d => setMyCard(d)).catch(() => {});
  }, []);

  const order = async (tierId) => {
    setLoading(tierId);
    try {
      const r = await fetch(`${API}/api/blitzcard/order`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_tier: tierId }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) fetch(`${API}/api/blitzcard/my-card`, { credentials: "include" }).then(r => r.json()).then(d => setMyCard(d));
    } catch { setMsg("Fehler"); }
    setLoading("");
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzcard-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="card-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><CreditCard size={18} className="text-sky-400" /> BlitzCard</h1>
            <p className="text-[10px] text-sky-400">Visa Debit mit Crypto-Cashback</p>
          </div>
        </div>
      </div>

      {/* My active card */}
      {myCard?.has_card && (
        <div className="px-4 pt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="w-full aspect-[1.6/1] rounded-2xl p-5 relative overflow-hidden shadow-2xl max-w-[380px] mx-auto"
            style={{ background: myCard.card.gradient }} data-testid="my-blitzcard">
            <div className="absolute inset-0 opacity-10">
              <svg viewBox="0 0 400 250" className="w-full h-full">
                <polygon points="0,0 200,0 150,120 0,80" fill="white" opacity="0.3" />
                <polygon points="200,130 400,100 400,250 100,250" fill="white" opacity="0.15" />
              </svg>
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/60 text-[10px] tracking-widest font-bold">BLITZCARD</p>
                  <p className="text-white font-bold text-sm mt-0.5">{myCard.card.tier_name}</p>
                </div>
                <Shield size={20} className="text-white/40" />
              </div>
              <div>
                <p className="text-white font-mono text-lg tracking-widest">{myCard.card.card_number}</p>
                <div className="flex justify-between mt-3">
                  <p className="text-white/50 text-[10px]">{myCard.card.cashback}% Cashback</p>
                  <p className="text-white font-bold text-sm">VISA</p>
                </div>
              </div>
            </div>
          </motion.div>
          <div className="text-center mt-3">
            <p className="text-sm text-gray-400">Bisheriger Cashback: <span className="text-green-400 font-bold">{myCard.card.cashback_earned?.toFixed(2) || "0.00"} EUR</span></p>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{myCard?.has_card ? "Upgrade deine Karte" : "Waehle deine Karte"}</p>
        {tiers.map((tier, i) => {
          const isActive = myCard?.card?.tier_id === tier.id;
          return (
            <motion.div key={tier.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`p-5 rounded-2xl border ${isActive ? "border-sky-500/40 bg-sky-500/5" : "border-white/5 bg-white/[0.02]"}`}
              data-testid={`card-tier-${tier.id}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-9 rounded-lg shadow-lg" style={{ background: tier.gradient }} />
                <div className="flex-1">
                  <p className="text-sm font-bold">{tier.name}</p>
                  <p className="text-[10px] text-gray-500">{tier.cashback}% Cashback · Limit: {tier.limit_monthly.toLocaleString("de-DE")} EUR/Mo</p>
                </div>
                <p className="text-sm font-bold">{tier.fee === 0 ? "Gratis" : `${tier.fee} EUR/Mo`}</p>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {tier.perks.map((p, j) => (
                  <span key={j} className="text-[9px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check size={8} className="text-green-400" /> {p}
                  </span>
                ))}
              </div>
              {isActive ? (
                <div className="w-full py-2.5 bg-sky-500/10 rounded-xl text-center text-sky-400 text-xs font-bold">Deine aktive Karte</div>
              ) : (
                <button onClick={() => order(tier.id)} disabled={loading === tier.id}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  data-testid={`order-card-${tier.id}`}>
                  {loading === tier.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Karte bestellen"}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-sky-500/20 border border-sky-500/30 rounded-xl text-sky-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
