/**
 * BidBlitz V2 - Event-Buchung (Tickets kaufen)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Calendar, MapPin, Star, Users, Ticket,
  Music, Trophy, Laugh, Drama, Tent, Loader2, Check, X, QrCode,
  Clock, Tag, Crown
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_ICONS = { concert: Music, sports: Trophy, comedy: Laugh, theater: Drama, festival: Tent, other: Calendar };
const CAT_LABELS = { concert: "Konzerte", sports: "Sport", comedy: "Comedy", theater: "Theater", festival: "Festivals", other: "Sonstiges" };
const CAT_COLORS = { concert: "#A855F7", sports: "#10B981", comedy: "#F59E0B", theater: "#EC4899", festival: "#3B82F6", other: "#6B7280" };

const EventBookingPage = ({ onBack, onNavigate }) => {
  const [view, setView] = useState("list");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [myTickets, setMyTickets] = useState([]);

  // Purchase form
  const [ticketType, setTicketType] = useState("standard");
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState(null);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("city", search);
    if (catFilter) params.set("category", catFilter);
    try {
      const res = await fetch(`${API}/api/events/list?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setEvents(d.events || []); }
    } catch {}
    setLoading(false);
  }, [search, catFilter]);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/events/my-tickets`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyTickets(d.tickets || []); }
    } catch {}
  }, []);

  useEffect(() => { loadEvents(); loadTickets(); }, [loadEvents, loadTickets]);

  const buyTicket = async () => {
    if (!selectedEvent) return;
    setBuying(true); setError("");
    try {
      const res = await fetch(`${API}/api/events/buy`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: selectedEvent.event_id, ticket_type: ticketType, quantity }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setBuyResult(d.ticket); loadTickets(); }
      else setError(d.detail || "Kauf fehlgeschlagen");
    } catch { setError("Netzwerkfehler"); }
    setBuying(false);
  };

  const price = selectedEvent ? (ticketType === "vip" ? selectedEvent.vip_price : selectedEvent.ticket_price) : 0;
  const total = price * quantity;
  const remaining = selectedEvent ? (ticketType === "vip" ? selectedEvent.total_vip - (selectedEvent.vip_sold || 0) : selectedEvent.total_tickets - (selectedEvent.tickets_sold || 0)) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="event-booking-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="event-back">
              <ArrowLeft size={18} />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold">Events & Tickets</h1>
              <p className="text-[10px] text-gray-500">{events.length} Events</p>
            </div>
          </div>
          <div className="flex gap-2">
            {["list", "tickets"].map(v => (
              <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => { setView(v); setSelectedEvent(null); setBuyResult(null); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium ${view === v ? "bg-[#A855F7] text-white" : "bg-white/5 text-gray-500"}`}
                data-testid={`event-tab-${v}`}>
                {v === "list" ? "Events" : "Meine Tickets"}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        {view === "list" && !selectedEvent && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCatFilter("")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${!catFilter ? "bg-[#A855F7] text-white" : "bg-white/5 text-gray-500"}`}>
              Alle
            </motion.button>
            {Object.entries(CAT_LABELS).map(([id, label]) => {
              const Icon = CAT_ICONS[id];
              return (
                <motion.button key={id} whileTap={{ scale: 0.95 }} onClick={() => setCatFilter(id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap flex items-center gap-1 ${catFilter === id ? "text-white" : "bg-white/5 text-gray-500"}`}
                  style={catFilter === id ? { background: CAT_COLORS[id] } : {}}>
                  <Icon size={10} /> {label}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#A855F7]" /></div>}

      {/* Event List */}
      {view === "list" && !loading && !selectedEvent && (
        <div className="p-4 space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-16"><Ticket size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Events gefunden</p></div>
          ) : events.map((e, i) => {
            const Icon = CAT_ICONS[e.category] || Calendar;
            const color = CAT_COLORS[e.category] || "#666";
            return (
              <motion.div key={e.event_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => { setSelectedEvent(e); setBuyResult(null); setError(""); setTicketType("standard"); setQuantity(1); }}
                className="bg-[#111118] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                data-testid={`event-${e.event_id}`}>
                {e.image_url && <img src={e.image_url} alt="" className="w-full h-36 object-cover" />}
                <div className="p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold text-white" style={{ background: color }}>
                      {CAT_LABELS[e.category] || e.category}
                    </span>
                    <span className="text-[9px] text-gray-500">{e.date} {e.time}</span>
                  </div>
                  <p className="text-[13px] font-bold mb-0.5">{e.title}</p>
                  <div className="flex items-center gap-1"><MapPin size={10} className="text-gray-500" /><span className="text-[10px] text-gray-500">{e.venue}, {e.city}</span></div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold" style={{ color }}>ab €{e.ticket_price}</span>
                    {e.vip_price > 0 && <span className="text-[9px] text-[#F59E0B] flex items-center gap-0.5"><Crown size={10} /> VIP €{e.vip_price}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Event Detail + Purchase */}
      {selectedEvent && !buyResult && (
        <div className="p-4 space-y-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedEvent(null)}
            className="flex items-center gap-1 text-xs text-[#A855F7] font-medium" data-testid="event-detail-back">
            <ArrowLeft size={14} /> Zurück
          </motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
            <h2 className="text-base font-bold mb-1">{selectedEvent.title}</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
              <span className="flex items-center gap-1"><Calendar size={11} /> {selectedEvent.date}</span>
              <span className="flex items-center gap-1"><Clock size={11} /> {selectedEvent.time}</span>
              <span className="flex items-center gap-1"><MapPin size={11} /> {selectedEvent.city}</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">{selectedEvent.description}</p>
            <p className="text-[10px] text-gray-600">{selectedEvent.venue}</p>
          </div>

          {/* Ticket Selection */}
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Ticket wählen</h3>
            <div className="grid grid-cols-2 gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTicketType("standard")}
                className={`p-3 rounded-xl border text-center ${ticketType === "standard" ? "bg-[#A855F7]/10 border-[#A855F7]" : "bg-white/[0.03] border-white/10"}`}
                data-testid="ticket-standard">
                <Ticket size={18} className={`mx-auto mb-1 ${ticketType === "standard" ? "text-[#A855F7]" : "text-gray-500"}`} />
                <p className="text-[11px] font-bold">Standard</p>
                <p className="text-xs font-bold text-[#A855F7]">€{selectedEvent.ticket_price}</p>
                <p className="text-[8px] text-gray-500">{selectedEvent.total_tickets - (selectedEvent.tickets_sold || 0)} verfügbar</p>
              </motion.button>
              {selectedEvent.vip_price > 0 && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTicketType("vip")}
                  className={`p-3 rounded-xl border text-center ${ticketType === "vip" ? "bg-[#F59E0B]/10 border-[#F59E0B]" : "bg-white/[0.03] border-white/10"}`}
                  data-testid="ticket-vip">
                  <Crown size={18} className={`mx-auto mb-1 ${ticketType === "vip" ? "text-[#F59E0B]" : "text-gray-500"}`} />
                  <p className="text-[11px] font-bold">VIP</p>
                  <p className="text-xs font-bold text-[#F59E0B]">€{selectedEvent.vip_price}</p>
                  <p className="text-[8px] text-gray-500">{selectedEvent.total_vip - (selectedEvent.vip_sold || 0)} verfügbar</p>
                </motion.button>
              )}
            </div>
            <div>
              <p className="text-[9px] text-gray-500 mb-1">Anzahl</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(q => (
                  <motion.button key={q} whileTap={{ scale: 0.9 }} onClick={() => setQuantity(q)}
                    className={`w-10 h-10 rounded-xl text-xs font-bold ${quantity === q ? "bg-[#A855F7] text-white" : "bg-white/5 text-gray-400"}`}>
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>
            {total > 0 && (
              <div className="p-3 rounded-xl bg-[#A855F7]/5 border border-[#A855F7]/20">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-gray-400">{quantity}x {ticketType.toUpperCase()} @ €{price}</span>
                  <span className="text-sm font-bold text-[#A855F7]">€{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-[#10B981]">Cashback (2%)</span>
                  <span className="text-[10px] font-semibold text-[#10B981]">+€{(total * 0.02).toFixed(2)}</span>
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={buyTicket} disabled={remaining <= 0 || buying}
              className="w-full py-3.5 rounded-xl bg-[#A855F7] text-white font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              data-testid="event-buy-btn">
              {buying ? <Loader2 size={18} className="animate-spin" /> : <><Ticket size={16} /> €{total.toFixed(2)} kaufen</>}
            </motion.button>
          </div>
        </div>
      )}

      {/* Purchase Success */}
      {buyResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#A855F7]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#A855F7]/10 border-2 border-[#A855F7] flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-[#A855F7]" />
            </div>
            <h3 className="text-lg font-bold mb-1">Ticket gekauft!</h3>
            <p className="text-sm text-gray-400 mb-1">{buyResult.event_title}</p>
            <p className="text-xs text-gray-500">{buyResult.event_date} {buyResult.event_time} — {buyResult.event_venue}</p>
            <p className="text-xl font-bold text-[#A855F7] mt-2">{buyResult.quantity}x {buyResult.ticket_type?.toUpperCase()}</p>
            <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <QrCode size={20} className="mx-auto text-gray-400 mb-1" />
              <p className="text-[10px] font-mono text-gray-400">{buyResult.qr_code}</p>
            </div>
            {buyResult.cashback > 0 && <p className="text-xs text-[#10B981] mt-2">+€{buyResult.cashback.toFixed(2)} Cashback</p>}
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelectedEvent(null); setBuyResult(null); setView("tickets"); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm" data-testid="event-goto-tickets">
              Meine Tickets
            </motion.button>
          </div>
        </div>
      )}

      {/* My Tickets */}
      {view === "tickets" && (
        <div className="p-4 space-y-3">
          {myTickets.length === 0 ? (
            <div className="text-center py-16"><Ticket size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Tickets</p></div>
          ) : myTickets.map((t, i) => (
            <motion.div key={t.ticket_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-3.5" data-testid={`ticket-${t.ticket_id}`}>
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="text-[12px] font-bold">{t.event_title}</p>
                  <p className="text-[10px] text-gray-500">{t.event_date} {t.event_time} — {t.event_venue}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${t.ticket_type === "vip" ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#A855F7]/10 text-[#A855F7]"}`}>
                  {t.ticket_type?.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#A855F7]">{t.quantity}x €{t.price_each}</span>
                  <span className="text-[9px] text-gray-600 font-mono">{t.qr_code?.slice(0, 15)}...</span>
                </div>
                <span className={`text-[8px] px-1.5 py-0.5 rounded ${t.status === "valid" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                  {t.status === "valid" ? "Gültig" : t.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventBookingPage;
