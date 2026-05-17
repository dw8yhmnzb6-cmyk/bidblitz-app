/**
 * BidBlitz V2 - Flugsuche & Buchung
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, Plane, MapPin, Clock, Calendar, Users,
  Loader2, Check, ChevronRight, ArrowRight, Zap
} from "lucide-react";
import { AirportAutocomplete, FilterBar } from "../components/search";

const API = process.env.REACT_APP_BACKEND_URL;

const CLASS_LABELS = { economy: "Economy", business: "Business", first: "First" };

const FlightSearchPage = ({ onBack, onNavigate }) => {
  const [view, setView] = useState("search");
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [airports, setAirports] = useState([]);
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [date, setDate] = useState("");
  const [tClass, setTClass] = useState("economy");
  const [pax, setPax] = useState(1);
  const [directOnly, setDirectOnly] = useState(false); // NEW: Direct flights filter
  const [filters, setFilters] = useState({ sort: "price_asc" }); // sort/stops/price_max
  const [selected, setSelected] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [booking, setBooking] = useState(false);
  const [bookResult, setBookResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/flights/airports`).then(r => r.json()).then(d => setAirports(d.airports || [])).catch(() => {});
    fetch(`${API}/api/flights/popular`).then(r => r.json()).then(d => setFlights(d.flights || [])).catch(() => {});
    fetch(`${API}/api/flights/my-bookings`, { credentials: "include" }).then(r => r.json()).then(d => setMyBookings(d.bookings || [])).catch(() => {});
  }, []);

  const search = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (origin) params.set("origin", origin);
    if (dest) params.set("destination", dest);
    if (date) params.set("date", date);
    try {
      const res = await fetch(`${API}/api/flights/search?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setFlights(d.flights || []); }
    } catch {}
    setLoading(false);
  };

  const book = async () => {
    if (!selected) return;
    setBooking(true); setError("");
    try {
      const res = await fetch(`${API}/api/flights/book`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flight_id: selected.flight_id, passengers: pax, travel_class: tClass }),
      });
      const d = await res.json();
      if (res.ok && d.ok) setBookResult(d.booking);
      else setError(d.detail || "Fehler");
    } catch { setError("Netzwerkfehler"); }
    setBooking(false);
  };

  const price = selected ? (selected[`price_${tClass}`] || selected.price_economy) * pax : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="flight-search-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <div>
              <h1 className="text-[16px] font-extrabold tracking-tight">Flüge finden</h1>
              <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                {flights.length} Flüge live · 3% Cashback
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {onNavigate && (
              <motion.button
                data-testid="flights-live-toggle"
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate("/flights-live")}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-[#00D26A] to-[#06B6D4] text-black flex items-center gap-1"
              >
                <Zap size={11} /> LIVE
              </motion.button>
            )}
            {["search", "bookings"].map(v => (
              <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium ${view === v ? "bg-[#06B6D4] text-white" : "bg-white/5 text-gray-500"}`}>
                {v === "search" ? "Suchen" : "Buchungen"}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {view === "search" && !selected && !bookResult && (
        <div className="p-4 space-y-3">
          {/* Trust-Row (Skyscanner-Style) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: "500+", label: "Airlines", color: "text-cyan-300" },
              { num: "Best-Preis", label: "Garantie", color: "text-emerald-300" },
              { num: "3%", label: "Cashback", color: "text-amber-300" },
            ].map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-2 py-2 text-center"
                data-testid={`flight-trust-${t.label.toLowerCase()}`}
              >
                <p className={`text-[13px] font-extrabold ${t.color} leading-none`}>{t.num}</p>
                <p className="text-[9px] text-white/50 mt-1 font-medium tracking-wide uppercase">{t.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500 mb-1 block">Von</label>
                <AirportAutocomplete
                  value={origin}
                  onChange={setOrigin}
                  onSelect={(a) => setOrigin(a.iata)}
                  placeholder="Abflug"
                  testId="flight-origin-autocomplete"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 mb-1 block">Nach</label>
                <AirportAutocomplete
                  value={dest}
                  onChange={setDest}
                  onSelect={(a) => setDest(a.iata)}
                  placeholder="Ankunft"
                  testId="flight-dest-autocomplete"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" />
              <select value={tClass} onChange={e => setTClass(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none">
                <option value="economy">Economy</option><option value="business">Business</option><option value="first">First</option>
              </select>
              <div className="flex gap-1">
                {[1,2,3,4].map(n => (
                  <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => setPax(n)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium ${pax === n ? "bg-[#06B6D4] text-white" : "bg-white/5 text-gray-400"}`}>{n}</motion.button>
                ))}
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={search}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow" data-testid="flight-search-btn">
              <Search size={16} /> Flüge suchen
            </motion.button>

            <FilterBar
              testId="flight-filter-bar"
              value={filters}
              onChange={setFilters}
              filters={[
                { key: "sort", type: "sort", label: "Sortieren", options: [
                  { value: "price_asc", label: "Preis ↑" },
                  { value: "duration_asc", label: "Dauer ↑" },
                  { value: "departure_asc", label: "Abflug früh" },
                ] },
                { key: "stops", type: "select", label: "Stopps", options: [
                  { value: 0, label: "Direkt" }, { value: 1, label: "≤1 Stop" }, { value: 2, label: "≤2 Stops" },
                ] },
                { key: "price_max", type: "select", label: "Max. Preis", options: [
                  { value: 100, label: "≤€100" }, { value: 250, label: "≤€250" },
                  { value: 500, label: "≤€500" }, { value: 1000, label: "≤€1000" },
                ] },
              ]}
            />

            {/* NEW: Direct Flights Filter (Google Flights Style) */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={directOnly} onChange={e => setDirectOnly(e.target.checked)} className="w-4 h-4 rounded bg-white/5 border border-white/20 checked:bg-[#06B6D4]" />
                <span className="text-xs text-gray-400">Nur Direktflüge</span>
              </label>
              <p className="text-[9px] text-gray-600">{flights.filter(f => !directOnly || f.stops === 0).length} Ergebnisse</p>
            </div>
          </div>

          {loading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#06B6D4]" /></div>}

          {!loading && (() => {
            const visible = flights.filter(f => {
              if (directOnly && f.stops !== 0) return false;
              if (filters.stops !== undefined && filters.stops !== "" && f.stops > filters.stops) return false;
              if (filters.price_max && (f.price_economy || 0) > filters.price_max) return false;
              return true;
            }).sort((a, b) => {
              if (filters.sort === "price_asc") return (a.price_economy||0) - (b.price_economy||0);
              if (filters.sort === "duration_asc") return String(a.duration||"").localeCompare(String(b.duration||""));
              if (filters.sort === "departure_asc") return String(a.departure_time||"").localeCompare(String(b.departure_time||""));
              return 0;
            });
            const minPrice = visible.length ? Math.min(...visible.map(f => f.price_economy || Infinity)) : null;
            return visible.map((f, i) => {
              const isBest = minPrice !== null && (f.price_economy || 0) === minPrice;
              return (
                <motion.div key={f.flight_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -2, scale: 1.005 }}
                  onClick={() => { setSelected(f); setBookResult(null); setError(""); }}
                  className={`relative bg-[#111118] rounded-2xl border ${isBest ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-white/15'} p-4 cursor-pointer transition-all`}
                  data-testid={`flight-${f.flight_id}`}>
                  {isBest && (
                    <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-[9px] font-extrabold text-black uppercase tracking-wider shadow-md">
                      ★ Bester Preis
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {f.airline_logo && <img src={f.airline_logo} alt="" className="w-7 h-7 rounded-lg object-cover" />}
                      <div>
                        <p className="text-[11px] font-bold">{f.airline}</p>
                        <p className="text-[9px] text-gray-500">{f.flight_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-gray-500 uppercase tracking-wider">ab</p>
                      <p className={`text-base font-extrabold leading-none ${isBest ? 'text-emerald-300' : 'text-[#06B6D4]'}`}>€{f.price_economy}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-base font-bold">{f.departure_time}</p>
                      <p className="text-[10px] text-gray-500">{f.origin_code}</p>
                    </div>
                    <div className="flex-1 mx-3 flex flex-col items-center">
                      <p className="text-[8px] text-gray-600">{f.duration}</p>
                      <div className="w-full flex items-center gap-1"><div className="flex-1 h-px bg-white/10" /><Plane size={12} className={isBest ? "text-emerald-400" : "text-[#06B6D4]"} /><div className="flex-1 h-px bg-white/10" /></div>
                      <p className={`text-[8px] font-semibold ${f.stops === 0 ? 'text-emerald-400' : 'text-gray-600'}`}>{f.stops === 0 ? "Direkt" : `${f.stops} Stop`}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold">{f.arrival_time}</p>
                      <p className="text-[10px] text-gray-500">{f.destination_code}</p>
                    </div>
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>
      )}

      {selected && !bookResult && (
        <div className="p-4 space-y-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-xs text-[#06B6D4] font-medium"><ArrowLeft size={14} /> Zurück</motion.button>
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              {selected.airline_logo && <img src={selected.airline_logo} alt="" className="w-10 h-10 rounded-xl object-cover" />}
              <div><p className="text-sm font-bold">{selected.airline} {selected.flight_number}</p><p className="text-[10px] text-gray-500">{selected.departure_date}</p></div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-center"><p className="text-xl font-bold">{selected.departure_time}</p><p className="text-xs text-gray-400">{selected.origin}</p><p className="text-[10px] text-gray-600">{selected.origin_code}</p></div>
              <div className="flex-1 mx-4 flex flex-col items-center"><p className="text-[10px] text-gray-500">{selected.duration}</p><div className="w-full flex items-center gap-1"><div className="flex-1 h-px bg-white/10" /><Plane size={14} className="text-[#06B6D4]" /><div className="flex-1 h-px bg-white/10" /></div></div>
              <div className="text-center"><p className="text-xl font-bold">{selected.arrival_time}</p><p className="text-xs text-gray-400">{selected.destination}</p><p className="text-[10px] text-gray-600">{selected.destination_code}</p></div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#06B6D4]/5 border border-[#06B6D4]/20">
            <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">{pax} Passagier(e) x {CLASS_LABELS[tClass]}</span><span className="text-sm font-bold text-[#06B6D4]">€{price.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-[#10B981]">Cashback (3%)</span><span className="text-[10px] text-[#10B981]">+€{(price * 0.03).toFixed(2)}</span></div>
          </div>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={book} disabled={booking}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#06B6D4] to-[#0EA5E9] text-white font-extrabold text-sm disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25" data-testid="flight-book-btn">
            {booking ? <Loader2 size={18} className="animate-spin" /> : <><Plane size={16} /> Jetzt €{price.toFixed(2)} buchen</>}
          </motion.button>
        </div>
      )}

      {bookResult && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-[#10B981]/20 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981] flex items-center justify-center mx-auto mb-4"><Check size={32} className="text-[#10B981]" /></div>
            <h3 className="text-lg font-bold mb-1">Flug gebucht!</h3>
            <p className="text-sm text-gray-400">{bookResult.origin_code} → {bookResult.destination_code}</p>
            <p className="text-xs text-gray-500">{bookResult.airline} {bookResult.flight_number}</p>
            <p className="text-xl font-bold text-[#06B6D4] mt-2">€{bookResult.total?.toFixed(2)}</p>
            <div className="mt-2 p-2 rounded-xl bg-white/[0.03] border border-white/5"><p className="text-[10px] font-mono text-gray-400">PNR: {bookResult.pnr}</p></div>
            {bookResult.cashback > 0 && <p className="text-xs text-[#10B981] mt-1">+€{bookResult.cashback.toFixed(2)} Cashback</p>}
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelected(null); setBookResult(null); setView("bookings"); }}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm">Meine Buchungen</motion.button>
          </div>
        </div>
      )}

      {view === "bookings" && (
        <div className="p-4 space-y-3">
          {myBookings.length === 0 ? (
            <div className="text-center py-16"><Plane size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">Keine Buchungen</p></div>
          ) : myBookings.map((b, i) => (
            <motion.div key={b.booking_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-[#111118] rounded-2xl border border-white/5 p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12px] font-bold">{b.airline} {b.flight_number}</p>
                <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">{b.status === "confirmed" ? "Bestätigt" : b.status}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>{b.origin_code}</span><ArrowRight size={10} /><span>{b.destination_code}</span>
                <span>|</span><span>{b.departure_date}</span><span>{b.departure_time}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] font-mono text-gray-600">PNR: {b.pnr}</span>
                <span className="text-sm font-bold text-[#06B6D4]">€{b.total?.toFixed(2)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlightSearchPage;
