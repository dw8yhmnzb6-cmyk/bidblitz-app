/**
 * BidBlitz V2 - Hotel & Unterkunft Buchung
 * Eigener Marktplatz: Unterkünfte suchen, buchen, verwalten
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, MapPin, Star, Users, Calendar, Bed, Bath,
  Wifi, Car, UtensilsCrossed, Wind, Loader2, X, Heart, ChevronRight,
  Home, Building2, Hotel, Check, AlertCircle, Plus
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const TYPE_ICONS = { apartment: Building2, house: Home, room: Bed, villa: Home, hotel: Hotel };
const TYPE_LABELS = { apartment: "Apartment", house: "Haus", room: "Zimmer", villa: "Villa", hotel: "Hotel" };

const HotelBookingPage = ({ onBack, onNavigate }) => {
  const [view, setView] = useState("list");
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProp, setSelectedProp] = useState(null);
  const [myBookings, setMyBookings] = useState([]);

  // Booking form
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookResult, setBookResult] = useState(null);
  const [error, setError] = useState("");

  const loadProperties = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/hotels/properties?city=${search}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setProperties(d.properties || []); }
    } catch {}
    setLoading(false);
  }, [search]);

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/hotels/my-bookings`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyBookings(d.bookings || []); }
    } catch {}
  }, []);

  useEffect(() => { loadProperties(); loadBookings(); }, [loadProperties, loadBookings]);

  const book = async () => {
    if (!checkIn || !checkOut || !selectedProp) return;
    setBooking(true); setError("");
    try {
      const res = await fetch(`${API}/api/hotels/book`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: selectedProp.property_id, check_in: checkIn, check_out: checkOut, guests, message }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setBookResult(d.booking); loadBookings(); }
      else setError(d.detail || "Buchung fehlgeschlagen");
    } catch { setError("Netzwerkfehler"); }
    setBooking(false);
  };

  const cancelBooking = async (id) => {
    if (!confirm("Buchung wirklich stornieren?")) return;
    const res = await fetch(`${API}/api/hotels/cancel/${id}`, { method: "POST", credentials: "include" });
    if (res.ok) loadBookings();
  };

  // Calculate nights and total
  const nights = checkIn && checkOut ? Math.max(0, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000)) : 0;
  const total = selectedProp ? nights * selectedProp.price_per_night : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="hotel-booking-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="hotel-back">
              <ArrowLeft size={18} />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold">Unterkünfte</h1>
              <p className="text-[10px] text-gray-500">{properties.length} verfügbar</p>
            </div>
          </div>
          <div className="flex gap-2">
            {["list", "bookings"].map(v => (
              <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium ${view === v ? "bg-[#00C2FF] text-black" : "bg-white/5 text-gray-500"}`}
                data-testid={`hotel-tab-${v}`}>
                {v === "list" ? "Suchen" : "Meine Buchungen"}
              </motion.button>
            ))}
          </div>
        </div>
        {view === "list" && (
          <div className="mt-3 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setLoading(true); }}
              placeholder="Stadt suchen..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none"
              data-testid="hotel-search" />
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#00C2FF]" /></div>}

      {/* Property List */}
      {view === "list" && !loading && !selectedProp && (
        <div className="p-4 space-y-3">
          {properties.length === 0 ? (
            <div className="text-center py-16">
              <Hotel size={40} className="mx-auto text-[#333] mb-3" />
              <p className="text-sm text-gray-500">Keine Unterkünfte gefunden</p>
              <p className="text-[10px] text-gray-600 mt-1">Versuche eine andere Stadt</p>
            </div>
          ) : properties.map((p, i) => {
            const Icon = TYPE_ICONS[p.property_type] || Hotel;
            return (
              <motion.div key={p.property_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => { setSelectedProp(p); setBookResult(null); setError(""); }}
                className="bg-[#111118] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
                data-testid={`property-${p.property_id}`}>
                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-36 object-cover" />}
                <div className="p-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-[13px] font-bold">{p.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-gray-500" />
                        <span className="text-[10px] text-gray-500">{p.city || "–"}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#00C2FF]">€{p.price_per_night}/N</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1"><Icon size={11} className="text-gray-500" /><span className="text-[9px] text-gray-500">{TYPE_LABELS[p.property_type] || p.property_type}</span></div>
                    <div className="flex items-center gap-1"><Users size={11} className="text-gray-500" /><span className="text-[9px] text-gray-500">{p.max_guests} Gäste</span></div>
                    <div className="flex items-center gap-1"><Bed size={11} className="text-gray-500" /><span className="text-[9px] text-gray-500">{p.bedrooms} Schlafz.</span></div>
                    {p.rating > 0 && <div className="flex items-center gap-0.5"><Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" /><span className="text-[9px] text-[#F59E0B]">{p.rating}</span></div>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Property Detail + Booking */}
      {selectedProp && !bookResult && (
        <div className="p-4 space-y-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedProp(null)}
            className="flex items-center gap-1 text-xs text-[#00C2FF] font-medium" data-testid="hotel-detail-back">
            <ArrowLeft size={14} /> Zurück zur Liste
          </motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
            <h2 className="text-base font-bold mb-1">{selectedProp.title}</h2>
            <div className="flex items-center gap-1 mb-2"><MapPin size={12} className="text-gray-500" /><span className="text-xs text-gray-400">{selectedProp.city} — {selectedProp.address}</span></div>
            <p className="text-[11px] text-gray-500 mb-3">{selectedProp.description}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(selectedProp.amenities || []).map(a => (
                <span key={a} className="px-2 py-1 rounded-lg bg-white/5 text-[9px] text-gray-400">{a}</span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-gray-400">
              <span><Bed size={12} className="inline mr-1" />{selectedProp.bedrooms} Schlafzimmer</span>
              <span><Bath size={12} className="inline mr-1" />{selectedProp.bathrooms} Bäder</span>
              <span><Users size={12} className="inline mr-1" />Max. {selectedProp.max_guests} Gäste</span>
            </div>
          </div>

          {/* Booking Form */}
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Jetzt buchen</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500 mb-1 block">Check-in</label>
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="hotel-checkin" />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 mb-1 block">Check-out</label>
                <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="hotel-checkout" />
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Gäste</label>
              <div className="flex gap-2">
                {[1,2,3,4].map(g => (
                  <motion.button key={g} whileTap={{ scale: 0.9 }} onClick={() => setGuests(g)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium ${guests === g ? "bg-[#00C2FF] text-black" : "bg-white/5 text-gray-400"}`}>
                    {g}
                  </motion.button>
                ))}
              </div>
            </div>
            {nights > 0 && (
              <div className="p-3 rounded-xl bg-[#00C2FF]/5 border border-[#00C2FF]/20">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-gray-400">{nights} Nächte x €{selectedProp.price_per_night}</span>
                  <span className="text-sm font-bold text-[#00C2FF]">€{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-[#10B981]">Cashback (3%)</span>
                  <span className="text-[10px] font-semibold text-[#10B981]">+€{(total * 0.03).toFixed(2)}</span>
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={book} disabled={!checkIn || !checkOut || nights <= 0 || booking}
              className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              data-testid="hotel-book-btn">
              {booking ? <Loader2 size={18} className="animate-spin" /> : <><Calendar size={16} /> €{total.toFixed(2)} buchen</>}
            </motion.button>
          </div>
        </div>
      )}

      {/* Booking Success */}
      {bookResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#10B981]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-[#10B981]" />
            </div>
            <h3 className="text-lg font-bold mb-1">Buchung bestätigt!</h3>
            <p className="text-sm text-gray-400 mb-2">{bookResult.property_title}</p>
            <p className="text-xs text-gray-500">{bookResult.check_in} — {bookResult.check_out} ({bookResult.nights} Nächte)</p>
            <p className="text-xl font-bold text-[#00C2FF] mt-2">€{bookResult.total?.toFixed(2)}</p>
            {bookResult.cashback > 0 && <p className="text-xs text-[#10B981] mt-1">+€{bookResult.cashback.toFixed(2)} Cashback</p>}
            <p className="text-[9px] text-gray-600 mt-2 font-mono">{bookResult.reference}</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelectedProp(null); setBookResult(null); setView("bookings"); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm" data-testid="hotel-goto-bookings">
              Meine Buchungen
            </motion.button>
          </div>
        </div>
      )}

      {/* My Bookings */}
      {view === "bookings" && (
        <div className="p-4 space-y-3">
          {myBookings.length === 0 ? (
            <div className="text-center py-16"><Calendar size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Buchungen</p></div>
          ) : myBookings.map((b, i) => (
            <motion.div key={b.booking_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-3.5" data-testid={`booking-${b.booking_id}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[12px] font-bold">{b.property_title}</p>
                  <p className="text-[10px] text-gray-500">{b.property_city}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${b.status === "confirmed" ? "bg-green-500/10 text-green-400" : b.status === "cancelled" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>
                  {b.status === "confirmed" ? "Bestätigt" : b.status === "cancelled" ? "Storniert" : b.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
                <span>{b.check_in} — {b.check_out}</span>
                <span>{b.nights} Nächte</span>
                <span>{b.guests} Gäste</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#00C2FF]">€{b.total?.toFixed(2)}</span>
                {b.status === "confirmed" && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => cancelBooking(b.booking_id)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium" data-testid={`cancel-booking-${b.booking_id}`}>
                    Stornieren
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HotelBookingPage;
