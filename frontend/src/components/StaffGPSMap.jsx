/**
 * Staff GPS Live Map Component
 * Mapbox GL JS für Live-Standort-Tracking
 */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "pk.placeholder";

mapboxgl.accessToken = MAPBOX_TOKEN;

export default function StaffGPSMap({ staffLocations = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return;

    // Default center (Berlin)
    const center = [13.4050, 52.5200];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: 12,
    });

    map.current.on("load", () => {
      setMapReady(true);
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when staff locations change
  useEffect(() => {
    if (!mapReady || !map.current) return;

    const currentStaffIds = new Set(staffLocations.map((s) => s.staff_id));

    // Remove old markers
    Object.keys(markers.current).forEach((staffId) => {
      if (!currentStaffIds.has(staffId)) {
        markers.current[staffId].remove();
        delete markers.current[staffId];
      }
    });

    // Add or update markers
    staffLocations.forEach((staff) => {
      if (!staff.last_location) return;

      const { lat, lng } = staff.last_location;
      const staffId = staff.staff_id;

      if (markers.current[staffId]) {
        // Update existing marker position
        markers.current[staffId].setLngLat([lng, lat]);
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = "staff-marker";
        el.style.cssText = `
          width: 40px;
          height: 40px;
          background-color: #10B981;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        `;
        el.textContent = (staff.user_name || "?")[0].toUpperCase();

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 8px;">
                <p style="font-weight: bold; margin: 0 0 4px;">${staff.user_name || "Mitarbeiter"}</p>
                <p style="font-size: 12px; color: #666; margin: 0;">${staff.user_email || ""}</p>
                <p style="font-size: 11px; color: #999; margin: 4px 0 0;">
                  ${new Date(staff.last_location.updated_at).toLocaleTimeString("de-DE")}
                </p>
              </div>
            `)
          )
          .addTo(map.current);

        markers.current[staffId] = marker;
      }
    });

    // Fit bounds to show all markers
    if (staffLocations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      staffLocations.forEach((staff) => {
        if (staff.last_location) {
          bounds.extend([staff.last_location.lng, staff.last_location.lat]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [staffLocations, mapReady]);

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-gray-300">
      <div ref={mapContainer} className="w-full h-full" />
      
      {!mapReady && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Karte lädt...</p>
          </div>
        </div>
      )}

      {MAPBOX_TOKEN === "pk.placeholder" && (
        <div className="absolute top-4 left-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg p-3 text-sm">
          ⚠️ Mapbox Token fehlt. Setze REACT_APP_MAPBOX_TOKEN in .env
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          <span>Aktiver Mitarbeiter ({staffLocations.length})</span>
        </div>
      </div>
    </div>
  );
}
