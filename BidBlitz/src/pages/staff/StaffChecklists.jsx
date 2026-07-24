/**
 * Staff Mobile — Checklists Tab (IMG_1106 Connecteam-Style)
 * ==========================================================
 * Daily Checklist mit Text/Photo/Signature/Checkbox/Rating-Items.
 */
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardCheck, CheckCircle2, Loader2, Camera, X, Star, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./StaffShifts";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffChecklists() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTpl, setOpenTpl] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/checklists/me/templates`, { credentials: "include" });
      if (r.ok) setTemplates((await r.json()).templates || []);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div data-testid="staff-checklists-tab" className="px-5 pt-6 pb-2 space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">Checklists & Forms</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit">Daily Checks</h2>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00D4FF]" /></div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Keine Checklists"
          sub="Sobald dein Manager Checklisten erstellt, erscheinen sie hier."
        />
      ) : (
        templates.map((t) => (
          <button
            key={t.id} onClick={() => setOpenTpl(t)}
            data-testid={`staff-checklist-tile-${t.id}`}
            className={`w-full p-4 rounded-2xl border text-left ${
              t.completed_today
                ? "bg-[#10D981]/10 border-[#10D981]/30"
                : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: t.completed_today ? "rgba(16,217,129,0.18)" : "rgba(0,212,255,0.12)",
                         color: t.completed_today ? "#10D981" : "#00D4FF" }}>
                {t.completed_today ? <CheckCircle2 size={18} /> : <ClipboardCheck size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{t.title}</p>
                <p className="text-[11px] text-white/55 line-clamp-1">{t.description || `${t.items.length} Fragen`}</p>
                {t.completed_today && <p className="text-[10px] text-[#10D981] mt-0.5">Heute bereits abgegeben ✓</p>}
              </div>
            </div>
          </button>
        ))
      )}

      <AnimatePresence>
        {openTpl && (
          <ChecklistSubmitSheet
            template={openTpl}
            onClose={() => setOpenTpl(null)}
            onDone={() => { setOpenTpl(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChecklistSubmitSheet({ template, onClose, onDone }) {
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);

  const setAnswer = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));

  const submit = async () => {
    // Validate
    for (const it of template.items) {
      if (it.required && !answers[it.key]) {
        return toast.error(`Pflichtfeld fehlt: ${it.label}`);
      }
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/checklists/submissions`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          answers: Object.entries(answers).map(([key, value]) => ({ key, value })),
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "fail");
      }
      toast.success("Checkliste abgegeben ✓");
      onDone();
    } catch (e) { toast.error(e.message || "Fehler"); }
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center"
      onClick={onClose} data-testid="staff-checklist-sheet"
    >
      <motion.div
        initial={{ y: 240 }} animate={{ y: 0 }} exit={{ y: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] bg-[#0A0B10] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
      >
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">{template.items.length} Fragen</p>
            <p className="text-base font-bold">{template.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {template.items.map((it) => (
            <ChecklistField key={it.key} item={it} value={answers[it.key]} onChange={(v) => setAnswer(it.key, v)} />
          ))}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={submit} disabled={busy}
            data-testid="staff-checklist-submit"
            className="w-full h-12 rounded-2xl font-bold text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #00D4FF, #7E5BF6)" }}
          >
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Abgeben"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChecklistField({ item, value, onChange }) {
  const fileRef = useRef(null);
  const sigRef = useRef(null);

  if (item.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} data-testid={`field-${item.key}`} className="w-5 h-5 accent-[#00D4FF]" />
        <span className="text-sm flex-1">{item.label}{item.required && <span className="text-[#F31260] ml-0.5">*</span>}</span>
      </label>
    );
  }

  if (item.type === "rating") {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/45 mb-1.5 font-semibold">{item.label}{item.required && <span className="text-[#F31260] ml-0.5">*</span>}</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => onChange(n)} data-testid={`field-${item.key}-${n}`}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: value >= n ? "rgba(245,165,36,0.20)" : "rgba(255,255,255,0.04)",
                       color: value >= n ? "#F5A524" : "rgba(255,255,255,0.30)" }}>
              <Star size={20} fill={value >= n ? "#F5A524" : "transparent"} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (item.type === "photo") {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/45 mb-1.5 font-semibold">{item.label}{item.required && <span className="text-[#F31260] ml-0.5">*</span>}</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          data-testid={`field-${item.key}-input`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 4_000_000) return toast.error("Max 4 MB");
            const r = new FileReader();
            r.onload = () => onChange(r.result);
            r.readAsDataURL(f);
          }} />
        {value ? (
          <div className="relative">
            <img src={value} alt="" className="w-full rounded-2xl" />
            <button onClick={() => onChange("")} className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px]">Ändern</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            data-testid={`field-${item.key}`}
            className="w-full py-6 rounded-2xl border border-dashed border-white/15 flex flex-col items-center gap-1 text-white/55 hover:bg-white/[0.03]">
            <Camera size={22} /><span className="text-xs">Foto aufnehmen</span>
          </button>
        )}
      </div>
    );
  }

  if (item.type === "signature") {
    return <SignatureField label={item.label} required={item.required} value={value} onChange={onChange} testid={`field-${item.key}`} />;
  }

  // text default
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-white/45 mb-1.5 font-semibold">{item.label}{item.required && <span className="text-[#F31260] ml-0.5">*</span>}</p>
      <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)}
        placeholder={item.placeholder} data-testid={`field-${item.key}`}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm focus:border-[#00D4FF]/40 outline-none" />
    </div>
  );
}

function SignatureField({ label, required, value, onChange, testid }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(!!value);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = c.offsetWidth * 2; c.height = c.offsetHeight * 2;
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight);
      img.src = value;
    }
  }, [value]);

  const getPos = (e) => {
    const c = canvasRef.current; const r = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x, y };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const p = getPos(e); const ctx = canvasRef.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const p = getPos(e); const ctx = canvasRef.current.getContext("2d"); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasInk(true); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const c = canvasRef.current; const ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height); onChange(""); setHasInk(false); };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] uppercase tracking-widest text-white/45 font-semibold">
          {label}{required && <span className="text-[#F31260] ml-0.5">*</span>}
        </p>
        {hasInk && <button onClick={clear} className="text-[10px] text-[#F31260]">Löschen</button>}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        data-testid={testid}
        className="w-full h-36 rounded-2xl bg-white/[0.04] border border-dashed border-white/15 touch-none"
      />
      <p className="text-[10px] text-white/35 mt-1 flex items-center gap-1"><Edit3 size={10} />Hier unterschreiben</p>
    </div>
  );
}
