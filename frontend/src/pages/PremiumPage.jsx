import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, Zap, Check, Star, Trophy, Users, TrendingUp, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function PremiumPage({ onBack }) {
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [tab, setTab] = useState("premium");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [cashoutHistory, setCashoutHistory] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/premium/plans`, { credentials: "include" }).then(r => r.json()).then(d => {
      setPlans(d.plans || []);
      setCurrentPlan(d.current_plan);
    }).catch(() => {});
    fetch(`${API}/api/monetize/challenges`, { credentials: "include" }).then(r => r.json()).then(d => setChallenges(d.challenges || [])).catch(() => {});
    fetch(`${API}/api/monetize/cashout/history`, { credentials: "include" }).then(r => r.json()).then(d => setCashoutHistory(d.cashouts || [])).catch(() => {});
  }, []);

  const subscribe = async (planId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/premium/subscribe`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const d = await res.json();
      setMsg(d.message || d.detail || "Fehler");
      if (res.ok) setCurrentPlan({ plan_id: planId });
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const instantCashout = async () => {
    if (!cashoutAmount) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/monetize/instant-cashout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(cashoutAmount) }),
      });
      const d = await res.json();
      setMsg(d.message || d.detail || "Fehler");
      setCashoutAmount("");
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const joinChallenge = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/monetize/challenges/join`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: id }),
      });
      const d = await res.json();
      setMsg(d.message || d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setLoading(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const planIcons = { basic: "💎", pro: "👑", elite: "🏆" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="premium-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-bold flex items-center gap-2"><Crown size={18} className="text-yellow-400" /> Premium & Mehr</h1>
        </div>
        <div className="flex gap-1.5 mt-3">
          {[{ id: "premium", label: "VIP Abos" }, { id: "cashout", label: "Auszahlung" }, { id: "challenges", label: "Challenges" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${tab === t.id ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* PREMIUM PLANS */}
        {tab === "premium" && (
          <div className="space-y-4">
            {currentPlan && (
              <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                <p className="text-yellow-400 font-bold">Dein aktuelles Abo: {currentPlan.plan_name || currentPlan.plan_id}</p>
              </div>
            )}
            {plans.map((plan, i) => {
              const active = currentPlan?.plan_id === plan.plan_id;
              return (
                <motion.div key={plan.plan_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`p-5 rounded-2xl border ${active ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-white/[0.02]"}`}
                  data-testid={`plan-${plan.plan_id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{planIcons[plan.plan_id]}</span>
                      <div>
                        <p className="font-bold text-lg" style={{ color: plan.color }}>{plan.name}</p>
                        <p className="text-2xl font-black text-white">€{plan.price}<span className="text-sm text-gray-500 font-normal">/Monat</span></p>
                      </div>
                    </div>
                    {active && <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">AKTIV</span>}
                  </div>
                  <div className="space-y-2 mb-4">
                    {plan.features.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-2 text-sm text-gray-400">
                        <Check size={14} style={{ color: plan.color }} /><span>{f}</span>
                      </div>
                    ))}
                  </div>
                  {!active && (
                    <button onClick={() => subscribe(plan.plan_id)} disabled={loading}
                      className="w-full py-3 rounded-xl font-bold text-black disabled:opacity-50"
                      style={{ background: plan.color }}>
                      {loading ? "..." : `${plan.name} wählen`}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* INSTANT CASHOUT */}
        {tab === "cashout" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={20} className="text-green-400" />
                <h2 className="text-lg font-bold">Sofort-Auszahlung</h2>
              </div>
              <p className="text-sm text-gray-400 mb-4">Geld in 10 Sekunden auf dein Konto. Gebühr: €0.99 (Pro-Abo: kostenlos)</p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <input value={cashoutAmount} onChange={e => setCashoutAmount(e.target.value)} placeholder="0.00" type="number"
                    className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-lg font-bold outline-none focus:border-green-500/30" />
                </div>
                <button onClick={instantCashout} disabled={loading || !cashoutAmount}
                  className="px-6 py-3 bg-green-500 rounded-xl font-bold text-black disabled:opacity-40" data-testid="cashout-btn">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Auszahlen"}
                </button>
              </div>
              {cashoutAmount && <p className="text-xs text-gray-500">Gebühr: €0.99 · Du erhältst: €{(parseFloat(cashoutAmount || 0)).toFixed(2)}</p>}
            </div>
            {cashoutHistory.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-bold mb-2">Letzte Auszahlungen</p>
                {cashoutHistory.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-2 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold">€{c.amount?.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleDateString("de-DE")}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">{c.fee > 0 ? `Gebühr €${c.fee}` : "Gratis"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SPAR-CHALLENGES */}
        {tab === "challenges" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
              <Trophy size={24} className="text-purple-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-purple-400">Spar-Challenges</p>
              <p className="text-xs text-gray-500">Wette mit Freunden, wer mehr spart. Gewinner teilt den Pool!</p>
            </div>
            {challenges.map((ch, i) => {
              const totalSaved = ch.participants?.reduce((s, p) => s + (p.saved || 0), 0) || 0;
              const pct = ch.target_amount > 0 ? Math.min(100, (totalSaved / (ch.target_amount * (ch.participants?.length || 1))) * 100) : 0;
              return (
                <motion.div key={ch.challenge_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`challenge-${ch.challenge_id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold flex-1">{ch.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">Pool: €{ch.pool}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5"><Users size={10} />{ch.participants?.length || 0} Teilnehmer</span>
                    <span>Ziel: €{ch.target_amount}</span>
                    <span>Eintritt: €{ch.entry_fee}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 mb-2 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="space-y-1 mb-3">
                    {ch.participants?.slice(0, 3).map((p, pi) => (
                      <div key={pi} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400">{pi === 0 ? "🥇" : pi === 1 ? "🥈" : "🥉"} {p.name}</span>
                        <span className="font-bold text-white">€{(p.saved || 0).toFixed(0)} / €{ch.target_amount}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => joinChallenge(ch.challenge_id)} disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-sm border border-purple-500/20 disabled:opacity-40">
                    Beitreten · €{ch.entry_fee}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm text-center font-medium z-50">{msg}</div>}
    </div>
  );
}
