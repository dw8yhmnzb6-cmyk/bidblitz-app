import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, MapPin, Clock, Zap, Plus, Star, Briefcase, Send } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_MAP = {
  delivery: { icon: "📦", name: "Lieferung", color: "#3B82F6" },
  shopping: { icon: "🛒", name: "Einkaufen", color: "#10B981" },
  cleaning: { icon: "🧹", name: "Putzen", color: "#8B5CF6" },
  tutoring: { icon: "📚", name: "Nachhilfe", color: "#F59E0B" },
  petcare: { icon: "🐕", name: "Tiere", color: "#EC4899" },
  garden: { icon: "🌿", name: "Garten", color: "#22C55E" },
  moving: { icon: "📦", name: "Umzug", color: "#F97316" },
  tech: { icon: "💻", name: "Tech", color: "#06B6D4" },
  handyman: { icon: "🔧", name: "Handwerk", color: "#EAB308" },
  other: { icon: "⚡", name: "Sonstiges", color: "#6366F1" },
};

export default function BlitzJobsPage({ onBack }) {
  const [jobs, setJobs] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("browse");
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [myJobs, setMyJobs] = useState({ posted: [], applied: [], working: [] });
  const [loading, setLoading] = useState(true);
  const [applyMsg, setApplyMsg] = useState("");
  const [msg, setMsg] = useState("");
  const [newJob, setNewJob] = useState({ title: "", description: "", category: "other", budget: "", location: "", duration_hours: 1, urgent: false });

  useEffect(() => { loadJobs(); }, [category, search]);

  const loadJobs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`${API}/api/jobs/feed?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setJobs(d.jobs || []); }
    } catch {}
    setLoading(false);
  };

  const loadMyJobs = async () => {
    try {
      const res = await fetch(`${API}/api/jobs/my-jobs`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyJobs(d); }
    } catch {}
  };

  useEffect(() => { if (tab === "my") loadMyJobs(); }, [tab]);

  const applyForJob = async (job) => {
    try {
      const res = await fetch(`${API}/api/jobs/apply`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.job_id, message: applyMsg }),
      });
      const d = await res.json();
      if (res.ok) { setMsg(d.message); setSelected(null); }
      else setMsg(d.detail || "Fehler");
    } catch { setMsg("Netzwerkfehler"); }
    setTimeout(() => setMsg(""), 3000);
  };

  const createJob = async () => {
    if (!newJob.title || !newJob.budget) return;
    try {
      const res = await fetch(`${API}/api/jobs/create`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newJob, budget: parseFloat(newJob.budget) }),
      });
      if (res.ok) { setMsg("Job erstellt!"); setShowCreate(false); setNewJob({ title: "", description: "", category: "other", budget: "", location: "", duration_hours: 1, urgent: false }); loadJobs(); }
    } catch {}
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="blitzjobs-page">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h1 className="text-base font-bold">BlitzJobs</h1>
            <p className="text-[10px] text-green-400">Geld verdienen in deiner Nähe</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold border border-green-500/20" data-testid="job-create-btn">
            <Plus size={14} className="inline mr-1" />Job erstellen
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {[{ id: "browse", label: "Entdecken" }, { id: "my", label: "Meine Jobs" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-green-500 text-black" : "bg-white/5 text-gray-400"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "browse" && (
          <>
            <div className="mt-3 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Jobs suchen..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-green-500/30 placeholder-gray-600" />
            </div>
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setCategory("")} className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${!category ? "bg-green-500 text-black" : "bg-white/5 text-gray-400"}`}>Alle</button>
              {Object.entries(CAT_MAP).map(([id, c]) => (
                <button key={id} onClick={() => setCategory(id === category ? "" : id)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${category === id ? "text-black" : "bg-white/5 text-gray-400"}`}
                  style={category === id ? { background: c.color } : {}}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Job Feed */}
      {tab === "browse" && (
        <div className="px-4 pt-4 space-y-3">
          {jobs.map((j, i) => {
            const cat = CAT_MAP[j.category] || CAT_MAP.other;
            return (
              <motion.div key={j.job_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(j)}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:border-green-500/20 transition-all" data-testid={`job-${j.job_id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${cat.color}15` }}>{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{j.title}</p>
                      {j.urgent && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold shrink-0">DRINGEND</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                      {j.location && <span className="flex items-center gap-0.5"><MapPin size={9} />{j.location}</span>}
                      <span className="flex items-center gap-0.5"><Clock size={9} />{j.duration_hours}h</span>
                      <span>{j.applicants?.length || 0} Bewerber</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-green-400">€{j.budget}</p>
                    <p className="text-[9px] text-gray-600">Budget</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* My Jobs */}
      {tab === "my" && (
        <div className="px-4 pt-4 space-y-4">
          {myJobs.working?.length > 0 && (
            <div>
              <p className="text-xs text-green-400 font-bold mb-2">Aktive Aufträge</p>
              {myJobs.working.map(j => (
                <div key={j.job_id} className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 mb-2">
                  <p className="text-sm font-bold">{j.title}</p>
                  <p className="text-xs text-green-400">€{j.budget} · In Bearbeitung</p>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 font-bold mb-2">Meine Ausschreibungen ({myJobs.posted?.length || 0})</p>
            {myJobs.posted?.map(j => (
              <div key={j.job_id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-2">
                <p className="text-sm font-bold">{j.title}</p>
                <p className="text-xs text-gray-400">€{j.budget} · {j.applicants?.length || 0} Bewerber · {j.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Detail + Apply Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} className="w-full bg-[#111] rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${(CAT_MAP[selected.category] || CAT_MAP.other).color}15` }}>
                  {(CAT_MAP[selected.category] || CAT_MAP.other).icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{selected.title}</h2>
                  <p className="text-xs text-gray-400">von {selected.poster_name}</p>
                </div>
              </div>
              <p className="text-3xl font-black text-green-400 mb-3">€{selected.budget}</p>
              <div className="flex gap-2 mb-4 text-[10px]">
                {selected.location && <span className="px-2 py-1 rounded-full bg-white/5 text-gray-400 flex items-center gap-1"><MapPin size={10} />{selected.location}</span>}
                <span className="px-2 py-1 rounded-full bg-white/5 text-gray-400 flex items-center gap-1"><Clock size={10} />{selected.duration_hours}h</span>
                {selected.urgent && <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-bold">DRINGEND</span>}
              </div>
              {selected.description && <p className="text-sm text-gray-400 mb-4">{selected.description}</p>}
              <textarea value={applyMsg} onChange={e => setApplyMsg(e.target.value)} placeholder="Nachricht an den Auftraggeber..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-green-500/30 h-16 resize-none mb-3" />
              <button onClick={() => applyForJob(selected)} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-black text-base" data-testid="job-apply-btn">
                <Send size={18} className="inline mr-2" />Jetzt bewerben
              </button>
              <p className="text-[9px] text-gray-600 text-center mt-2">15% Service-Gebühr · Auszahlung direkt ins Wallet</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} className="w-full bg-[#111] rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Job ausschreiben</h2>
              <div className="space-y-3">
                <input value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} placeholder="Was soll erledigt werden?"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-green-500/30" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={newJob.budget} onChange={e => setNewJob({...newJob, budget: e.target.value})} placeholder="Budget €" type="number"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
                  <input value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} placeholder="Ort"
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none" />
                </div>
                <select value={newJob.category} onChange={e => setNewJob({...newJob, category: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none text-white">
                  {Object.entries(CAT_MAP).map(([id, c]) => <option key={id} value={id} className="bg-[#111]">{c.icon} {c.name}</option>)}
                </select>
                <label className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer">
                  <input type="checkbox" checked={newJob.urgent} onChange={e => setNewJob({...newJob, urgent: e.target.checked})} className="accent-red-500" />
                  <span className="text-sm text-red-400 font-medium">Dringend</span>
                </label>
                <button onClick={createJob} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-black" data-testid="job-submit-btn">
                  <Briefcase size={18} className="inline mr-2" />Job veröffentlichen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-sm text-center font-medium z-50">{msg}</div>}
    </div>
  );
}
