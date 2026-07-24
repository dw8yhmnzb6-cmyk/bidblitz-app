/**
 * BidBlitz V2 - Sabre Live Flight Search (with Airport Autocomplete)
 * Backed by /api/sabre/flights/search (Sabre GDS Bargain Finder Max v4.4.0)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Plane, Loader2, AlertCircle, Globe, Calendar, Users, ArrowRight, Zap, X,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const CABIN_OPTIONS = [
  { code: "Y", label: "Economy" },
  { code: "W", label: "Premium Economy" },
  { code: "C", label: "Business" },
  { code: "F", label: "First" },
];

// Robust fetch helper: reads the body ONCE and handles HTTP errors (400/500) gracefully.
async function safeFetchJson(url, options) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server antwortete nicht im JSON-Format (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || data?.error || `Fehler ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ── Airport search field with autocomplete dropdown ─────────────
const AirportField = ({ label, value, onSelect, testId, placeholder }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  const displayText = value ? `${value.city} (${value.code})` : "";

  const fetchSuggestions = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/sabre/airports/search?q=${encodeURIComponent(q)}&limit=12`, {
        signal: abortRef.current.signal,
        credentials: "include",
      });
      const d = await res.json();
      setSuggestions(d.airports || []);
    } catch (e) {
      if (e.name !== "AbortError") setSuggestions([]);
    }
    setLoading(false);
  }, []);

  const onChange = (v) => {
    setQuery(v);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(v), 180);
  };

  const pick = (a) => {
    onSelect(a);
    setQuery("");
    setOpen(false);
    setSuggestions([]);
  };

  const clear = (e) => {
    e.stopPropagation();
    onSelect(null);
    setQuery("");
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="relative">
      <div
        className="bg-white/5 border border-white/10 rounded-xl p-3 cursor-text"
        onClick={() => setOpen(true)}
        data-testid={`${testId}-field`}
      >
        <div className="flex items-start justify-between gap-2">
          <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">{label}</label>
          {value && (
            <button
              onClick={clear}
              data-testid={`${testId}-clear`}
              className="p-0.5 rounded-md hover:bg-white/10"
              aria-label="Löschen"
            >
              <X size={11} className="text-gray-500" />
            </button>
          )}
        </div>
        {value ? (
          <div className="mt-0.5">
            <p className="text-[16px] font-black text-white tracking-wide">{value.code}</p>
            <p className="text-[10px] text-gray-500 truncate">{value.city} · {value.country}</p>
          </div>
        ) : (
          <input
            data-testid={testId}
            autoComplete="off"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { setOpen(true); if (!suggestions.length) fetchSuggestions(""); }}
            placeholder={placeholder || "Stadt oder Code…"}
            className="w-full bg-transparent outline-none text-[14px] font-bold text-white placeholder-gray-600 mt-0.5"
          />
        )}
      </div>

      <AnimatePresence>
        {open && (query.length > 0 || suggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#0E1016] border border-white/10 rounded-xl shadow-2xl max-h-[280px] overflow-y-auto"
            data-testid={`${testId}-suggestions`}
          >
            {loading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin text-gray-500" />
              </div>
            )}
            {!loading && suggestions.length === 0 && query.length >= 2 && (
              <div className="text-center py-3 text-[11px] text-gray-500">Keine Treffer</div>
            )}
            {!loading && suggestions.map((a) => (
              <button
                key={a.code}
                data-testid={`${testId}-option-${a.code}`}
                onClick={() => pick(a)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 border-b border-white/[0.03] last:border-0 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-[#06B6D4]/15 flex items-center justify-center flex-shrink-0">
                  <Plane size={13} className="text-[#06B6D4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">
                    {a.city} <span className="text-gray-500 font-normal">· {a.country}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{a.name}</p>
                </div>
                <span className="text-[11px] font-black text-[#00D26A] tabular-nums tracking-wider">{a.code}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close dropdown on outside-click */}
      {open && (
        <button
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setOpen(false)}
          aria-hidden="true"
          tabIndex={-1}
          style={{ background: "transparent" }}
        />
      )}
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────
const SabreFlightsPage = ({ onBack }) => {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
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

  // Validate return >= departure
  useEffect(() => {
    if (retDate && depDate && retDate < depDate) {
      setRetDate("");
    }
  }, [depDate, retDate]);

  const search = async () => {
    setError("");
    if (!origin) { setError("Bitte Abflugflughafen wählen"); return; }
    if (!destination) { setError("Bitte Zielflughafen wählen"); return; }
    if (origin.code === destination.code) { setError("Abflug und Ziel müssen unterschiedlich sein"); return; }
    if (!depDate) { setError("Bitte Hinflug-Datum wählen"); return; }
    if (retDate && retDate < depDate) { setError("Rückflug-Datum muss nach dem Hinflug liegen"); return; }

    setLoading(true);
    setFlights([]);
    try {
      const body = {
        origin: origin.code,
        destination: destination.code,
        departure_date: depDate,
        adults,
        cabin,
        num_results: 20,
      };
      if (retDate) body.return_date = retDate;

      const d = await safeFetchJson(`${API}/api/sabre/flights/search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!d.ok) {
        setError(d.message || d.error || "Suche fehlgeschlagen");
      } else {
        setFlights(d.flights || []);
        setEnvironment(d.environment || "");
        if (!d.flights?.length) {
          setError("Keine Flüge für diese Route gefunden. Bitte anderes Datum probieren.");
        }
      }
    } catch (e) {
      // Friendly error messages — never show raw "Body is disturbed" etc.
      const raw = e.message || "";
      if (/body|stream|disturbed|locked/i.test(raw)) {
        setError("Netzwerkfehler. Bitte Seite neu laden (Pull-to-refresh) und erneut versuchen.");
      } else if (e.status === 400) {
        setError(raw);
      } else if (e.status >= 500) {
        setError("Sabre-Server nicht erreichbar. Bitte später versuchen.");
      } else {
        setError(raw || "Unbekannter Fehler");
      }
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
            <div className="flex items-center gap-2 flex-wrap">
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
          <AirportField
            label="Von"
            value={origin}
            onSelect={setOrigin}
            testId="sabre-origin"
            placeholder="z. B. Hamburg"
          />
          <AirportField
            label="Nach"
            value={destination}
            onSelect={setDestination}
            testId="sabre-destination"
            placeholder="z. B. Dubai"
          />
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
              min={new Date().toISOString().slice(0, 10)}
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
              min={depDate || new Date().toISOString().slice(0, 10)}
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
          disabled={loading}
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
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
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

              <div className="space-y-1 mt-3">
                {(f.segments || []).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[11px] bg-black/30 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="font-bold text-white w-14 flex-shrink-0">
                      {s.flight_number}
                    </span>
                    <span className="font-mono text-gray-400">{s.from}</span>
                    <ArrowRight size={10} className="text-gray-600 flex-shrink-0" />
                    <span className="font-mono text-gray-400">{s.to}</span>
                    <span className="ml-auto text-gray-500 whitespace-nowrap">
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
                Stadt auswählen und auf <span className="text-[#06B6D4]">Live suchen</span> tippen
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SabreFlightsPage;
