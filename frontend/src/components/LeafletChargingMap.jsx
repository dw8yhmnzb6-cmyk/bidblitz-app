/**
 * Leaflet EV Charging Station Map (Chargemap/PlugShare Style)
 * Color-coded pins: Green=Available, Orange=Occupied, Red=Offline
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const LeafletChargingMap = ({ stations, center = [51.1657, 10.4515], zoom = 6, onStationClick }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Init map
    mapInstance.current = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [center, zoom]);

  // Update markers when stations change
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Create custom pin colors based on status
    const getPinColor = (status) => {
      switch (status) {
        case 'available': return '#10B981'; // Green
        case 'occupied': return '#F59E0B';  // Orange
        case 'offline': return '#EF4444';   // Red
        default: return '#8B95A5';          // Gray
      }
    };

    const createCustomIcon = (status, power) => {
      const color = getPinColor(status);
      return L.divIcon({
        className: 'custom-charging-pin',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: ${color};
            border: 3px solid #000;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: 14px;
              font-weight: bold;
              color: #000;
            ">⚡</span>
          </div>
          <div style="
            position: absolute;
            top: -18px;
            left: 50%;
            transform: translateX(-50%);
            background: ${color};
            color: #000;
            font-size: 9px;
            font-weight: bold;
            padding: 2px 4px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${power}kW</div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40],
      });
    };

    // Add new markers
    stations.forEach(station => {
      if (!station.lat || !station.lng) return;

      const marker = L.marker([station.lat, station.lng], {
        icon: createCustomIcon(station.status, station.power_kw),
      }).addTo(mapInstance.current);

      // Popup
      marker.bindPopup(`
        <div style="color: #000; font-family: sans-serif;">
          <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold;">${station.name}</h3>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Betreiber:</strong> ${station.operator}</p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Leistung:</strong> ${station.power_kw} kW</p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Preis:</strong> ${station.price_per_kwh}€/kWh</p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Verfügbar:</strong> ${station.slots_available}/${station.slots_total}</p>
        </div>
      `);

      // Click event
      if (onStationClick) {
        marker.on('click', () => onStationClick(station));
      }

      markersRef.current.push(marker);
    });

    // Auto-fit bounds if multiple stations
    if (stations.length > 0) {
      const bounds = L.latLngBounds(stations.map(s => [s.lat, s.lng]));
      mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [stations, onStationClick]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

export default LeafletChargingMap;
