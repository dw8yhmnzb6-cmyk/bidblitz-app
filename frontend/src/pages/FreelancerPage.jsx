import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star, MapPin, Clock, Code, Palette, Megaphone, Film, Languages, Calculator, ChevronRight, Users, Briefcase, Send, CheckCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_ICONS = { design: Palette, entwicklung: Code, marketing: Megaphone, video: Film, uebersetzung: Languages, finanzen: Calculator };
const CAT_COLORS = { design: "#A855F7", entwicklung: "#3B82F6", marketing: "#10B981", video: "#F59E0B", uebersetzung: "#EC4899", finanzen: "#06B6D4" };

export default function FreelancerPage({ onBack }) {
  const [freelancers, setFreelancers] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [tab, setTab] = useState("freelancers");
  const [selected, setSelected] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqBudget, setReqBudget] = useState("");
  const [reqSent, setReqSent] = useState(false);

  useEffect(() => {
    loadData();
  }, [catFilter]);

  const loadData = async () => {
    try {
      const catParam = catFilter ? `?category=${catFilter}` : "";
      const [fRes, gRes, cRes] = await Promise.all([
        fetch(`${API}/api/freelancer/freelancers${catParam}`, { credentials: "include" }),
        fetch(`${API}/api/freelancer/gigs${catParam}`, { credentials: "include" }),
        fetch(`${API}/api/freelancer/categories`, { credentials: "include" }),
      ]);
      const [fData, gData, cData] = await Promise.all([fRes.json(), gRes.json(), cRes.json()]);
      setFreelancers(fData.freelancers || []);
      setGigs(gData.gigs || []);
      setCategories(cData.categories || []);
    } catch { }
    setLoading(false);
  };

  const sendRequest = async () => {
    if (!selected || !reqTitle) return;
    try {
      await fetch(`${API}/api/freelancer/project/request`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancer_id: selected.freelancer_id, title: reqTitle,
          description: reqDesc, budget: parseFloat(reqBudget) || 0,
        }),
      });
      setReqSent(true);
      setTimeout(() => { setReqSent(false); setShowRequest(false); setReqTitle(""); setReqDesc(""); setReqBudget(""); }, 2000);
    } catch { }
  };

  const filteredF = freelancers.filter(f =>
    !search || f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.title?.toLowerCase().includes(search.toLowerCase()) ||
    f.skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredG = gigs.filter(g =>
    !search || g.title?.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    const f = selected;
    const CatIcon = CAT_ICONS[f.category] || Briefcase;
    const catColor = CAT_COLORS[f.category] || "#00C2FF";
    return (
      <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card, #111)" }} data-testid="fl-detail-back">
            <ArrowLeft size={20} style={{ color: "var(--text-primary, #fff)" }} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary, #fff)" }}>Profil</h1>
        </div>

        <div className="px-4 space-y-5">
          <div className="flex items-center gap-4">
            <img src={f.avatar} alt={f.name} className="w-20 h-20 rounded-2xl object-cover" />
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary, #fff)" }}>{f.name}</h2>
              <p className="text-sm" style={{ color: catColor }}>{f.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400" /><span className="text-xs font-medium" style={{ color: "var(--text-primary, #fff)" }}>{f.rating}</span></div>
                <span className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>({f.reviews_count} Bewertungen)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Stundensatz", value: `${f.hourly_rate}€/h` },
              { label: "Projekte", value: f.completed_projects },
              { label: "Antwortzeit", value: f.response_time },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-card, #111)" }}>
                <div className="text-sm font-bold" style={{ color: "#00C2FF" }}>{item.value}</div>
                <div className="text-[10px] mt-1" style={{ color: "var(--text-secondary, #888)" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Über mich</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #aaa)" }}>{f.description}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Skills</h3>
            <div className="flex flex-wrap gap-2">
              {f.skills?.map((s, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs" style={{ background: `${catColor}20`, color: catColor }}>{s}</span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Sprachen</h3>
            <div className="flex gap-2">
              {f.languages?.map((l, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs" style={{ background: "var(--bg-card, #111)", color: "var(--text-primary, #fff)" }}>{l}</span>
              ))}
            </div>
          </div>

          {f.gigs?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Angebote</h3>
              {f.gigs.map(g => (
                <div key={g.gig_id} className="rounded-xl p-3 mb-2" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary, #fff)" }}>{g.title}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: "#00C2FF" }}>ab {g.price_from}€</span>
                    <span className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>{g.delivery_days} Tage Lieferzeit</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showRequest ? (
            <button onClick={() => setShowRequest(true)} className="w-full py-3 rounded-xl font-semibold text-sm text-black" style={{ background: "#00C2FF" }} data-testid="fl-hire-btn">
              Projekt anfragen
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(0,194,255,0.2)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary, #fff)" }}>Projektanfrage</h3>
              <input value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="Projekttitel" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-primary, #030303)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.1)" }} data-testid="fl-req-title" />
              <textarea value={reqDesc} onChange={e => setReqDesc(e.target.value)} placeholder="Beschreibung" className="w-full px-3 py-2 rounded-lg text-sm resize-none" rows={3} style={{ background: "var(--bg-primary, #030303)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.1)" }} data-testid="fl-req-desc" />
              <input value={reqBudget} onChange={e => setReqBudget(e.target.value)} placeholder="Budget (€)" type="number" className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-primary, #030303)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.1)" }} data-testid="fl-req-budget" />
              <button onClick={sendRequest} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{ background: "#00C2FF" }} data-testid="fl-req-send">
                {reqSent ? <><CheckCircle size={16} /> Gesendet!</> : <><Send size={16} /> Anfrage senden</>}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card, #111)" }} data-testid="fl-back">
            <ArrowLeft size={20} style={{ color: "var(--text-primary, #fff)" }} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary, #fff)" }}>Freelancer</h1>
            <p className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>{freelancers.length} Experten verfügbar</p>
          </div>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary, #666)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Skill oder Titel suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-card, #111)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.06)" }} data-testid="fl-search" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setCatFilter("")} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0" data-testid="fl-cat-all"
            style={{ background: !catFilter ? "#00C2FF" : "var(--bg-card, #111)", color: !catFilter ? "#000" : "var(--text-secondary, #aaa)" }}>Alle</button>
          {categories.map(c => {
            const Icon = CAT_ICONS[c.id] || Briefcase;
            return (
              <button key={c.id} onClick={() => setCatFilter(c.id)} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5" data-testid={`fl-cat-${c.id}`}
                style={{ background: catFilter === c.id ? (CAT_COLORS[c.id] || "#00C2FF") : "var(--bg-card, #111)", color: catFilter === c.id ? "#000" : "var(--text-secondary, #aaa)" }}>
                <Icon size={12} /> {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: "var(--bg-card, #111)" }}>
          {[{ id: "freelancers", label: "Freelancer" }, { id: "gigs", label: "Angebote" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 py-2 rounded-lg text-xs font-medium transition-all" data-testid={`fl-tab-${t.id}`}
              style={{ background: tab === t.id ? "#00C2FF" : "transparent", color: tab === t.id ? "#000" : "var(--text-secondary, #888)" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00C2FF", borderTopColor: "transparent" }} />
          </div>
        ) : tab === "freelancers" ? (
          filteredF.length === 0 ? (
            <div className="text-center py-20">
              <Users size={48} className="mx-auto mb-3" style={{ color: "var(--text-secondary, #444)" }} />
              <p style={{ color: "var(--text-secondary, #888)" }}>Keine Freelancer gefunden</p>
            </div>
          ) : filteredF.map(f => {
            const catColor = CAT_COLORS[f.category] || "#00C2FF";
            return (
              <motion.div key={f.freelancer_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 cursor-pointer" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }} onClick={() => {
                (async () => {
                  try { const r = await fetch(`${API}/api/freelancer/freelancer/${f.freelancer_id}`, { credentials: "include" }); if (r.ok) setSelected(await r.json()); else setSelected(f); } catch { setSelected(f); }
                })();
              }} data-testid={`fl-card-${f.freelancer_id}`}>
                <div className="flex items-start gap-3">
                  <img src={f.avatar} alt={f.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary, #fff)" }}>{f.name}</h3>
                      {f.featured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">TOP</span>}
                    </div>
                    <p className="text-xs" style={{ color: catColor }}>{f.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400" /><span className="text-xs" style={{ color: "var(--text-primary, #fff)" }}>{f.rating}</span><span className="text-[10px]" style={{ color: "var(--text-secondary, #666)" }}>({f.reviews_count})</span></div>
                      <div className="flex items-center gap-1"><MapPin size={12} style={{ color: "var(--text-secondary, #666)" }} /><span className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>{f.location}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {f.skills?.slice(0, 3).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{ background: `${catColor}15`, color: catColor }}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold" style={{ color: "#00C2FF" }}>{f.hourly_rate}€</div>
                    <div className="text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>/Stunde</div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          filteredG.length === 0 ? (
            <div className="text-center py-20">
              <Briefcase size={48} className="mx-auto mb-3" style={{ color: "var(--text-secondary, #444)" }} />
              <p style={{ color: "var(--text-secondary, #888)" }}>Keine Angebote gefunden</p>
            </div>
          ) : filteredG.map(g => (
            <motion.div key={g.gig_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }} data-testid={`fl-gig-${g.gig_id}`}>
              {g.image && <img src={g.image} alt={g.title} className="w-full h-36 object-cover" loading="lazy" />}
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary, #fff)" }}>{g.title}</h3>
                <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--text-secondary, #aaa)" }}>{g.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "#00C2FF" }}>ab {g.price_from}€</span>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary, #888)" }}>
                    <span className="flex items-center gap-1"><Clock size={12} />{g.delivery_days} Tage</span>
                    <span className="flex items-center gap-1"><Users size={12} />{g.orders_count}x bestellt</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
