import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, Trash2, Edit3, Eye, EyeOff, Save, Loader2, X, MapPin } from "lucide-react";
import { adminApi, Skeleton } from "./adminHelpers";

const IND_OPTIONS = [
  { value: "gastro", label: "Gastronomie", color: "#FF6B6B" },
  { value: "retail", label: "Einzelhandel", color: "#00E89D" },
  { value: "service", label: "Dienstleistung", color: "#A855F7" },
  { value: "fitness", label: "Fitness", color: "#FFB800" },
  { value: "fuel", label: "Tankstelle", color: "#00C2FF" },
  { value: "bakery", label: "Bäckerei", color: "#EC4899" },
];

const EMPTY = {
  business_name: "", owner_name: "", role: "", industry: "retail",
  location: "", quote: "", photo_url: "", logo_url: "",
  rating: 5, is_pilot: true, active: true, sort_order: 100, stats: {},
};

export default function AdminTestimonialsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // testimonial_id or 'new' or null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminApi("/api/testimonials/admin/list");
      setItems(d.testimonials || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setForm(EMPTY); setEditing("new"); setError(""); };
  const startEdit = (tm) => { setForm({ ...tm }); setEditing(tm.testimonial_id); setError(""); };
  const cancel = () => { setEditing(null); setForm(EMPTY); setError(""); };

  const save = async () => {
    if (form.quote.length < 20) { setError("Zitat zu kurz (min. 20 Zeichen)"); return; }
    setSaving(true); setError("");
    try {
      if (editing === "new") {
        await adminApi("/api/testimonials/admin/create", { method: "POST", body: JSON.stringify(form) });
      } else {
        await adminApi(`/api/testimonials/admin/${editing}`, { method: "PUT", body: JSON.stringify(form) });
      }
      cancel(); load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm("Testimonial wirklich löschen?")) return;
    try { await adminApi(`/api/testimonials/admin/${id}`, { method: "DELETE" }); load(); }
    catch (e) { setError(e.message); }
  };

  const toggleActive = async (tm) => {
    try { await adminApi(`/api/testimonials/admin/${tm.testimonial_id}`, { method: "PUT", body: JSON.stringify({ active: !tm.active }) }); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="admin-testimonials-tab">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-[#FFB800]" />
          <p className="text-[10px] text-[#444] uppercase tracking-[0.12em] font-semibold">
            Händler-Testimonials ({items.length}, {items.filter(t => t.active).length} aktiv)
          </p>
        </div>
        <motion.button data-testid="testimonial-new-btn" whileTap={{ scale: 0.95 }} onClick={startNew}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15">
          <Plus size={11} /> Neu
        </motion.button>
      </div>

      {error && <p className="text-[10px] text-red-400 mb-2 px-3 py-1.5 rounded bg-red-500/5 border border-red-500/15">{error}</p>}

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl mb-3" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.15)" }}>
            <div className="p-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Firmenname *" testId="tm-business" value={form.business_name} onChange={v => setForm(f => ({ ...f, business_name: v }))} />
                <Field label="Standort" testId="tm-location" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Inhaber-Name" testId="tm-owner" value={form.owner_name} onChange={v => setForm(f => ({ ...f, owner_name: v }))} />
                <Field label="Rolle" testId="tm-role" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#444] block mb-1">Branche</label>
                  <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none cursor-pointer"
                    data-testid="tm-industry">
                    {IND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-[#444] block mb-1">Bewertung (1-5)</label>
                  <input type="number" min="1" max="5" value={form.rating}
                    onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) || 5 }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none"
                    data-testid="tm-rating" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-[#444] block mb-1">Zitat * ({form.quote.length}/400)</label>
                <textarea rows={4} value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value.slice(0, 400) }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none resize-none"
                  placeholder="Das sagt der Kunde über BidBlitz..."
                  data-testid="tm-quote" />
              </div>
              <Field label="Foto-URL (optional)" testId="tm-photo" value={form.photo_url} onChange={v => setForm(f => ({ ...f, photo_url: v }))}
                placeholder="https://..." mono />
              <div className="grid grid-cols-3 gap-2">
                <ToggleField label="Pilot-Badge" checked={form.is_pilot} onToggle={() => setForm(f => ({ ...f, is_pilot: !f.is_pilot }))} testId="tm-pilot" />
                <ToggleField label="Aktiv/Sichtbar" checked={form.active} onToggle={() => setForm(f => ({ ...f, active: !f.active }))} testId="tm-active" />
                <div>
                  <label className="text-[9px] text-[#444] block mb-1">Sortierung</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <motion.button data-testid="tm-save" whileTap={{ scale: 0.97 }} disabled={saving}
                  onClick={save}
                  className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} /> Speichern</>}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={cancel}
                  className="px-4 py-2.5 rounded-xl text-[11px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]">
                  Abbrechen
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Star size={40} className="mx-auto text-[#333] mb-3" />
          <p className="text-[12px] text-[#555]">Noch keine Testimonials</p>
          <p className="text-[10px] text-[#333] mt-1">Klicke "Neu" um das erste hinzuzufügen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(tm => {
            const ind = IND_OPTIONS.find(o => o.value === tm.industry) || IND_OPTIONS[1];
            return (
              <motion.div key={tm.testimonial_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.018)", border: `1px solid ${tm.active ? "rgba(255,255,255,0.04)" : "rgba(255,71,87,0.15)"}`, opacity: tm.active ? 1 : 0.5 }}
                data-testid={`tm-row-${tm.testimonial_id}`}>
                <div className="flex items-start gap-3">
                  {tm.photo_url ? (
                    <img src={tm.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" onError={e => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0" style={{ background: `${ind.color}15`, color: ind.color }}>
                      {(tm.business_name || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12px] font-bold text-white/85">{tm.business_name}</p>
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: `${ind.color}15`, color: ind.color }}>
                        {ind.label}
                      </span>
                      {tm.is_pilot && <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 uppercase font-bold">Pilot</span>}
                      {Array.from({ length: tm.rating || 5 }).map((_, i) => <Star key={i} size={9} className="fill-yellow-400 text-yellow-400" />)}
                    </div>
                    <p className="text-[10px] text-[#555] mt-0.5">
                      {tm.owner_name}{tm.role && ` · ${tm.role}`}
                      {tm.location && <> · <MapPin size={8} className="inline" /> {tm.location}</>}
                    </p>
                    <p className="text-[11px] text-white/55 mt-1.5 line-clamp-2">"{tm.quote}"</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleActive(tm)}
                      className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]" data-testid={`tm-toggle-${tm.testimonial_id}`}>
                      {tm.active ? <Eye size={11} className="text-[#00E89D]" /> : <EyeOff size={11} className="text-[#555]" />}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => startEdit(tm)}
                      className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]" data-testid={`tm-edit-${tm.testimonial_id}`}>
                      <Edit3 size={11} className="text-[#00C2FF]" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => del(tm.testimonial_id)}
                      className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]" data-testid={`tm-delete-${tm.testimonial_id}`}>
                      <Trash2 size={11} className="text-[#FF6B6B]" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

const Field = ({ label, value, onChange, testId, placeholder, mono }) => (
  <div>
    <label className="text-[9px] text-[#444] block mb-1">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 placeholder-[#333] outline-none ${mono ? "font-mono" : ""}`}
      data-testid={testId} />
  </div>
);

const ToggleField = ({ label, checked, onToggle, testId }) => (
  <div>
    <label className="text-[9px] text-[#444] block mb-1">{label}</label>
    <motion.button whileTap={{ scale: 0.95 }} onClick={onToggle} data-testid={testId}
      className="w-full py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1"
      style={{
        background: checked ? "rgba(0,232,157,0.12)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${checked ? "rgba(0,232,157,0.3)" : "rgba(255,255,255,0.05)"}`,
        color: checked ? "#00E89D" : "#555",
      }}>
      {checked ? "Ein" : "Aus"}
    </motion.button>
  </div>
);
