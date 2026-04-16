import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Video, Share2, Flame, Radio, Zap, Award, Heart, Eye, MessageCircle, Send, Play, Users, Trophy, Loader2 } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: "clips", label: "BlitzClips", icon: Video, color: "#EC4899" },
  { id: "challenges", label: "Challenges", icon: Flame, color: "#EF4444" },
  { id: "feed", label: "Live Feed", icon: Radio, color: "#22C55E" },
  { id: "share", label: "Share & Earn", icon: Share2, color: "#F59E0B" },
  { id: "streak", label: "Invite Streak", icon: Zap, color: "#8B5CF6" },
  { id: "wrapped", label: "Mein Profil", icon: Award, color: "#06B6D4" },
];

export default function ViralHubPage({ onBack }) {
  const [active, setActive] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const api = async (path, method = "GET", body = null) => {
    const opts = { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : {} };
    if (body) opts.body = JSON.stringify(body);
    return (await fetch(`${API}${path}`, opts)).json();
  };

  const load = async (id) => {
    setActive(id);
    try {
      if (id === "clips") setData(await api("/api/viral/clips/feed"));
      else if (id === "challenges") setData(await api("/api/viral/challenges"));
      else if (id === "feed") setData(await api("/api/viral/live-feed"));
      else if (id === "share") setData(await api("/api/viral/share-earn/stats"));
      else if (id === "streak") setData(await api("/api/viral/invite-streak"));
      else if (id === "wrapped") setData(await api("/api/viral/profile-card"));
    } catch { setData({}); }
  };

  const action = async (path, body = null) => {
    setLoading(true);
    try { const d = await api(path, "POST", body); setMsg(d.message || ""); if (active) load(active); return d; }
    catch { setMsg("Fehler"); return {}; }
    finally { setLoading(false); setTimeout(() => setMsg(""), 4000); }
  };

  if (!active) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="viral-hub">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-base font-bold">Viral & Social</h1><p className="text-[10px] text-pink-400">Clips, Challenges, Teilen & Verdienen</p></div>
      </div>
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {TABS.map((t, i) => (
          <motion.button key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => load(t.id)} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-left hover:bg-white/[0.06] transition-all" data-testid={`viral-${t.id}`}>
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center" style={{ background: t.color + "20" }}>
              <t.icon size={20} style={{ color: t.color }} /></div>
            <p className="text-sm font-bold">{t.label}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );

  const tab = TABS.find(t => t.id === active);
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid={`viral-${active}`}>
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setActive(null)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-base font-bold flex items-center gap-2"><tab.icon size={18} style={{ color: tab.color }} /> {tab.label}</h1></div>
      </div>
      <div className="px-4 pt-4 space-y-3">

        {/* BLITZCLIPS */}
        {active === "clips" && (<>
          <button onClick={() => action("/api/viral/clips/post", { title: "Mein erster Clip!", description: "Check das aus", duration_sec: 15, category: "Allgemein" })}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-violet-500 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2">
            <Video size={16} /> Clip posten</button>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {["Alle", "Comedy", "Tech", "Crypto", "Fitness", "Fashion", "Gaming", "Kochen"].map(c => (
              <button key={c} className="px-3 py-1.5 bg-white/5 rounded-full text-[10px] font-bold text-gray-400 whitespace-nowrap hover:bg-pink-500/20 hover:text-pink-400">{c}</button>
            ))}
          </div>
          {data.clips?.map((c, i) => (
            <motion.div key={c.clip_id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`clip-${i}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-xs font-bold text-pink-400">{c.creator?.charAt(0)}</div>
                <div><p className="text-xs font-bold">{c.creator}</p><p className="text-[9px] text-gray-500">{c.duration} · {c.category}</p></div>
              </div>
              <p className="text-sm font-bold mb-2">{c.title}</p>
              {/* Video placeholder */}
              <div className="w-full aspect-[9/16] max-h-48 rounded-xl bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center mb-3">
                <Play size={40} className="text-white/20" />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <button onClick={() => action(`/api/viral/clips/like/${c.clip_id}`)} className="flex items-center gap-1 hover:text-pink-400"><Heart size={12} /> {c.likes?.toLocaleString()}</button>
                <span className="flex items-center gap-1"><Eye size={12} /> {c.views?.toLocaleString()}</span>
                <span className="flex items-center gap-1"><MessageCircle size={12} /> {c.comments || 0}</span>
                <button onClick={() => action(`/api/viral/clips/share/${c.clip_id}`)} className="flex items-center gap-1 hover:text-blue-400"><Share2 size={12} /> {c.shares || 0}</button>
              </div>
            </motion.div>
          ))}
        </>)}

        {/* CHALLENGES */}
        {active === "challenges" && data.challenges?.map((ch, i) => (
          <motion.div key={ch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl border border-white/5" style={{ background: ch.color + "08" }}>
            <div className="flex items-center gap-2 mb-2">
              <Flame size={16} style={{ color: ch.color }} />
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: ch.color + "20", color: ch.color }}>{ch.category}</span>
              <span className="text-[9px] text-gray-500">{ch.participants.toLocaleString()} Teilnehmer</span>
            </div>
            <p className="text-sm font-bold mb-1">{ch.title}</p>
            <p className="text-[10px] text-gray-500 mb-2">{ch.desc}</p>
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold" style={{ color: ch.color }}>Preis: {ch.prize}</p>
              <button onClick={() => action(`/api/viral/challenges/join/${ch.id}`)} disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: ch.color }}>Mitmachen</button>
            </div>
          </motion.div>
        ))}

        {/* LIVE FEED */}
        {active === "feed" && (<>
          <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs text-green-400 font-bold">LIVE</span></div>
          {data.activities?.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 py-2.5 border-b border-white/5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                a.type === "jackpot" ? "bg-yellow-500/20 text-yellow-400" : a.type === "win" ? "bg-green-500/20 text-green-400" : a.type === "premium" ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-gray-400"
              }`}>{a.user.charAt(0)}</div>
              <div className="flex-1">
                <p className="text-sm"><span className="font-bold">{a.user}</span> {a.action}</p>
                <p className="text-[9px] text-gray-500">{a.time}</p>
              </div>
              {a.amount > 0 && <p className="text-xs font-bold text-green-400">{a.amount} EUR</p>}
            </motion.div>
          ))}
        </>)}

        {/* SHARE & EARN */}
        {active === "share" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-yellow-900/30 to-orange-900/20 border border-yellow-500/20 text-center">
              <Share2 size={32} className="mx-auto text-yellow-400 mb-2" />
              <p className="text-lg font-bold">2 EUR pro Anmeldung</p>
              <p className="text-xs text-gray-400">Teile deinen Link — verdiene bei jeder Registrierung</p>
            </div>
            <button onClick={() => action("/api/viral/share-earn")} className="w-full py-4 bg-yellow-500 text-black rounded-xl font-bold">Neuen Share-Link erstellen</button>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-white/[0.03] text-center"><p className="text-xs text-gray-400">Anmeldungen</p><p className="text-xl font-bold text-yellow-400">{data.total_signups || 0}</p></div>
              <div className="p-3 rounded-xl bg-white/[0.03] text-center"><p className="text-xs text-gray-400">Verdient</p><p className="text-xl font-bold text-green-400">{data.total_earned || 0} EUR</p></div>
            </div>
          </div>
        )}

        {/* INVITE STREAK */}
        {active === "streak" && (
          <div className="text-center py-8 space-y-4">
            <Zap size={48} className="mx-auto text-violet-400" />
            <p className="text-3xl font-black">{data.streak || 0} / {data.target || 3}</p>
            <p className="text-sm text-gray-400">Einladungen diese Woche</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${(data.streak || 0) >= i ? "bg-violet-500 text-white" : "bg-white/5 text-gray-600"}`}>{i}</div>
              ))}
            </div>
            {data.bonus_unlocked ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20"><p className="text-green-400 font-bold">25 EUR Bonus freigeschaltet!</p></div>
            ) : (
              <p className="text-xs text-gray-500">Lade {(data.target || 3) - (data.streak || 0)} weitere Freunde ein fuer 25 EUR Bonus!</p>
            )}
          </div>
        )}

        {/* PROFILE CARD / WRAPPED */}
        {active === "wrapped" && data.card && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-3xl bg-gradient-to-br from-cyan-900/40 to-blue-900/30 border border-cyan-500/20 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-cyan-500/20 flex items-center justify-center text-3xl font-black text-cyan-400">{data.card.name?.charAt(0)}</div>
            <h2 className="text-xl font-black">{data.card.name}</h2>
            <p className="text-xs text-gray-400">Mitglied seit {data.card.member_since}</p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-black/20"><p className="text-2xl font-black text-cyan-400">{data.card.total_transactions}</p><p className="text-[9px] text-gray-500">Transaktionen</p></div>
              <div className="p-3 rounded-xl bg-black/20"><p className="text-2xl font-black text-green-400">{data.card.quiz_wins}</p><p className="text-[9px] text-gray-500">Quiz-Siege</p></div>
              <div className="p-3 rounded-xl bg-black/20"><p className="text-2xl font-black text-yellow-400">{data.card.friends_invited}</p><p className="text-[9px] text-gray-500">Freunde</p></div>
              <div className="p-3 rounded-xl bg-black/20"><p className="text-2xl font-black text-purple-400">Lv.{data.card.level}</p><p className="text-[9px] text-gray-500">{data.card.badges} Badges</p></div>
            </div>
            <p className="text-xs text-gray-400">Top-Kategorie: <span className="text-cyan-400 font-bold">{data.card.top_category}</span></p>
            <button onClick={() => { navigator.clipboard.writeText(data.card.share_text); setMsg("Profilkarte kopiert! Teile sie auf Social Media."); setTimeout(() => setMsg(""), 3000); }}
              className="w-full py-3 bg-cyan-500 text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Share2 size={14} /> Auf Social Media teilen</button>
          </motion.div>
        )}
      </div>
      {msg && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-20 left-4 right-4 p-3 rounded-xl text-sm text-center z-50 font-medium" style={{ background: tab.color + "30", color: tab.color, border: `1px solid ${tab.color}50` }}>{msg}</motion.div>}
    </div>
  );
}
