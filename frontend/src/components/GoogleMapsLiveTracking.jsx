import React, { useEffect, useRef, useState } from 'react';
import { Loader } from 'lucide-react';

/**
 * GoogleMapsLiveTracking — Real-time Driver Position
 * Alternative zu Leaflet mit Google Maps API
 */
export default function GoogleMapsLiveTracking({ 
  driverPosition, 
  pickupPosition, 
  destinationPosition,
  apiKey 
}) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState({ driver: null, pickup: null, destination: null });
  const [polyline, setPolyline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (map) {
      updateMarkers();
      updateRoute();
    }
  }, [driverPosition, pickupPosition, destinationPosition, map]);

  const loadGoogleMaps = () => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey || 'DEMO_API_KEY'}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current) return;

    const defaultCenter = driverPosition || pickupPosition || { lat: 52.52, lng: 13.405 }; // Berlin

    const googleMap = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      styles: [
        // Dark Mode Google Maps Style
        { elementType: 'geometry', stylers: [{ color: '#212121' }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
        { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
        { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
        { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
      ],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
    });

    setMap(googleMap);
    setLoading(false);
  };

  const updateMarkers = () => {
    if (!map || !window.google) return;

    // Driver Marker (Car Icon)
    if (driverPosition) {
      if (markers.driver) {
        markers.driver.setPosition(driverPosition);
      } else {
        const driverMarker = new window.google.maps.Marker({
          position: driverPosition,
          map: map,
          icon: {
            path: 'M17.402 0H5.643C2.526 0 0 3.467 0 6.584v34.804c0 3.116 2.526 5.644 5.643 5.644h11.759c3.116 0 5.644-2.527 5.644-5.644V6.584C23.044 3.467 20.518 0 17.402 0zM22 41.388c0 2.558-2.084 4.644-4.644 4.644H5.643C3.084 46.032 1 43.946 1 41.388V6.584c0-2.558 2.084-4.584 4.643-4.584h11.759c2.559 0 4.644 2.026 4.644 4.584v34.804z',
            fillColor: '#00E0FF',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 0.7,
            anchor: new window.google.maps.Point(11, 23),
          },
          title: 'Fahrer',
        });
        setMarkers(prev => ({ ...prev, driver: driverMarker }));
      }
    }

    // Pickup Marker
    if (pickupPosition) {
      if (!markers.pickup) {
        const pickupMarker = new window.google.maps.Marker({
          position: pickupPosition,
          map: map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#00C2FF',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 8,
          },
          title: 'Abholung',
        });
        setMarkers(prev => ({ ...prev, pickup: pickupMarker }));
      }
    }

    // Destination Marker
    if (destinationPosition) {
      if (!markers.destination) {
        const destMarker = new window.google.maps.Marker({
          position: destinationPosition,
          map: map,
          icon: {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: '#7B2CFF',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 2,
            anchor: new window.google.maps.Point(12, 24),
          },
          title: 'Ziel',
        });
        setMarkers(prev => ({ ...prev, destination: destMarker }));
      }
    }

    // Auto-fit bounds
    if (driverPosition || pickupPosition || destinationPosition) {
      const bounds = new window.google.maps.LatLngBounds();
      if (driverPosition) bounds.extend(driverPosition);
      if (pickupPosition) bounds.extend(pickupPosition);
      if (destinationPosition) bounds.extend(destinationPosition);
      map.fitBounds(bounds, 50);
    }
  };

  const updateRoute = () => {
    if (!map || !window.google || !driverPosition || !destinationPosition) return;

    // Remove old polyline
    if (polyline) {
      polyline.setMap(null);
    }

    // Draw route (simplified straight line - use Directions API for real route)
    const path = [driverPosition, destinationPosition];
    const newPolyline = new window.google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#00E0FF',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: map,
    });

    setPolyline(newPolyline);

    // For real route, use Directions Service:
    // const directionsService = new window.google.maps.DirectionsService();
    // directionsService.route({...})
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A]">
        <Loader size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />
  );
}
