/**
 * useTaxiMap — Mapbox GL map lifecycle + markers + POI tilequery for TaxiPage.
 *
 * Encapsulates:
 *  - Lazy-loading of mapbox-gl bundle (~800KB) only when the map mounts
 *  - Map initialization keyed off `taxiType` (mount when booking-form opens)
 *  - Pickup marker (draggable, reverse-geocodes on drop)
 *  - Dropoff marker (recreated when dropoff coords change)
 *  - Style switching (mapStyle prop)
 *  - POI tilequery (loadPOIs / clearPoiMarkers)
 *  - Global window.__taxiSetDropoffPOI bridge for popup-HTML "Als Ziel setzen"
 *
 * Returns: { mapContainerRef, mapRef, pickupMarkerRef, loadPOIs }
 */
import { useCallback, useEffect, useRef } from "react";
import { MAP_STYLES, POI_CATEGORIES } from "../components/taxi/TaxiConstants";

let _mapboxgl = null;
let _mapboxLoadPromise = null;
const loadMapbox = () => {
  if (_mapboxgl) return Promise.resolve(_mapboxgl);
  if (_mapboxLoadPromise) return _mapboxLoadPromise;
  _mapboxLoadPromise = Promise.all([
    import(/* webpackChunkName: "mapbox-gl" */ "mapbox-gl"),
    import(/* webpackChunkName: "mapbox-gl" */ "mapbox-gl/dist/mapbox-gl.css"),
  ]).then(([mod]) => {
    _mapboxgl = mod.default;
    _mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
    return _mapboxgl;
  });
  return _mapboxLoadPromise;
};

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function readLastKnownPickup() {
  try {
    const raw = window.localStorage.getItem('bidblitz_last_gps_pickup');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.lat) || !Number.isFinite(parsed?.lng)) return null;
    if (parsed.lat === 0 && parsed.lng === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function reverseGeocodeInline(lat, lng) {
  if (!MAPBOX_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=de&limit=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.features?.[0]?.place_name || null;
  } catch {
    return null;
  }
}

export function useTaxiMap({
  pickup, setPickup,
  dropoff, setDropoff,
  taxiType,
  retrySeed,
  mapStyle,
  activePoiCategory, setActivePoiCategory,
  setPoiLoading,
  driverLocation, // { lat, lng } | null  — live driver marker (tracking view)
  onError,        // callback (msg: string) — fired when Mapbox fails
  onReadyChange,
  surgeZones,     // [{lat, lng, multiplier}] | null — UNIQUE heatmap overlay
  showTripReplay, // bool — animates collected driverPath after ride completion
  nearbyDrivers,  // [{id, lat, lng}] — pulse markers for available taxis on booking map
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const routeSourceAddedRef = useRef(false);
  const poiMarkersRef = useRef([]);
  const nearbyMarkersRef = useRef([]);
  // Track whether the map was started with a real GPS fix. If false, we
  // need to flyTo the pickup as soon as it arrives so users in any city
  // see *their* surroundings (Berlin-Fallback otherwise leaves Pristina/etc.
  // users staring at Berlin tiles).
  const initialisedWithGpsRef = useRef(false);
  const autoFlewToPickupRef = useRef(false);
  const lastErrorRef = useRef(null);

  const pushMapError = useCallback((message) => {
    if (!message || lastErrorRef.current === message) return;
    lastErrorRef.current = message;
    onError?.(message);
  }, [onError]);

  const clearMapError = useCallback(() => {
    if (lastErrorRef.current == null) return;
    lastErrorRef.current = null;
    onError?.(null);
  }, [onError]);

  const setReady = useCallback((value) => {
    onReadyChange?.(value);
  }, [onReadyChange]);

  // Track latest pickup in a ref so map.on('load') can read current value
  // even when the closure was created at fallback-init time.
  const latestPickupRef = useRef(pickup);
  useEffect(() => { latestPickupRef.current = pickup; }, [pickup.lat, pickup.lng, pickup.address]);

  // Init map when booking flow opens (taxiType set)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    setReady(false);
    if (mapRef.current) {
      try { mapRef.current.remove(); } catch (removeError) { void removeError; }
      mapRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      driverMarkerRef.current = null;
      routeSourceAddedRef.current = false;
    }
    let cancelled = false;

    // Hard-fail visibly if the token is missing in this build
    if (!MAPBOX_TOKEN) {
      console.error("[taxi] REACT_APP_MAPBOX_TOKEN missing in build — map cannot load.");
      setReady(false);
      pushMapError("Karte nicht verfügbar. Du kannst Straße oder Ort trotzdem direkt suchen und bestellen.");
      return;
    }

    loadMapbox().then((mb) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      try {
        // Avoid initializing at [0,0] (Gulf of Guinea → completely black tiles).
        // Use a sane default until GPS arrives.
        const hasValidPickup = Number.isFinite(pickup?.lat) && Number.isFinite(pickup?.lng)
          && pickup.lat !== 0 && pickup.lng !== 0;
        const lastKnownPickup = !hasValidPickup ? readLastKnownPickup() : null;
        const hasLastKnownPickup = Number.isFinite(lastKnownPickup?.lat) && Number.isFinite(lastKnownPickup?.lng)
          && lastKnownPickup.lat !== 0 && lastKnownPickup.lng !== 0;
        const startCenter = hasValidPickup
          ? [pickup.lng, pickup.lat]
          : hasLastKnownPickup
            ? [lastKnownPickup.lng, lastKnownPickup.lat]
            : [13.405, 52.52];
        const startZoom = hasValidPickup || hasLastKnownPickup ? 14 : 11;
        initialisedWithGpsRef.current = hasValidPickup || hasLastKnownPickup;
        autoFlewToPickupRef.current = hasValidPickup || hasLastKnownPickup;

        const map = new mb.Map({
          container: mapContainerRef.current,
          style:
            mapStyle === "light"
              ? "mapbox://styles/mapbox/light-v11"
              : mapStyle === "satellite"
                ? "mapbox://styles/mapbox/satellite-streets-v12"
                : "mapbox://styles/mapbox/dark-v11",
          center: startCenter,
          zoom: startZoom,
          language: "de",
          attributionControl: false,
        });

        // iOS Safari sometimes mounts the canvas with stale dimensions when the
        // bottom-sheet animates in. Force a resize after layout settles.
        const resizeSoon = () => {
          try { map.resize(); } catch (resizeError) { void resizeError; }
        };
        // After style/load, recenter on the LATEST pickup if it's now valid.
        // Closes the GPS-arrives-after-init race condition.
        const recenterOnLatestPickup = () => {
          try {
            const p = latestPickupRef.current;
            if (!p) return;
            if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
            if (p.lat === 0 && p.lng === 0) return;
            // If we already initialised with a real GPS fix, nothing to do.
            if (initialisedWithGpsRef.current) return;
            map.jumpTo({ center: [p.lng, p.lat], zoom: 14 });
            autoFlewToPickupRef.current = true;
          } catch (recenterError) { void recenterError; }
        };
        map.on("load", () => { clearMapError(); resizeSoon(); recenterOnLatestPickup(); });
        map.on("style.load", () => { clearMapError(); resizeSoon(); recenterOnLatestPickup(); });
        map.once("idle", () => {
          clearMapError();
          resizeSoon();
          recenterOnLatestPickup();
          setReady(true);
        });
        setTimeout(resizeSoon, 250);
        setTimeout(resizeSoon, 800);
        // Surface Mapbox-internal errors (invalid token, tile load failures)
        map.on("error", (ev) => {
          const msg = ev?.error?.message || "";
          console.error("[taxi] Mapbox error:", msg, ev?.error);
          if (/request object could not be cloned|postmessage/i.test(msg)) {
            setReady(false);
            pushMapError("Karte konnte nicht stabil geladen werden. Wir schalten auf die sichere Fallback-Karte um und versuchen die Live-Karte automatisch erneut.");
          } else if (/unauthorized|access token|401|forbidden/i.test(msg)) {
            setReady(false);
            pushMapError("Karte konnte nicht geladen werden. Straßensuche und Bestellung bleiben verfügbar.");
          } else if (/network|fetch|load/i.test(msg)) {
            setReady(false);
            pushMapError("Karte konnte nicht geladen werden. Suche und Bestellung bleiben aktiv.");
          }
        });
        map.addControl(new mb.NavigationControl(), "top-right");

        const pickupEl = document.createElement("div");
        pickupEl.className = "mapbox-marker-pickup";
        pickupEl.style.cssText =
          "width:32px;height:32px;background:#00C2FF;border:4px solid white;border-radius:50%;box-shadow:0 0 16px rgba(0,194,255,0.6),0 4px 8px rgba(0,0,0,0.3);cursor:move;";
        // Only attach the pickup marker if we have a real GPS fix. Otherwise the
        // markers effect will create it once a valid pickup arrives.
        if (hasValidPickup) {
          const pickupMarker = new mb.Marker({ element: pickupEl, draggable: true })
            .setLngLat([pickup.lng, pickup.lat])
            .addTo(map);
          pickupMarkerRef.current = pickupMarker;

          pickupMarker.on("dragend", async () => {
            const lngLat = pickupMarker.getLngLat();
            const addr = await reverseGeocodeInline(lngLat.lat, lngLat.lng);
            setPickup((prev) => ({
              ...prev,
              lat: lngLat.lat,
              lng: lngLat.lng,
              ...(addr ? { address: addr } : {}),
            }));
          });
        }

        mapRef.current = map;
      } catch (err) {
        console.error("❌ Mapbox initialization error:", err);
        setReady(false);
        pushMapError("Karte konnte nicht initialisiert werden. Suche und Bestellung bleiben aktiv.");
      }
    }).catch((err) => {
      console.error("❌ Mapbox bundle load failed:", err);
      setReady(false);
      pushMapError("Karte konnte nicht geladen werden. Suche und Bestellung bleiben aktiv.");
    });

    return () => {
      cancelled = true;
      setReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxiType, retrySeed, pushMapError, clearMapError, setReady]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      setReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [setReady]);

  // Style switch
  useEffect(() => {
    if (!mapRef.current) return;
    const styleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.streets;
    mapRef.current.setStyle(styleConfig.style);
    // setStyle() wipes all custom sources & layers — mark route source as gone so
    // the next pickup/dropoff change re-adds it cleanly.
    routeSourceAddedRef.current = false;
    try {
      localStorage.setItem("bidblitz_map_style", mapStyle);
    } catch {}
  }, [mapStyle]);

  // Markers update when pickup/dropoff change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapboxgl) return;

    // Auto recenter on first valid pickup arrival (when map started with Berlin-Fallback)
    // Uses both jumpTo (instant, works even before style-load) and flyTo (smooth, animated)
    if (!autoFlewToPickupRef.current && pickup.lat && pickup.lng
        && pickup.lat !== 0 && pickup.lng !== 0) {
      autoFlewToPickupRef.current = true;
      try {
        // Instant jump first to ensure visible movement even if style not yet loaded
        map.jumpTo({ center: [pickup.lng, pickup.lat], zoom: 14 });
        // Then animate for polish (no-op if style not ready, but jumpTo already worked)
        setTimeout(() => {
          try { map.flyTo({ center: [pickup.lng, pickup.lat], zoom: 14, duration: 500, essential: true }); } catch (flyError) { void flyError; }
        }, 100);
      } catch (jumpError) { void jumpError; }
    }

    if (pickupMarkerRef.current && pickup.lat && pickup.lng) {
      pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
    } else if (pickup.lat && pickup.lng && !pickupMarkerRef.current && _mapboxgl) {
      // Late-arriving GPS: create the pickup marker now (map was initialized at fallback center)
      const pickupEl = document.createElement("div");
      pickupEl.className = "mapbox-marker-pickup";
      pickupEl.style.cssText =
        "width:32px;height:32px;background:#00C2FF;border:4px solid white;border-radius:50%;box-shadow:0 0 16px rgba(0,194,255,0.6),0 4px 8px rgba(0,0,0,0.3);cursor:move;";
      const marker = new _mapboxgl.Marker({ element: pickupEl, draggable: true })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map);
      marker.on("dragend", async () => {
        const lngLat = marker.getLngLat();
        const addr = await reverseGeocodeInline(lngLat.lat, lngLat.lng);
        setPickup((prev) => ({
          ...prev,
          lat: lngLat.lat,
          lng: lngLat.lng,
          ...(addr ? { address: addr } : {}),
        }));
      });
      pickupMarkerRef.current = marker;
    }

    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }

    if (dropoff.lat && dropoff.lng && dropoff.lat !== 0) {
      const el = document.createElement("div");
      el.className = "custom-dropoff-marker";
      el.style.cssText =
        "width:22px;height:22px;background:#EF4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(239,68,68,0.8)";
      dropoffMarkerRef.current = new _mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map);

      const bounds = new _mapboxgl.LngLatBounds(
        [pickup.lng, pickup.lat],
        [pickup.lng, pickup.lat],
      );
      bounds.extend([dropoff.lng, dropoff.lat]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });

      // Draw route polyline (Uber/Bolt parity)
      drawRoute(map, [pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]);
    } else if (pickup.lat) {
      removeRoute(map);
      map.flyTo({ center: [pickup.lng, pickup.lat], zoom: 14, duration: 600 });
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  // Helper: draw / update route between two points via Mapbox Directions API
  const drawRoute = async (map, start, end) => {
    if (!MAPBOX_TOKEN) return;
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const route = data?.routes?.[0]?.geometry;
      if (!route) return;
      const geojson = { type: "Feature", geometry: route, properties: {} };

      const ensureLayer = () => {
        if (!routeSourceAddedRef.current) {
          map.addSource("taxi-route", { type: "geojson", data: geojson });
          map.addLayer({
            id: "taxi-route-shadow",
            type: "line",
            source: "taxi-route",
            paint: {
              "line-color": "#000",
              "line-width": 8,
              "line-opacity": 0.35,
              "line-blur": 1,
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });
          map.addLayer({
            id: "taxi-route-line",
            type: "line",
            source: "taxi-route",
            paint: {
              "line-color": "#00C2FF",
              "line-width": 5,
              "line-opacity": 0.95,
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });
          routeSourceAddedRef.current = true;
        } else {
          const src = map.getSource("taxi-route");
          if (src) src.setData(geojson);
        }
      };

      if (map.isStyleLoaded()) ensureLayer();
      else map.once("style.load", ensureLayer);
    } catch (e) {
      console.warn("Route draw failed", e);
    }
  };

  const removeRoute = (map) => {
    if (!map) return;
    try {
      if (map.getLayer("taxi-route-line")) map.removeLayer("taxi-route-line");
      if (map.getLayer("taxi-route-shadow")) map.removeLayer("taxi-route-shadow");
      if (map.getSource("taxi-route")) map.removeSource("taxi-route");
    } catch {}
    routeSourceAddedRef.current = false;
  };

  const driverAnimRef = useRef({ rafId: null, fromLng: null, fromLat: null });
  const driverPathRef = useRef([]); // [[lng,lat], ...] — collected for trip-replay

  // Nearby drivers — pulse markers on booking map (subtle, live confidence signal)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapboxgl) return;

    // Clear existing
    nearbyMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    nearbyMarkersRef.current = [];

    if (driverLocation) return; // hide during active ride tracking

    const drivers = Array.isArray(nearbyDrivers) ? nearbyDrivers : [];
    if (drivers.length === 0) return;

    // Inject pulse CSS once
    if (!document.getElementById("taxi-pulse-css")) {
      const st = document.createElement("style");
      st.id = "taxi-pulse-css";
      st.textContent = `
        @keyframes taxiPulseRing { 0%{transform:scale(0.6);opacity:.85} 100%{transform:scale(2.6);opacity:0} }
        .taxi-pulse-marker{position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center}
        .taxi-pulse-marker::before,.taxi-pulse-marker::after{
          content:"";position:absolute;left:0;top:0;width:100%;height:100%;
          border-radius:50%;background:rgba(0,194,255,0.55);
          animation:taxiPulseRing 1.8s cubic-bezier(0.2,.8,.4,1) infinite;
        }
        .taxi-pulse-marker::after{animation-delay:.9s}
        .taxi-pulse-marker .dot{
          position:relative;z-index:2;width:14px;height:14px;border-radius:50%;
          background:linear-gradient(135deg,#FBBF24,#F59E0B);
          border:2px solid #0A0A0F;box-shadow:0 2px 6px rgba(0,0,0,.4);
        }
      `;
      document.head.appendChild(st);
    }

    drivers.slice(0, 12).forEach((d) => {
      if (!Number.isFinite(d?.lat) || !Number.isFinite(d?.lng)) return;
      const el = document.createElement("div");
      el.className = "taxi-pulse-marker";
      el.setAttribute("data-testid", "taxi-nearby-marker");
      const dot = document.createElement("div");
      dot.className = "dot";
      el.appendChild(dot);
      try {
        const marker = new _mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([d.lng, d.lat])
          .addTo(map);
        nearbyMarkersRef.current.push(marker);
      } catch {}
    });

    return () => {
      nearbyMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      nearbyMarkersRef.current = [];
    };
  }, [nearbyDrivers, driverLocation]);

  // Live driver marker — smooth RAF easing between polling snapshots (~5s polling → 1.4s ease)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapboxgl) return;
    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      if (driverAnimRef.current.rafId) cancelAnimationFrame(driverAnimRef.current.rafId);
      driverAnimRef.current = { rafId: null, fromLng: null, fromLat: null };
      return;
    }
    const targetLng = driverLocation.lng;
    const targetLat = driverLocation.lat;

    // First snapshot — create marker
    if (!driverMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "taxi-driver-marker";
      el.style.cssText =
        "width:38px;height:38px;background:linear-gradient(135deg,#FBBF24,#F59E0B);border:3px solid #0A0A0F;border-radius:50%;box-shadow:0 0 0 4px rgba(251,191,36,0.25),0 6px 16px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:18px;";
      el.textContent = "🚕";
      driverMarkerRef.current = new _mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([targetLng, targetLat])
        .addTo(map);
      driverAnimRef.current = { rafId: null, fromLng: targetLng, fromLat: targetLat };
      // Seed path
      driverPathRef.current = [[targetLng, targetLat]];
      return;
    }

    // Cancel any in-flight animation
    if (driverAnimRef.current.rafId) cancelAnimationFrame(driverAnimRef.current.rafId);
    const fromLng = driverAnimRef.current.fromLng ?? targetLng;
    const fromLat = driverAnimRef.current.fromLat ?? targetLat;
    const start = performance.now();
    const DUR = 1400; // ms — slightly less than 1500ms polling
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const e = easeOutCubic(t);
      const lng = fromLng + (targetLng - fromLng) * e;
      const lat = fromLat + (targetLat - fromLat) * e;
      try {
        driverMarkerRef.current?.setLngLat([lng, lat]);
      } catch {}
      if (t < 1) {
        driverAnimRef.current.rafId = requestAnimationFrame(step);
      } else {
        driverAnimRef.current.rafId = null;
        driverAnimRef.current.fromLng = targetLng;
        driverAnimRef.current.fromLat = targetLat;
      }
    };
    driverAnimRef.current.rafId = requestAnimationFrame(step);

    // Append to trip-replay path (dedupe same point)
    const path = driverPathRef.current;
    const last = path[path.length - 1];
    if (!last || Math.abs(last[0] - targetLng) + Math.abs(last[1] - targetLat) > 1e-6) {
      path.push([targetLng, targetLat]);
    }
  }, [driverLocation?.lat, driverLocation?.lng]);

  // Surge-Heatmap-Overlay (UNIQUE feature) — toggleable
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapboxgl) return;
    if (!surgeZones || !Array.isArray(surgeZones) || surgeZones.length === 0) {
      try {
        if (map.getLayer("surge-heatmap")) map.removeLayer("surge-heatmap");
        if (map.getSource("surge-heatmap-src")) map.removeSource("surge-heatmap-src");
      } catch {}
      return;
    }
    const geojson = {
      type: "FeatureCollection",
      features: surgeZones.map((z) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [z.lng, z.lat] },
        properties: { intensity: Math.max(0, Math.min(1, (z.multiplier - 1) / 1.5)) },
      })),
    };
    const add = () => {
      try {
        if (!map.getSource("surge-heatmap-src")) {
          map.addSource("surge-heatmap-src", { type: "geojson", data: geojson });
        } else {
          map.getSource("surge-heatmap-src").setData(geojson);
        }
        if (!map.getLayer("surge-heatmap")) {
          map.addLayer({
            id: "surge-heatmap",
            type: "heatmap",
            source: "surge-heatmap-src",
            maxzoom: 16,
            paint: {
              "heatmap-weight": ["interpolate", ["linear"], ["get", "intensity"], 0, 0, 1, 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 1, 16, 2.5],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(0,0,0,0)",
                0.2, "rgba(0,194,255,0.18)",
                0.4, "rgba(168,85,247,0.30)",
                0.7, "rgba(245,158,11,0.55)",
                1.0, "rgba(239,68,68,0.75)",
              ],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 35, 16, 90],
              "heatmap-opacity": 0.7,
            },
          });
        }
      } catch (e) { console.warn("heatmap add failed", e); }
    };
    if (map.isStyleLoaded()) add();
    else map.once("style.load", add);
  }, [surgeZones]);

  // Trip-Replay: animated polyline through the collected driver path after completion
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapboxgl) return;
    const cleanup = () => {
      try {
        if (map.getLayer("trip-replay-line")) map.removeLayer("trip-replay-line");
        if (map.getSource("trip-replay-src")) map.removeSource("trip-replay-src");
      } catch {}
    };
    if (!showTripReplay) { cleanup(); return; }
    const coords = driverPathRef.current;
    if (!coords || coords.length < 2) { cleanup(); return; }

    let i = 1;
    let animId = null;
    const animateFrame = () => {
      const partial = coords.slice(0, i);
      const data = { type: "Feature", geometry: { type: "LineString", coordinates: partial }, properties: {} };
      try {
        if (!map.getSource("trip-replay-src")) {
          map.addSource("trip-replay-src", { type: "geojson", data });
          map.addLayer({
            id: "trip-replay-line",
            type: "line",
            source: "trip-replay-src",
            paint: {
              "line-color": "#10D981",
              "line-width": 6,
              "line-opacity": 0.95,
              "line-blur": 0.5,
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        } else {
          map.getSource("trip-replay-src").setData(data);
        }
      } catch (e) { /* ignore */ }
      i++;
      if (i <= coords.length) animId = setTimeout(animateFrame, 50);
    };
    const startAnim = () => { animateFrame(); };
    if (map.isStyleLoaded()) startAnim();
    else map.once("style.load", startAnim);

    return () => {
      if (animId) clearTimeout(animId);
      cleanup();
    };
  }, [showTripReplay]);

  // POI tilequery
  const clearPoiMarkers = useCallback(() => {
    poiMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch {}
    });
    poiMarkersRef.current = [];
  }, []);

  const loadPOIs = useCallback(
    async (categoryKey) => {
      const map = mapRef.current;
      if (!map) return;
      clearPoiMarkers();
      if (!categoryKey) {
        setActivePoiCategory(null);
        return;
      }
      setActivePoiCategory(categoryKey);
      setPoiLoading(true);
      try {
        const center = map.getCenter();
        const cat = POI_CATEGORIES[categoryKey];
        const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${center.lng},${center.lat}.json?radius=2500&limit=40&dedupe=true&layers=poi_label&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const features = (data.features || []).filter((f) => {
          const cls = (f.properties?.class || "").toLowerCase();
          const maki = (f.properties?.maki || "").toLowerCase();
          return cat.filter.some((t) => cls.includes(t) || maki.includes(t));
        });
        features.slice(0, 30).forEach((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const el = document.createElement("div");
          el.className = "mapbox-poi-marker";
          el.style.cssText = `width:30px;height:30px;border-radius:50%;background:${cat.color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;`;
          el.textContent = cat.icon;
          const safeName = (f.properties?.name_de || f.properties?.name || "").replace(/'/g, "\\'");
          const label = f.properties?.name_de || f.properties?.name || cat.label;
          const popup = new _mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(`
            <div style="font-family:system-ui;color:#0A0A0F;padding:2px 4px;min-width:160px;">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${label}</div>
              <button onclick="window.__taxiSetDropoffPOI(${lng},${lat},'${safeName}')"
                style="background:#00C2FF;color:white;border:none;padding:6px 10px;border-radius:8px;font-weight:600;font-size:11px;cursor:pointer;width:100%;">Als Ziel setzen</button>
            </div>
          `);
          const marker = new _mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);
          poiMarkersRef.current.push(marker);
        });
      } catch (err) {
        console.error("POI load failed:", err);
      } finally {
        setPoiLoading(false);
      }
    },
    [clearPoiMarkers, setActivePoiCategory, setPoiLoading],
  );

  // Global bridge for the popup HTML "Als Ziel setzen" button
  useEffect(() => {
    window.__taxiSetDropoffPOI = (lng, lat, name) => {
      setDropoff({
        lat: Number(lat),
        lng: Number(lng),
        address: name || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
      });
      clearPoiMarkers();
      setActivePoiCategory(null);
    };
    return () => {
      delete window.__taxiSetDropoffPOI;
    };
  }, [setDropoff, clearPoiMarkers, setActivePoiCategory]);

  // Clear POIs when leaving taxi flow
  useEffect(() => {
    if (!taxiType) clearPoiMarkers();
  }, [taxiType, clearPoiMarkers]);

  return {
    mapContainerRef,
    mapRef,
    pickupMarkerRef,
    loadPOIs,
    driverPathRef,
  };
}
