import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Send, Plus, Tag, Zap, Trophy, MapPin } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const TYPE_COLORS = { deal: "#F59E0B", achievement: "#22C55E", ride: "#3B82F6", text: "#6366F1" };
const TYPE_ICONS = { deal: "🏷️", achievement: "🏆", ride: "🛴", text: "💬" };

export default function StoriesPage({ onBack }) {
  const [stories, setStories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newStory, setNewStory] = useState({ content: "", type: "text" });
  const [msg, setMsg] = useState("");

  useEffect(() => { loadStories(); }, []);
  const loadStories = async () => {
    try { const r = await fetch(`${API}/api/stories/feed`, { credentials: "include" }); if (r.ok) { const d = await r.json(); setStories(d.stories || []); } } catch {}
  };

  const post = async () => {
    if (!newStory.content.trim()) return;
    try {
      const r = await fetch(`${API}/api/stories/create`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStory) });
      if (r.ok) { setShowCreate(false); setNewStory({ content: "", type: "text" }); loadStories(); }
    } catch {}
  };

  const like = async (id) => {
    try { await fetch(`${API}/api/stories/like/${id}`, { method: "POST", credentials: "include" }); loadStories(); } catch {}
  };

  const timeAgo = (d) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m/60)}h` : `${Math.floor(m/1440)}d`; };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="stories-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div className="flex-1"><h1 className="text-base font-bold">Social Feed</h1><p className="text-[10px] text-gray-500">{stories.length} Posts</p></div>
        <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold border border-indigo-500/20"><Plus size={14} className="inline mr-1" />Posten</button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {stories.map((s, i) => (
          <motion.div key={s.story_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: `${TYPE_COLORS[s.type]}20` }}>{TYPE_ICONS[s.type]}</div>
              <div className="flex-1"><p className="text-xs font-bold">{s.author_name}</p><p className="text-[9px] text-gray-500">{timeAgo(s.created_at)}</p></div>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${TYPE_COLORS[s.type]}20`, color: TYPE_COLORS[s.type] }}>{s.type}</span>
            </div>
            <p className="text-sm text-gray-200 mb-3">{s.content}</p>
            {s.tags?.length > 0 && <div className="flex gap-1 mb-2">{s.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">#{t}</span>)}</div>}
            <div className="flex items-center gap-4 pt-2 border-t border-white/5">
              <button onClick={() => like(s.story_id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors"><Heart size={14} />{s.like_count}</button>
              <span className="flex items-center gap-1 text-xs text-gray-400"><MessageCircle size={14} />{s.comment_count}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="w-full bg-[#111] rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-3">Story posten</h2>
              <div className="flex gap-2 mb-3">
                {Object.entries(TYPE_ICONS).map(([t, icon]) => (
                  <button key={t} onClick={() => setNewStory({...newStory, type: t})}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${newStory.type === t ? "text-black" : "bg-white/5 text-gray-400"}`}
                    style={newStory.type === t ? { background: TYPE_COLORS[t] } : {}}>
                    {icon} {t === "deal" ? "Deal" : t === "achievement" ? "Erfolg" : t === "ride" ? "Fahrt" : "Text"}
                  </button>
                ))}
              </div>
              <textarea value={newStory.content} onChange={e => setNewStory({...newStory, content: e.target.value})} placeholder="Was gibt's Neues?"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none h-24 resize-none mb-3" />
              <button onClick={post} className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl font-bold text-white"><Send size={16} className="inline mr-2" />Posten</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
