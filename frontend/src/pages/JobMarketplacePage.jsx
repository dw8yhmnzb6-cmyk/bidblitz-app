/**
 * BidBlitz V2 - Job Marketplace
 * Vollzeit, Teilzeit, Mini-Job, Freelance, Praktikum
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Briefcase, MapPin, Clock, Star, DollarSign,
  Loader2, Check, X, Plus, Send, Building2, Phone, Mail, Globe,
  Zap, ChevronRight, Filter, Eye, Users, Laptop, Home as HomeIcon,
  FileText
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_COLORS = { it: "#6366F1", gastro: "#F97316", retail: "#10B981", craft: "#F59E0B", office: "#3B82F6", logistics: "#06B6D4", health: "#EC4899", finance: "#10B981", marketing: "#A855F7", education: "#14B8A6", other: "#6B7280" };
const TYPE_LABELS = { fulltime: "Vollzeit", parttime: "Teilzeit", minijob: "Mini-Job", freelance: "Freelance", internship: "Praktikum" };
const TYPE_COLORS = { fulltime: "#10B981", parttime: "#3B82F6", minijob: "#F59E0B", freelance: "#A855F7", internship: "#06B6D4" };
const SAL_LABELS = { monthly: "/Monat", hourly: "/Stunde", yearly: "/Jahr", project: "Projekt" };

const JobMarketplacePage = ({ onBack, onNavigate }) => {
  const [view, setView] = useState("list"); // list | detail | create | applications | my-jobs
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [myApps, setMyApps] = useState([]);

  // Create form
  const [form, setForm] = useState({ title: "", description: "", category: "other", job_type: "fulltime", company_name: "", company_logo: "", company_phone: "", company_email: "", company_website: "", company_description: "", city: "", salary_min: "", salary_max: "", salary_type: "monthly", remote: false, requirements: "", benefits: "" });
  const [creating, setCreating] = useState(false);

  // Apply
  const [showApply, setShowApply] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (catFilter) params.set("category", catFilter);
      if (typeFilter) params.set("job_type", typeFilter);
      if (searchQ) params.set("search", searchQ);
      const res = await fetch(`${API}/api/jobs/list?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setJobs(d.jobs || []); }
    } catch {}
    setLoading(false);
  }, [catFilter, typeFilter, searchQ]);

  const loadCats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/jobs/categories`);
      if (res.ok) { const d = await res.json(); setCategories(d.categories || []); }
    } catch {}
  }, []);

  const loadApps = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/jobs/my-applications`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyApps(d.applications || []); }
    } catch {}
  }, []);

  useEffect(() => { load(); loadCats(); loadApps(); }, [load, loadCats, loadApps]);

  const openDetail = async (jobId) => {
    try {
      const res = await fetch(`${API}/api/jobs/detail/${jobId}`, { credentials: "include" });
      if (res.ok) { setSelectedJob(await res.json()); setView("detail"); }
    } catch {}
  };

  const createJob = async () => {
    if (!form.title) return;
    setCreating(true); setError("");
    try {
      const body = { ...form, salary_min: parseFloat(form.salary_min) || 0, salary_max: parseFloat(form.salary_max) || 0, requirements: form.requirements ? form.requirements.split(",").map(s => s.trim()) : [], benefits: form.benefits ? form.benefits.split(",").map(s => s.trim()) : [] };
      const res = await fetch(`${API}/api/jobs/create`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setView("list"); load(); setForm({ title: "", description: "", category: "other", job_type: "fulltime", company_name: "", company_logo: "", company_phone: "", company_email: "", company_website: "", company_description: "", city: "", salary_min: "", salary_max: "", salary_type: "monthly", remote: false, requirements: "", benefits: "" }); }
      else setError(d.detail || "Fehler");
    } catch { setError("Netzwerkfehler"); }
    setCreating(false);
  };

  const applyToJob = async () => {
    if (!selectedJob) return;
    setApplying(true); setError("");
    try {
      const res = await fetch(`${API}/api/jobs/apply`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: selectedJob.job_id, cover_letter: coverLetter, phone: applyPhone }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setApplyResult(d.application); setShowApply(false); loadApps(); }
      else setError(d.detail || "Fehler");
    } catch { setError("Netzwerkfehler"); }
    setApplying(false);
  };

  const boostJob = async (jobId) => {
    const res = await fetch(`${API}/api/jobs/boost/${jobId}`, { method: "POST", credentials: "include" });
    const d = await res.json();
    if (res.ok) { alert("Job geboostet!"); load(); }
    else alert(d.detail || "Fehler");
  };

  const fmtSalary = (j) => {
    if (!j.salary_min && !j.salary_max) return "";
    if (j.salary_min && j.salary_max) return `€${j.salary_min.toLocaleString()}-${j.salary_max.toLocaleString()}${SAL_LABELS[j.salary_type] || ""}`;
    return `€${(j.salary_max || j.salary_min).toLocaleString()}${SAL_LABELS[j.salary_type] || ""}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="job-marketplace-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => view === "list" ? onBack() : setView("list")} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <div><h1 className="text-[15px] font-bold">Job-Marktplatz</h1><p className="text-[10px] text-gray-500">{jobs.length} Jobs</p></div>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => onNavigate?.("/cv-builder")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-[10px] font-medium" data-testid="job-cv-btn"><FileText size={12} /> CV</motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("create")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-[10px] font-bold" data-testid="job-create-btn"><Plus size={12} /> Job posten</motion.button>
          </div>
        </div>

        {view === "list" && (
          <>
            <div className="mt-3 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="text" value={searchQ} onChange={e => { setSearchQ(e.target.value); setLoading(true); }}
                placeholder="Job, Firma oder Stadt suchen..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="job-search" />
            </div>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCatFilter("")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${!catFilter ? "bg-[#6366F1] text-white" : "bg-white/5 text-gray-500"}`}>Alle</motion.button>
              {categories.map(c => (
                <motion.button key={c.id} whileTap={{ scale: 0.95 }} onClick={() => setCatFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${catFilter === c.id ? "text-white" : "bg-white/5 text-gray-500"}`}
                  style={catFilter === c.id ? { background: CAT_COLORS[c.id] || "#666" } : {}}>{c.label}</motion.button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              {Object.entries(TYPE_LABELS).map(([id, label]) => (
                <motion.button key={id} whileTap={{ scale: 0.95 }} onClick={() => setTypeFilter(typeFilter === id ? "" : id)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-medium ${typeFilter === id ? "text-white" : "bg-white/5 text-gray-600"}`}
                  style={typeFilter === id ? { background: TYPE_COLORS[id] } : {}}>{label}</motion.button>
              ))}
            </div>
          </>
        )}

        {view !== "list" && view !== "detail" && view !== "create" && (
          <div className="flex gap-2 mt-3">
            {[{ id: "applications", label: "Bewerbungen" }, { id: "my-jobs", label: "Meine Jobs" }].map(t => (
              <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setView(t.id)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-medium ${view === t.id ? "bg-[#6366F1] text-white" : "bg-white/5 text-gray-500"}`}>{t.label}</motion.button>
            ))}
          </div>
        )}
      </div>

      {loading && view === "list" && <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#6366F1]" /></div>}

      {/* Job List */}
      {view === "list" && !loading && (
        <div className="p-4 space-y-3">
          {jobs.length === 0 ? (
            <div className="text-center py-16"><Briefcase size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Jobs gefunden</p></div>
          ) : jobs.map((j, i) => (
            <motion.div key={j.job_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => openDetail(j.job_id)}
              className={`bg-[#111118] rounded-2xl border p-4 cursor-pointer hover:border-white/10 transition-colors ${j.is_boosted ? "border-[#F59E0B]/30" : "border-white/5"}`}
              data-testid={`job-${j.job_id}`}>
              {j.is_boosted && <div className="flex items-center gap-1 mb-2"><Zap size={10} className="text-[#F59E0B]" /><span className="text-[8px] text-[#F59E0B] font-bold uppercase">Premium</span></div>}
              <div className="flex items-start gap-3">
                {j.company_logo ? (
                  <img src={j.company_logo} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${CAT_COLORS[j.category] || "#666"}15` }}>
                    <Building2 size={18} style={{ color: CAT_COLORS[j.category] || "#666" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{j.title}</p>
                  <p className="text-[10px] text-gray-500">{j.company_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold text-white" style={{ background: TYPE_COLORS[j.job_type] || "#666" }}>{TYPE_LABELS[j.job_type]}</span>
                    {j.city && <span className="flex items-center gap-0.5 text-[9px] text-gray-500"><MapPin size={9} /> {j.city}</span>}
                    {j.remote && <span className="flex items-center gap-0.5 text-[9px] text-[#06B6D4]"><Laptop size={9} /> Remote</span>}
                  </div>
                </div>
                {fmtSalary(j) && <span className="text-[11px] font-bold text-[#10B981] flex-shrink-0">{fmtSalary(j)}</span>}
              </div>
            </motion.div>
          ))}
          <div className="flex gap-2 pt-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView("applications")}
              className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-xs font-medium">Meine Bewerbungen</motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView("my-jobs")}
              className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-xs font-medium">Meine Jobs</motion.button>
          </div>
        </div>
      )}

      {/* Job Detail */}
      {view === "detail" && selectedJob && (
        <div className="p-4 space-y-4">
          {applyResult ? (
            <div className="bg-[#111118] rounded-2xl border border-[#10B981]/20 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-[#10B981]" /></div>
              <h3 className="text-lg font-bold mb-1">Bewerbung gesendet!</h3>
              <p className="text-sm text-gray-400">{applyResult.job_title} bei {applyResult.company_name}</p>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setView("list"); setApplyResult(null); }}
                className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm">Zurück zu Jobs</motion.button>
            </div>
          ) : (
            <>
              <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
                <div className="flex items-start gap-3 mb-3">
                  {selectedJob.company_logo ? <img src={selectedJob.company_logo} alt="" className="w-14 h-14 rounded-xl object-cover" /> : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${CAT_COLORS[selectedJob.category] || "#666"}15` }}>
                      <Building2 size={24} style={{ color: CAT_COLORS[selectedJob.category] || "#666" }} />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-base font-bold">{selectedJob.title}</h2>
                    <p className="text-xs text-gray-400">{selectedJob.company_name}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded text-[8px] font-bold text-white" style={{ background: TYPE_COLORS[selectedJob.job_type] }}>{TYPE_LABELS[selectedJob.job_type]}</span>
                      {selectedJob.city && <span className="text-[9px] text-gray-500 flex items-center gap-0.5"><MapPin size={9} /> {selectedJob.city}</span>}
                      {selectedJob.remote && <span className="text-[9px] text-[#06B6D4] flex items-center gap-0.5"><Laptop size={9} /> Remote</span>}
                    </div>
                  </div>
                </div>
                {fmtSalary(selectedJob) && <div className="p-2.5 rounded-xl bg-[#10B981]/5 border border-[#10B981]/20 mb-3"><p className="text-sm font-bold text-[#10B981]">{fmtSalary(selectedJob)}</p></div>}
                <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-line">{selectedJob.description}</p>
              </div>

              {/* Company Info */}
              {(selectedJob.company_description || selectedJob.company_phone || selectedJob.company_website) && (
                <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
                  <h3 className="text-sm font-bold mb-2">Über das Unternehmen</h3>
                  {selectedJob.company_description && <p className="text-[10px] text-gray-400 mb-2">{selectedJob.company_description}</p>}
                  <div className="space-y-1.5">
                    {selectedJob.company_phone && <div className="flex items-center gap-2 text-[10px] text-gray-500"><Phone size={11} /> {selectedJob.company_phone}</div>}
                    {selectedJob.company_email && <div className="flex items-center gap-2 text-[10px] text-gray-500"><Mail size={11} /> {selectedJob.company_email}</div>}
                    {selectedJob.company_website && <div className="flex items-center gap-2 text-[10px] text-[#3B82F6]"><Globe size={11} /> {selectedJob.company_website}</div>}
                  </div>
                </div>
              )}

              {/* Requirements & Benefits */}
              {(selectedJob.requirements?.length > 0 || selectedJob.benefits?.length > 0) && (
                <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
                  {selectedJob.requirements?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-400 mb-1.5">Anforderungen</h4>
                      {selectedJob.requirements.map((r, i) => <div key={i} className="flex items-center gap-2 mb-1"><div className="w-1 h-1 rounded-full bg-gray-500" /><span className="text-[10px] text-gray-400">{r}</span></div>)}
                    </div>
                  )}
                  {selectedJob.benefits?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-[#10B981] mb-1.5">Benefits</h4>
                      {selectedJob.benefits.map((b, i) => <div key={i} className="flex items-center gap-2 mb-1"><Check size={10} className="text-[#10B981]" /><span className="text-[10px] text-gray-400">{b}</span></div>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowApply(true)}
                  className="flex-1 py-3.5 rounded-xl bg-[#6366F1] text-white font-bold text-sm flex items-center justify-center gap-2"
                  data-testid="job-apply-btn"><Send size={16} /> Jetzt bewerben</motion.button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Job */}
      {view === "create" && (
        <div className="p-4 space-y-3">
          <h2 className="text-sm font-bold">Neuen Job posten</h2>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Jobtitel *" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="job-title" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung" rows={4} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none">
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={form.job_type} onChange={e => setForm({ ...form, job_type: e.target.value })} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none">
              {Object.entries(TYPE_LABELS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <p className="text-[10px] text-gray-400 font-semibold">Unternehmen</p>
            <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="Firmenname" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <input value={form.company_logo} onChange={e => setForm({ ...form, company_logo: e.target.value })} placeholder="Logo-URL" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.company_phone} onChange={e => setForm({ ...form, company_phone: e.target.value })} placeholder="Telefon" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
              <input value={form.company_email} onChange={e => setForm({ ...form, company_email: e.target.value })} placeholder="E-Mail" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            </div>
            <input value={form.company_website} onChange={e => setForm({ ...form, company_website: e.target.value })} placeholder="Website" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <textarea value={form.company_description} onChange={e => setForm({ ...form, company_description: e.target.value })} placeholder="Über das Unternehmen" rows={2} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none" />
          </div>
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Stadt" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
          <div className="grid grid-cols-3 gap-2">
            <input value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} placeholder="Gehalt von" type="number" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <input value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} placeholder="Gehalt bis" type="number" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
            <select value={form.salary_type} onChange={e => setForm({ ...form, salary_type: e.target.value })} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none">
              {Object.entries(SAL_LABELS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={form.remote} onChange={e => setForm({ ...form, remote: e.target.checked })} /> Remote möglich</label>
          <input value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} placeholder="Anforderungen (kommagetrennt)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
          <input value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} placeholder="Benefits (kommagetrennt)" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <motion.button whileTap={{ scale: 0.97 }} onClick={createJob} disabled={!form.title || creating}
            className="w-full py-3.5 rounded-xl bg-[#6366F1] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
            data-testid="job-submit">{creating ? <Loader2 size={18} className="animate-spin" /> : <><Briefcase size={16} /> Job veröffentlichen</>}</motion.button>
        </div>
      )}

      {/* My Applications */}
      {view === "applications" && (
        <div className="p-4 space-y-3">
          <h2 className="text-sm font-bold mb-2">Meine Bewerbungen</h2>
          {myApps.length === 0 ? (
            <div className="text-center py-16"><Send size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Noch keine Bewerbungen</p></div>
          ) : myApps.map((a, i) => (
            <motion.div key={a.application_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12px] font-bold">{a.job_title}</p>
                <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${a.status === "pending" ? "bg-amber-500/10 text-amber-400" : a.status === "accepted" ? "bg-green-500/10 text-green-400" : a.status === "interview" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
                  {a.status === "pending" ? "Ausstehend" : a.status === "accepted" ? "Angenommen" : a.status === "interview" ? "Interview" : "Abgelehnt"}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">{a.company_name}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Apply Modal */}
      <AnimatePresence>
        {showApply && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowApply(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 p-5" data-testid="apply-modal">
              <h3 className="text-[15px] font-bold mb-3">Bewerbung senden</h3>
              <p className="text-xs text-gray-400 mb-3">{selectedJob?.title} bei {selectedJob?.company_name}</p>
              <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)} placeholder="Anschreiben / Nachricht..." rows={4}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none mb-3" data-testid="apply-cover" />
              <input value={applyPhone} onChange={e => setApplyPhone(e.target.value)} placeholder="Telefonnummer (optional)"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs outline-none mb-3" data-testid="apply-phone" />
              {error && <p className="text-xs text-red-400 text-center mb-2">{error}</p>}
              <motion.button whileTap={{ scale: 0.97 }} onClick={applyToJob} disabled={applying}
                className="w-full py-3.5 rounded-xl bg-[#6366F1] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
                data-testid="apply-submit">{applying ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16} /> Bewerbung senden</>}</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JobMarketplacePage;
