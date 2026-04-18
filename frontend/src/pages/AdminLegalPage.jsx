/**
 * AdminLegalPage — Admin interface for editing Legal pages.
 * Routes: /admin/legal
 * Backend:
 *  GET  /api/admin/legal/all
 *  GET  /api/admin/legal/{slug}
 *  PUT  /api/admin/legal/{slug}
 *  POST /api/admin/legal/{slug}/reset
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, FileText, Shield, Building2, Lock,
  Plus, Trash2, Save, RotateCcw, Loader2, CheckCircle2,
  ArrowUp, ArrowDown,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let d = {};
  try { d = await r.clone().json(); } catch {}
  if (!r.ok) throw new Error(d.detail || d.message || `Error ${r.status}`);
  return d;
}

const TABS = [
  { slug: "agb",          label: "AGB",         icon: FileText,  color: "#00C2FF" },
  { slug: "datenschutz",  label: "Datenschutz", icon: Shield,    color: "#00E89D" },
  { slug: "impressum",    label: "Impressum",   icon: Building2, color: "#A855F7" },
  { slug: "sicherheit",   label: "Sicherheit",  icon: Lock,      color: "#FFD700" },
];

const AdminLegalPage = ({ onBack }) => {
  const [activeSlug, setActiveSlug] = useState("agb");
  const [overview, setOverview] = useState([]);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const d = await api("/api/admin/legal/all");
      setOverview(d.documents || []);
    } catch (e) { toast.error(e.message); }
  }, []);

  const loadDoc = useCallback(async (slug) => {
    setLoading(true);
    try {
      const d = await api(`/api/admin/legal/${slug}`);
      setDoc({ ...d, _dirty: false });
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadDoc(activeSlug); }, [activeSlug, loadDoc]);

  const updateSection = (idx, field, value) => {
    const content = [...doc.content];
    content[idx] = { ...content[idx], [field]: value };
    setDoc({ ...doc, content, _dirty: true });
  };

  const addSection = () => {
    const content = [...(doc.content || []), { heading: "Neuer Abschnitt", text: "" }];
    setDoc({ ...doc, content, _dirty: true });
  };

  const removeSection = (idx) => {
    if (!window.confirm("Abschnitt löschen?")) return;
    const content = doc.content.filter((_, i) => i !== idx);
    setDoc({ ...doc, content, _dirty: true });
  };

  const moveSection = (idx, dir) => {
    const content = [...doc.content];
    const j = idx + dir;
    if (j < 0 || j >= content.length) return;
    [content[idx], content[j]] = [content[j], content[idx]];
    setDoc({ ...doc, content, _dirty: true });
  };

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const body = {
        title: doc.title,
        content: doc.content.map(({ heading, text }) => ({ heading, text })),
      };
      const res = await api(`/api/admin/legal/${activeSlug}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setDoc({ ...res.document, _dirty: false });
      toast.success("Gespeichert.");
      loadOverview();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm("Wirklich auf Standard-Text zurücksetzen? Deine Änderungen gehen verloren.")) return;
    setSaving(true);
    try {
      await api(`/api/admin/legal/${activeSlug}/reset`, { method: "POST" });
      toast.success("Auf Standard zurückgesetzt.");
      await loadDoc(activeSlug);
      await loadOverview();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const currentMeta = TABS.find((t) => t.slug === activeSlug) || TABS[0];

  return (
    <motion.div
      data-testid="admin-legal-page"
      className="min-h-screen pb-24"
      style={{ background: "#050505", color: "white" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-3 sticky top-0 z-20 backdrop-blur-xl"
        style={{ background: "rgba(5,5,5,0.85)" }}
      >
        <motion.button
          data-testid="admin-legal-back"
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </motion.button>
        <div className="flex-1">
          <p className="text-[11px] text-white/50 uppercase tracking-[0.2em] font-bold">Admin</p>
          <p className="text-[16px] font-bold">Legal-Pages Editor</p>
        </div>
        {doc?._dirty && (
          <motion.button
            data-testid="admin-legal-save"
            whileTap={{ scale: 0.95 }}
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold text-black bg-[#00E89D] flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Speichern
          </motion.button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 my-3 flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const ov = overview.find((x) => x.slug === t.slug);
          return (
            <motion.button
              key={t.slug}
              data-testid={`admin-legal-tab-${t.slug}`}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveSlug(t.slug)}
              className="rounded-full px-4 py-2 text-[11px] font-semibold flex items-center gap-1.5 flex-shrink-0"
              style={{
                background: activeSlug === t.slug ? `${t.color}15` : "rgba(255,255,255,0.03)",
                border: `1px solid ${activeSlug === t.slug ? t.color : "rgba(255,255,255,0.05)"}`,
                color: activeSlug === t.slug ? t.color : "rgba(255,255,255,0.55)",
              }}
            >
              <t.icon size={12} /> {t.label}
              {ov && <span className="text-[9px] opacity-70">· {ov.sections}</span>}
            </motion.button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin text-white/40" />
        </div>
      )}

      {!loading && doc && (
        <div className="px-5">
          {/* Title */}
          <div className="rounded-xl p-3 mb-3" style={{ background: `${currentMeta.color}08`, border: `1px solid ${currentMeta.color}30` }}>
            <p className="text-[9px] text-white/50 uppercase mb-1">Titel</p>
            <input
              data-testid="admin-legal-title"
              value={doc.title || ""}
              onChange={(e) => setDoc({ ...doc, title: e.target.value, _dirty: true })}
              className="w-full bg-transparent text-[15px] font-bold text-white outline-none"
            />
            {doc.last_updated && (
              <p className="text-[9px] text-white/40 mt-1">
                Zuletzt geändert: {new Date(doc.last_updated).toLocaleString("de-DE")}
              </p>
            )}
          </div>

          {/* Sections */}
          <AnimatePresence initial={false}>
            {(doc.content || []).map((section, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl p-3 mb-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                data-testid={`admin-legal-section-${i}`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-[9px] text-white/40 uppercase flex-1">Abschnitt {i + 1}</p>
                  <button data-testid={`section-up-${i}`} onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-white/40 hover:text-white disabled:opacity-20 p-1">
                    <ArrowUp size={12} />
                  </button>
                  <button data-testid={`section-down-${i}`} onClick={() => moveSection(i, 1)} disabled={i === doc.content.length - 1} className="text-white/40 hover:text-white disabled:opacity-20 p-1">
                    <ArrowDown size={12} />
                  </button>
                  <button data-testid={`section-remove-${i}`} onClick={() => removeSection(i)} className="text-red-400 hover:text-red-300 p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  data-testid={`section-heading-${i}`}
                  value={section.heading || ""}
                  onChange={(e) => updateSection(i, "heading", e.target.value)}
                  placeholder="Überschrift"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-bold text-white outline-none focus:border-[#00C2FF] mb-2"
                />
                <textarea
                  data-testid={`section-text-${i}`}
                  value={section.text || ""}
                  onChange={(e) => updateSection(i, "text", e.target.value)}
                  placeholder="Inhalt (Zeilenumbrüche erlaubt)"
                  rows={Math.max(4, Math.min(14, (section.text || "").split("\n").length + 1))}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#00C2FF] resize-none leading-relaxed"
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <motion.button
              data-testid="admin-legal-add-section"
              whileTap={{ scale: 0.96 }}
              onClick={addSection}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-[12px] font-bold text-white flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Abschnitt hinzufügen
            </motion.button>
            <motion.button
              data-testid="admin-legal-reset"
              whileTap={{ scale: 0.96 }}
              onClick={reset}
              disabled={saving}
              className="py-3 px-4 rounded-xl bg-white/5 border border-red-500/30 text-[12px] font-bold text-red-400 flex items-center gap-2"
            >
              <RotateCcw size={14} /> Reset
            </motion.button>
          </div>

          {/* Save footer */}
          <motion.button
            data-testid="admin-legal-save-footer"
            whileTap={{ scale: 0.98 }}
            onClick={save}
            disabled={saving || !doc._dirty}
            className="w-full mt-4 py-3.5 rounded-xl font-bold text-[13px] disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: doc._dirty ? "linear-gradient(90deg, #00E89D, #00C2FF)" : "rgba(255,255,255,0.05)",
              color: doc._dirty ? "#000" : "#888",
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {doc._dirty ? "Änderungen speichern" : "Keine Änderungen"}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

export default AdminLegalPage;
