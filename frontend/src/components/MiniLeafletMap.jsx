/**
 * MiniLeafletMap - Drop-in replacement for Mapbox static images.
 * Uses the existing Leaflet + Carto tile setup (already in package).
 */
import { useEffect, useRef } from "react";

const MiniLeafletMap = ({
  lat,
  lng,
  zoom = 14,
  height = 200,
  pins = [], // [{lat, lng, color, label}]
  autoFitPins = false,
  className = "",
  testId = "mini-leaflet-map",
  interactive = true,
  onMapClick,
  polyline = [],
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const lineRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || lat == null || lng == null) return;
    let mounted = true;
    let cleanupFns = [];

    (async () => {
      const L = (await import("leaflet")).default;
      // Inject Leaflet CSS once
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet-css", "true");
        document.head.appendChild(link);
      }
      if (!mounted) return;

      const map = L.map(containerRef.current, {
        zoomControl: interactive,
        attributionControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
      }).setView([lat, lng], zoom);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Render pins
      const allPins = pins.length > 0 ? pins : [{ lat, lng, color: "#3B82F6" }];
      markerRefs.current = [];
      allPins.forEach((p) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
        const icon = L.divIcon({
          html: `<div style="width:24px;height:24px;border-radius:50%;background:${p.color || "#3B82F6"};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${p.label || "•"}</div>`,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        markerRefs.current.push(marker);
      });

      const routePoints = polyline
        .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map((p) => [p[0], p[1]]);
      if (routePoints.length > 1) {
        lineRef.current = L.polyline(routePoints, {
          color: "#0F6FFF",
          weight: 5,
          opacity: 0.9,
        }).addTo(map);
      }

      if (autoFitPins && (allPins.length > 1 || routePoints.length > 1)) {
        const points = [
          ...allPins
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p) => [p.lat, p.lng]),
          ...routePoints,
        ];
        if (points.length > 1) {
          map.fitBounds(points, { padding: [48, 48], maxZoom: zoom });
        }
      }

      if (interactive && onMapClick) {
        map.on("click", (event) => {
          onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      }

      cleanupFns.push(() => map.remove());
    })().catch(() => {});

    return () => {
      mounted = false;
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (cleanupError) {
          void cleanupError;
        }
      });
      mapRef.current = null;
    };
  }, [lat, lng, zoom, autoFitPins, interactive, onMapClick, JSON.stringify(pins), JSON.stringify(polyline)]);

  if (lat == null || lng == null) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className={`bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[11px] text-gray-500 ${className}`}
        style={{ height }}
      >
        GPS aktivieren oder Adresse eingeben
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ height, width: "100%", position: "relative", zIndex: 0 }}
    />
  );
};

export default MiniLeafletMap;
