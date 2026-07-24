/**
 * AirportAutocomplete — typeahead for airports (IATA + city name).
 *
 * Props:
 *   value, onChange, onSelect, placeholder, testId, className
 *   onSelect receives {iata, name, city, country, country_code, lat, lon}
 */
import { useEffect, useRef, useState } from "react";
import { Plane, Loader2, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const AirportAutocomplete = ({
  value = "",
  onChange,
  onSelect,
  placeholder = "Flughafen oder Stadt...",
  testId = "airport-autocomplete",
  className = "",
}) => {
  const [text, setText] = useState(value);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const cache = useRef(new Map());

  useEffect(() => {
    // Only sync from parent if parent value differs significantly (avoid flicker mid-typing)
    if (value !== text) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (text.trim().length < 2) { setResults([]); return; }
    const key = text.toLowerCase();
    if (cache.current.has(key)) { setResults(cache.current.get(key)); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/geo/airports?q=${encodeURIComponent(text)}&limit=8`);
        const d = await r.json();
        cache.current.set(key, d.results || []);
        setResults(d.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [text]);

  const pick = (a) => {
    const display = `${a.iata} — ${a.city}`;
    setText(display);
    setOpen(false);
    onChange?.(display);
    onSelect?.(a);
  };

  const onKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && results[highlight]) { e.preventDefault(); pick(results[highlight]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`} data-testid={testId}>
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-blue-500/50 transition">
        <Plane size={16} className="text-blue-400 shrink-0" />
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHighlight(0); onChange?.(e.target.value); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
          data-testid={`${testId}-input`}
          autoComplete="off"
        />
        {loading && <Loader2 size={14} className="text-gray-400 animate-spin" />}
        {text && !loading && (
          <button onClick={() => { setText(""); onChange?.(""); }} className="text-gray-500 hover:text-white" data-testid={`${testId}-clear`}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#15151B] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map((a, i) => (
            <button
              key={a.iata + i}
              onClick={() => pick(a)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition ${i === highlight ? "bg-blue-500/15" : "hover:bg-white/5"}`}
              data-testid={`${testId}-option-${i}`}
            >
              <span className="text-[11px] font-mono px-2 py-1 rounded bg-blue-500/15 text-blue-300 shrink-0">{a.iata}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{a.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{a.city}, {a.country}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AirportAutocomplete;
