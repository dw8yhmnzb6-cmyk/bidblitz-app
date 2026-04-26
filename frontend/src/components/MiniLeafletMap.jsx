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
  className = "",
  testId = "mini-leaflet-map",
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

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
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      }).setView([lat, lng], zoom);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Render pins
      const allPins = pins.length > 0 ? pins : [{ lat, lng, color: "#3B82F6" }];
      allPins.forEach((p) => {
        const icon = L.divIcon({
          html: `<div style="width:24px;height:24px;border-radius:50%;background:${p.color || "#3B82F6"};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${p.label || "•"}</div>`,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([p.lat, p.lng], { icon }).addTo(map);
      });

      cleanupFns.push(() => map.remove());
    })().catch(() => {});

    return () => {
      mounted = false;
      cleanupFns.forEach((fn) => { try { fn(); } catch {} });
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom, JSON.stringify(pins)]);

  if (lat == null || lng == null) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className={`bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[11px] text-gray-500 ${className}`}
        style={{ height }}
      >
        Keine Position
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
