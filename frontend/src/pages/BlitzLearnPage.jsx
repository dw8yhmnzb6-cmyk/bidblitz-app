import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Star, Clock, Video, Code, Music, Dumbbell, Palette, Gamepad2, BookOpen, Globe2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const CAT_ICONS = { math: "📐", english: "🇬🇧", german: "🇩🇪", science: "🔬", coding: "💻", design: "🎨", video: "🎬", gaming: "🎮", music: "🎵", fitness: "💪" };

export default function BlitzLearnPage({ onBack }) {
  const [offers, setOffers] = useState([]);
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState(1);
  const [msg, setMsg] = useState("");
  const cats = ["math","english","german","science","coding","design","video","gaming","music","fitness"];
  const catNames = { math: "Mathe", english: "Englisch", german: "Deutsch", science: "Natur", coding: "Code", design: "Design", video: "Video", gaming: "Gaming", music: "Musik", fitness: "Fitness" };

  useEffect(() => {
    const params = category ? `?category=${category}` : "";
    fetch(`${API}/api/blitzlearn/offers${params}`, { credentials: "include" }).then(r => r.json()).then(d => setOffers(d.offers || [])).catch(() => {});
  }, [category]);

  const book = async () => {
    if (!selected) return;
    try {
      const r = await fetch(`${API}/api/blitzlearn/book`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: selected.offer_id, hours }) });
      const d = await r.json();
      setMsg(d.message || d.detail || "Fehler");
      if (r.ok) setSelected(null);
    } catch { setMsg("Netzwerkfehler"); }
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzlearn-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div className="flex-1"><h1 className="text-base font-bold">BlitzLearn</h1><p className="text-[10px] text-blue-400">Skills lernen & unterrichten</p></div>
        </div>
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setCategory("")} className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${!category ? "bg-blue-500 text-white" : "bg-white/5 text-gray-400"}`}>Alle</button>
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c === category ? "" : c)}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${category === c ? "bg-blue-500 text-white" : "bg-white/5 text-gray-400"}`}>
              {CAT_ICONS[c]} {catNames[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {offers.map((o, i) => (
          <motion.div key={o.offer_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={() => setSelected(o)} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:border-blue-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 bg-blue-500/10">{CAT_ICONS[o.category] || "📚"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{o.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{o.tutor_name} · {o.sessions_count} Sessions · {o.online ? "Online" : "Vor Ort"}</p>
                {o.rating > 0 && <div className="flex items-center gap-1 mt-1"><Star size={10} className="text-yellow-400 fill-yellow-400" /><span className="text-[10px] text-yellow-400">{o.rating}</span></div>}
              </div>
              <div className="text-right shrink-0"><p className="text-lg font-black text-blue-400">€{o.price_per_hour}</p><p className="text-[9px] text-gray-500">/Std</p></div>
            </div>
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="w-full bg-[#111] rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-1">{selected.title}</h2>
              <p className="text-sm text-gray-400 mb-4">{selected.description} · {selected.tutor_name}</p>
              <div className="flex gap-2 mb-4">
                {[0.5, 1, 1.5, 2, 3].map(h => (
                  <button key={h} onClick={() => setHours(h)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${hours === h ? "bg-blue-500 text-white" : "bg-white/5 text-gray-400"}`}>{h}h</button>
                ))}
              </div>
              <p className="text-2xl font-black text-blue-400 text-center mb-4">€{(selected.price_per_hour * hours).toFixed(2)}</p>
              <button onClick={book} className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl font-bold text-white">Session buchen</button>
              <p className="text-[9px] text-gray-600 text-center mt-2">20% Service-Gebühr inkl.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
