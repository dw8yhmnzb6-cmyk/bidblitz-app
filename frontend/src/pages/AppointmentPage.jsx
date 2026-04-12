/**
 * BidBlitz V2 - Appointment Booking
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Scissors, Stethoscope, Sparkles, Dumbbell,
  Scale, Wrench, Hammer, Calendar, Clock, MapPin, Star, Users,
  Loader2, Check, X, Phone
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const BR_ICONS = { hair: Scissors, doctor: Stethoscope, beauty: Sparkles, fitness: Dumbbell, lawyer: Scale, car_repair: Wrench, handyman: Hammer };
const BR_COLORS = { hair: "#EC4899", doctor: "#3B82F6", beauty: "#A855F7", fitness: "#10B981", lawyer: "#F59E0B", car_repair: "#EF4444", handyman: "#06B6D4" };
const BR_LABELS = { hair: "Friseur", doctor: "Arzt", beauty: "Kosmetik", fitness: "Fitness", lawyer: "Anwalt", car_repair: "KFZ", handyman: "Handwerker" };

const AppointmentPage = ({ onBack }) => {
  const [view, setView] = useState("list");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [myApts, setMyApts] = useState([]);
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("10:00");
  const [aptService, setAptService] = useState("");
  const [aptNotes, setAptNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookResult, setBookResult] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/appointments/providers?branch=${branchFilter}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setProviders(d.providers || []); }
    } catch {}
    setLoading(false);
  }, [branchFilter]);

  const loadApts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/appointments/my-appointments`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyApts(d.appointments || []); }
    } catch {}
  }, []);

  useEffect(() => { load(); loadApts(); }, [load, loadApts]);

  const book = async () => {
    if (!aptDate || !aptTime || !selected) return;
    setBooking(true); setError("");
    try {
      const res = await fetch(`${API}/api/appointments/book`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: selected.provider_id, service: aptService, date: aptDate, time: aptTime, notes: aptNotes }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setBookResult(d.appointment); loadApts(); }
      else setError(d.detail || "Buchung fehlgeschlagen");
    } catch { setError("Netzwerkfehler"); }
    setBooking(false);
  };

  const cancelApt = async (id) => {
    if (!confirm("Termin stornieren?")) return;
    await fetch(`${API}/api/appointments/cancel/${id}`, { method: "POST", credentials: "include" });
    loadApts();
  };

  const timeSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="appointment-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <div><h1 className="text-[15px] font-bold">Termine buchen</h1><p className="text-[10px] text-gray-500">{providers.length} Anbieter</p></div>
          </div>
          <div className="flex gap-2">
            {["list", "appointments"].map(v => (
              <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => { setView(v); setSelected(null); setBookResult(null); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium ${view === v ? "bg-[#3B82F6] text-white" : "bg-white/5 text-gray-500"}`}
                data-testid={`apt-tab-${v}`}>{v === "list" ? "Anbieter" : "Meine Termine"}</motion.button>
            ))}
          </div>
        </div>
        {view === "list" && !selected && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setBranchFilter("")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${!branchFilter ? "bg-[#3B82F6] text-white" : "bg-white/5 text-gray-500"}`}>Alle</motion.button>
            {Object.entries(BR_LABELS).map(([id, label]) => {
              const Icon = BR_ICONS[id];
              return (
                <motion.button key={id} whileTap={{ scale: 0.95 }} onClick={() => setBranchFilter(id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap flex items-center gap-1 ${branchFilter === id ? "text-white" : "bg-white/5 text-gray-500"}`}
                  style={branchFilter === id ? { background: BR_COLORS[id] } : {}}><Icon size={10} /> {label}</motion.button>
              );
            })}
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#3B82F6]" /></div>}

      {/* Provider List */}
      {view === "list" && !loading && !selected && (
        <div className="p-4 space-y-3">
          {providers.length === 0 ? (
            <div className="text-center py-16"><Calendar size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Anbieter gefunden</p></div>
          ) : providers.map((p, i) => {
            const Icon = BR_ICONS[p.branch] || Calendar;
            const color = BR_COLORS[p.branch] || "#666";
            return (
              <motion.div key={p.provider_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => { setSelected(p); setBookResult(null); setError(""); setAptService(p.services?.[0] || ""); }}
                className="bg-[#111118] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                data-testid={`provider-${p.provider_id}`}>
                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-32 object-cover" />}
                <div className="p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}><Icon size={14} style={{ color }} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate">{p.name}</p>
                      <p className="text-[9px] text-gray-500">{BR_LABELS[p.branch]} — {p.city}</p>
                    </div>
                    {p.rating > 0 && <div className="flex items-center gap-0.5"><Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" /><span className="text-[10px] text-[#F59E0B]">{p.rating}</span></div>}
                  </div>
                  {p.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.services.slice(0, 4).map(s => <span key={s} className="px-2 py-0.5 rounded-lg bg-white/5 text-[8px] text-gray-400">{s}</span>)}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Provider Detail + Book */}
      {selected && !bookResult && (
        <div className="p-4 space-y-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium"><ArrowLeft size={14} /> Zurück</motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
            <h2 className="text-base font-bold mb-1">{selected.name}</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
              <span className="flex items-center gap-1"><MapPin size={11} /> {selected.city}</span>
              {selected.phone && <span className="flex items-center gap-1"><Phone size={11} /> {selected.phone}</span>}
              <span className="flex items-center gap-1"><Clock size={11} /> {selected.opening_hours}</span>
            </div>
            <p className="text-[11px] text-gray-500">{selected.description}</p>
          </div>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Termin buchen</h3>
            {selected.services?.length > 0 && (
              <div>
                <label className="text-[9px] text-gray-500 mb-1 block">Service</label>
                <div className="flex flex-wrap gap-1.5">
                  {selected.services.map(s => (
                    <motion.button key={s} whileTap={{ scale: 0.9 }} onClick={() => setAptService(s)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium ${aptService === s ? "bg-[#3B82F6] text-white" : "bg-white/5 text-gray-400"}`}>{s}</motion.button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Datum</label>
              <input type="date" value={aptDate} onChange={e => setAptDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="apt-date" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Uhrzeit</label>
              <div className="grid grid-cols-5 gap-1.5">
                {timeSlots.map(t => (
                  <motion.button key={t} whileTap={{ scale: 0.9 }} onClick={() => setAptTime(t)}
                    className={`py-2 rounded-lg text-[10px] font-medium ${aptTime === t ? "bg-[#3B82F6] text-white" : "bg-white/5 text-gray-400"}`}>{t}</motion.button>
                ))}
              </div>
            </div>
            <input type="text" value={aptNotes} onChange={e => setAptNotes(e.target.value)} placeholder="Notizen (optional)"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] outline-none text-gray-300 placeholder-gray-600" data-testid="apt-notes" />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={book} disabled={!aptDate || !aptTime || booking}
              className="w-full py-3.5 rounded-xl bg-[#3B82F6] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              data-testid="apt-book-btn">{booking ? <Loader2 size={18} className="animate-spin" /> : <><Calendar size={16} /> Termin buchen</>}</motion.button>
          </div>
        </div>
      )}

      {/* Booking Success */}
      {bookResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#10B981]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-[#10B981]" /></div>
            <h3 className="text-lg font-bold mb-1">Termin bestätigt!</h3>
            <p className="text-sm text-gray-400">{bookResult.provider_name}</p>
            <div className="flex items-center justify-center gap-3 text-xs text-gray-500 mt-2">
              <span>{bookResult.date}</span><span>{bookResult.time}</span>
            </div>
            {bookResult.service && <p className="text-[10px] text-gray-500 mt-1">{bookResult.service}</p>}
            <p className="text-[9px] text-gray-600 mt-2 font-mono">{bookResult.reference}</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelected(null); setBookResult(null); setView("appointments"); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm" data-testid="apt-goto-list">Meine Termine</motion.button>
          </div>
        </div>
      )}

      {/* My Appointments */}
      {view === "appointments" && (
        <div className="p-4 space-y-3">
          {myApts.length === 0 ? (
            <div className="text-center py-16"><Calendar size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Termine</p></div>
          ) : myApts.map((a, i) => {
            const color = BR_COLORS[a.provider_branch] || "#666";
            return (
              <motion.div key={a.appointment_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-[#111118] rounded-2xl border border-white/5 p-3.5" data-testid={`apt-${a.appointment_id}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <div><p className="text-[12px] font-bold">{a.provider_name}</p><p className="text-[10px] text-gray-500">{a.service || BR_LABELS[a.provider_branch]}</p></div>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${a.status === "confirmed" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {a.status === "confirmed" ? "Bestätigt" : "Storniert"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><Calendar size={10} /> {a.date}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {a.time}</span>
                </div>
                {a.status === "confirmed" && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => cancelApt(a.appointment_id)}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium">Stornieren</motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppointmentPage;
