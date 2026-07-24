import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Loader2, Video, Star } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function SkillsPage({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState("browse");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/skills/sessions`).then(r => r.json()).then(d => setSessions(d.sessions || [])).catch(() => {});
    fetch(`${API}/api/skills/my-bookings`, { credentials: "include" }).then(r => r.json()).then(d => setBookings(d.bookings || [])).catch(() => {});
  }, []);

  const book = async (id, duration) => {
    const r = await fetch(`${API}/api/skills/book`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id, duration }) });
    const d = await r.json(); setMsg(d.message || d.detail);
    if (r.ok) fetch(`${API}/api/skills/my-bookings`, { credentials: "include" }).then(r => r.json()).then(d => setBookings(d.bookings || []));
    setTimeout(() => setMsg(""), 4000);
  };

  const catColors = { coding: "#3B82F6", design: "#EC4899", music: "#8B5CF6", language: "#10B981", business: "#F59E0B", fitness: "#EF4444" };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="skills-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><GraduationCap size={18} className="text-violet-400" /> Skills Marktplatz</h1>
            <p className="text-[10px] text-violet-400">1-zu-1 Video-Sessions buchen</p></div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ id: "browse", label: "Tutoren" }, { id: "bookings", label: "Meine Buchungen" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-violet-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3">
        {tab === "browse" && sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid={`skill-${s.id}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: (catColors[s.category] || "#666") + "20", color: catColors[s.category] }}>{s.tutor.charAt(0)}</div>
              <div className="flex-1">
                <p className="text-sm font-bold">{s.title}</p>
                <p className="text-[10px] text-gray-500">{s.tutor} · {s.desc}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-yellow-400 flex items-center gap-0.5"><Star size={9} /> {s.rating}</span>
                  <span className="text-[9px] text-gray-500">{s.sessions_done} Sessions</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => book(s.id, 30)} className="flex-1 py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-400 text-xs font-bold flex items-center justify-center gap-1">
                <Video size={12} /> 30min · {s.price_30min} EUR</button>
              <button onClick={() => book(s.id, 60)} className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                <Video size={12} /> 60min · {s.price_60min} EUR</button>
            </div>
          </motion.div>
        ))}
        {tab === "bookings" && bookings.length === 0 && <p className="text-center text-gray-600 py-12">Keine Buchungen</p>}
        {tab === "bookings" && bookings.map((b, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
            <div><p className="text-sm font-bold">{b.title}</p><p className="text-[10px] text-gray-500">{b.tutor} · {b.duration}min</p></div>
            <p className="text-sm font-bold text-violet-400">{b.price} EUR</p>
          </div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-violet-500/20 border border-violet-500/30 rounded-xl text-violet-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
