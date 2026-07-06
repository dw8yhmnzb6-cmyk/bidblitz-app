/**
 * useTaxiGeocoder — Mapbox forward-geocoding hook for taxi pickup/dropoff.
 *
 * Provides:
 *  - search(query, setterFn): debounced suggestion list
 *  - geocodeOnBlur({address, lat, lng}): coordinate fix-up if user typed
 *    a free-form address without selecting a suggestion.
 *
 * STRATEGY:
 *  1) If REACT_APP_MAPBOX_TOKEN is present in the build → call Mapbox DIRECTLY
 *     (fastest, no backend hop).
 *  2) Else (e.g. Production GitHub Action forgot the secret) → transparently
 *     fall back to backend proxy /api/taxi/geocode which uses server-side
 *     MAPBOX_TOKEN. So address autocomplete always works.
 */
import { useCallback, useRef, useEffect } from "react";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const FORWARD_PARAMS =
  "language=de&limit=8&types=address,poi,place,locality,neighborhood,postcode,district";
const COUNTRY_HINT = "de,at,ch,xk,al,mk,me";

function buildDirectUrl(query, proximity) {
  const hasProx = proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng)
    && proximity.lat !== 0;
  const prox = hasProx ? `&proximity=${proximity.lng},${proximity.lat}` : "";
  const country = `&country=${COUNTRY_HINT}`;
  const bbox = hasProx
    ? `&bbox=${proximity.lng - 1.4},${proximity.lat - 1.4},${proximity.lng + 1.4},${proximity.lat + 1.4}`
    : "";
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?access_token=${MAPBOX_TOKEN}&${FORWARD_PARAMS}&autocomplete=true${country}${prox}${bbox}`;
}

function buildProxyUrl(query, proximity, limit = 8) {
  return `${BACKEND_URL}/api/taxi/geocode?q=${encodeURIComponent(query)}&limit=${limit}${
    proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng) && proximity.lat !== 0
      ? `&lat=${proximity.lat}&lng=${proximity.lng}`
      : ""
  }&country=${encodeURIComponent(COUNTRY_HINT)}`;
}

async function fetchFeatures(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Geocode failed: ${res.status}`);
  }
  const data = await res.json();
  return data?.features || [];
}

async function fetchWithFallback(query, proximity, signal) {
  const directUrl = MAPBOX_TOKEN ? buildDirectUrl(query, proximity) : null;
  const proxyUrl = BACKEND_URL ? buildProxyUrl(query, proximity) : null;
  const urls = [directUrl, proxyUrl].filter(Boolean);

  let lastError = null;
  for (const url of urls) {
    try {
      const features = await fetchFeatures(url, signal);
      if (features.length > 0 || url === urls[urls.length - 1]) {
        return features;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

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

function scoreFeature(feature, query, proximity) {
  const q = (query || "").trim().toLowerCase();
  const text = `${feature?.text || ""} ${feature?.place_name || ""}`.toLowerCase();
  let score = 0;
  if (text.startsWith(q)) score += 120;
  if (text.includes(q)) score += 60;
  const types = feature?.place_type || [];
  if (types.includes("address")) score += 28;
  if (types.includes("poi")) score += 20;
  if (types.includes("place")) score += 14;
  const center = feature?.center || [];
  if (proximity && Number.isFinite(center[1]) && Number.isFinite(center[0])) {
    const dLat = Math.abs(center[1] - proximity.lat);
    const dLng = Math.abs(center[0] - proximity.lng);
    score += Math.max(0, 18 - ((dLat + dLng) * 12));
  }
  return score;
}

export function useTaxiGeocoder({ debounceMs = 100 } = {}) {
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
    (key, query, setSuggestions, setVisibility, proximity = null) => {
      const timers = timersRef.current;
      const aborters = abortersRef.current;
      if (timers[key]) clearTimeout(timers[key]);
      if (aborters[key]) aborters[key].abort();

      const q = (query || "").trim();
      if (q.length < 1) {
        setSuggestions([]);
        setVisibility(false);
        return;
      }

      timers[key] = setTimeout(async () => {
        const controller = new AbortController();
        aborters[key] = controller;
        try {
          if (!MAPBOX_TOKEN && !BACKEND_URL) {
            setSuggestions([]);
            setVisibility(false);
            return;
          }
          const features = await fetchWithFallback(q, proximity, controller.signal);
          const results = features
            .slice()
            .sort((a, b) => scoreFeature(b, q, proximity) - scoreFeature(a, q, proximity))
            .map(parseFeature)
            .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
            .filter((r) => {
              const hay = `${r.name || ''} ${r.cityZip || ''} ${r.address || ''}`.toLowerCase();
              return hay.includes(q.toLowerCase());
            });
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
    try {
      let url;
      if (MAPBOX_TOKEN) {
        url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          target.address,
        )}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1&country=${COUNTRY_HINT}`;
      } else if (BACKEND_URL) {
        url = `${BACKEND_URL}/api/taxi/geocode?q=${encodeURIComponent(target.address)}&limit=1&country=${encodeURIComponent(COUNTRY_HINT)}`;
      } else {
        return;
      }
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
