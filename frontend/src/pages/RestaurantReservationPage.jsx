/**
 * BidBlitz V2 - Restaurant-Reservierung
 * Tisch reservieren, mit Wallet bezahlen
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, MapPin, Star, Users, Clock, Calendar,
  UtensilsCrossed, Loader2, Check, X, Phone, ChevronRight, Heart
} from "lucide-react";
import { CityAutocomplete } from "../components/search";

const API = process.env.REACT_APP_BACKEND_URL;

const PRICE_LABELS = { budget: "€", mid: "€€", fine: "€€€" };
const PRICE_COLORS = { budget: "#10B981", mid: "#F59E0B", fine: "#A855F7" };

const RestaurantReservationPage = ({ onBack, onNavigate }) => {
  const [view, setView] = useState("list");
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("");
  const [selectedRest, setSelectedRest] = useState(null);
  const [myReservations, setMyReservations] = useState([]);

  // Reservation form
  const [resDate, setResDate] = useState("");
  const [resTime, setResTime] = useState("19:00");
  const [resGuests, setResGuests] = useState(2);
  const [specialReq, setSpecialReq] = useState("");
  const [reserving, setReserving] = useState(false);
  const [resResult, setResResult] = useState(null);
  const [error, setError] = useState("");

  const loadRestaurants = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("city", search);
    if (cuisineFilter) params.set("cuisine", cuisineFilter);
    try {
      const res = await fetch(`${API}/api/restaurants/list?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setRestaurants(d.restaurants || []); }
    } catch {}
    setLoading(false);
  }, [search, cuisineFilter]);

  const loadReservations = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/restaurants/my-reservations`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setMyReservations(d.reservations || []); }
    } catch {}
  }, []);

  useEffect(() => { loadRestaurants(); loadReservations(); }, [loadRestaurants, loadReservations]);

  const reserve = async () => {
    if (!resDate || !resTime || !selectedRest) return;
    setReserving(true); setError("");
    try {
      const res = await fetch(`${API}/api/restaurants/reserve`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: selectedRest.restaurant_id, date: resDate, time: resTime, guests: resGuests, special_requests: specialReq }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setResResult(d.reservation); loadReservations(); }
      else setError(d.detail || "Reservierung fehlgeschlagen");
    } catch { setError("Netzwerkfehler"); }
    setReserving(false);
  };

  const cancelReservation = async (id) => {
    if (!window.confirm("Reservierung wirklich stornieren?")) return;
    const res = await fetch(`${API}/api/restaurants/cancel/${id}`, { method: "POST", credentials: "include" });
    if (res.ok) loadReservations();
  };

  const timeSlots = ["11:00","11:30","12:00","12:30","13:00","13:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30"];

  const cuisines = [
    { id: "italian", label: "Italienisch" }, { id: "asian", label: "Asiatisch" },
    { id: "german", label: "Deutsch" }, { id: "turkish", label: "Türkisch" },
    { id: "japanese", label: "Japanisch" }, { id: "indian", label: "Indisch" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="restaurant-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="restaurant-back">
              <ArrowLeft size={18} />
            </motion.button>
            <div>
              <h1 className="text-[15px] font-bold">Restaurants</h1>
              <p className="text-[10px] text-gray-500">{restaurants.length} verfügbar</p>
            </div>
          </div>
          <div className="flex gap-2">
            {["list", "reservations"].map(v => (
              <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => { setView(v); setSelectedRest(null); setResResult(null); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium ${view === v ? "bg-[#F59E0B] text-black" : "bg-white/5 text-gray-500"}`}
                data-testid={`rest-tab-${v}`}>
                {v === "list" ? "Suchen" : "Reservierungen"}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Cuisine Filter */}
        {view === "list" && !selectedRest && (
          <>
            <div className="mt-3">
              <CityAutocomplete
                value={search}
                onChange={setSearch}
                onSelect={(c) => setSearch(c.name)}
                placeholder="Stadt suchen..."
                testId="rest-city"
              />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCuisineFilter("")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${!cuisineFilter ? "bg-[#F59E0B] text-black" : "bg-white/5 text-gray-500"}`}>
              Alle
            </motion.button>
            {cuisines.map(c => (
              <motion.button key={c.id} whileTap={{ scale: 0.95 }} onClick={() => setCuisineFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${cuisineFilter === c.id ? "bg-[#F59E0B] text-black" : "bg-white/5 text-gray-500"}`}>
                {c.label}
              </motion.button>
            ))}
            </div>
          </>
        )}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-[#F59E0B]" /></div>}

      {/* Restaurant List */}
      {view === "list" && !loading && !selectedRest && (
        <div className="p-4 space-y-3">
          {restaurants.length === 0 ? (
            <div className="text-center py-16"><UtensilsCrossed size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Restaurants gefunden</p></div>
          ) : restaurants.map((r, i) => (
            <motion.div key={r.restaurant_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => { setSelectedRest(r); setResResult(null); setError(""); }}
              className="bg-[#111118] rounded-2xl border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
              data-testid={`restaurant-${r.restaurant_id}`}>
              {r.images?.[0] && <img src={r.images[0]} alt="" className="w-full h-36 object-cover" />}
              <div className="p-3.5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-[13px] font-bold">{r.name}</p>
                    <p className="text-[10px] text-gray-500">{r.cuisine ? `${r.cuisine.charAt(0).toUpperCase() + r.cuisine.slice(1)}` : ""} {r.city ? `— ${r.city}` : ""}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: PRICE_COLORS[r.price_range] || "#666" }}>
                    {PRICE_LABELS[r.price_range] || "€€"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                  {r.rating > 0 && <span className="flex items-center gap-0.5"><Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" /> {r.rating}</span>}
                  <span className="flex items-center gap-0.5"><Clock size={10} /> {r.opening_hours}</span>
                  <span className="flex items-center gap-0.5"><Users size={10} /> {r.capacity} Plätze</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Restaurant Detail + Reservation */}
      {selectedRest && !resResult && (
        <div className="p-4 space-y-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedRest(null)}
            className="flex items-center gap-1 text-xs text-[#F59E0B] font-medium" data-testid="rest-detail-back">
            <ArrowLeft size={14} /> Zurück
          </motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
            <h2 className="text-base font-bold mb-1">{selectedRest.name}</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
              <span className="flex items-center gap-1"><MapPin size={11} /> {selectedRest.city} — {selectedRest.address}</span>
              {selectedRest.phone && <span className="flex items-center gap-1"><Phone size={11} /> {selectedRest.phone}</span>}
            </div>
            <p className="text-[11px] text-gray-500 mb-2">{selectedRest.description}</p>
            {selectedRest.reviews?.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] text-gray-500 font-semibold">Bewertungen</p>
                {selectedRest.reviews.slice(0, 3).map(rv => (
                  <div key={rv.review_id} className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={8} className={s <= rv.rating ? "text-[#F59E0B] fill-[#F59E0B]" : "text-gray-600"} />)}</div>
                      <span className="text-[9px] text-gray-500">{rv.guest_name}</span>
                    </div>
                    <p className="text-[10px] text-gray-400">{rv.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reservation Form */}
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <h3 className="text-sm font-bold">Tisch reservieren</h3>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Datum</label>
              <input type="date" value={resDate} onChange={e => setResDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="rest-date" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Uhrzeit</label>
              <div className="grid grid-cols-4 gap-1.5">
                {timeSlots.map(t => (
                  <motion.button key={t} whileTap={{ scale: 0.9 }} onClick={() => setResTime(t)}
                    className={`py-2 rounded-lg text-[10px] font-medium ${resTime === t ? "bg-[#F59E0B] text-black" : "bg-white/5 text-gray-400"}`}>
                    {t}
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">Personen</label>
              <div className="flex gap-2">
                {[1,2,3,4,5,6,8].map(g => (
                  <motion.button key={g} whileTap={{ scale: 0.9 }} onClick={() => setResGuests(g)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold ${resGuests === g ? "bg-[#F59E0B] text-black" : "bg-white/5 text-gray-400"}`}>
                    {g}
                  </motion.button>
                ))}
              </div>
            </div>
            <input type="text" value={specialReq} onChange={e => setSpecialReq(e.target.value)}
              placeholder="Besondere Wünsche (optional)" maxLength={200}
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] outline-none text-gray-300 placeholder-gray-600"
              data-testid="rest-special" />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={reserve} disabled={!resDate || !resTime || reserving}
              className="w-full py-3.5 rounded-xl bg-[#F59E0B] text-black font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              data-testid="rest-reserve-btn">
              {reserving ? <Loader2 size={18} className="animate-spin" /> : <><Calendar size={16} /> Tisch reservieren</>}
            </motion.button>
          </div>
        </div>
      )}

      {/* Reservation Success */}
      {resResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#F59E0B]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F59E0B]/10 border-2 border-[#F59E0B] flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-[#F59E0B]" />
            </div>
            <h3 className="text-lg font-bold mb-1">Reservierung bestätigt!</h3>
            <p className="text-sm text-gray-400 mb-2">{resResult.restaurant_name}</p>
            <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
              <span>{resResult.date}</span>
              <span>{resResult.time}</span>
              <span>{resResult.guests} Pers.</span>
            </div>
            <p className="text-[9px] text-gray-600 mt-2 font-mono">{resResult.reference}</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelectedRest(null); setResResult(null); setView("reservations"); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm" data-testid="rest-goto-reservations">
              Meine Reservierungen
            </motion.button>
          </div>
        </div>
      )}

      {/* My Reservations */}
      {view === "reservations" && (
        <div className="p-4 space-y-3">
          {myReservations.length === 0 ? (
            <div className="text-center py-16"><Calendar size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Reservierungen</p></div>
          ) : myReservations.map((r, i) => (
            <motion.div key={r.reservation_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-3.5" data-testid={`reservation-${r.reservation_id}`}>
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="text-[12px] font-bold">{r.restaurant_name}</p>
                  <p className="text-[10px] text-gray-500">{r.restaurant_city}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${r.status === "confirmed" ? "bg-green-500/10 text-green-400" : r.status === "cancelled" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>
                  {r.status === "confirmed" ? "Bestätigt" : r.status === "cancelled" ? "Storniert" : r.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
                <span className="flex items-center gap-1"><Calendar size={10} /> {r.date}</span>
                <span className="flex items-center gap-1"><Clock size={10} /> {r.time}</span>
                <span className="flex items-center gap-1"><Users size={10} /> {r.guests} Pers.</span>
              </div>
              {r.status === "confirmed" && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => cancelReservation(r.reservation_id)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium" data-testid={`cancel-res-${r.reservation_id}`}>
                  Stornieren
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RestaurantReservationPage;
