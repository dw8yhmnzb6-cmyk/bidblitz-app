/**
 * BidBlitz Staff — Knowledge Base Manager (Connecteam-Style)
 * ===========================================================
 * Manager: Artikel verwalten, Kategorien, Pin/Publish, Markdown-Inhalte.
 */
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Plus, Search, Pin, Eye, EyeOff, Edit3, Trash2, Loader2,
  Tag, X, Save, Calendar, BookText,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function KnowledgeBaseManager() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // article or { __new: true }

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filterCat) params.set("category", filterCat);
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/staff/knowledge/articles?${params}`, { credentials: "include" }),
        fetch(`${API}/api/staff/knowledge/categories`, { credentials: "include" }),
      ]);
      if (r1.ok) setArticles((await r1.json()).articles || []);
      if (r2.ok) setCategories((await r2.json()).categories || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [query, filterCat]);

  const togglePublished = async (a) => {
    const r = await fetch(`${API}/api/staff/knowledge/articles/${a.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !a.published }),
    });
    if (r.ok) { toast.success(a.published ? "Auf Entwurf gestellt" : "Veröffentlicht"); load(); }
    else toast.error("Fehler");
  };

  const togglePin = async (a) => {
    const r = await fetch(`${API}/api/staff/knowledge/articles/${a.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !a.pinned }),
    });
    if (r.ok) { toast.success(a.pinned ? "Pin entfernt" : "Angepinnt"); load(); }
    else toast.error("Fehler");
  };

  const remove = async (a) => {
    if (!window.confirm(`Artikel "${a.title}" wirklich löschen?`)) return;
    const r = await fetch(`${API}/api/staff/knowledge/articles/${a.id}`, {
      method: "DELETE", credentials: "include",
    });
    if (r.ok) { toast.success("Gelöscht"); load(); }
    else toast.error("Löschen fehlgeschlagen");
  };

  return (
    <div data-testid="kb-manager" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Wissens-Datenbank</p>
          <h2 className="text-xl font-bold mt-0.5 font-outfit flex items-center gap-2">
            <BookOpen size={20} className="text-[#00C2FF]" />
            Knowledge Base
          </h2>
          <p className="text-[11px] text-white/45 mt-0.5">Tutorials, Standards, Rezepte für dein Team.</p>
        </div>
        <button
          onClick={() => setEditing({ __new: true, title: "", content: "", category: "Allgemein", tags: [], pinned: false, published: true })}
          data-testid="kb-create-btn"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #00C2FF 0%, #A855F7 100%)", color: "#fff" }}
        >
          <Plus size={14} /> Neuer Artikel
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Titel, Inhalt, Tag…"
            data-testid="kb-search-input"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          data-testid="kb-category-filter"
          className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none"
        >
          <option value="">Alle Kategorien</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00C2FF]" /></div>
      ) : articles.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
          <BookText size={28} className="mx-auto text-white/30 mb-2" />
          <p className="text-sm font-semibold text-white/70">Noch keine Artikel</p>
          <p className="text-[11px] text-white/40 mt-1">Erstelle Tutorials, Standards & Rezepte für dein Team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {articles.map((a) => (
            <div
              key={a.id}
              data-testid={`kb-article-card-${a.id}`}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#00C2FF]/10 text-[#00C2FF] font-semibold uppercase tracking-wide">{a.category || "—"}</span>
                    {a.pinned && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-400/15 text-amber-400 font-semibold flex items-center gap-0.5"><Pin size={9} /> Angepinnt</span>}
                    {!a.published && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 font-semibold">Entwurf</span>}
                  </div>
                  <p className="text-sm font-bold mt-1.5 truncate">{a.title}</p>
                  <p className="text-[11px] text-white/45 mt-1 line-clamp-2 whitespace-pre-line">{(a.content || "").slice(0, 140)}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-white/35">
                    <span className="flex items-center gap-1"><Eye size={10} /> {a.view_count || 0}</span>
                    {a.tags?.length > 0 && (
                      <span className="flex items-center gap-1"><Tag size={10} /> {a.tags.slice(0, 3).join(", ")}</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(a.updated_at || a.created_at).toLocaleDateString("de-DE")}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <IconBtn onClick={() => setEditing(a)} testId={`kb-edit-${a.id}`} title="Bearbeiten"><Edit3 size={12} /></IconBtn>
                <IconBtn onClick={() => togglePin(a)} testId={`kb-pin-${a.id}`} title={a.pinned ? "Pin entfernen" : "Anpinnen"} color={a.pinned ? "#FBBF24" : undefined}><Pin size={12} /></IconBtn>
                <IconBtn onClick={() => togglePublished(a)} testId={`kb-publish-${a.id}`} title={a.published ? "Auf Entwurf" : "Veröffentlichen"}>
                  {a.published ? <Eye size={12} /> : <EyeOff size={12} />}
                </IconBtn>
                <IconBtn onClick={() => remove(a)} testId={`kb-delete-${a.id}`} title="Löschen" color="#F87171"><Trash2 size={12} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <ArticleEditor
            article={editing}
            categories={categories}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({ children, onClick, testId, title, color }) {
  return (
    <button
      onClick={onClick} title={title} data-testid={testId}
      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 transition-colors"
      style={color ? { color } : null}
    >
      {children}
    </button>
  );
}

function ArticleEditor({ article, categories, onClose, onSaved }) {
  const isNew = !!article.__new;
  const [form, setForm] = useState({
    title: article.title || "",
    content: article.content || "",
    category: article.category || "Allgemein",
    tags: article.tags || [],
    pinned: !!article.pinned,
    published: article.published !== false,
  });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput("");
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Titel und Inhalt sind Pflicht");
      return;
    }
    setSaving(true);
    try {
      const url = isNew
        ? `${API}/api/staff/knowledge/articles`
        : `${API}/api/staff/knowledge/articles/${article.id}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        toast.success(isNew ? "Artikel erstellt" : "Aktualisiert");
        onSaved();
      } else toast.error("Speichern fehlgeschlagen");
    } catch (e) { toast.error("Netzwerkfehler"); }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      data-testid="kb-editor-overlay"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-[#0A0A0A] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-outfit">
            {isNew ? "Neuer Artikel" : "Artikel bearbeiten"}
          </h3>
          <button onClick={onClose} data-testid="kb-editor-close" className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <Lbl>Titel *</Lbl>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          data-testid="kb-editor-title"
          placeholder="z.B. Wie macht man perfekten Espresso?"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Lbl>Kategorie</Lbl>
            <input
              list="kb-categories" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              data-testid="kb-editor-category"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
            />
            <datalist id="kb-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <Lbl>Tag hinzufügen</Lbl>
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Enter zum Hinzufügen"
                data-testid="kb-editor-tag-input"
                className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm outline-none focus:border-[#00C2FF]/40"
              />
              <button onClick={addTag} data-testid="kb-editor-tag-add" className="px-3 rounded-xl bg-white/[0.06] border border-white/10 text-xs">Add</button>
            </div>
          </div>
        </div>

        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map((t) => (
              <span key={t} className="text-[10px] px-2 py-1 rounded-md bg-[#A855F7]/15 text-[#A855F7] font-medium flex items-center gap-1">
                #{t}
                <button onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })} className="hover:text-white">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <Lbl>Inhalt * (Markdown unterstützt)</Lbl>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={10}
          data-testid="kb-editor-content"
          placeholder={"# Überschrift\n\n- Schritt 1\n- Schritt 2\n\n**Wichtig:** …"}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-mono resize-y outline-none focus:border-[#00C2FF]/40"
        />

        <div className="flex flex-wrap gap-3 pt-1">
          <ToggleChip on={form.pinned} onClick={() => setForm({ ...form, pinned: !form.pinned })} icon={Pin} label="Anpinnen" testId="kb-editor-pinned" />
          <ToggleChip on={form.published} onClick={() => setForm({ ...form, published: !form.published })} icon={Eye} label="Veröffentlicht" testId="kb-editor-published" />
        </div>

        <button
          onClick={save} disabled={saving}
          data-testid="kb-editor-save"
          className="w-full py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #00C2FF 0%, #A855F7 100%)" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={14} />}
          {isNew ? "Artikel erstellen" : "Änderungen speichern"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function Lbl({ children }) {
  return <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1">{children}</label>;
}

function ToggleChip({ on, onClick, icon: Icon, label, testId }) {
  return (
    <button
      onClick={onClick} data-testid={testId}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
        on ? "bg-[#00C2FF]/15 border-[#00C2FF]/40 text-[#00C2FF]" : "bg-white/[0.03] border-white/10 text-white/60"
      }`}
    >
      <Icon size={12} /> {label} {on ? "✓" : ""}
    </button>
  );
}
