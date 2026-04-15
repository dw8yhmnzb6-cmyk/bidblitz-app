import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, Check, Star, Loader2, Gift, Users, Copy, Share2, Trophy, Sparkles } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function LevelUpPage({ onBack }) {
  const [tiers, setTiers] = useState([]);
  const [myTier, setMyTier] = useState(null);
  const [referral, setReferral] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState("tiers");
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [copied, setCopied] = useState(false);

  const load = () => {
    fetch(`${API}/api/levelup/tiers`).then(r => r.json()).then(d => setTiers(d.tiers || [])).catch(() => {});
    fetch(`${API}/api/levelup/my-tier`, { credentials: "include" }).then(r => r.json()).then(d => setMyTier(d)).catch(() => {});
    fetch(`${API}/api/levelup/referral`, { credentials: "include" }).then(r => r.json()).then(d => setReferral(d)).catch(() => {});
    fetch(`${API}/api/levelup/referral/leaderboard`).then(r => r.json()).then(d => setLeaderboard(d.leaderboard || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const subscribe = async (tierId) => {
    setLoading(tierId);
    try {
      const r = await fetch(`${API}/api/levelup/subscribe`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_id: tierId }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) load();
    } catch { setMsg("Fehler"); }
    setLoading("");
    setTimeout(() => setMsg(""), 4000);
  };

  const redeem = async () => {
    if (!redeemCode.trim()) return;
    setLoading("redeem");
    try {
      const r = await fetch(`${API}/api/levelup/referral/redeem`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referral_code: redeemCode }),
      });
      const d = await r.json();
      setMsg(d.message || d.detail);
      if (r.ok) { setRedeemCode(""); load(); }
    } catch { setMsg("Fehler"); }
    setLoading("");
    setTimeout(() => setMsg(""), 5000);
  };

  const copyCode = () => {
    if (referral?.referral_code) {
      navigator.clipboard.writeText(referral.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareCode = () => {
    if (referral?.referral_code && navigator.share) {
      navigator.share({
        title: "BidBlitz Level Up",
        text: `Melde dich bei BidBlitz an mit meinem Code ${referral.referral_code} und erhalte 10 EUR Bonus + 1 Monat Silver gratis!`,
        url: "https://bidblitz.com",
      }).catch(() => {});
    } else {
      copyCode();
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="levelup-page">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="levelup-back-btn"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2"><Crown size={18} className="text-yellow-400" /> Level Up</h1>
            <p className="text-[10px] text-yellow-400">Premium Rewards & Referral</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {[
            { id: "tiers", label: "Tiers", icon: Star },
            { id: "referral", label: "Einladen", icon: Gift },
            { id: "leaderboard", label: "Rangliste", icon: Trophy },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${tab === t.id ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}
              data-testid={`tab-${t.id}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current tier banner */}
      {myTier?.subscribed && tab === "tiers" && (
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

        {/* ─── TIERS TAB ─── */}
        {tab === "tiers" && tiers.map((tier, i) => {
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

        {/* ─── REFERRAL TAB ─── */}
        {tab === "referral" && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

              {/* Referral Hero */}
              <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #78350F 0%, #F59E0B 50%, #FDE68A 100%)" }}>
                <div className="absolute -right-6 -top-6 opacity-10">
                  <Gift size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-yellow-900" />
                    <p className="text-yellow-900 font-black text-xs tracking-widest">FREUNDE EINLADEN</p>
                  </div>
                  <h2 className="text-xl font-black text-yellow-950 mb-1">Verdiene mit jeder Einladung!</h2>
                  <p className="text-xs text-yellow-900/80">Du bekommst <b>5 EUR Bonus + 1 Monat gratis</b>. Dein Freund bekommt <b>10 EUR + Silver gratis</b>!</p>
                </div>
              </div>

              {/* My Referral Code */}
              {referral?.referral_code && (
                <div className="p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dein Einladungscode</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 py-3 px-4 bg-[#0A0A0F] rounded-xl text-center">
                      <p className="text-xl font-mono font-black text-yellow-400 tracking-[0.2em]" data-testid="referral-code">{referral.referral_code}</p>
                    </div>
                    <button onClick={copyCode}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${copied ? "bg-green-500/20 text-green-400" : "bg-white/5 text-gray-400 hover:text-white"}`}
                      data-testid="copy-referral-btn">
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button onClick={shareCode}
                      className="w-12 h-12 rounded-xl bg-yellow-500 text-black flex items-center justify-center"
                      data-testid="share-referral-btn">
                      <Share2 size={18} />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="p-3 rounded-xl bg-[#0A0A0F] text-center">
                      <p className="text-lg font-black text-yellow-400">{referral.total_referrals}</p>
                      <p className="text-[9px] text-gray-500">Einladungen</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0A0F] text-center">
                      <p className="text-lg font-black text-green-400">{referral.total_bonus_earned} EUR</p>
                      <p className="text-[9px] text-gray-500">Verdient</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0A0F] text-center">
                      <p className="text-lg font-black text-blue-400">{referral.free_months_earned}</p>
                      <p className="text-[9px] text-gray-500">Gratis-Monate</p>
                    </div>
                  </div>

                  {/* Recent referrals */}
                  {referral.referrals?.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] text-gray-500 mb-2">Letzte Einladungen</p>
                      {referral.referrals.map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-yellow-500/10 flex items-center justify-center">
                              <Users size={12} className="text-yellow-400" />
                            </div>
                            <p className="text-xs font-medium">{r.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-green-400">+{r.bonus} EUR</p>
                            <p className="text-[9px] text-gray-600">{new Date(r.date).toLocaleDateString("de-DE")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Redeem a Code */}
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.02] space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Code einloesen</p>
                <p className="text-[11px] text-gray-500">Hast du einen Einladungscode von einem Freund?</p>
                <div className="flex gap-2">
                  <input value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="BLITZ-XXXXXX"
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-mono outline-none focus:border-yellow-500/40 uppercase tracking-wider placeholder:text-gray-600"
                    data-testid="redeem-code-input" />
                  <button onClick={redeem} disabled={loading === "redeem" || !redeemCode.trim()}
                    className="px-6 py-3 bg-yellow-500 text-black rounded-xl font-bold text-sm disabled:opacity-50"
                    data-testid="redeem-btn">
                    {loading === "redeem" ? <Loader2 size={14} className="animate-spin" /> : "Einloesen"}
                  </button>
                </div>
              </div>

              {/* How it works */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-xs font-bold text-gray-400 mb-3">So funktioniert's:</p>
                <div className="space-y-3">
                  {[
                    { step: "1", title: "Code teilen", desc: "Sende deinen Code an Freunde", icon: Share2 },
                    { step: "2", title: "Freund registriert sich", desc: "Dein Freund loest den Code ein", icon: Users },
                    { step: "3", title: "Beide verdienen", desc: "Du: 5 EUR + 1 Monat gratis. Freund: 10 EUR + Silver", icon: Gift },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                        <s.icon size={14} className="text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">{s.title}</p>
                        <p className="text-[10px] text-gray-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── LEADERBOARD TAB ─── */}
        {tab === "leaderboard" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="text-center py-3">
              <Trophy size={28} className="mx-auto text-yellow-400 mb-2" />
              <p className="text-sm font-bold">Top Einlader</p>
              <p className="text-[10px] text-gray-500">Die aktivsten Referral-Partner</p>
            </div>
            {leaderboard.length === 0 && <p className="text-center text-gray-600 py-8 text-sm">Noch keine Einladungen</p>}
            {leaderboard.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className={`p-4 rounded-2xl flex items-center justify-between ${i === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : i === 1 ? "bg-gray-500/5 border border-gray-500/10" : i === 2 ? "bg-orange-500/5 border border-orange-500/10" : "bg-white/[0.02] border border-white/5"}`}
                data-testid={`leader-${i}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-400 text-black" : i === 2 ? "bg-orange-400 text-black" : "bg-white/5 text-gray-400"}`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{l.display_name}</p>
                    <p className="text-[10px] text-gray-500">{l.total_referrals} Einladungen</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-green-400">+{l.total_bonus_earned} EUR</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 left-4 right-4 p-3.5 bg-yellow-500/90 backdrop-blur-xl rounded-2xl text-black text-sm text-center font-medium z-50 shadow-xl"
            data-testid="levelup-toast">
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
