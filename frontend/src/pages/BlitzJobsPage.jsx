/**
 * BlitzJobsPage - Fiverr-Style Job-Posting mit 6-Schritte Wizard
 * Komplett neu designt nach Konkurrenz-Standard 2026
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, MapPin, Clock, Zap, Plus, Star, Briefcase, Send, Camera, X, Check, ChevronRight, ChevronLeft, Tag, DollarSign, Calendar, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: "web-dev", name: "Web-Entwicklung", icon: "💻", skills: ["React", "Node.js", "WordPress", "PHP", "Python"] },
  { id: "design", name: "Design & Kreativ", icon: "🎨", skills: ["Logo Design", "UI/UX", "Photoshop", "Illustrator"] },
  { id: "writing", name: "Text & Übersetzung", icon: "✍️", skills: ["SEO-Texte", "Copywriting", "Übersetzen", "Lektorat"] },
  { id: "marketing", name: "Marketing", icon: "📈", skills: ["Social Media", "SEO", "Google Ads", "Email Marketing"] },
  { id: "video", name: "Video & Animation", icon: "🎬", skills: ["Video Editing", "After Effects", "3D Animation"] },
  { id: "business", name: "Business", icon: "💼", skills: ["Buchhaltung", "Beratung", "Excel", "PowerPoint"] },
  { id: "lifestyle", name: "Lifestyle", icon: "🌟", skills: ["Fitness", "Ernährung", "Dating Coach", "Life Coach"] },
  { id: "handwerk", name: "Handwerk", icon: "🔧", skills: ["Renovierung", "Elektrik", "Klempner", "Möbelbau"] },
];

export default function BlitzJobsPage({ onBack }) {
  const [view, setView] = useState("browse"); // browse | wizard | mine | detail
  const [wizardStep, setWizardStep] = useState(1); // 1-6
  const [jobs, setJobs] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // Wizard Form State
  const [form, setForm] = useState({
    // Step 1: Overview
    title: "",
    category: "",
    subcategory: "",
    tags: [],
    
    // Step 2: Pricing
    packages: {
      basic: { price: "", delivery_days: 3, description: "", revisions: 1 },
      standard: { price: "", delivery_days: 7, description: "", revisions: 3 },
      premium: { price: "", delivery_days: 14, description: "", revisions: 999 },
    },
    
    // Step 3: Gallery
    images: [],
    
    // Step 4: Description
    description: "",
    requirements: "",
    faqs: [],
    
    // Step 5: Details
    location: "",
    urgent: false,
    deadline: "",
    
    // Step 6: Review
  });

  useEffect(() => { if (view === "browse") loadJobs(); }, [category, search]);

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

  const createJob = async () => {
    try {
      const res = await fetch(`${API}/api/jobs/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          budget: parseFloat(form.packages.basic.price),
          location: form.location,
          urgent: form.urgent,
          tags: form.tags,
          images: form.images,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      toast.success("🎉 Job erfolgreich erstellt!");
      setView("browse");
      setForm({
        title: "", category: "", tags: [], packages: { basic: {}, standard: {}, premium: {} },
        images: [], description: "", requirements: "", faqs: [], location: "", urgent: false, deadline: "",
      });
      loadJobs();
    } catch (err) {
      toast.error(err.message || "Fehler beim Erstellen");
    }
  };

  const nextStep = () => {
    // Validation
    if (wizardStep === 1 && (!form.title || !form.category)) {
      return toast.error("Bitte Titel und Kategorie auswählen");
    }
    if (wizardStep === 2 && !form.packages.basic.price) {
      return toast.error("Bitte mindestens Basic-Paket mit Preis erstellen");
    }
    if (wizardStep < 6) setWizardStep(s => s + 1);
  };

  const prevStep = () => {
    if (wizardStep > 1) setWizardStep(s => s - 1);
  };

  const addTag = (tag) => {
    if (form.tags.length >= 5) return toast.error("Max. 5 Tags");
    if (!form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] });
    }
  };

  const removeTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  // ═══════════════════════════════════════════════════════════════════
  // WIZARD UI
  // ═══════════════════════════════════════════════════════════════════

  if (view === "wizard") {
    const steps = [
      { num: 1, title: "Übersicht", icon: FileText },
      { num: 2, title: "Preise", icon: DollarSign },
      { num: 3, title: "Bilder", icon: Camera },
      { num: 4, title: "Beschreibung", icon: FileText },
      { num: 5, title: "Details", icon: MapPin },
      { num: 6, title: "Überprüfen", icon: Check },
    ];

    const selectedCategory = CATEGORIES.find(c => c.id === form.category);

    return (
      <div className="min-h-screen bg-[#030303] pb-24">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/5">
          <button onClick={() => setView("browse")} className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center">
            <ArrowLeft size={20} className="text-white"/>
          </button>
          <h1 className="text-lg font-bold text-white">Job erstellen</h1>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex-1 flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  wizardStep >= step.num ? 'bg-green-500 text-black' : 'bg-white/10 text-white/40'
                }`}>
                  {wizardStep > step.num ? <Check size={14}/> : step.num}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-all ${wizardStep > step.num ? 'bg-green-500' : 'bg-white/10'}`}/>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-white/60 text-center">
            Schritt {wizardStep} von 6: {steps.find(s => s.num === wizardStep)?.title}
          </p>
        </div>

        {/* Step Content */}
        <div className="px-4 py-6">
          <AnimatePresence mode="wait">
            {/* STEP 1: OVERVIEW */}
            {wizardStep === 1 && (
              <motion.div key="step1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Job-Titel *</label>
                  <input
                    type="text"
                    placeholder='z.B. "Ich werde Ihre WordPress-Website erstellen"'
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                    maxLength={80}
                  />
                  <p className="text-xs text-white/40 mt-1">{form.title.length}/80 Zeichen</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Kategorie *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setForm({...form, category: cat.id})}
                        className={`p-3 rounded-xl flex items-center gap-2 transition-all ${
                          form.category === cat.id
                            ? 'bg-green-500 text-black'
                            : 'bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-xs font-medium">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedCategory && (
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block flex items-center gap-1">
                      <Tag size={14} className="text-green-400"/>
                      Skill-Tags (max. 5)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {form.tags.map(tag => (
                        <span key={tag} className="px-3 py-1.5 rounded-full bg-green-500 text-black text-xs font-medium flex items-center gap-1">
                          {tag}
                          <X size={12} className="cursor-pointer" onClick={() => removeTag(tag)}/>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCategory.skills.map(skill => (
                        <button
                          key={skill}
                          onClick={() => addTag(skill)}
                          disabled={form.tags.includes(skill) || form.tags.length >= 5}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            form.tags.includes(skill)
                              ? 'bg-white/5 text-white/40 cursor-not-allowed'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          + {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: PRICING */}
            {wizardStep === 2 && (
              <motion.div key="step2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
                <p className="text-sm text-white/60">Erstellen Sie 3 Pakete für verschiedene Budgets (wie Fiverr)</p>
                
                {['basic', 'standard', 'premium'].map((tier, idx) => (
                  <div key={tier} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white capitalize">{tier === 'basic' ? '🥉 Basic' : tier === 'standard' ? '🥈 Standard' : '🥇 Premium'}</h3>
                      {idx === 0 && <span className="text-xs text-green-400 font-medium">Erforderlich</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Preis (€)</label>
                        <input
                          type="number"
                          placeholder="50"
                          value={form.packages[tier].price}
                          onChange={e => setForm({...form, packages: {...form.packages, [tier]: {...form.packages[tier], price: e.target.value}}})}
                          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Lieferzeit (Tage)</label>
                        <select
                          value={form.packages[tier].delivery_days}
                          onChange={e => setForm({...form, packages: {...form.packages, [tier]: {...form.packages[tier], delivery_days: parseInt(e.target.value)}}})}
                          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                        >
                          {[1,2,3,5,7,10,14,21,30].map(d => <option key={d} value={d}>{d} Tage</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs text-white/60 mb-1 block">Was ist enthalten?</label>
                      <textarea
                        placeholder={tier === 'basic' ? 'Basis-Features...' : tier === 'standard' ? 'Erweiterte Features...' : 'Alle Features + Extras...'}
                        value={form.packages[tier].description}
                        onChange={e => setForm({...form, packages: {...form.packages, [tier]: {...form.packages[tier], description: e.target.value}}})}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* STEP 3: GALLERY */}
            {wizardStep === 3 && (
              <motion.div key="step3" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
                <p className="text-sm text-white/60">Fügen Sie bis zu 5 Bilder hinzu, um Ihre Arbeit zu präsentieren</p>
                <div className="grid grid-cols-3 gap-3">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
                      <img src={img} alt="" className="w-full h-full object-cover"/>
                      <button
                        onClick={() => setForm({...form, images: form.images.filter((_,i) => i !== idx)})}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                      >
                        <X size={12} className="text-white"/>
                      </button>
                    </div>
                  ))}
                  {form.images.length < 5 && (
                    <label className="aspect-square rounded-xl bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-green-400 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []).slice(0, 5 - form.images.length);
                          const urls = await Promise.all(files.map(f => new Promise(r => {
                            const reader = new FileReader();
                            reader.onload = () => r(reader.result);
                            reader.readAsDataURL(f);
                          })));
                          setForm({...form, images: [...form.images, ...urls]});
                        }}
                      />
                      <Camera size={20} className="text-white/40 mb-1"/>
                      <span className="text-[9px] text-white/40 font-medium">Bild hinzufügen</span>
                    </label>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 4: DESCRIPTION */}
            {wizardStep === 4 && (
              <motion.div key="step4" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Detaillierte Beschreibung *</label>
                  <textarea
                    placeholder="Beschreiben Sie Ihren Service, Ihre Fähigkeiten, und was Käufer erwarten können..."
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm resize-none"
                    rows={6}
                    maxLength={1200}
                  />
                  <p className="text-xs text-white/40 mt-1">{form.description.length}/1200 Zeichen</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Anforderungen an Käufer</label>
                  <textarea
                    placeholder="Was müssen Käufer Ihnen mitteilen? (z.B. Branche, Dateien, Präferenzen...)"
                    value={form.requirements}
                    onChange={e => setForm({...form, requirements: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm resize-none"
                    rows={3}
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 5: DETAILS */}
            {wizardStep === 5 && (
              <motion.div key="step5" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Standort</label>
                  <input
                    type="text"
                    placeholder="München, Berlin, Remote..."
                    value={form.location}
                    onChange={e => setForm({...form, location: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  />
                </div>

                <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.urgent}
                    onChange={e => setForm({...form, urgent: e.target.checked})}
                    className="accent-red-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-red-400">⚡ Als dringend markieren</p>
                    <p className="text-xs text-white/40">Wird oben angezeigt (+10% Gebühr)</p>
                  </div>
                </label>
              </motion.div>
            )}

            {/* STEP 6: REVIEW */}
            {wizardStep === 6 && (
              <motion.div key="step6" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30">
                  <Sparkles size={32} className="text-green-400 mb-3"/>
                  <h3 className="text-lg font-bold text-white mb-2">Fast geschafft!</h3>
                  <p className="text-sm text-white/70">Überprüfen Sie Ihre Angaben und veröffentlichen Sie Ihren Job.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40 mb-1">Titel</p>
                    <p className="text-sm text-white font-medium">{form.title}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40 mb-1">Kategorie</p>
                    <p className="text-sm text-white font-medium">
                      {CATEGORIES.find(c => c.id === form.category)?.name}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40 mb-1">Basic-Preis</p>
                    <p className="text-sm text-white font-medium">€{form.packages.basic.price}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <p className="text-xs text-white/40 mb-1">Bilder</p>
                    <p className="text-sm text-white font-medium">{form.images.length} hochgeladen</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#030303] border-t border-white/10">
          <div className="flex gap-3">
            {wizardStep > 1 && (
              <button
                onClick={prevStep}
                className="flex-1 py-3 rounded-xl bg-white/5 text-white font-medium flex items-center justify-center gap-2"
              >
                <ChevronLeft size={18}/>
                Zurück
              </button>
            )}
            {wizardStep < 6 ? (
              <button
                onClick={nextStep}
                className="flex-1 py-3 rounded-xl bg-green-500 text-black font-bold flex items-center justify-center gap-2"
              >
                Weiter
                <ChevronRight size={18}/>
              </button>
            ) : (
              <button
                onClick={createJob}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold flex items-center justify-center gap-2"
              >
                <Briefcase size={18}/>
                Jetzt veröffentlichen
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // BROWSE VIEW (Keep existing)
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#030303] pb-24">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center">
          <ArrowLeft size={20} className="text-white"/>
        </button>
        <h1 className="text-lg font-bold text-white">BlitzJobs</h1>
        <button
          onClick={() => { setView("wizard"); setWizardStep(1); }}
          className="ml-auto px-4 py-2 rounded-xl bg-green-500 text-black text-sm font-bold flex items-center gap-2"
        >
          <Plus size={16}/>
          Job erstellen
        </button>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-3">
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/>
          <input
            type="text"
            placeholder="Jobs suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setCategory("")}
            className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
              !category ? 'bg-green-500 text-black' : 'bg-white/5 text-white'
            }`}
          >
            Alle
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 ${
                category === cat.id ? 'bg-green-500 text-black' : 'bg-white/5 text-white'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="px-4 space-y-3">
        {loading ? (
          <p className="text-center text-white/40 py-10">Lade Jobs...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-10">
            <Briefcase size={48} className="mx-auto text-white/20 mb-3"/>
            <p className="text-white/40">Keine Jobs gefunden</p>
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.job_id} onClick={() => setSelected(job)} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-xl">
                  {CATEGORIES.find(c => c.id === job.category)?.icon || '💼'}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white mb-1">{job.title}</h3>
                  <p className="text-xs text-white/60 mb-2 line-clamp-2">{job.description}</p>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1"><MapPin size={12}/>{job.location}</span>
                    <span className="flex items-center gap-1"><DollarSign size={12}/>€{job.budget}</span>
                    {job.urgent && <span className="text-red-400 flex items-center gap-1"><Zap size={12}/>Dringend</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
