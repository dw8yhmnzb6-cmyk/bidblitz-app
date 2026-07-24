/**
 * MapResultsView — Leaflet map with markers for a results list.
 *
 * Props:
 *   results:  [{ id, lat, lon, title, subtitle?, price?, image? }, ...]
 *   activeId: optional currently-highlighted id
 *   onMarkerClick: fn(item)
 *   height:   default "400px"
 *   center:   [lat,lon] optional override
 *   zoom:     default 5
 *   testId:   default "map-results-view"
 */
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon paths in webpack bundle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PRICE_ICON = (price, active) => L.divIcon({
  className: "bb-price-marker",
  html: `<div style="
    background:${active ? "#f97316" : "#15151B"};
    color:white;border:1.5px solid ${active ? "#fff" : "#f97316"};
    padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;
    white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.4);
    transform:translate(-50%,-50%);
  ">${price ?? ""}</div>`,
  iconSize: [40, 24],
  iconAnchor: [20, 12],
});

const PIN_ICON = (active) => L.divIcon({
  className: "bb-pin-marker",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:${active ? "#f97316" : "#3b82f6"};
    border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);
    transform:translate(-50%,-50%);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const FitBounds = ({ pts }) => {
  const map = useMap();
  useEffect(() => {
    if (!pts.length) return;
    if (pts.length === 1) { map.setView(pts[0], 11); return; }
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [pts, map]);
  return null;
};

export const MapResultsView = ({
  results = [],
  activeId,
  onMarkerClick,
  height = "400px",
  center,
  zoom = 5,
  testId = "map-results-view",
  className = "",
}) => {
  const valid = useMemo(() => results.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon)), [results]);
  const pts = valid.map(r => [r.lat, r.lon]);
  const initialCenter = center || (pts[0] || [50.110, 8.682]); // FRA fallback

  return (
    <div className={`rounded-2xl overflow-hidden border border-white/10 ${className}`} style={{ height }} data-testid={testId}>
      <MapContainer center={initialCenter} zoom={zoom} style={{ height: "100%", width: "100%", background: "#15151B" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pts={pts} />
        {valid.map((r) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lon]}
            icon={r.price !== undefined && r.price !== null ? PRICE_ICON(r.price, r.id === activeId) : PIN_ICON(r.id === activeId)}
            eventHandlers={{ click: () => onMarkerClick?.(r) }}
          >
            {(r.title || r.subtitle) && (
              <Popup>
                {r.image && <img src={r.image} alt="" className="w-40 h-24 object-cover rounded mb-2" />}
                <div className="font-semibold text-sm">{r.title}</div>
                {r.subtitle && <div className="text-xs text-gray-600">{r.subtitle}</div>}
                {r.price !== undefined && r.price !== null && <div className="text-xs font-bold mt-1">{r.price}</div>}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapResultsView;
