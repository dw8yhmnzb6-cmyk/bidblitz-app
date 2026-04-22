/**
 * BidBlitz V2 - Sabre Live Flight Search
 * Backed by /api/sabre/flights/search (Sabre GDS Bargain Finder Max v4.4.0)
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, Plane, Loader2, AlertCircle, Globe, Calendar, Users, ArrowRight, Zap,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const CABIN_OPTIONS = [
  { code: "Y", label: "Economy" },
  { code: "W", label: "Premium Economy" },
  { code: "C", label: "Business" },
  { code: "F", label: "First" },
];

const SabreFlightsPage = ({ onBack }) => {
  const [origin, setOrigin] = useState("JFK");
  const [destination, setDestination] = useState("LAX");
  const [depDate, setDepDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [retDate, setRetDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState("Y");
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState("");
  const [environment, setEnvironment] = useState("");

  const search = async () => {
    setError("");
    setLoading(true);
    setFlights([]);
    try {
      const body = {
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departure_date: depDate,
        adults,
        cabin,
        num_results: 20,
      };
      if (retDate) body.return_date = retDate;
      const res = await fetch(`${API}/api/sabre/flights/search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.message || d.error || "Suche fehlgeschlagen");
      } else {
        setFlights(d.flights || []);
        setEnvironment(d.environment || "");
      }
    } catch (e) {
      setError("Netzwerkfehler: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="sabre-flights-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="sabre-flights-back"
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10"
          >
            <ArrowLeft size={18} />
          </motion.button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold">Live Flugsuche</h1>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-gradient-to-r from-[#00D26A] to-[#06B6D4] text-black uppercase tracking-wider">
                Sabre
              </span>
              {environment && (
                <span className="text-[9px] text-gray-500 uppercase">{environment}</span>
              )}
            </div>
            <p className="text-[10px] text-gray-500">
              {flights.length > 0 ? `${flights.length} Live-Ergebnisse` : "Powered by Sabre GDS"}
            </p>
          </div>
          <Globe className="text-[#06B6D4]" size={20} />
        </div>
      </div>

      {/* Search Form */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Von</label>
            <input
              data-testid="sabre-origin-input"
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="JFK"
              className="w-full bg-transparent outline-none text-[18px] font-bold tracking-wider uppercase mt-1"
              maxLength={3}
            />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Nach</label>
            <input
              data-testid="sabre-destination-input"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="LAX"
              className="w-full bg-transparent outline-none text-[18px] font-bold tracking-wider uppercase mt-1"
              maxLength={3}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider flex items-center gap-1">
              <Calendar size={10} /> Hinflug
            </label>
            <input
              data-testid="sabre-departure-date"
              type="date"
              value={depDate}
              onChange={(e) => setDepDate(e.target.value)}
              className="w-full bg-transparent outline-none text-[13px] font-semibold mt-1 [color-scheme:dark]"
            />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider flex items-center gap-1">
              <Calendar size={10} /> Rückflug (optional)
            </label>
            <input
              data-testid="sabre-return-date"
              type="date"
              value={retDate}
              onChange={(e) => setRetDate(e.target.value)}
              className="w-full bg-transparent outline-none text-[13px] font-semibold mt-1 [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider flex items-center gap-1">
              <Users size={10} /> Erwachsene
            </label>
            <select
              data-testid="sabre-adults"
              value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value))}
              className="w-full bg-transparent outline-none text-[13px] font-semibold mt-1"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n} className="bg-[#0A0A0F]">
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Klasse</label>
            <select
              data-testid="sabre-cabin"
              value={cabin}
              onChange={(e) => setCabin(e.target.value)}
              className="w-full bg-transparent outline-none text-[13px] font-semibold mt-1"
            >
              {CABIN_OPTIONS.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0A0A0F]">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <motion.button
          data-testid="sabre-search-btn"
          whileTap={{ scale: 0.98 }}
          onClick={search}
          disabled={loading || !origin || !destination || !depDate}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#00D26A] to-[#06B6D4] text-black font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
          {loading ? "Durchsuche Sabre GDS..." : "Live suchen"}
        </motion.button>

        {error && (
          <div
            data-testid="sabre-error"
            className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-[12px] text-red-300"
          >
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-2 mt-4">
          {flights.map((f, idx) => (
            <motion.div
              key={f.id + "-" + idx}
              data-testid={`sabre-flight-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                    <Plane size={14} className="text-[#06B6D4]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold">{f.validating_carrier}</p>
                    <p className="text-[9px] text-gray-500 uppercase">
                      {f.segments?.length || 0} Segment{f.segments?.length !== 1 ? "e" : ""}
                      {f.num_stops > 0 && ` · ${f.num_stops} Stop${f.num_stops > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-black text-[#00D26A] tabular-nums">
                    {f.currency === "USD" ? "$" : f.currency + " "}
                    {f.total_fare?.toFixed(0)}
                  </p>
                  <p className="text-[9px] text-gray-500">
                    {f.refundable ? "Refundable" : "Non-Ref"}
                  </p>
                </div>
              </div>

              {/* Segments timeline */}
              <div className="space-y-1 mt-3">
                {(f.segments || []).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[11px] bg-black/30 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="font-bold text-white w-12">
                      {s.airline}
                      {s.flight_number?.replace(s.airline, "")}
                    </span>
                    <span className="font-mono text-gray-400">{s.from}</span>
                    <ArrowRight size={10} className="text-gray-600" />
                    <span className="font-mono text-gray-400">{s.to}</span>
                    <span className="ml-auto text-gray-500">
                      {s.duration_min ? `${Math.floor(s.duration_min / 60)}h ${s.duration_min % 60}m` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          {!loading && flights.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              <Zap size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">Live-Ergebnisse direkt von Sabre GDS</p>
              <p className="text-[10px] mt-1">
                Route eingeben und auf <span className="text-[#06B6D4]">Live suchen</span> tippen
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SabreFlightsPage;
