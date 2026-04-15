import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, ShoppingBag, Star, Shield, QrCode, Heart, Bell, Trash2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SocialHubPage({ onBack }) {
  const [tab, setTab] = useState("groups");
  const [groups, setGroups] = useState([]);
  const [score, setScore] = useState(null);
  const [card, setCard] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/social/group-buy`, { credentials: "include" }).then(r => r.json()).then(d => setGroups(d.groups || [])).catch(() => {});
    fetch(`${API}/api/social/credit-score`, { credentials: "include" }).then(r => r.json()).then(d => setScore(d)).catch(() => {});
    fetch(`${API}/api/social/profile-card`, { credentials: "include" }).then(r => r.json()).then(d => setCard(d)).catch(() => {});
    fetch(`${API}/api/social/wishlist`, { credentials: "include" }).then(r => r.json()).then(d => setWishlist(d.items || [])).catch(() => {});
  }, []);

  const joinGroup = async (id) => {
    try {
      const r = await fetch(`${API}/api/social/group-buy/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ group_id: id }) });
      const d = await r.json();
      setMsg(d.message || d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const scoreColor = (s) => s >= 750 ? "#22C55E" : s >= 650 ? "#3B82F6" : s >= 550 ? "#F59E0B" : "#EF4444";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="social-hub-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-bold">Social Hub</h1>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
          {[{id:"groups",l:"Group Buy"},{id:"score",l:"Finanz-Score"},{id:"card",l:"Visitenkarte"},{id:"wishlist",l:"Wunschliste"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold ${tab===t.id?"bg-indigo-500 text-white":"bg-white/5 text-gray-400"}`}>{t.l}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* GROUP BUY */}
        {tab === "groups" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Zusammen günstiger einkaufen!</p>
            {groups.map((g, i) => {
              const pct = Math.min(100, (g.current_count / g.min_participants) * 100);
              return (
                <motion.div key={g.group_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">{g.title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold">{g.category}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="text-xl font-black text-indigo-400">€{g.per_person}</p><p className="text-[9px] text-gray-500">pro Person</p></div>
                    <div className="text-right"><p className="text-sm text-gray-400">Gesamt: €{g.target_price}</p><p className="text-[10px] text-gray-500"><Users size={10} className="inline" /> {g.current_count}/{g.min_participants} min</p></div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 mb-3"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                  <button onClick={() => joinGroup(g.group_id)} className="w-full py-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold text-sm border border-indigo-500/20">Beitreten</button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* CREDIT SCORE */}
        {tab === "score" && score && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl text-center" style={{ background: `${scoreColor(score.score)}10`, border: `1px solid ${scoreColor(score.score)}30` }}>
              <p className="text-sm text-gray-400 mb-1">Dein BidBlitz Score</p>
              <p className="text-6xl font-black" style={{ color: scoreColor(score.score) }}>{score.score}</p>
              <p className="text-sm font-bold mt-1" style={{ color: scoreColor(score.score) }}>{score.level}</p>
              <div className="w-full h-2 rounded-full bg-white/5 mt-4">
                <div className="h-full rounded-full" style={{ width: `${(score.score / 850) * 100}%`, background: scoreColor(score.score) }} />
              </div>
              <p className="text-[9px] text-gray-500 mt-1">{score.score} / 850</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-bold">Score-Aufschlüsselung</p>
              {Object.entries(score.breakdown || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-[11px] text-gray-400">{k.replace(/_/g, " ")}</span>
                  <span className="text-xs font-bold text-white">+{v}</span>
                </div>
              ))}
            </div>
            {score.tips?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-bold mb-2">Tipps zum Verbessern</p>
                {score.tips.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/5 mb-1"><Star size={12} className="text-yellow-400 shrink-0" /><span className="text-[11px] text-yellow-300">{t}</span></div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DIGITAL CARD */}
        {tab === "card" && card && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 mx-auto mb-3 flex items-center justify-center text-2xl font-black text-indigo-400">{card.name?.[0] || "?"}</div>
              <h2 className="text-xl font-bold">{card.name}</h2>
              <p className="text-xs text-gray-400">{card.email}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {card.is_verified && <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold flex items-center gap-1"><Shield size={9} />Verifiziert</span>}
                {card.is_premium && <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">{card.premium_plan?.toUpperCase()}</span>}
              </div>
              <div className="mt-4 p-4 bg-white rounded-xl inline-block">
                <QrCode size={80} className="text-black" />
              </div>
              <p className="text-[8px] text-gray-500 mt-2 font-mono">{card.qr_data}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "Verkauft", value: card.stats?.items_sold, icon: ShoppingBag },
                { label: "Jobs", value: card.stats?.jobs_completed, icon: Star },
                { label: "Vertrauen", value: `${card.stats?.trust_score}%`, icon: Shield }
              ].map((s, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                  <s.icon size={16} className="mx-auto mb-1 text-indigo-400" />
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[9px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WISHLIST */}
        {tab === "wishlist" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{wishlist.length} Artikel auf deiner Wunschliste</p>
            {wishlist.length === 0 && <p className="text-center text-gray-600 py-8">Noch keine Artikel. Füge Artikel aus dem Reselling Marketplace hinzu!</p>}
            {wishlist.map((w, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{w.item_title}</p>
                  <p className="text-[10px] text-gray-500">€{w.current_price?.toFixed(2)} {w.target_price ? `· Alarm: €${w.target_price.toFixed(2)}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {w.target_price && <Bell size={14} className="text-yellow-400" />}
                  <Heart size={14} className="text-red-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 text-sm text-center font-medium z-50">{msg}</div>}
    </div>
  );
}
