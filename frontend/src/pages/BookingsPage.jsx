/**
 * BookingsPage V2 — Termine buchen mit Datum, Slots, Provider-Admin.
 * - Tab: Anbieter | Meine Termine | Mein Business (wenn Provider Owner)
 * - Flow: Provider → Service → Datum (7 Tage vorwärts) → freie Slots → Buchung
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarCheck, Star, Clock, Loader2, ChevronRight, Check,
  Settings, User, Phone, FileText, X, Calendar as CalendarIcon,
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

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const fmtDate = (d) => `${WEEKDAYS_DE[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${MONTHS_DE[d.getMonth()]}`;
const isoDate = (d) => d.toISOString().slice(0, 10);
const nextDays = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); return d;
});

// ── Provider detail + booking flow ──
const ProviderFlow = ({ provider, onDone, onBack }) => {
  const [service, setService] = useState(null);
  const [date, setDate] = useState(isoDate(new Date()));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", notes: "" });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!service) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    api(`/api/bookings/providers/${provider.id}/slots?date=${date}&service_id=${service.service_id}`)
      .then((d) => setSlots(d.slots || []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingSlots(false));
  }, [service, date, provider.id]);

  const book = async () => {
    if (!service || !selectedSlot) return;
    setBooking(true);
    try {
      const res = await api("/api/bookings/book", {
        method: "POST",
        body: JSON.stringify({
          provider_id: provider.id,
          service_id: service.service_id,
          date,
          time: selectedSlot,
          ...form,
        }),
      });
      toast.success(res.message || "Termin gebucht!");
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBooking(false);
    }
  };

  const days = nextDays(14);

  return (
    <div className="space-y-4">
      {/* Provider header */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: `${provider.color}10`, border: `1px solid ${provider.color}30` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black"
          style={{ background: provider.color + "30", color: provider.color }}>
          {provider.name.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-bold text-white">{provider.name}</p>
          <p className="text-[10px] text-white/50">{provider.type} · {provider.city}</p>
        </div>
        <span className="text-[10px] text-yellow-400 flex items-center gap-1">
          <Star size={10} fill="currentColor" /> {provider.rating}
        </span>
      </div>

      {/* Step 1: Service */}
      <div>
        <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mb-2">1. Service wählen</p>
        <div className="space-y-2">
          {(provider.services || []).map((s) => (
            <motion.button
              key={s.service_id}
              data-testid={`service-${s.service_id}`}
              whileTap={{ scale: 0.98 }}
              onClick={() => setService(s)}
              className="w-full rounded-xl p-3 flex items-center justify-between text-left"
              style={{
                background: service?.service_id === s.service_id ? `${provider.color}15` : "rgba(255,255,255,0.03)",
                border: `1px solid ${service?.service_id === s.service_id ? provider.color : "rgba(255,255,255,0.05)"}`,
              }}
            >
              <div>
                <p className="text-[13px] font-bold text-white">{s.name}</p>
                <p className="text-[10px] text-white/50 flex items-center gap-1">
                  <Clock size={10} /> {s.duration} Min · {s.price === 0 ? "Kostenlos" : `${s.price}€`}
                </p>
              </div>
              {service?.service_id === s.service_id && <Check size={16} style={{ color: provider.color }} />}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Step 2: Date */}
      {service && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mb-2">2. Datum wählen</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {days.map((d) => {
              const iso = isoDate(d);
              const active = iso === date;
              const isToday = iso === isoDate(new Date());
              return (
                <motion.button
                  key={iso}
                  data-testid={`date-${iso}`}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setDate(iso)}
                  className="flex-shrink-0 rounded-xl p-2.5 text-center w-[60px]"
                  style={{
                    background: active ? provider.color : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? provider.color : "rgba(255,255,255,0.05)"}`,
                    color: active ? "#000" : "#fff",
                  }}
                >
                  <p className="text-[9px] opacity-70 uppercase">{WEEKDAYS_DE[(d.getDay() + 6) % 7]}</p>
                  <p className="text-[16px] font-bold mt-0.5">{d.getDate()}</p>
                  <p className="text-[8px] opacity-60 uppercase">
                    {isToday ? "heute" : MONTHS_DE[d.getMonth()]}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Step 3: Slots */}
      {service && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mb-2">3. Uhrzeit wählen</p>
          {loadingSlots ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/40" /></div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl p-4 bg-red-500/5 border border-red-500/20 text-[11px] text-red-300 text-center">
              Keine freien Slots an diesem Tag. Wähle ein anderes Datum.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((t) => (
                <motion.button
                  key={t}
                  data-testid={`slot-${t}`}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSelectedSlot(t)}
                  className="rounded-lg py-2 text-[12px] font-semibold"
                  style={{
                    background: selectedSlot === t ? provider.color : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedSlot === t ? provider.color : "rgba(255,255,255,0.06)"}`,
                    color: selectedSlot === t ? "#000" : "#fff",
                  }}
                >
                  {t}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Step 4: Form */}
      {selectedSlot && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold mb-2">4. Deine Daten</p>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              data-testid="book-name"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="Name"
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF]"
            />
          </div>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              data-testid="book-phone"
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              placeholder="Telefon (optional)"
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF]"
            />
          </div>
          <div className="relative">
            <FileText size={14} className="absolute left-3 top-3 text-white/40" />
            <textarea
              data-testid="book-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notizen für den Anbieter (optional)"
              rows={2}
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-[12px] text-white outline-none focus:border-[#00C2FF] resize-none"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl p-3 mt-3 bg-white/5 border border-white/10">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-white/60">{service.name}</span>
              <span className="text-white">{service.duration} Min</span>
            </div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-white/60">Datum</span>
              <span className="text-white">{date}</span>
            </div>
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-white/60">Uhrzeit</span>
              <span className="text-white font-bold">{selectedSlot}</span>
            </div>
            <div className="flex justify-between text-[14px] pt-2 border-t border-white/10">
              <span className="text-white font-bold">Total</span>
              <span className="text-[#00E89D] font-bold">{service.price === 0 ? "Gratis" : `${service.price}€`}</span>
            </div>
          </div>

          <motion.button
            data-testid="book-confirm"
            whileTap={{ scale: 0.98 }}
            onClick={book}
            disabled={booking}
            className="w-full py-3.5 rounded-xl font-bold text-[13px] mt-3"
            style={{ background: provider.color, color: "#000" }}
          >
            {booking ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Termin verbindlich buchen"}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

// ── Main page ──
export default function BookingsPage({ onBack, onNavigate }) {
  const [providers, setProviders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [myProviders, setMyProviders] = useState([]);
  const [tab, setTab] = useState("browse");
  const [sel, setSel] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [p, a, mp] = await Promise.all([
        api("/api/bookings/providers"),
        api("/api/bookings/my-appointments").catch(() => ({ appointments: [] })),
        api("/api/provider/my-providers").catch(() => ({ providers: [] })),
      ]);
      setProviders(p.providers || []);
      setAppointments(a.appointments || []);
      setMyProviders(mp.providers || []);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const cancel = async (id) => {
    if (!window.confirm("Termin wirklich stornieren?")) return;
    try {
      await api(`/api/bookings/cancel/${id}`, { method: "POST" });
      toast.success("Storniert.");
      loadAll();
    } catch (e) { toast.error(e.message); }
  };

  const hasBusiness = myProviders.length > 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="bookings-page">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            data-testid="bookings-back"
            onClick={sel ? () => setSel(null) : onBack}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold flex items-center gap-2">
              <CalendarCheck size={18} className="text-[#00C2FF]" />
              {sel ? sel.name : "Termine buchen"}
            </h1>
            <p className="text-[10px] text-[#00C2FF]">
              {sel ? sel.type : "Friseur, Arzt, Wellness & mehr"}
            </p>
          </div>
        </div>

        {!sel && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {[
              { id: "browse", label: "Anbieter" },
              { id: "my", label: `Meine Termine${appointments.length ? ` (${appointments.length})` : ""}` },
              ...(hasBusiness ? [{ id: "business", label: "Mein Business" }] : []),
            ].map((t) => (
              <button
                key={t.id}
                data-testid={`bookings-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap ${
                  tab === t.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-white/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {sel ? (
            <motion.div key="flow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProviderFlow
                provider={sel}
                onDone={() => { setSel(null); loadAll(); }}
                onBack={() => setSel(null)}
              />
            </motion.div>
          ) : tab === "browse" ? (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {providers.map((p, i) => (
                <motion.button
                  key={p.id}
                  data-testid={`provider-${p.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => api(`/api/bookings/providers/${p.id}`).then(setSel).catch((e) => toast.error(e.message))}
                  className="w-full rounded-2xl p-4 bg-white/[0.03] border border-white/5 flex items-center gap-3 text-left"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-black"
                    style={{ background: p.color + "20", color: p.color }}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold">{p.name}</p>
                    <p className="text-[10px] text-white/50">{p.type} · {p.city}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-yellow-400 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" /> {p.rating}
                      </span>
                      <span className="text-[9px] text-white/40">{p.reviews} Bewertungen</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-white/30" />
                </motion.button>
              ))}
            </motion.div>
          ) : tab === "my" ? (
            <motion.div key="my" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {appointments.length === 0 && (
                <p className="text-center text-white/40 py-12 text-[12px]">Noch keine Termine</p>
              )}
              {appointments.map((a) => (
                <div
                  key={a.appointment_id}
                  data-testid={`appt-${a.appointment_id}`}
                  className="rounded-xl p-3 bg-white/[0.03] border border-white/5"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold truncate">{a.service_name}</p>
                      <p className="text-[10px] text-white/50 truncate">{a.provider_name}</p>
                      <p className="text-[10px] text-[#00C2FF] mt-1">
                        📅 {a.date} · ⏰ {a.time} · {a.duration_min}min
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-[13px] font-bold text-[#00E89D]">{a.price === 0 ? "Gratis" : `${a.price}€`}</p>
                      <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        a.status === "confirmed" ? "bg-green-500/15 text-green-400" :
                        a.status === "cancelled" ? "bg-red-500/15 text-red-400" :
                        "bg-white/10 text-white/70"
                      }`}>{a.status}</span>
                    </div>
                  </div>
                  {a.status === "confirmed" && (
                    <button
                      data-testid={`cancel-${a.appointment_id}`}
                      onClick={() => cancel(a.appointment_id)}
                      className="mt-2 text-[10px] text-red-400 hover:text-red-300"
                    >
                      Stornieren
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="biz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="rounded-xl p-3 bg-[#00C2FF]/5 border border-[#00C2FF]/20 text-[11px] text-[#00C2FF]">
                Du besitzt {myProviders.length} {myProviders.length === 1 ? "Anbieter" : "Anbieter"}. Verwalte Services, Öffnungszeiten und Buchungen.
              </div>
              {myProviders.map((p) => (
                <button
                  key={p.id}
                  data-testid={`biz-${p.id}`}
                  onClick={() => onNavigate?.(`/provider-admin/${p.id}`)}
                  className="w-full rounded-2xl p-4 bg-white/[0.03] border border-white/5 flex items-center gap-3 text-left"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-black"
                    style={{ background: (p.color || "#00C2FF") + "20", color: p.color || "#00C2FF" }}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold">{p.name}</p>
                    <p className="text-[10px] text-white/50">{(p.services || []).length} Services · {p.city}</p>
                  </div>
                  <Settings size={16} className="text-white/40" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
