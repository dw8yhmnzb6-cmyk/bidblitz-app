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
  mapStyle,
  activePoiCategory, setActivePoiCategory,
  setPoiLoading,
  driverLocation, // { lat, lng } | null  — live driver marker (tracking view)
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const routeSourceAddedRef = useRef(false);
  const poiMarkersRef = useRef([]);

  // Init map when booking flow opens (taxiType set)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;
    let cancelled = false;

    loadMapbox().then((mb) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      try {
        const map = new mb.Map({
          container: mapContainerRef.current,
          style:
            mapStyle === "light"
              ? "mapbox://styles/mapbox/light-v11"
              : mapStyle === "satellite"
                ? "mapbox://styles/mapbox/satellite-streets-v12"
                : "mapbox://styles/mapbox/dark-v11",
          center: [pickup.lng, pickup.lat],
          zoom: 14,
          language: "de",
          attributionControl: false,
        });
        map.addControl(new mb.NavigationControl(), "top-right");

        const pickupEl = document.createElement("div");
        pickupEl.className = "mapbox-marker-pickup";
        pickupEl.style.cssText =
          "width:32px;height:32px;background:#00C2FF;border:4px solid white;border-radius:50%;box-shadow:0 0 16px rgba(0,194,255,0.6),0 4px 8px rgba(0,0,0,0.3);cursor:move;";
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

        mapRef.current = map;
      } catch (err) {
        console.error("❌ Mapbox initialization error:", err);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxiType]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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

    if (pickupMarkerRef.current && pickup.lat && pickup.lng) {
      pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
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

  // Live driver marker (tracking view)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !_mapboxgl) return;
    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }
    if (!driverMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "taxi-driver-marker";
      el.style.cssText =
        "width:38px;height:38px;background:linear-gradient(135deg,#FBBF24,#F59E0B);border:3px solid #0A0A0F;border-radius:50%;box-shadow:0 0 0 4px rgba(251,191,36,0.25),0 6px 16px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:18px;transition:transform 1.2s linear;";
      el.textContent = "🚕";
      driverMarkerRef.current = new _mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map);
    } else {
      // Smooth move
      driverMarkerRef.current.setLngLat([driverLocation.lng, driverLocation.lat]);
    }
  }, [driverLocation?.lat, driverLocation?.lng]);

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
  };
}
