/**
 * CityAutocomplete — typeahead for city names backed by /api/geo/cities.
 *
 * Props:
 *   value         (string)  current text
 *   onChange      (fn)      called on text change
 *   onSelect      (fn)      called with full {name,country_code,lat,lon,region} object
 *   placeholder   (string)
 *   country       (string)  optional ISO-2 to scope (e.g. "DE")
 *   testId        (string)  data-testid prefix
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const CityAutocomplete = ({
  value = "",
  onChange,
  onSelect,
  placeholder = "Stadt suchen...",
  country = "",
  testId = "city-autocomplete",
  className = "",
}) => {
  const [text, setText] = useState(value);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const cache = useRef(new Map());

  useEffect(() => { setText(value); }, [value]);

  // Close on click-outside
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (text.trim().length < 2) { setResults([]); return; }
    const key = `${country}|${text.toLowerCase()}`;
    if (cache.current.has(key)) { setResults(cache.current.get(key)); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const u = new URL(`${API}/api/geo/cities`);
        u.searchParams.set("q", text);
        u.searchParams.set("limit", "8");
        if (country) u.searchParams.set("country", country);
        const r = await fetch(u);
        const d = await r.json();
        const list = d.results || [];
        cache.current.set(key, list);
        setResults(list);
      } catch { setResults([]); }
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [text, country]);

  const pick = (c) => {
    setText(c.name);
    setOpen(false);
    onChange?.(c.name);
    onSelect?.(c);
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
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-orange-500/50 transition">
        <MapPin size={16} className="text-orange-400 shrink-0" />
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
          {results.map((c, i) => (
            <button
              key={`${c.name}-${c.country_code}-${i}`}
              onClick={() => pick(c)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition ${i === highlight ? "bg-orange-500/15" : "hover:bg-white/5"}`}
              data-testid={`${testId}-option-${i}`}
            >
              <MapPin size={14} className="text-orange-400/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{c.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{c.region ? `${c.region}, ` : ""}{c.country_code}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CityAutocomplete;
