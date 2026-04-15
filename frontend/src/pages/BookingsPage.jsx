import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarCheck, Star, Clock, Loader2 } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function BookingsPage({ onBack }) {
  const [providers, setProviders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState("browse");
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/bookings/providers`).then(r => r.json()).then(d => setProviders(d.providers || [])).catch(() => {});
    fetch(`${API}/api/bookings/my-appointments`, { credentials: "include" }).then(r => r.json()).then(d => setAppointments(d.appointments || [])).catch(() => {});
  }, []);

  const book = async (providerId, serviceName) => {
    const r = await fetch(`${API}/api/bookings/book`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId, service_name: serviceName }) });
    const d = await r.json(); setMsg(d.message || d.detail);
    if (r.ok) fetch(`${API}/api/bookings/my-appointments`, { credentials: "include" }).then(r => r.json()).then(d => setAppointments(d.appointments || []));
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="bookings-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={sel ? () => setSel(null) : onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
          <div><h1 className="text-base font-bold flex items-center gap-2"><CalendarCheck size={18} className="text-sky-400" /> {sel ? sel.name : "Termine buchen"}</h1>
            <p className="text-[10px] text-sky-400">{sel ? sel.type : "Friseur, Arzt, Wellness & mehr"}</p></div>
        </div>
        {!sel && <div className="flex gap-2 mt-3">
          {[{ id: "browse", label: "Anbieter" }, { id: "my", label: "Meine Termine" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${tab === t.id ? "bg-sky-500 text-white" : "bg-white/5 text-gray-400"}`}>{t.label}</button>
          ))}
        </div>}
      </div>
      <div className="px-4 pt-4 space-y-3">
        {!sel && tab === "browse" && providers.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setSel(p)} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06]" data-testid={`provider-${p.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: p.color + "20", color: p.color }}>{p.name.charAt(0)}</div>
              <div className="flex-1">
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-[10px] text-gray-500">{p.type} · {p.city}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-yellow-400 flex items-center gap-0.5"><Star size={9} /> {p.rating}</span>
                  <span className="text-[9px] text-gray-500">{p.reviews} Bewertungen</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">{p.services.length} Services</p>
            </div>
          </motion.div>
        ))}
        {sel && sel.services.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{s.name}</p>
              <p className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} /> {s.duration} min · {s.price === 0 ? "Kostenlos" : `${s.price} EUR`}</p>
            </div>
            <button onClick={() => book(sel.id, s.name)} className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold">Buchen</button>
          </motion.div>
        ))}
        {!sel && tab === "my" && appointments.length === 0 && <p className="text-center text-gray-600 py-12">Keine Termine</p>}
        {!sel && tab === "my" && appointments.map((a, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
            <div><p className="text-sm font-bold">{a.service}</p><p className="text-[10px] text-gray-500">{a.provider_name} · {a.duration_min}min</p></div>
            <p className="text-sm font-bold text-sky-400">{a.price === 0 ? "Gratis" : `${a.price} EUR`}</p>
          </div>
        ))}
      </div>
      {msg && <div className="fixed bottom-20 left-4 right-4 p-3 bg-sky-500/20 border border-sky-500/30 rounded-xl text-sky-400 text-sm text-center z-50">{msg}</div>}
    </div>
  );
}
