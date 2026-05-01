import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, Video, Stethoscope, Brain, Bone, Heart, Baby, Activity,
  Calendar, CheckCircle, FileText, X, Loader2, Pill
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const SP_ICONS = { allgemeinmedizin: Activity, dermatologie: Heart, psychologie: Brain, orthopaedie: Bone, kinderheilkunde: Baby, innere: Stethoscope };
const SP_COLORS = { allgemeinmedizin: "#3B82F6", dermatologie: "#A855F7", psychologie: "#10B981", orthopaedie: "#F59E0B", kinderheilkunde: "#EC4899", innere: "#06B6D4" };

export default function TelemedizinPage({ onBack }) {
  const [view, setView] = useState("doctors"); // doctors | appointments | prescriptions
  const [doctors, setDoctors] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [specFilter, setSpecFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [booked, setBooked] = useState(null);
  const [slots, setSlots] = useState([]);
  const [appts, setAppts] = useState([]);
  const [rx, setRx] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const p = specFilter ? `?specialty=${specFilter}` : "";
      const [r1, r2] = await Promise.all([
        fetch(`${API}/api/telemedizin/doctors${p}`),
        fetch(`${API}/api/telemedizin/specialties`),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setDoctors(d1.doctors || []);
      setSpecs(d2.specialties || []);
    } catch { /* noop */ }
    setLoading(false);
  }, [specFilter]);

  const loadAppts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/telemedizin/my-appointments`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setAppts(d.appointments || []); }
    } catch { /* noop */ }
  }, []);

  const loadRx = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/telemedizin/my-prescriptions`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setRx(d.prescriptions || []); }
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadDoctors(); loadAppts(); loadRx(); }, [loadDoctors, loadAppts, loadRx]);

  const loadSlots = async (doctorId, d) => {
    if (!doctorId || !d) { setSlots([]); return; }
    try {
      const r = await fetch(`${API}/api/telemedizin/slots/${doctorId}?date=${d}`);
      if (r.ok) { const j = await r.json(); setSlots(j.slots || []); }
    } catch { setSlots([]); }
  };

  useEffect(() => { if (selected && date) loadSlots(selected.doctor_id, date); }, [selected, date]);

  const book = async () => {
    if (!selected || !date || !time) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/telemedizin/appointment`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: selected.doctor_id, date, time, reason }),
      });
      if (r.ok) { const d = await r.json(); setBooked(d.appointment); loadAppts(); }
    } catch { /* noop */ }
    setBusy(false);
  };

  const cancel = async (id) => {
    if (!confirm("Termin stornieren?")) return;
    const r = await fetch(`${API}/api/telemedizin/cancel/${id}`, { method: "POST", credentials: "include" });
    if (r.ok) loadAppts();
  };

  // ---- Booked confirmation ----
  if (booked) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary,#030303)" }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl p-6 text-center max-w-sm w-full"
        style={{ background: "var(--bg-card,#111)", border: "1px solid rgba(16,185,129,0.3)" }}>
        <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
        <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary,#fff)" }}>Termin bestätigt!</h2>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary,#aaa)" }}>{booked.doctor_name}<br />{booked.date} um {booked.time}</p>
        <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(0,194,255,0.1)" }}>
          <Video size={20} className="mx-auto mb-1" style={{ color: "#00C2FF" }} />
          <p className="text-xs" style={{ color: "#00C2FF" }}>Video-Link wird per E-Mail gesendet</p>
        </div>
        <button onClick={() => { setBooked(null); setSelected(null); setView("appointments"); }}
          className="w-full py-3 rounded-xl font-semibold text-sm text-black"
          style={{ background: "#00C2FF" }} data-testid="tm-done">
          Meine Termine
        </button>
      </motion.div>
    </div>
  );

  // ---- Booking detail view ----
  if (selected) {
    const d = selected;
    const color = SP_COLORS[d.specialty] || "#00C2FF";
    return (
      <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary,#030303)" }}>
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card,#111)" }} data-testid="tm-back2">
            <ArrowLeft size={20} style={{ color: "var(--text-primary,#fff)" }} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary,#fff)" }}>Termin buchen</h1>
        </div>
        <div className="px-4 space-y-4">
          <div className="flex items-center gap-4">
            <img src={d.avatar} alt={d.name} className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary,#fff)" }}>{d.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs" style={{ color: "var(--text-primary,#fff)" }}>{d.rating}</span>
                <span className="text-xs" style={{ color: "var(--text-secondary,#888)" }}>({d.reviews})</span>
              </div>
              <div className="text-xs mt-1" style={{ color }}>Nächster Termin: {d.next_slot}</div>
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary,#aaa)" }}>{d.description}</p>
          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--bg-card,#111)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary,#fff)" }}>Videosprechstunde</span>
            <span className="text-sm font-bold" style={{ color: "#00C2FF" }}>{d.price_consultation}€</span>
          </div>
          <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => { setDate(e.target.value); setTime(""); }}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--bg-card,#111)", color: "var(--text-primary,#fff)", border: "1px solid rgba(255,255,255,0.1)" }} data-testid="tm-date" />

          {date && (
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary,#888)" }}>Verfügbare Slots</p>
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map(s => (
                  <button key={s.time} onClick={() => s.available && setTime(s.time)} disabled={!s.available}
                    className="py-2 rounded-lg text-[11px] font-semibold disabled:opacity-25"
                    style={{
                      background: time === s.time ? "#00C2FF" : "var(--bg-card,#111)",
                      color: time === s.time ? "#000" : (s.available ? "var(--text-primary,#fff)" : "var(--text-secondary,#666)"),
                    }}
                    data-testid={`tm-slot-${s.time}`}>{s.time}</button>
                ))}
              </div>
            </div>
          )}

          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Grund des Besuchs (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm resize-none" rows={2}
            style={{ background: "var(--bg-card,#111)", color: "var(--text-primary,#fff)", border: "1px solid rgba(255,255,255,0.1)" }} data-testid="tm-reason" />
          <button onClick={book} disabled={busy || !date || !time}
            className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2 disabled:opacity-30"
            style={{ background: "#00C2FF" }} data-testid="tm-book">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <><Video size={16} />Buchen — {d.price_consultation}€</>}
          </button>
        </div>
      </div>
    );
  }

  // ---- Tab views ----
  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary,#030303)" }}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "var(--bg-primary,#030303)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card,#111)" }} data-testid="tm-back">
            <ArrowLeft size={20} style={{ color: "var(--text-primary,#fff)" }} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary,#fff)" }}>Telemedizin</h1>
        </div>
        <div className="flex gap-2 mb-3">
          {[
            { id: "doctors", label: "Ärzte" },
            { id: "appointments", label: `Termine (${appts.length})` },
            { id: "prescriptions", label: `Rezepte (${rx.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: view === t.id ? "#00C2FF" : "var(--bg-card,#111)", color: view === t.id ? "#000" : "var(--text-secondary,#aaa)" }}
              data-testid={`tm-tab-${t.id}`}>{t.label}</button>
          ))}
        </div>
        {view === "doctors" && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button onClick={() => setSpecFilter("")}
              className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0"
              style={{ background: !specFilter ? "#00C2FF" : "var(--bg-card,#111)", color: !specFilter ? "#000" : "var(--text-secondary,#aaa)" }}
              data-testid="tm-spec-all">Alle</button>
            {specs.map(s => (
              <button key={s.id} onClick={() => setSpecFilter(s.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0"
                style={{ background: specFilter === s.id ? (s.color || "#00C2FF") : "var(--bg-card,#111)", color: specFilter === s.id ? "#fff" : "var(--text-secondary,#aaa)" }}
                data-testid={`tm-spec-${s.id}`}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 space-y-3">
        {view === "doctors" && (loading ? (
          <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin" style={{ color: "#00C2FF" }} /></div>
        ) : doctors.map(d => {
          const color = SP_COLORS[d.specialty] || "#00C2FF";
          return (
            <motion.div key={d.doctor_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 cursor-pointer"
              style={{ background: "var(--bg-card,#111)", border: "1px solid rgba(255,255,255,0.05)" }}
              onClick={() => setSelected(d)} data-testid={`tm-doc-${d.doctor_id}`}>
              <div className="flex items-start gap-3">
                <img src={d.avatar} alt={d.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary,#fff)" }}>{d.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs" style={{ color: "var(--text-primary,#fff)" }}>{d.rating}</span>
                    <span className="text-xs" style={{ color: "var(--text-secondary,#888)" }}>({d.reviews})</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color }}>Nächster Termin: {d.next_slot}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold" style={{ color: "#00C2FF" }}>{d.price_consultation}€</div>
                  <div className="text-[10px]" style={{ color: "var(--text-secondary,#888)" }}>Video</div>
                </div>
              </div>
            </motion.div>
          );
        }))}

        {view === "appointments" && (appts.length === 0 ? (
          <div className="text-center py-16"><Calendar size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm" style={{ color: "var(--text-secondary,#888)" }}>Keine Termine</p></div>
        ) : appts.map(a => (
          <motion.div key={a.appointment_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4" style={{ background: "var(--bg-card,#111)", border: "1px solid rgba(255,255,255,0.05)" }}
            data-testid={`tm-appt-${a.appointment_id}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary,#fff)" }}>{a.doctor_name}</p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary,#888)" }}>{a.specialty} · {a.date} um {a.time}</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded font-medium"
                style={{ background: a.status === "confirmed" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: a.status === "confirmed" ? "#10B981" : "#EF4444" }}>
                {a.status === "confirmed" ? "Bestätigt" : "Storniert"}
              </span>
            </div>
            {a.reason && <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary,#888)" }}>Grund: {a.reason}</p>}
            <div className="flex items-center gap-2 mt-3">
              {a.status === "confirmed" && a.video_link && (
                <a href={a.video_link} target="_blank" rel="noreferrer"
                  className="flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold text-center text-black"
                  style={{ background: "#00C2FF" }} data-testid={`tm-join-${a.appointment_id}`}>
                  <Video size={12} className="inline mr-1" /> Beitreten
                </a>
              )}
              {a.status === "confirmed" && (
                <button onClick={() => cancel(a.appointment_id)}
                  className="px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
                  data-testid={`tm-cancel-${a.appointment_id}`}>
                  <X size={12} /> Stornieren
                </button>
              )}
            </div>
          </motion.div>
        )))}

        {view === "prescriptions" && (rx.length === 0 ? (
          <div className="text-center py-16"><FileText size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm" style={{ color: "var(--text-secondary,#888)" }}>Keine Rezepte</p></div>
        ) : rx.map(r => (
          <motion.div key={r.prescription_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4" style={{ background: "var(--bg-card,#111)", border: "1px solid rgba(168,85,247,0.2)" }}
            data-testid={`tm-rx-${r.prescription_id}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary,#fff)" }}>{r.diagnosis || "Rezept"}</p>
                <p className="text-[10px]" style={{ color: "var(--text-secondary,#888)" }}>{r.doctor_name} · {(r.issued_at || "").slice(0, 10)}</p>
              </div>
              <span className="text-[9px] font-mono" style={{ color: "#A855F7" }}>{r.code}</span>
            </div>
            <div className="space-y-1.5 mt-2">
              {(r.medications || []).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-primary,#fff)" }}>
                  <Pill size={11} style={{ color: "#A855F7" }} />
                  <span className="font-semibold">{m.name}</span>
                  {m.dosage && <span style={{ color: "var(--text-secondary,#888)" }}>· {m.dosage}</span>}
                  {m.frequency && <span style={{ color: "var(--text-secondary,#888)" }}>· {m.frequency}</span>}
                </div>
              ))}
            </div>
            {r.notes && <p className="text-[10px] mt-2" style={{ color: "var(--text-secondary,#888)" }}>{r.notes}</p>}
          </motion.div>
        )))}
      </div>
    </div>
  );
}
