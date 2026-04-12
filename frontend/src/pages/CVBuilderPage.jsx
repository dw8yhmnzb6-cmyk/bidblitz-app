/**
 * BidBlitz V2 - CV Builder
 * Lebenslauf erstellen, bearbeiten, PDF-Export
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, FileDown, Plus, Trash2, Loader2, Check,
  User, Briefcase, GraduationCap, Star, Globe, Award, Users,
  Heart, Camera, ChevronDown, ChevronUp
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CVBuilderPage = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState("personal");

  const [cv, setCv] = useState({
    full_name: "", title: "", summary: "", email: "", phone: "",
    address: "", city: "", website: "", linkedin: "", photo_url: "",
    date_of_birth: "", nationality: "",
    experience: [], education: [], skills: [],
    languages: [], certificates: [], references: [], hobbies: [],
    auto_attach: true,
  });

  useEffect(() => {
    fetch(`${API}/api/cv/me`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.cv) setCv(prev => ({ ...prev, ...d.cv })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setCv(prev => ({ ...prev, [key]: val }));

  const saveCv = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/cv/save`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cv),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    setSaving(false);
  };

  const exportPdf = () => {
    window.open(`${API}/api/cv/pdf`, "_blank");
  };

  // List helpers
  const addExp = () => set("experience", [...cv.experience, { company: "", position: "", start_date: "", end_date: "", description: "", current: false }]);
  const addEdu = () => set("education", [...cv.education, { institution: "", degree: "", field: "", start_date: "", end_date: "" }]);
  const addCert = () => set("certificates", [...cv.certificates, { name: "", issuer: "", date: "" }]);
  const addRef = () => set("references", [...cv.references, { name: "", company: "", phone: "", email: "", relation: "" }]);
  const addLang = () => set("languages", [...cv.languages, { name: "", level: "Grundkenntnisse" }]);

  const updateList = (key, idx, field, val) => {
    const arr = [...cv[key]];
    arr[idx] = { ...arr[idx], [field]: val };
    set(key, arr);
  };
  const removeList = (key, idx) => set(key, cv[key].filter((_, i) => i !== idx));

  const SectionHeader = ({ id, icon: Icon, label, count }) => (
    <motion.button whileTap={{ scale: 0.98 }} onClick={() => setOpenSection(openSection === id ? "" : id)}
      className="w-full flex items-center justify-between p-3 rounded-xl bg-[#111118] border border-white/5 mb-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-[#6366F1]" />
        <span className="text-xs font-bold text-white">{label}</span>
        {count > 0 && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#6366F1]/10 text-[#6366F1] font-bold">{count}</span>}
      </div>
      {openSection === id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
    </motion.button>
  );

  const Input = ({ value, onChange, placeholder, type = "text", className = "" }) => (
    <input type={type} value={value || ""} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className={`w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white placeholder-gray-600 ${className}`} />
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#6366F1]" /></div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="cv-builder-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <div><h1 className="text-[15px] font-bold">CV-Builder</h1><p className="text-[10px] text-gray-500">Lebenslauf erstellen</p></div>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={exportPdf}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-[10px] font-medium" data-testid="cv-pdf-btn">
              <FileDown size={12} /> PDF
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={saveCv} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6366F1] text-white text-[10px] font-bold" data-testid="cv-save-btn">
              {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
              {saved ? "Gespeichert" : "Speichern"}
            </motion.button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-1">

        {/* ═══ Personal ═══ */}
        <SectionHeader id="personal" icon={User} label="Persönliche Daten" />
        {openSection === "personal" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-2 mb-3">
            {cv.photo_url && <img src={cv.photo_url} alt="" className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-[#6366F1]" />}
            <Input value={cv.photo_url} onChange={v => set("photo_url", v)} placeholder="Profilbild-URL" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={cv.full_name} onChange={v => set("full_name", v)} placeholder="Vollständiger Name *" />
              <Input value={cv.title} onChange={v => set("title", v)} placeholder="Berufsbezeichnung" />
            </div>
            <textarea value={cv.summary || ""} onChange={e => set("summary", e.target.value)} placeholder="Zusammenfassung / Über mich"
              rows={3} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none text-white placeholder-gray-600" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={cv.email} onChange={v => set("email", v)} placeholder="E-Mail" type="email" />
              <Input value={cv.phone} onChange={v => set("phone", v)} placeholder="Telefon" />
              <Input value={cv.city} onChange={v => set("city", v)} placeholder="Stadt" />
              <Input value={cv.address} onChange={v => set("address", v)} placeholder="Adresse" />
              <Input value={cv.date_of_birth} onChange={v => set("date_of_birth", v)} placeholder="Geburtsdatum" />
              <Input value={cv.nationality} onChange={v => set("nationality", v)} placeholder="Nationalität" />
              <Input value={cv.website} onChange={v => set("website", v)} placeholder="Website" />
              <Input value={cv.linkedin} onChange={v => set("linkedin", v)} placeholder="LinkedIn" />
            </div>
          </div>
        )}

        {/* ═══ Experience ═══ */}
        <SectionHeader id="experience" icon={Briefcase} label="Berufserfahrung" count={cv.experience.length} />
        {openSection === "experience" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-3 mb-3">
            {cv.experience.map((e, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-500 font-medium">Position {i + 1}</span>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeList("experience", i)}><Trash2 size={12} className="text-red-400" /></motion.button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={e.position} onChange={v => updateList("experience", i, "position", v)} placeholder="Position *" />
                  <Input value={e.company} onChange={v => updateList("experience", i, "company", v)} placeholder="Firma *" />
                  <Input value={e.start_date} onChange={v => updateList("experience", i, "start_date", v)} placeholder="Von (z.B. 01/2020)" />
                  <Input value={e.end_date} onChange={v => updateList("experience", i, "end_date", v)} placeholder="Bis (oder leer)" />
                </div>
                <textarea value={e.description || ""} onChange={ev => updateList("experience", i, "description", ev.target.value)}
                  placeholder="Beschreibung" rows={2} className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs outline-none resize-none text-white placeholder-gray-600" />
                <label className="flex items-center gap-2 text-[10px] text-gray-400">
                  <input type="checkbox" checked={e.current} onChange={ev => updateList("experience", i, "current", ev.target.checked)} /> Aktuelle Position
                </label>
              </div>
            ))}
            <motion.button whileTap={{ scale: 0.95 }} onClick={addExp}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-[10px] text-gray-500 flex items-center justify-center gap-1"><Plus size={12} /> Hinzufügen</motion.button>
          </div>
        )}

        {/* ═══ Education ═══ */}
        <SectionHeader id="education" icon={GraduationCap} label="Ausbildung" count={cv.education.length} />
        {openSection === "education" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-3 mb-3">
            {cv.education.map((e, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-500 font-medium">Ausbildung {i + 1}</span>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeList("education", i)}><Trash2 size={12} className="text-red-400" /></motion.button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={e.institution} onChange={v => updateList("education", i, "institution", v)} placeholder="Institution" />
                  <Input value={e.degree} onChange={v => updateList("education", i, "degree", v)} placeholder="Abschluss" />
                  <Input value={e.field} onChange={v => updateList("education", i, "field", v)} placeholder="Fachrichtung" />
                  <div className="grid grid-cols-2 gap-1">
                    <Input value={e.start_date} onChange={v => updateList("education", i, "start_date", v)} placeholder="Von" />
                    <Input value={e.end_date} onChange={v => updateList("education", i, "end_date", v)} placeholder="Bis" />
                  </div>
                </div>
              </div>
            ))}
            <motion.button whileTap={{ scale: 0.95 }} onClick={addEdu}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-[10px] text-gray-500 flex items-center justify-center gap-1"><Plus size={12} /> Hinzufügen</motion.button>
          </div>
        )}

        {/* ═══ Skills ═══ */}
        <SectionHeader id="skills" icon={Star} label="Fähigkeiten" count={cv.skills.length} />
        {openSection === "skills" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-2 mb-3">
            <div className="flex flex-wrap gap-1.5">
              {cv.skills.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-[#6366F1]/10 text-[#6366F1] text-[10px] font-medium flex items-center gap-1">
                  {s} <motion.button whileTap={{ scale: 0.8 }} onClick={() => set("skills", cv.skills.filter((_, j) => j !== i))}><Trash2 size={9} /></motion.button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input id="skill-input" placeholder="Neue Fähigkeit..." className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white placeholder-gray-600"
                onKeyDown={e => { if (e.key === "Enter" && e.target.value) { set("skills", [...cv.skills, e.target.value]); e.target.value = ""; } }} />
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { const el = document.getElementById("skill-input"); if (el?.value) { set("skills", [...cv.skills, el.value]); el.value = ""; } }}
                className="px-3 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold"><Plus size={14} /></motion.button>
            </div>
          </div>
        )}

        {/* ═══ Languages ═══ */}
        <SectionHeader id="languages" icon={Globe} label="Sprachen" count={cv.languages.length} />
        {openSection === "languages" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-2 mb-3">
            {cv.languages.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={l.name} onChange={v => updateList("languages", i, "name", v)} placeholder="Sprache" className="flex-1" />
                <select value={l.level} onChange={e => updateList("languages", i, "level", e.target.value)}
                  className="px-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white">
                  <option value="Muttersprache">Muttersprache</option>
                  <option value="Verhandlungssicher">Verhandlungssicher</option>
                  <option value="Fließend">Fließend</option>
                  <option value="Gut">Gut</option>
                  <option value="Grundkenntnisse">Grundkenntnisse</option>
                </select>
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeList("languages", i)}><Trash2 size={12} className="text-red-400" /></motion.button>
              </div>
            ))}
            <motion.button whileTap={{ scale: 0.95 }} onClick={addLang}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-[10px] text-gray-500 flex items-center justify-center gap-1"><Plus size={12} /> Sprache hinzufügen</motion.button>
          </div>
        )}

        {/* ═══ Certificates ═══ */}
        <SectionHeader id="certificates" icon={Award} label="Zertifikate" count={cv.certificates.length} />
        {openSection === "certificates" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-2 mb-3">
            {cv.certificates.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={c.name} onChange={v => updateList("certificates", i, "name", v)} placeholder="Zertifikat" className="flex-1" />
                <Input value={c.issuer} onChange={v => updateList("certificates", i, "issuer", v)} placeholder="Aussteller" className="flex-1" />
                <Input value={c.date} onChange={v => updateList("certificates", i, "date", v)} placeholder="Datum" className="w-24" />
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeList("certificates", i)}><Trash2 size={12} className="text-red-400" /></motion.button>
              </div>
            ))}
            <motion.button whileTap={{ scale: 0.95 }} onClick={addCert}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-[10px] text-gray-500 flex items-center justify-center gap-1"><Plus size={12} /> Hinzufügen</motion.button>
          </div>
        )}

        {/* ═══ References ═══ */}
        <SectionHeader id="references" icon={Users} label="Referenzen" count={cv.references.length} />
        {openSection === "references" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-3 mb-3">
            {cv.references.map((r, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center justify-between"><span className="text-[9px] text-gray-500">Referenz {i+1}</span><motion.button whileTap={{ scale: 0.8 }} onClick={() => removeList("references", i)}><Trash2 size={12} className="text-red-400" /></motion.button></div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={r.name} onChange={v => updateList("references", i, "name", v)} placeholder="Name" />
                  <Input value={r.company} onChange={v => updateList("references", i, "company", v)} placeholder="Firma" />
                  <Input value={r.phone} onChange={v => updateList("references", i, "phone", v)} placeholder="Telefon" />
                  <Input value={r.email} onChange={v => updateList("references", i, "email", v)} placeholder="E-Mail" />
                </div>
              </div>
            ))}
            <motion.button whileTap={{ scale: 0.95 }} onClick={addRef}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-[10px] text-gray-500 flex items-center justify-center gap-1"><Plus size={12} /> Hinzufügen</motion.button>
          </div>
        )}

        {/* ═══ Hobbies ═══ */}
        <SectionHeader id="hobbies" icon={Heart} label="Hobbys & Interessen" count={cv.hobbies.length} />
        {openSection === "hobbies" && (
          <div className="p-3 rounded-xl bg-[#111118] border border-white/5 space-y-2 mb-3">
            <div className="flex flex-wrap gap-1.5">
              {cv.hobbies.map((h, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-[#EC4899]/10 text-[#EC4899] text-[10px] font-medium flex items-center gap-1">
                  {h} <motion.button whileTap={{ scale: 0.8 }} onClick={() => set("hobbies", cv.hobbies.filter((_, j) => j !== i))}><Trash2 size={9} /></motion.button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input id="hobby-input" placeholder="Neues Hobby..." className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs outline-none text-white placeholder-gray-600"
                onKeyDown={e => { if (e.key === "Enter" && e.target.value) { set("hobbies", [...cv.hobbies, e.target.value]); e.target.value = ""; } }} />
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { const el = document.getElementById("hobby-input"); if (el?.value) { set("hobbies", [...cv.hobbies, el.value]); el.value = ""; } }}
                className="px-3 py-2 rounded-xl bg-[#EC4899] text-white text-xs font-bold"><Plus size={14} /></motion.button>
            </div>
          </div>
        )}

        {/* ═══ Settings ═══ */}
        <div className="p-3 rounded-xl bg-[#111118] border border-white/5 mt-3">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">Auto-Anhang bei Bewerbungen</p>
              <p className="text-[9px] text-gray-500">CV wird automatisch bei Job-Bewerbungen mitgesendet</p>
            </div>
            <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${cv.auto_attach ? "bg-[#6366F1]" : "bg-white/10"}`}
              onClick={() => set("auto_attach", !cv.auto_attach)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${cv.auto_attach ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default CVBuilderPage;
