import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCw, Brain, Tag, Trophy, Film, Smile, Bot, PiggyBank, Users, Gem, Loader2, Check, Star, Gift, Heart, Send } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: "spin", label: "Gluecksrad", icon: RotateCw, color: "#F59E0B" },
  { id: "quiz", label: "Quiz Battle", icon: Brain, color: "#8B5CF6" },
  { id: "coupons", label: "Coupons", icon: Tag, color: "#EF4444" },
  { id: "achievements", label: "Badges", icon: Trophy, color: "#F97316" },
  { id: "videos", label: "Videos", icon: Film, color: "#EC4899" },
  { id: "memes", label: "Memes", icon: Smile, color: "#22C55E" },
  { id: "aichat", label: "AI Chat", icon: Bot, color: "#3B82F6" },
  { id: "roundup", label: "Round-Up", icon: PiggyBank, color: "#10B981" },
  { id: "debts", label: "Schulden", icon: Users, color: "#06B6D4" },
  { id: "airdrops", label: "Airdrops", icon: Gem, color: "#9945FF" },
];

export default function EngageHubPage({ onBack }) {
  const [active, setActive] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [quizState, setQuizState] = useState(null);
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  const api = async (path, method = "GET", body = null) => {
    const opts = { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : {} };
    if (body) opts.body = JSON.stringify(body);
    return (await fetch(`${API}${path}`, opts)).json();
  };

  const load = async (id) => {
    setActive(id);
    try {
      if (id === "spin") setData(await api("/api/daily-spin/status"));
      else if (id === "quiz") setData(await api("/api/quiz/leaderboard"));
      else if (id === "coupons") setData(await api("/api/engage/coupons"));
      else if (id === "achievements") setData(await api("/api/engage/achievements"));
      else if (id === "videos") setData(await api("/api/engage/videos"));
      else if (id === "memes") setData(await api("/api/engage/memes/feed"));
      else if (id === "roundup") setData(await api("/api/engage/roundup/stats"));
      else if (id === "debts") setData(await api("/api/engage/debts/mine"));
      else if (id === "airdrops") setData(await api("/api/engage/airdrops"));
    } catch { setData({}); }
  };

  const action = async (path, body = null) => {
    setLoading(true);
    try { const d = await api(path, "POST", body); setMsg(d.message || ""); if (active) load(active); return d; }
    catch { setMsg("Fehler"); return {}; }
    finally { setLoading(false); setTimeout(() => setMsg(""), 4000); }
  };

  if (!active) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="engage-hub">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-base font-bold">Fun & Verdienen</h1><p className="text-[10px] text-yellow-400">Gluecksrad, Quiz, Coupons & mehr</p></div>
      </div>
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {TABS.map((t, i) => (
          <motion.button key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => load(t.id)} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-left hover:bg-white/[0.06] transition-all" data-testid={`engage-${t.id}`}>
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
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid={`engage-${active}`}>
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => { setActive(null); setQuizState(null); }} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-base font-bold flex items-center gap-2"><tab.icon size={18} style={{ color: tab.color }} /> {tab.label}</h1></div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {/* SPIN */}
        {active === "spin" && (
          <div className="text-center py-6 space-y-5">
            <motion.div animate={{ rotate: loading ? 1080 : 0 }} transition={{ duration: 2, ease: "easeOut" }}
              className="w-40 h-40 mx-auto rounded-full border-4 border-yellow-500/30 flex items-center justify-center" style={{ background: "conic-gradient(#F59E0B, #EF4444, #3B82F6, #22C55E, #8B5CF6, #EC4899, #06B6D4, #F59E0B)" }}>
              <div className="w-24 h-24 rounded-full bg-[#0A0A0F] flex items-center justify-center"><RotateCw size={32} className="text-yellow-400" /></div>
            </motion.div>
            {data.today_prize ? (
              <div><p className="text-lg font-bold text-yellow-400">Heute gewonnen:</p><p className="text-2xl font-black">{data.today_prize}</p><p className="text-sm text-gray-500 mt-2">Komm morgen wieder!</p></div>
            ) : (
              <button onClick={() => action("/api/daily-spin/spin")} disabled={loading}
                className="px-10 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-2xl font-black text-lg disabled:opacity-50" data-testid="spin-btn">
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : "DREHEN!"}</button>
            )}
          </div>
        )}

        {/* QUIZ */}
        {active === "quiz" && !quizState && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Brain size={40} className="mx-auto text-violet-400 mb-3" />
              <p className="text-lg font-bold">Quiz Battle</p>
              <p className="text-sm text-gray-400">5 Fragen, 3+ richtig = Gewinn!</p>
            </div>
            {[1, 2, 5, 10, 25].map(bet => (
              <button key={bet} onClick={async () => { const d = await action("/api/quiz/start", { bet_eur: bet }); if (d.ok) setQuizState({ ...d, current: 0, answers: [] }); }}
                className="w-full py-3 bg-white/5 hover:bg-violet-500/10 rounded-xl text-sm font-bold flex justify-between px-4" data-testid={`quiz-bet-${bet}`}>
                <span>Einsatz: {bet} EUR</span><span className="text-violet-400">Gewinn: {(bet * 1.8).toFixed(2)} EUR</span>
              </button>
            ))}
            <p className="text-xs text-gray-500 font-bold mt-4">Leaderboard</p>
            {data.leaderboard?.map((l, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-white/5">
                <div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400"}`}>{i+1}</span>
                  <span className="text-sm">{l.name}</span></div>
                <span className="text-sm font-bold text-green-400">{l.wins} Siege</span>
              </div>
            ))}
          </div>
        )}
        {active === "quiz" && quizState && quizState.current < (quizState.questions?.length || 0) && (
          <div className="space-y-4">
            <div className="flex justify-between"><span className="text-xs text-gray-500">Frage {quizState.current + 1}/{quizState.questions.length}</span><span className="text-xs text-violet-400">{quizState.bet} EUR Einsatz</span></div>
            <p className="text-base font-bold">{quizState.questions[quizState.current].q}</p>
            {quizState.questions[quizState.current].options.map((opt, i) => (
              <button key={i} onClick={() => { const newAnswers = [...quizState.answers, i]; const next = quizState.current + 1;
                if (next >= quizState.questions.length) { action("/api/quiz/answer", { match_id: quizState.match_id, answers: newAnswers }).then(d => setQuizState({ ...quizState, done: true, result: d })); }
                else setQuizState({ ...quizState, current: next, answers: newAnswers }); }}
                className="w-full py-3 bg-white/5 hover:bg-violet-500/10 rounded-xl text-sm text-left px-4">{opt}</button>
            ))}
          </div>
        )}
        {active === "quiz" && quizState?.done && (
          <div className="text-center py-8">
            <p className={`text-4xl font-black ${quizState.result?.won ? "text-green-400" : "text-red-400"}`}>{quizState.result?.score}/{quizState.result?.total}</p>
            <p className="text-lg font-bold mt-2">{quizState.result?.won ? "Gewonnen!" : "Verloren!"}</p>
            <p className={`text-2xl font-black mt-1 ${quizState.result?.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{quizState.result?.pnl >= 0 ? "+" : ""}{quizState.result?.pnl} EUR</p>
            <button onClick={() => setQuizState(null)} className="mt-6 px-8 py-3 bg-violet-500 text-white rounded-xl font-bold">Nochmal spielen</button>
          </div>
        )}

        {/* COUPONS */}
        {active === "coupons" && data.coupons?.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white" style={{ background: c.color }}>{c.brand.charAt(0)}</div>
              <div><p className="text-sm font-bold">{c.brand}</p><p className="text-[10px] text-gray-500">{c.deal}</p><p className="text-[9px] text-gray-600">bis {c.expires}</p></div>
            </div>
            <button onClick={() => action(`/api/engage/coupons/claim/${c.id}`)} className="px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-bold">Einloesen</button>
          </motion.div>
        ))}

        {/* ACHIEVEMENTS */}
        {active === "achievements" && (<>
          <div className="flex justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 mb-2">
            <div><p className="text-xs text-gray-400">Level</p><p className="text-xl font-black text-orange-400">{data.level || 1}</p></div>
            <div className="text-right"><p className="text-xs text-gray-400">XP</p><p className="text-xl font-black">{data.total_xp || 0}</p></div>
          </div>
          {data.achievements?.map((a, i) => (
            <div key={a.id} className={`p-3 rounded-xl border flex items-center justify-between ${a.unlocked ? "bg-orange-500/5 border-orange-500/20" : "bg-white/[0.02] border-white/5"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.unlocked ? "bg-orange-500/20" : "bg-white/5"}`}>
                  {a.unlocked ? <Check size={16} className="text-orange-400" /> : <Star size={16} className="text-gray-600" />}
                </div>
                <div><p className="text-sm font-bold">{a.name}</p><p className="text-[10px] text-gray-500">{a.desc}</p></div>
              </div>
              <div className="text-right"><p className="text-xs font-bold text-orange-400">+{a.xp} XP</p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded ${a.rarity === "Legendary" ? "bg-yellow-500/20 text-yellow-400" : a.rarity === "Epic" ? "bg-purple-500/20 text-purple-400" : a.rarity === "Rare" ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"}`}>{a.rarity}</span>
              </div>
            </div>
          ))}
        </>)}

        {/* VIDEOS */}
        {active === "videos" && data.videos?.map((v, i) => (
          <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex justify-between mb-2"><p className="text-sm font-bold">{v.title}</p><span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">{v.category}</span></div>
            <p className="text-[10px] text-gray-500">{v.creator} · {v.duration} · {v.views?.toLocaleString()} Views</p>
            <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><Heart size={10} /> {v.likes?.toLocaleString()}</span>
              <span className="flex items-center gap-1"><Send size={10} /> Teilen</span>
            </div>
          </motion.div>
        ))}

        {/* AI CHAT */}
        {active === "aichat" && (
          <div className="space-y-3">
            {chatHistory.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl ${m.role === "user" ? "bg-blue-500/10 border border-blue-500/20 ml-8" : "bg-white/[0.03] border border-white/5 mr-8"}`}>
                <p className="text-sm">{m.text}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Frage stellen..."
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" data-testid="ai-chat-input"
                onKeyDown={e => { if (e.key === "Enter" && chatMsg.trim()) {
                  const userMsg = chatMsg; setChatMsg(""); setChatHistory(h => [...h, { role: "user", text: userMsg }]);
                  api("/api/engage/ai-chat", "POST", { message: userMsg }).then(d => setChatHistory(h => [...h, { role: "ai", text: d.reply }])); }}} />
              <button onClick={() => { if (!chatMsg.trim()) return; const userMsg = chatMsg; setChatMsg("");
                setChatHistory(h => [...h, { role: "user", text: userMsg }]);
                api("/api/engage/ai-chat", "POST", { message: userMsg }).then(d => setChatHistory(h => [...h, { role: "ai", text: d.reply }])); }}
                className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center"><Send size={16} /></button>
            </div>
          </div>
        )}

        {/* AIRDROPS */}
        {active === "airdrops" && data.airdrops?.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex justify-between mb-2"><p className="text-sm font-bold">{a.project}</p><p className="text-sm font-bold text-purple-400">{a.amount}</p></div>
            <p className="text-[10px] text-gray-500 mb-1">Wert: ~{a.value_eur} EUR · {a.participants.toLocaleString()} Teilnehmer</p>
            <p className="text-[10px] text-gray-600 mb-2">Bedingung: {a.requirements}</p>
            <button onClick={() => action(`/api/engage/airdrops/claim/${a.id}`)} disabled={loading}
              className="w-full py-2.5 bg-purple-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">Claimen</button>
          </motion.div>
        ))}

        {/* ROUND-UP */}
        {active === "roundup" && (
          <div className="text-center py-8 space-y-4">
            <PiggyBank size={48} className="mx-auto text-emerald-400" />
            <p className="text-3xl font-black text-emerald-400">{data.total_saved || 0} EUR</p>
            <p className="text-sm text-gray-400">gespart durch Round-Up</p>
            <p className="text-xs text-gray-500">{data.transactions || 0} Transaktionen aufgerundet</p>
            <button onClick={() => action("/api/engage/roundup/toggle")} className="px-8 py-3 bg-emerald-500 text-black rounded-xl font-bold">Round-Up aktivieren</button>
          </div>
        )}

        {/* DEBTS */}
        {active === "debts" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-green-500/10 text-center"><p className="text-xs text-gray-400">Mir geschuldet</p><p className="text-lg font-bold text-green-400">{data.owed_to_me || 0} EUR</p></div>
              <div className="p-3 rounded-xl bg-red-500/10 text-center"><p className="text-xs text-gray-400">Ich schulde</p><p className="text-lg font-bold text-red-400">{data.i_owe || 0} EUR</p></div>
            </div>
            {data.debts?.map((d, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
                <div><p className="text-sm font-bold">{d.person}</p>
                  <p className={`text-xs ${d.direction === "owed_to_me" ? "text-green-400" : "text-red-400"}`}>{d.direction === "owed_to_me" ? "schuldet mir" : "schulde ich"} {d.amount} EUR</p></div>
                <button onClick={() => action(`/api/engage/debts/settle/${d.debt_id}`)} className="px-3 py-1.5 bg-white/5 rounded-lg text-xs">Erledigt</button>
              </div>
            ))}
            <button onClick={() => action("/api/engage/debts/add", { person: "Max", amount: 20, direction: "owed_to_me", note: "Mittagessen" })}
              className="w-full py-3 bg-white/5 rounded-xl text-xs text-gray-400">+ Schuld hinzufuegen</button>
          </div>
        )}

        {/* MEMES */}
        {active === "memes" && (
          <div className="space-y-3">
            <button onClick={() => action("/api/engage/memes/create", { template_id: "m4", texts: ["Wenn BidBlitz steigt"] })}
              className="w-full py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold">+ Meme erstellen</button>
            {data.memes?.map((m, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-sm font-bold mb-1">{m.texts?.join(" / ") || "Meme"}</p>
                <p className="text-[10px] text-gray-500">Template: {m.template_id} · {m.likes} Likes</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {msg && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-20 left-4 right-4 p-3 rounded-xl text-sm text-center z-50 font-medium" style={{ background: tab.color + "30", color: tab.color, border: `1px solid ${tab.color}50` }}>{msg}</motion.div>}
    </div>
  );
}
