/**
 * useTaxiGeocoder — Mapbox forward-geocoding hook for taxi pickup/dropoff.
 *
 * Provides:
 *  - search(query, setterFn): debounced suggestion list
 *  - geocodeOnBlur({address, lat, lng}): coordinate fix-up if user typed
 *    a free-form address without selecting a suggestion.
 *
 * Uses REACT_APP_MAPBOX_TOKEN directly so it works BEFORE the lazy-loaded
 * Mapbox GL library finishes initializing (fixes race condition where users
 * type pickup/dropoff before the map mounts).
 */
import { useCallback, useRef, useEffect } from "react";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const FORWARD_PARAMS =
  "language=de&limit=8&types=address,poi,place,locality,neighborhood,postcode,district";

function parseFeature(f) {
  const ctx = f.context || [];
  const postcode = (ctx.find((c) => (c.id || "").startsWith("postcode")) || {}).text || "";
  const city =
    (ctx.find((c) => (c.id || "").startsWith("place")) || ctx.find((c) => (c.id || "").startsWith("locality")) || {})
      .text || "";
  const country =
    (ctx.find((c) => (c.id || "").startsWith("country")) || {}).short_code?.toUpperCase() || "";
  const houseNo = f.address ? ` ${f.address}` : "";
  const name = `${f.text || ""}${houseNo}`.trim() || (f.place_name || "").split(",")[0];
  const cityZip = [postcode, city].filter(Boolean).join(" ") + (country ? `, ${country}` : "");
  return {
    name,
    cityZip: cityZip.trim(),
    address: f.place_name,
    lat: f.center?.[1],
    lng: f.center?.[0],
    type: (f.place_type && f.place_type[0]) || "address",
  };
}

export function useTaxiGeocoder({ debounceMs = 250 } = {}) {
  const timersRef = useRef({});
  const abortersRef = useRef({});

  useEffect(() => {
    const timers = timersRef.current;
    const aborters = abortersRef.current;
    return () => {
      Object.values(timers).forEach((t) => t && clearTimeout(t));
      Object.values(aborters).forEach((a) => a && a.abort());
    };
  }, []);

  /**
   * search(key, query, setSuggestions, setVisibility)
   * key: stable identifier per input ("pickup" | "dropoff" | …)
   */
  const search = useCallback(
    (key, query, setSuggestions, setVisibility) => {
      const timers = timersRef.current;
      const aborters = abortersRef.current;
      if (timers[key]) clearTimeout(timers[key]);
      if (aborters[key]) aborters[key].abort();

      const q = (query || "").trim();
      if (q.length < 2) {
        setSuggestions([]);
        setVisibility(false);
        return;
      }
      if (!MAPBOX_TOKEN) {
        console.warn("⚠️ REACT_APP_MAPBOX_TOKEN missing — autocomplete disabled");
        setSuggestions([]);
        setVisibility(false);
        return;
      }

      timers[key] = setTimeout(async () => {
        const controller = new AbortController();
        aborters[key] = controller;
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            q,
          )}.json?access_token=${MAPBOX_TOKEN}&${FORWARD_PARAMS}&autocomplete=true`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) {
            setSuggestions([]);
            setVisibility(false);
            return;
          }
          const data = await res.json();
          const results = (data.features || [])
            .map(parseFeature)
            .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
          setSuggestions(results);
          setVisibility(results.length > 0);
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("Geocode search error:", err);
          }
          setSuggestions([]);
          setVisibility(false);
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  /**
   * geocodeOnBlur(target, setter, fallbackLat=52.52)
   * Only runs when address is set but coords are empty/default.
   */
  const geocodeOnBlur = useCallback(async (target, setter, fallbackLat = 52.52) => {
    if (!target || !target.address) return;
    if (target.lat && target.lat !== 0 && target.lat !== fallbackLat) return;
    if (!MAPBOX_TOKEN) return;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        target.address,
      )}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const f = (data.features || [])[0];
      if (f && f.center) {
        setter({ lat: f.center[1], lng: f.center[0], address: f.place_name || target.address });
      }
    } catch {
      /* ignore */
    }
  }, []);

  return { search, geocodeOnBlur };
}
