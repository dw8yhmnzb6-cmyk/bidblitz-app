import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Star, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function LevelUpPage({ onBack }) {
  const [tiers, setTiers] = useState([]);
  const [myTier, setMyTier] = useState(null);
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/levelup/tiers`).then(r => r.json()).then(d => setTiers(d.tiers || [])).catch(() => {});
    fetch(`${API}/api/levelup/my-tier`, { credentials: "include" }).then(r => r.json()).then(d => setMyTier(d)).catch(() => {});
  }, []);

  const subscribe = async (tierId) => {
    setLoading(tierId);
    try {
      const r = await fetch(`${API}/api/levelup/subscribe`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_id: tierId }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) fetch(`${API}/api/levelup/my-tier`, { credentials: "include" }).then(r => r.json()).then(d => setMyTier(d));
    } catch { setMsg("Fehler"); }
    setLoading("");
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="levelup-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="levelup-back-btn"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2"><Crown size={18} className="text-yellow-400" /> Level Up</h1>
            <p className="text-[10px] text-yellow-400">Premium Rewards & Vorteile</p>
          </div>
        </div>
      </div>

      {myTier?.subscribed && (
        <div className="px-4 pt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: myTier.tier.color + "30" }}>
              <Crown size={22} style={{ color: myTier.tier.color === "#0F0F0F" ? "#fff" : myTier.tier.color }} />
            </div>
            <div>
              <p className="text-sm font-bold">Dein Level: {myTier.tier.name}</p>
              <p className="text-[10px] text-gray-400">{myTier.tier.cashback}% Cashback · +{myTier.tier.earn_bonus}% Earn Bonus</p>
            </div>
          </motion.div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {tiers.map((tier, i) => {
          const isActive = myTier?.tier?.id === tier.id;
          return (
            <motion.div key={tier.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`p-5 rounded-2xl border ${isActive ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-white/[0.02]"}`}
              data-testid={`tier-${tier.id}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: tier.color === "#0F0F0F" ? "#222" : tier.color + "25" }}>
                    <Star size={18} style={{ color: tier.color === "#0F0F0F" ? "#fff" : tier.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{tier.name}</p>
                    <p className="text-[10px] text-gray-500">{tier.cashback}% Cashback · +{tier.earn_bonus}% Earn</p>
                  </div>
                </div>
                <p className="text-lg font-black">{tier.price === 0 ? "Gratis" : `${tier.price} EUR/Mo`}</p>
              </div>
              <div className="space-y-1.5 mb-4">
                {tier.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Check size={12} className="text-green-400 shrink-0" />
                    <p className="text-[11px] text-gray-400">{f}</p>
                  </div>
                ))}
              </div>
              {isActive ? (
                <div className="w-full py-3 bg-yellow-500/10 rounded-xl text-center text-yellow-400 text-xs font-bold">Aktives Abo</div>
              ) : (
                <button onClick={() => subscribe(tier.id)} disabled={loading === tier.id}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  data-testid={`subscribe-${tier.id}`}>
                  {loading === tier.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : tier.price === 0 ? "Aktivieren" : `Fuer ${tier.price} EUR/Mo abonnieren`}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
