import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star, Clock, Users, BookOpen, Play, CheckCircle, Award, TrendingUp, ChevronRight, GraduationCap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const LEVEL_LABELS = { anfaenger: "Einsteiger", mittel: "Fortgeschritten", experte: "Experte" };
const LEVEL_COLORS = { anfaenger: "#10B981", mittel: "#F59E0B", experte: "#EF4444" };

export default function ELearningPage({ onBack }) {
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [tab, setTab] = useState("browse");
  const [selected, setSelected] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => { loadData(); }, [catFilter]);

  const loadData = async () => {
    try {
      const catParam = catFilter ? `?category=${catFilter}` : "";
      const [cRes, catRes, myRes] = await Promise.all([
        fetch(`${API}/api/elearning/courses${catParam}`),
        fetch(`${API}/api/elearning/categories`),
        fetch(`${API}/api/elearning/my-courses`, { credentials: "include" }).catch(() => ({ ok: false })),
      ]);
      const cData = await cRes.json();
      const catData = await catRes.json();
      setCourses(cData.courses || []);
      setCategories(catData.categories || []);
      if (myRes.ok) { const myData = await myRes.json(); setMyCourses(myData.enrollments || []); }
    } catch { }
    setLoading(false);
  };

  const enroll = async (courseId) => {
    setEnrolling(true);
    try {
      const res = await fetch(`${API}/api/elearning/enroll`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (res.ok) {
        loadData();
        setSelected(null);
      }
    } catch { }
    setEnrolling(false);
  };

  const updateProgress = async (courseId, moduleId) => {
    try {
      await fetch(`${API}/api/elearning/progress`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId, module_id: moduleId }),
      });
      loadData();
    } catch { }
  };

  const isEnrolled = (courseId) => myCourses.some(e => e.course_id === courseId);
  const getEnrollment = (courseId) => myCourses.find(e => e.course_id === courseId);

  const filtered = courses.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.instructor?.toLowerCase().includes(search.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (selected) {
    const c = selected;
    const enrolled = isEnrolled(c.course_id);
    const enrollment = getEnrollment(c.course_id);
    return (
      <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="relative">
          <img src={c.image} alt={c.title} className="w-full h-56 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <button onClick={() => setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="el-detail-back">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            {c.bestseller && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black mr-2">BESTSELLER</span>}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: LEVEL_COLORS[c.level] || "#10B981", color: "white" }}>{LEVEL_LABELS[c.level] || c.level}</span>
            <h1 className="text-white text-lg font-bold mt-2 line-clamp-2">{c.title}</h1>
            <p className="text-white/70 text-xs mt-1">von {c.instructor}</p>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold" style={{ color: "#00C2FF" }}>{c.price}€</span>
                {c.original_price > c.price && <span className="text-sm line-through" style={{ color: "var(--text-secondary, #666)" }}>{c.original_price}€</span>}
              </div>
              {c.discount_percent > 0 && <span className="text-xs text-green-400">-{c.discount_percent}% Rabatt</span>}
            </div>
            <div className="flex items-center gap-1">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold" style={{ color: "var(--text-primary, #fff)" }}>{c.rating}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>({c.reviews_count?.toLocaleString()})</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Clock, label: `${c.duration_hours}h Video` },
              { icon: BookOpen, label: `${c.modules_count} Module` },
              { icon: Users, label: `${c.students_count?.toLocaleString()} Teilnehmer` },
            ].map((item, i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-card, #111)" }}>
                <item.icon size={18} className="mx-auto mb-1" style={{ color: "#00C2FF" }} />
                <div className="text-[10px]" style={{ color: "var(--text-primary, #fff)" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Beschreibung</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #aaa)" }}>{c.description}</p>
          </div>

          {c.what_you_learn?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Was du lernst</h3>
              <div className="space-y-2">
                {c.what_you_learn.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} style={{ color: "#10B981", marginTop: 2 }} />
                    <span className="text-sm" style={{ color: "var(--text-secondary, #aaa)" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary, #fff)" }}>Kursmodule</h3>
            <div className="space-y-2">
              {c.modules?.map((m, i) => {
                const completed = enrollment?.completed_modules?.includes(m.id);
                return (
                  <div key={m.id} className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--bg-card, #111)", border: completed ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: completed ? "rgba(16,185,129,0.2)" : "rgba(0,194,255,0.1)", color: completed ? "#10B981" : "#00C2FF" }}>
                        {completed ? <CheckCircle size={16} /> : i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-medium" style={{ color: "var(--text-primary, #fff)" }}>{m.title}</div>
                        <div className="text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>{m.lessons} Lektionen · {m.duration_min} Min.</div>
                      </div>
                    </div>
                    {enrolled && !completed && (
                      <button onClick={() => updateProgress(c.course_id, m.id)} className="px-2 py-1 rounded-lg text-[10px] font-medium" style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }} data-testid={`el-complete-${m.id}`}>
                        <Play size={10} className="inline mr-1" />Starten
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!enrolled ? (
            <button onClick={() => enroll(c.course_id)} disabled={enrolling} className="w-full py-3 rounded-xl font-semibold text-sm text-black" style={{ background: "#00C2FF", opacity: enrolling ? 0.6 : 1 }} data-testid="el-enroll-btn">
              {enrolling ? "Wird eingeschrieben..." : `Jetzt einschreiben — ${c.price}€`}
            </button>
          ) : (
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <CheckCircle size={24} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm font-medium text-green-400">Eingeschrieben</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary, #888)" }}>Fortschritt: {enrollment?.progress_percent || 0}%</p>
              <div className="w-full h-2 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${enrollment?.progress_percent || 0}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary, #030303)" }}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "var(--bg-primary, #030303)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card, #111)" }} data-testid="el-back">
            <ArrowLeft size={20} style={{ color: "var(--text-primary, #fff)" }} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary, #fff)" }}>E-Learning</h1>
            <p className="text-xs" style={{ color: "var(--text-secondary, #888)" }}>{courses.length} Kurse verfügbar</p>
          </div>
          <GraduationCap size={24} style={{ color: "#00C2FF" }} />
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary, #666)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kurs, Thema oder Dozent suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-card, #111)", color: "var(--text-primary, #fff)", border: "1px solid rgba(255,255,255,0.06)" }} data-testid="el-search" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setCatFilter("")} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0" data-testid="el-cat-all"
            style={{ background: !catFilter ? "#00C2FF" : "var(--bg-card, #111)", color: !catFilter ? "#000" : "var(--text-secondary, #aaa)" }}>Alle</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.id)} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0" data-testid={`el-cat-${c.id}`}
              style={{ background: catFilter === c.id ? "#00C2FF" : "var(--bg-card, #111)", color: catFilter === c.id ? "#000" : "var(--text-secondary, #aaa)" }}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: "var(--bg-card, #111)" }}>
          {[{ id: "browse", label: "Entdecken" }, { id: "my", label: "Meine Kurse" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 py-2 rounded-lg text-xs font-medium transition-all" data-testid={`el-tab-${t.id}`}
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
        ) : tab === "browse" ? (
          filtered.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen size={48} className="mx-auto mb-3" style={{ color: "var(--text-secondary, #444)" }} />
              <p style={{ color: "var(--text-secondary, #888)" }}>Keine Kurse gefunden</p>
            </div>
          ) : filtered.map(c => (
            <motion.div key={c.course_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl overflow-hidden cursor-pointer" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }} onClick={() => setSelected(c)} data-testid={`el-course-${c.course_id}`}>
              <div className="relative">
                <img src={c.image} alt={c.title} className="w-full h-40 object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                {c.bestseller && <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black">BESTSELLER</span>}
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: LEVEL_COLORS[c.level] || "#10B981", color: "white" }}>{LEVEL_LABELS[c.level] || c.level}</span>
                {isEnrolled(c.course_id) && <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 text-white flex items-center gap-1"><CheckCircle size={10} />Eingeschrieben</span>}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-1 line-clamp-1" style={{ color: "var(--text-primary, #fff)" }}>{c.title}</h3>
                <p className="text-xs mb-2" style={{ color: "var(--text-secondary, #888)" }}>{c.instructor}</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400" /><span className="text-xs font-medium" style={{ color: "var(--text-primary, #fff)" }}>{c.rating}</span></div>
                  <span className="text-[10px]" style={{ color: "var(--text-secondary, #666)" }}>({c.reviews_count?.toLocaleString()} Bewertungen)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-base font-bold" style={{ color: "#00C2FF" }}>{c.price}€</span>
                    {c.original_price > c.price && <span className="text-xs line-through" style={{ color: "var(--text-secondary, #666)" }}>{c.original_price}€</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>
                    <span>{c.duration_hours}h</span>
                    <span>{c.modules_count} Module</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          myCourses.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap size={48} className="mx-auto mb-3" style={{ color: "var(--text-secondary, #444)" }} />
              <p className="text-sm mb-1" style={{ color: "var(--text-secondary, #888)" }}>Noch keine Kurse</p>
              <button onClick={() => setTab("browse")} className="text-xs" style={{ color: "#00C2FF" }}>Jetzt Kurse entdecken</button>
            </div>
          ) : myCourses.map(e => (
            <motion.div key={e.enrollment_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 cursor-pointer" style={{ background: "var(--bg-card, #111)", border: "1px solid rgba(255,255,255,0.05)" }}
              onClick={() => { const course = courses.find(c => c.course_id === e.course_id); if (course) setSelected(course); }}
              data-testid={`el-my-${e.course_id}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold line-clamp-1" style={{ color: "var(--text-primary, #fff)" }}>{e.course_title}</h3>
                {e.status === "completed" ? <Award size={16} className="text-yellow-400" /> : <ChevronRight size={16} style={{ color: "var(--text-secondary, #666)" }} />}
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: e.status === "completed" ? "#10B981" : "#00C2FF" }}>{e.status === "completed" ? "Abgeschlossen" : `${e.progress_percent}% Fortschritt`}</span>
                <span className="text-[10px]" style={{ color: "var(--text-secondary, #888)" }}>{e.completed_modules?.length || 0} Module</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${e.progress_percent}%`, background: e.status === "completed" ? "#10B981" : "#00C2FF" }} />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
