import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/I18nContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ReviewModal from '../components/ReviewModal';
import SplitPaymentModal from '../components/SplitPaymentModal';
import LiveChat from '../components/LiveChat';
import GroupOrderModal from '../components/GroupOrderModal';
import GroupTrackerBanner from '../components/GroupTrackerBanner';
import KYCBanner from '../components/KYCBanner';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const API = process.env.REACT_APP_BACKEND_URL;

// Map Style Tile-Provider (CartoDB + ESRI) — Apple Maps-ähnliche Auswahl
const MAP_STYLES = {
  dark: {
    name: 'Hell',
    description: 'Apple-Maps Stil',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  light: {
    name: 'Hell',
    description: 'Apple-Maps Stil',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  satellite: {
    name: 'Satellit',
    description: 'Luftbild',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    subdomains: '',
    maxZoom: 19,
  },
};

// Status badge colors
const STATUS_COLORS = {
  requested: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-blue-500/20 text-blue-400',
  arriving: 'bg-cyan-500/20 text-cyan-400',
  started: 'bg-green-500/20 text-green-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS = {
  requested: 'Suche Fahrer...',
  accepted: 'Fahrer gefunden',
  arriving: 'Fahrer kommt',
  started: 'Fahrt läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

// Professional vehicle SVG icons (Uber/Bolt-style silhouettes)
const VehicleIcon = ({ type, className = '', active = false }) => {
  const color = active ? '#00C2FF' : '#8B95A5';
  const accent = active ? '#00E5FF' : '#B8C1CC';

  if (type === 'premium') {
    // Sleek luxury sedan silhouette (Mercedes E-Class / BMW 5 style)
    return (
      <svg viewBox="0 0 64 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`premGrad-${active ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={color} stopOpacity="1"/>
          </linearGradient>
        </defs>
        {/* Body */}
        <path d="M4 22 L8 14 C10 10 14 8 20 7 L44 7 C50 8 54 10 56 14 L60 22 L60 26 L4 26 Z"
              fill={`url(#premGrad-${active ? 'on' : 'off'})`} stroke={accent} strokeWidth="0.5"/>
        {/* Windows */}
        <path d="M14 13 L18 9 L38 9 L46 13 L44 15 L16 15 Z" fill="#0A1420" opacity="0.85"/>
        <path d="M32 9 L32 15" stroke={color} strokeWidth="0.4" opacity="0.6"/>
        {/* Headlight */}
        <circle cx="58" cy="17" r="1.2" fill="#FFF8DC"/>
        {/* Wheels */}
        <circle cx="16" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="16" cy="26" r="2" fill="#2A2A2A"/>
        <circle cx="48" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="48" cy="26" r="2" fill="#2A2A2A"/>
      </svg>
    );
  }

  if (type === 'van') {
    // Minivan / 7-seater silhouette (VW Sharan / Mercedes V-Class style)
    return (
      <svg viewBox="0 0 64 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`vanGrad-${active ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={color} stopOpacity="1"/>
          </linearGradient>
        </defs>
        {/* Body – taller roof for van */}
        <path d="M4 24 L5 10 C5 8 7 7 10 7 L52 7 C56 7 58 9 59 12 L60 24 L60 26 L4 26 Z"
              fill={`url(#vanGrad-${active ? 'on' : 'off'})`} stroke={accent} strokeWidth="0.5"/>
        {/* Windows */}
        <path d="M9 11 L9 17 L27 17 L27 9 L12 9 Z" fill="#0A1420" opacity="0.85"/>
        <path d="M30 9 L30 17 L50 17 L49 11 L30 9 Z" fill="#0A1420" opacity="0.85"/>
        <path d="M29 9 L29 17" stroke={color} strokeWidth="0.4" opacity="0.6"/>
        {/* Headlight */}
        <rect x="57" y="16" width="2.5" height="2" rx="0.5" fill="#FFF8DC"/>
        {/* Wheels */}
        <circle cx="16" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="16" cy="26" r="2" fill="#2A2A2A"/>
        <circle cx="48" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
        <circle cx="48" cy="26" r="2" fill="#2A2A2A"/>
      </svg>
    );
  }

  // Standard – compact hatchback/sedan (VW Golf / Toyota Prius style)
  return (
    <svg viewBox="0 0 64 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`stdGrad-${active ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={color} stopOpacity="1"/>
        </linearGradient>
      </defs>
      {/* Body */}
      <path d="M4 23 L9 15 C11 12 15 10 20 9 L42 9 C48 10 53 13 56 16 L60 23 L60 26 L4 26 Z"
            fill={`url(#stdGrad-${active ? 'on' : 'off'})`} stroke={accent} strokeWidth="0.5"/>
      {/* Windshield + rear window */}
      <path d="M14 15 L20 11 L38 11 L45 15 L43 17 L16 17 Z" fill="#0A1420" opacity="0.85"/>
      <path d="M30 11 L30 17" stroke={color} strokeWidth="0.4" opacity="0.6"/>
      {/* Headlight */}
      <circle cx="58" cy="18" r="1.1" fill="#FFF8DC"/>
      {/* Door handle */}
      <rect x="25" y="19" width="4" height="0.8" rx="0.4" fill={accent} opacity="0.5"/>
      {/* Wheels */}
      <circle cx="16" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
      <circle cx="16" cy="26" r="2" fill="#2A2A2A"/>
      <circle cx="48" cy="26" r="4.5" fill="#0F0F0F" stroke={accent} strokeWidth="1"/>
      <circle cx="48" cy="26" r="2" fill="#2A2A2A"/>
    </svg>
  );
};

// Legacy mapping (kept for history list fallback)
const VEHICLE_ICONS = {
  standard: 'standard',
  premium: 'premium',
  van: 'van',
};

export default function TaxiPage({ onNavigate }) {
  const { t } = useI18n();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // State
  const [view, setView] = useState('book'); // book, tracking, history
  const [taxiType, setTaxiType] = useState(''); // '' = not selected, 'business' = Unternehmer, 'private' = Privat
  const [pickup, setPickup] = useState({ lat: 52.52, lng: 13.405, address: '' });
  const [dropoff, setDropoff] = useState({ lat: 0, lng: 0, address: '' });
  const [estimates, setEstimates] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  const [error, setError] = useState('');
  const [surge, setSurge] = useState({ active: false, multiplier: 1.0 });
  const [userBalance, setUserBalance] = useState(0);
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [moduleMessage, setModuleMessage] = useState('');

  // Super-App parity (review, split, live chat)
  const [showReview, setShowReview] = useState(false);
  const [reviewRideId, setReviewRideId] = useState(null);
  const [showSplit, setShowSplit] = useState(false);
  const [splitRideId, setSplitRideId] = useState(null);
  const [splitTotal, setSplitTotal] = useState(0);
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [showGroupRide, setShowGroupRide] = useState(false);
  
  // Driver Onboarding Modal
  const [showDriverOnboarding, setShowDriverOnboarding] = useState(false);
  const [onboardingType, setOnboardingType] = useState(''); // 'business' or 'private'
  const [onboardingForm, setOnboardingForm] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    vehicle_type: 'standard',
    city: '',
    message: '',
  });
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);

  // Autocomplete state
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [showPickupSugg, setShowPickupSugg] = useState(false);
  const [showDropoffSugg, setShowDropoffSugg] = useState(false);
  const pickupTimer = useRef(null);
  const dropoffTimer = useRef(null);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveIcon, setSaveIcon] = useState("star");

  // Current address (Reverse Geocoded)
  const [currentAddress, setCurrentAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Map style picker (Uber/Bolt style)
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('bidblitz_map_style') || 'dark');
  const [showMapStyles, setShowMapStyles] = useState(false);
  const tileLayerRef = useRef(null);

  // Interactive map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);

  // Initialize Leaflet Map (CartoDB Dark Matter – Uber/Bolt-Style) — re-runs when container becomes visible
  useEffect(() => {
    // Wait for container (it's conditionally rendered after taxiType is selected)
    if (!mapContainerRef.current) return;
    if (mapRef.current) {
      // Already initialized – just make sure size is correct after layout change
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 100);
      return;
    }

    console.log('✓ Initializing Leaflet (CartoDB Dark) map...');

    try {
      const map = L.map(mapContainerRef.current, {
        center: [pickup.lat, pickup.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });

      // Apply current map style (dark/light/satellite)
      const styleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.dark;
      tileLayerRef.current = L.tileLayer(styleConfig.url, {
        attribution: styleConfig.attribution,
        subdomains: styleConfig.subdomains,
        maxZoom: styleConfig.maxZoom,
        crossOrigin: true,
      }).addTo(map);

      // Professional pulsing pickup marker (cyan glow, Uber-style)
      const pickupIcon = L.divIcon({
        className: 'taxi-pickup-pulse',
        html: `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,194,255,0.25);animation:taxi-pulse 2s ease-out infinite;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#00C2FF;border:3px solid #fff;box-shadow:0 0 12px rgba(0,194,255,0.9),0 2px 6px rgba(0,0,0,0.5);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const pickupMarker = L.marker([pickup.lat, pickup.lng], {
        draggable: true,
        icon: pickupIcon,
      }).addTo(map);
      pickupMarkerRef.current = pickupMarker;

      pickupMarker.on('dragend', async (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPickup(prev => ({ ...prev, lat, lng }));
        await reverseGeocode(lat, lng);
      });

      // Subtle attribution bottom-right
      L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);

      mapRef.current = map;

      // Force size recalculation after container animation finishes
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 500);

      console.log('✓ Leaflet Dark map loaded successfully');
    } catch (error) {
      console.error('❌ Map initialization error:', error);
    }
  }, [taxiType]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Switch tile layer when user picks a different map style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const styleConfig = MAP_STYLES[mapStyle] || MAP_STYLES.dark;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(styleConfig.url, {
      attribution: styleConfig.attribution,
      subdomains: styleConfig.subdomains,
      maxZoom: styleConfig.maxZoom,
      crossOrigin: true,
    }).addTo(map);

    // Persist user preference
    localStorage.setItem('bidblitz_map_style', mapStyle);
  }, [mapStyle]);
  
  // Get current GPS location
  useEffect(() => {
    getCurrentLocation();
  }, []);
  
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCurrentAddress('Geolocation wird nicht unterstützt');
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('✓ GPS Position:', latitude, longitude);

        setPickup(prev => ({ ...prev, lat: latitude, lng: longitude }));

        // Update map center & pickup marker
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15);
          mapRef.current.invalidateSize();
        }
        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLatLng([latitude, longitude]);
        }

        // Reverse geocode to get address
        await reverseGeocode(latitude, longitude);
        setLoadingLocation(false);
      },
      (error) => {
        console.error('❌ Geolocation error:', error);
        setCurrentAddress('Standort konnte nicht ermittelt werden');
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };
  
  // Reverse Geocoding: GPS → Adresse (Nominatim / OpenStreetMap)
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=de`
      );
      if (!response.ok) throw new Error('Reverse geocoding failed');
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.pedestrian || addr.footway || '';
        const houseNumber = addr.house_number || '';
        const postcode = addr.postcode || '';
        const city = addr.city || addr.town || addr.village || addr.suburb || '';

        const streetLine = `${street} ${houseNumber}`.trim();
        const cityLine = `${postcode} ${city}`.trim();
        const fullAddress = [streetLine, cityLine].filter(Boolean).join(', ');

        setCurrentAddress(fullAddress);
        setPickup(prev => ({ ...prev, address: fullAddress }));

        console.log('✓ Address:', fullAddress);
      }
    } catch (error) {
      console.error('❌ Reverse geocoding error:', error);
      setCurrentAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  // Update markers when pickup/dropoff changes (Leaflet)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Pickup marker – just update position (don't recreate, to preserve draggable handler)
    if (pickupMarkerRef.current && pickup.lat && pickup.lng) {
      pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
    }

    // Dropoff marker
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }
    if (dropoff.lat && dropoff.lng && dropoff.lat !== 0) {
      const dropoffIcon = L.divIcon({
        className: 'custom-dropoff-marker',
        html: '<div style="width:22px;height:22px;background:#EF4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(239,68,68,0.8)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      dropoffMarkerRef.current = L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon }).addTo(map);

      // Fit bounds to show both markers
      const bounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (pickup.lat) {
      map.setView([pickup.lat, pickup.lng], 14);
    }
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  useEffect(() => { loadSavedPlaces(); }, []);

  const loadSavedPlaces = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/saved-places`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setSavedPlaces(d.places || []); }
    } catch {}
  };

  const savePlace = async (address, lat, lng) => {
    if (!saveName || !address) return;
    try {
      await fetch(`${API}/api/taxi/saved-places`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName, icon: saveIcon, address, lat, lng }),
      });
      loadSavedPlaces();
      setShowSaveModal(false); setSaveName(""); setSaveIcon("star");
    } catch {}
  };

  const deletePlace = async (placeId) => {
    try {
      await fetch(`${API}/api/taxi/saved-places/${placeId}`, { method: 'DELETE', credentials: 'include' });
      loadSavedPlaces();
    } catch {}
  };

  const geocodeSearch = async (query, setter, showSetter) => {
    if (!query || query.length < 2) { setter([]); showSetter(false); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&accept-language=de&countrycodes=de,at,ch`
      );
      if (res.ok) {
        const data = await res.json();
        const results = (data || []).map(f => {
          const addr = f.address || {};
          const name = addr.road
            ? `${addr.road}${addr.house_number ? ' ' + addr.house_number : ''}`
            : (f.name || f.display_name.split(',')[0]);
          return {
            name,
            address: f.display_name,
            lat: parseFloat(f.lat),
            lng: parseFloat(f.lon),
            type: f.type || 'address',
          };
        });
        setter(results);
        showSetter(results.length > 0);
      }
    } catch { setter([]); showSetter(false); }
  };

  const handlePickupChange = (text) => {
    setPickup(p => ({ ...p, address: text }));
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(() => geocodeSearch(text, setPickupSuggestions, setShowPickupSugg), 300);
  };

  const handleDropoffChange = (text) => {
    setDropoff(p => ({ ...p, address: text }));
    if (dropoffTimer.current) clearTimeout(dropoffTimer.current);
    dropoffTimer.current = setTimeout(() => geocodeSearch(text, setDropoffSuggestions, setShowDropoffSugg), 300);
  };

  // Auto-geocode on blur if no coords yet
  const geocodeOnBlur = async (type) => {
    const target = type === 'pickup' ? pickup : dropoff;
    const setter = type === 'pickup' ? setPickup : setDropoff;
    if (target.address && (!target.lat || target.lat === 0 || target.lat === 52.52)) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(target.address)}&limit=1&accept-language=de&countrycodes=de,at,ch`
        );
        if (res.ok) {
          const data = await res.json();
          const f = data?.[0];
          if (f) setter({ lat: parseFloat(f.lat), lng: parseFloat(f.lon), address: f.display_name || target.address });
        }
      } catch {}
    }
  };

  const selectPickupSugg = (s) => {
    setPickup({ lat: s.lat, lng: s.lng, address: s.address });
    setShowPickupSugg(false); setPickupSuggestions([]);
  };

  const selectDropoffSugg = (s) => {
    setDropoff({ lat: s.lat, lng: s.lng, address: s.address });
    setShowDropoffSugg(false); setDropoffSuggestions([]);
  };
  const [businessDrivers, setBusinessDrivers] = useState(0);
  const [privateDrivers, setPrivateDrivers] = useState(0);
  const [modeSettings, setModeSettings] = useState({
    business: { enabled: true, label: 'Unternehmer-Taxi', description: '' },
    private: { enabled: true, label: 'Privat-Taxi', description: '' },
  });
  
  // Refs
  const pollingRef = useRef(null);

  // Fetch user data
  useEffect(() => {
    fetchUserData();
    checkActiveRide();
    checkModuleStatus();
    fetchModeSettings();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchModeSettings = async () => {
    try {
      const res = await fetch(`${API}/api/admin/taxi/public/mode-settings`);
      if (res.ok) {
        const data = await res.json();
        setModeSettings(data);
      }
    } catch (err) {}
  };

  const checkModuleStatus = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/driver/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.module_enabled === false) {
          setModuleEnabled(false);
          setModuleMessage(data.message || 'Taxi-Modul wird derzeit vorbereitet');
        } else {
          // Get driver counts by type
          setBusinessDrivers(data.business_drivers || 0);
          setPrivateDrivers(data.private_drivers || 0);
        }
      }
    } catch (err) {}
  };

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const checkActiveRide = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/rides/active`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.has_active_ride && data.ride) {
          setActiveRide(data.ride);
          setView('tracking');
          startPolling(data.ride.ride_id);
        }
      }
    } catch (err) {
      console.error('Failed to check active ride:', err);
    }
  };

  const startPolling = (rideId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/taxi/ride/${rideId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setActiveRide(data.ride);
          if (['completed', 'cancelled'].includes(data.ride.status)) {
            clearInterval(pollingRef.current);
            fetchUserData();
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  // NOTE: getCurrentLocation is already defined at line 143 with GPS + Geocoding
  // This old version has been removed to fix duplicate declaration error

  // Get fare estimates
  const getEstimates = async () => {
    // Auto-geocode dropoff if needed
    if (dropoff.address && (!dropoff.lat || dropoff.lat === 0)) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dropoff.address)}&limit=1&accept-language=de&countrycodes=de,at,ch`
        );
        if (res.ok) {
          const data = await res.json();
          const f = data?.[0];
          if (f) { setDropoff({ lat: parseFloat(f.lat), lng: parseFloat(f.lon), address: f.display_name || dropoff.address }); }
          else { setError('Ziel nicht gefunden. Bitte Vorschlag auswählen.'); return; }
        }
      } catch { setError('Geocoding-Fehler'); return; }
    }
    if (!pickup.lat || !dropoff.address) {
      setError('Bitte Start und Ziel eingeben');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/taxi/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pickup, dropoff }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setEstimates(data.estimates || []);
        setSurge(data.surge || { active: false, multiplier: 1.0 });
      } else {
        const err = await res.json();
        setError(err.detail || 'Fehler beim Laden der Preise');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Book ride
  const bookRide = async () => {
    const estimate = estimates.find(e => e.vehicle_type === selectedVehicle);
    if (!estimate) return;
    
    if (userBalance < estimate.fare) {
      setError(`Nicht genug Guthaben. Benötigt: €${estimate.fare.toFixed(2)}`);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API}/api/taxi/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pickup,
          dropoff,
          vehicle_type: selectedVehicle,
          payment_method: 'wallet',
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setActiveRide(data.ride);
        setView('tracking');
        startPolling(data.ride.ride_id);
      } else {
        const err = await res.json();
        setError(err.detail || 'Buchung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Cancel ride
  const cancelRide = async () => {
    if (!activeRide) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/taxi/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveRide(null);
        setView('book');
        fetchUserData();
      } else {
        const err = await res.json();
        setError(err.detail || 'Stornierung fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  // Fetch ride history
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/rides/history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRideHistory(data.rides || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    if (view === 'history') fetchHistory();
  }, [view]);

  // Simulate driver for demo
  const simulateDriverArrival = async () => {
    if (!activeRide) return;
    try {
      await fetch(`${API}/api/taxi/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id, status: 'arriving' }),
      });
    } catch (err) {}
  };

  const simulateStartTrip = async () => {
    if (!activeRide) return;
    try {
      await fetch(`${API}/api/taxi/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id, status: 'started' }),
      });
    } catch (err) {}
  };

  const simulateCompleteTrip = async () => {
    if (!activeRide) return;
    try {
      await fetch(`${API}/api/taxi/driver/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ride_id: activeRide.ride_id, status: 'completed' }),
      });
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">BidBlitz Taxi</h1>
            <div className="text-sm text-cyan-400 font-medium">€{userBalance.toFixed(2)}</div>
          </div>
          
          {/* Tab Navigation */}
          {moduleEnabled && (
          <div className="flex gap-2 mt-4">
            {['book', 'tracking', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  view === tab
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {tab === 'book' ? 'Buchen' : tab === 'tracking' ? 'Live' : 'Verlauf'}
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <KYCBanner onNavigate={onNavigate} />
        {/* MODULE DISABLED NOTICE */}
        {!moduleEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-24 h-24 mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Taxi Demnächst</h2>
            <p className="text-gray-400 mb-6 max-w-sm">
              {moduleMessage || 'Das Taxi-Modul wartet auf echte Fahrer-Onboarding. Bald verfügbar!'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl font-semibold text-black"
            >
              Zur Startseite
            </button>
          </motion.div>
        )}

        {moduleEnabled && (
        <AnimatePresence mode="wait">
          {/* GROUP-RIDE LIVE-TRACKER BANNER (alle Views) */}
          <GroupTrackerBanner
            serviceType="taxi"
            onOpenGroup={() => setShowGroupRide(true)}
          />

          {/* BOOKING VIEW */}
          {view === 'book' && (
            <motion.div
              key="book"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* TAXI TYPE SELECTION */}
              {!taxiType && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold text-center">Wähle deinen Taxi-Typ</h2>
                  <div className={`grid gap-4 ${modeSettings.business.enabled && modeSettings.private.enabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Business/Company Taxi */}
                    {modeSettings.business.enabled && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (businessDrivers > 0) {
                          setTaxiType('business');
                        } else {
                          setOnboardingType('business');
                          setShowDriverOnboarding(true);
                        }
                      }}
                      className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 rounded-2xl p-5 text-left hover:border-cyan-400/60 transition-all"
                      data-testid="taxi-type-business"
                    >
                      <div className="w-14 h-14 mb-4 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">{modeSettings.business.label || 'Unternehmer'}</h3>
                      <p className="text-xs text-gray-400 mb-3">{modeSettings.business.description || 'Professionelle Taxiunternehmen mit Lizenz'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-400 font-medium">
                          {businessDrivers > 0 ? `${businessDrivers} verfügbar` : 'Buchung anfragen'}
                        </span>
                      </div>
                      {businessDrivers > 0 && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </motion.button>
                    )}

                    {/* Private Taxi */}
                    {modeSettings.private.enabled && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (privateDrivers > 0) {
                          setTaxiType('private');
                        } else {
                          setOnboardingType('private');
                          setShowDriverOnboarding(true);
                        }
                      }}
                      className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl p-5 text-left hover:border-purple-400/60 transition-all"
                      data-testid="taxi-type-private"
                    >
                      <div className="w-14 h-14 mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">{modeSettings.private.label || 'Privat'}</h3>
                      <p className="text-xs text-gray-400 mb-3">{modeSettings.private.description || 'Private Fahrer in deiner Nähe'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 font-medium">
                          {privateDrivers > 0 ? `${privateDrivers} verfügbar` : 'Buchung anfragen'}
                        </span>
                      </div>
                      {privateDrivers > 0 && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </motion.button>
                    )}
                  </div>

                  {/* No modes available fallback */}
                  {!modeSettings.business.enabled && !modeSettings.private.enabled && (
                    <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-sm text-gray-400">Taxi-Buchung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.</p>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-[#111] rounded-xl p-4 border border-white/5">
                    <h4 className="text-sm font-semibold mb-2">Was ist der Unterschied?</h4>
                    <div className="space-y-2 text-xs text-gray-400">
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-400">•</span>
                        <span><strong className="text-white">Unternehmer:</strong> Lizenzierte Taxiunternehmen, feste Preise, Quittung möglich</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        <span><strong className="text-white">Privat:</strong> Flexible Preise, schneller verfügbar, Community-Fahrer</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* BOOKING FORM - Only show after taxi type is selected */}
              {taxiType && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Selected Type Badge & Change Button */}
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      taxiType === 'business' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {taxiType === 'business' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                      <span className="text-sm font-medium">
                        {taxiType === 'business' ? 'Unternehmer-Taxi' : 'Privat-Taxi'}
                      </span>
                    </div>
                    <button
                      onClick={() => setTaxiType('')}
                      className="text-xs text-gray-400 hover:text-white underline"
                    >
                      Ändern
                    </button>
                  </div>

              {/* Interactive Map (Leaflet / OpenStreetMap) */}
              <div className="relative h-56 bg-[#0A0A0F] rounded-2xl overflow-hidden border border-white/10">
                <div
                  ref={mapContainerRef}
                  className="w-full h-full"
                  data-testid="taxi-map-container"
                  style={{ minHeight: '14rem' }}
                />

                {/* Reload Location Button */}
                <button
                  onClick={getCurrentLocation}
                  disabled={loadingLocation}
                  className="absolute bottom-3 right-3 bg-cyan-500 hover:bg-cyan-600 text-white p-3 rounded-full shadow-lg z-20 disabled:opacity-50 transition-colors"
                  title="Standort aktualisieren"
                  data-testid="taxi-reload-location"
                >
                  {loadingLocation ? (
                    <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>

                {/* Map Style Switcher (Apple Maps-style) */}
                <button
                  onClick={() => setShowMapStyles(true)}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg z-20 flex items-center justify-center hover:bg-black/90 transition-colors"
                  title="Kartenmodus wechseln"
                  data-testid="taxi-map-style-btn"
                >
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 3m0 0l-3 3m3-3H9a6 6 0 00-6 6v3m18 0v-3a6 6 0 00-6-6h-3m0 18l-3-3m0 0l3-3m-3 3h6a6 6 0 006-6v-3" opacity="0.3"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                  </svg>
                </button>

                {/* Map Style Picker Modal (Apple Maps-style) */}
                <AnimatePresence>
                  {showMapStyles && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowMapStyles(false)}
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-end"
                      data-testid="taxi-map-style-modal"
                    >
                      <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-[#0A0A0F]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 p-4"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-white font-bold text-sm">Kartenmodus</h3>
                          <button onClick={() => setShowMapStyles(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(MAP_STYLES).map(([key, style]) => {
                            const isActive = mapStyle === key;
                            const previewBg = {
                              dark: 'linear-gradient(135deg, #1A1D2E 0%, #0A0C1A 100%)',
                              light: 'linear-gradient(135deg, #E8ECF0 0%, #C8D0D8 100%)',
                              satellite: 'linear-gradient(135deg, #3A5A3C 0%, #2A4A2C 60%, #5A7A5C 100%)',
                            }[key];
                            return (
                              <button
                                key={key}
                                onClick={() => { setMapStyle(key); setShowMapStyles(false); }}
                                className={`flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all ${
                                  isActive ? '' : 'opacity-70 hover:opacity-100'
                                }`}
                                data-testid={`map-style-${key}`}
                              >
                                <div
                                  className={`w-full h-16 rounded-xl border-2 transition-all ${
                                    isActive ? 'border-cyan-400 shadow-[0_0_16px_rgba(0,194,255,0.4)]' : 'border-white/10'
                                  }`}
                                  style={{ background: previewBg }}
                                >
                                  {/* Mini roads preview */}
                                  <svg viewBox="0 0 80 60" className="w-full h-full" preserveAspectRatio="none">
                                    <path d="M0,40 Q20,30 40,35 T80,30" stroke={key === 'light' ? '#B8C5D0' : '#4A5568'} strokeWidth="2" fill="none" opacity="0.6"/>
                                    <path d="M20,0 L35,60" stroke={key === 'light' ? '#D0D8E0' : '#3A4258'} strokeWidth="1.5" fill="none" opacity="0.5"/>
                                    <circle cx="40" cy="35" r="3" fill="#00C2FF"/>
                                  </svg>
                                </div>
                                <span className={`text-[11px] font-semibold ${isActive ? 'text-cyan-400' : 'text-white/70'}`}>
                                  {style.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Current Address Overlay (Straße + Hausnummer) */}
                {currentAddress && (
                  <div className="absolute top-3 left-3 right-16 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl z-10 border border-white/10" data-testid="taxi-current-address">
                    <p className="text-[9px] text-cyan-400 font-semibold uppercase tracking-wider">Dein Standort</p>
                    <p className="text-xs text-white truncate">{currentAddress}</p>
                  </div>
                )}

                {/* Route info overlay */}
                {dropoff.lat !== 0 && estimates.length > 0 && (
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl z-10 border border-white/10">
                    <p className="text-[10px] text-cyan-400 font-semibold">{estimates[0]?.distance_km} km</p>
                    <p className="text-[9px] text-white/50">~{estimates[0]?.duration_minutes} Min</p>
                  </div>
                )}
              </div>

              {/* Location Inputs */}
              <div className="space-y-3">
                {/* ABHOLUNG */}
                <div className="relative z-20">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 ring-4 ring-cyan-500/20" />
                  </div>
                  <div className="absolute left-4 top-[58px] -translate-y-1/2 text-[8px] text-gray-500 uppercase tracking-wider z-10">ABHOLUNG</div>
                  <input
                    type="text"
                    placeholder="Aktueller Standort"
                    value={pickup.address}
                    onChange={(e) => handlePickupChange(e.target.value)}
                    onFocus={() => { if (pickupSuggestions.length > 0) setShowPickupSugg(true); }}
                    onBlur={() => { setTimeout(() => setShowPickupSugg(false), 200); geocodeOnBlur('pickup'); }}
                    className="w-full pl-10 pr-4 pt-6 pb-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    data-testid="taxi-pickup-input"
                  />
                  {showPickupSugg && pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl" style={{ zIndex: 50 }}>
                      {pickupSuggestions.map((s, i) => (
                        <button key={i} onMouseDown={() => selectPickupSugg(s)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-cyan-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                          data-testid={`pickup-sugg-${i}`}>
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{s.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{s.address}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ZIEL */}
                <div className="relative z-10">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                  </div>
                  <div className="absolute left-4 top-[58px] -translate-y-1/2 text-[8px] text-gray-500 uppercase tracking-wider z-10">ZIEL</div>
                  <input
                    type="text"
                    placeholder="Wohin möchtest du?"
                    value={dropoff.address}
                    onChange={(e) => handleDropoffChange(e.target.value)}
                    onFocus={() => { if (dropoffSuggestions.length > 0) setShowDropoffSugg(true); }}
                    onBlur={() => { setTimeout(() => setShowDropoffSugg(false), 200); geocodeOnBlur('dropoff'); }}
                    className="w-full pl-10 pr-4 pt-6 pb-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all cursor-text"
                    data-testid="taxi-dropoff-input"
                  />
                  {showDropoffSugg && dropoffSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl" style={{ zIndex: 50 }}>
                      {dropoffSuggestions.map((s, i) => (
                        <button key={i} onMouseDown={() => selectDropoffSugg(s)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                          data-testid={`dropoff-sugg-${i}`}>
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{s.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{s.address}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Saved Places */}
                {savedPlaces.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Gespeicherte Orte</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {savedPlaces.map((p) => {
                        const icons = { home: '🏠', work: '💼', gym: '🏋️', school: '🎓', star: '⭐' };
                        return (
                          <button
                            key={p.place_id}
                            onClick={() => setDropoff({ lat: p.lat, lng: p.lng, address: p.address })}
                            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 rounded-xl text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
                            data-testid={`taxi-saved-${p.name}`}
                          >
                            <span>{icons[p.icon] || '📍'}</span>
                            <span className="font-medium">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Destinations + Save Button */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Schnellauswahl</span>
                    {dropoff.address && dropoff.lat !== 0 && (
                      <button
                        onClick={() => setShowSaveModal(true)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        data-testid="taxi-save-place-btn"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                        Ziel speichern
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {[
                      { name: 'Flughafen BER', lat: 52.3667, lng: 13.5033 },
                      { name: 'Hauptbahnhof', lat: 52.5251, lng: 13.3694 },
                      { name: 'Alexanderplatz', lat: 52.5219, lng: 13.4132 },
                      { name: 'Brandenburger Tor', lat: 52.5163, lng: 13.3777 },
                    ].map((dest) => (
                      <button
                        key={dest.name}
                        onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name })}
                        className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors border border-white/5"
                        data-testid={`taxi-quick-${dest.name}`}
                      >
                        {dest.name}
                      </button>
                    ))}
                  </div>

                  {/* Bekannte Orte: Prishtina */}
                  <div className="mb-2">
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">Prishtina</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {[
                        { name: 'Flughafen Prishtina', lat: 42.5728, lng: 21.0358 },
                        { name: 'Skanderbeg-Platz', lat: 42.6629, lng: 21.1655 },
                        { name: 'Newborn Monument', lat: 42.6598, lng: 21.1596 },
                        { name: 'Germia Park', lat: 42.6740, lng: 21.1910 },
                        { name: 'Kathedrale Mutter Teresa', lat: 42.6608, lng: 21.1573 },
                        { name: 'Grand Hotel Prishtina', lat: 42.6622, lng: 21.1645 },
                        { name: 'Bulevardi Nënë Tereza', lat: 42.6610, lng: 21.1620 },
                        { name: 'Albi Mall', lat: 42.6484, lng: 21.1544 },
                      ].map((dest) => (
                        <button
                          key={dest.name}
                          onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name + ', Prishtina' })}
                          className="px-2.5 py-1 bg-emerald-500/8 rounded-lg text-[10px] text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors border border-emerald-500/10"
                          data-testid={`taxi-pri-${dest.name}`}
                        >
                          {dest.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bekannte Orte: Dubai */}
                  <div>
                    <span className="text-[9px] text-gray-600 uppercase tracking-wider">Dubai</span>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {[
                        { name: 'Dubai Airport (DXB)', lat: 25.2532, lng: 55.3657 },
                        { name: 'Burj Khalifa', lat: 25.1972, lng: 55.2744 },
                        { name: 'Dubai Mall', lat: 25.1985, lng: 55.2796 },
                        { name: 'Palm Jumeirah', lat: 25.1124, lng: 55.1390 },
                        { name: 'Burj Al Arab', lat: 25.1413, lng: 55.1853 },
                        { name: 'Dubai Marina', lat: 25.0805, lng: 55.1403 },
                        { name: 'Dubai Frame', lat: 25.2350, lng: 55.3006 },
                        { name: 'Mall of Emirates', lat: 25.1182, lng: 55.2006 },
                      ].map((dest) => (
                        <button
                          key={dest.name}
                          onClick={() => setDropoff({ lat: dest.lat, lng: dest.lng, address: dest.name + ', Dubai' })}
                          className="px-2.5 py-1 bg-amber-500/8 rounded-lg text-[10px] text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-400 transition-colors border border-amber-500/10"
                          data-testid={`taxi-dub-${dest.name}`}
                        >
                          {dest.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Save Place Modal */}
                {showSaveModal && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-[#1a1a1f] border border-cyan-500/20 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Ort speichern</span>
                      <button onClick={() => setShowSaveModal(false)} className="text-gray-500 hover:text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{dropoff.address}</div>
                    <div className="flex gap-2">
                      {[
                        { id: 'home', label: '🏠 Zuhause' },
                        { id: 'work', label: '💼 Arbeit' },
                        { id: 'gym', label: '🏋️ Gym' },
                        { id: 'school', label: '🎓 Schule' },
                        { id: 'star', label: '⭐ Andere' },
                      ].map(ic => (
                        <button key={ic.id} onClick={() => { setSaveIcon(ic.id); if (!saveName || ['Zuhause','Arbeit','Gym','Schule','Andere'].includes(saveName)) setSaveName(ic.id === 'home' ? 'Zuhause' : ic.id === 'work' ? 'Arbeit' : ic.id === 'gym' ? 'Gym' : ic.id === 'school' ? 'Schule' : 'Andere'); }}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${saveIcon === ic.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-white/5'}`}
                          data-testid={`taxi-save-icon-${ic.id}`}
                        >{ic.label}</button>
                      ))}
                    </div>
                    <input
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      placeholder="Name (z.B. Zuhause)"
                      className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 outline-none"
                      data-testid="taxi-save-name"
                    />
                    <button
                      onClick={() => savePlace(dropoff.address, dropoff.lat, dropoff.lng)}
                      disabled={!saveName}
                      className="w-full py-2.5 bg-cyan-500 text-black rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-cyan-400 transition-all"
                      data-testid="taxi-save-confirm"
                    >Speichern</button>
                  </motion.div>
                )}
                
                <button
                  onClick={getEstimates}
                  disabled={loading || !dropoff.address}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Lädt...
                    </span>
                  ) : '🚕 Preise anzeigen'}
                </button>
              </div>

              {/* Surge Warning */}
              {surge.active && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-medium text-yellow-400">Hohe Nachfrage</p>
                      <p className="text-sm text-gray-400">Preise sind {surge.multiplier}x höher</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Options */}
              {estimates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">Wähle dein Fahrzeug</h3>
                  {estimates.map((est) => {
                    const isActive = selectedVehicle === est.vehicle_type;
                    return (
                      <motion.button
                        key={est.vehicle_type}
                        onClick={() => setSelectedVehicle(est.vehicle_type)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all ${
                          isActive
                            ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-400/70 shadow-[0_0_24px_rgba(0,194,255,0.15)]'
                            : 'bg-[#0F1218] border-white/5 hover:border-white/15'
                        }`}
                        whileTap={{ scale: 0.98 }}
                        data-testid={`vehicle-card-${est.vehicle_type}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`shrink-0 w-20 h-12 rounded-xl flex items-center justify-center ${
                              isActive ? 'bg-cyan-500/10' : 'bg-white/[0.03]'
                            }`}>
                              <VehicleIcon type={est.vehicle_type} className="w-16 h-8" active={isActive} />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <p className={`font-bold text-base ${isActive ? 'text-white' : 'text-gray-200'}`}>{est.name}</p>
                              <p className="text-xs text-gray-500 truncate">{est.description}</p>
                              <p className="text-[11px] text-gray-600 mt-0.5">
                                {est.capacity} Pers. · {est.eta_minutes} Min
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-lg font-bold ${isActive ? 'text-cyan-400' : 'text-gray-300'}`}>€{est.fare.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-600">
                              €{est.fare_range?.min.toFixed(2)}–€{est.fare_range?.max.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                  
                  {/* Book Button */}
                  <button
                    onClick={bookRide}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl font-bold text-black text-lg disabled:opacity-50 shadow-[0_4px_24px_rgba(0,194,255,0.35)] hover:shadow-[0_6px_32px_rgba(0,194,255,0.5)] transition-shadow"
                    data-testid="taxi-book-btn"
                  >
                    {loading ? 'Wird gebucht...' : 'Fahrt buchen'}
                  </button>

                  {/* Group Ride Button (Bolt-Style) */}
                  <button
                    type="button"
                    onClick={() => setShowGroupRide(true)}
                    data-testid="taxi-group-ride-btn"
                    className="w-full py-3 bg-[#121218] border border-emerald-500/40 text-emerald-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    👥 Group Ride starten
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
                  {error}
                </div>
              )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* TRACKING VIEW */}
          {view === 'tracking' && (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {activeRide ? (
                <>
                  {/* Live Map */}
                  <div className="relative h-56 bg-[#111] rounded-2xl overflow-hidden border border-white/10">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-5xl mb-3">
                          {activeRide.status === 'started' ? '🚗💨' : '📍'}
                        </div>
                        <p className="text-gray-400">Live Tracking</p>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[activeRide.status]}`}>
                        {STATUS_LABELS[activeRide.status]}
                      </span>
                    </div>
                  </div>

                  {/* Driver Info */}
                  {activeRide.driver && (
                    <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
                      <div className="flex items-center gap-4">
                        <img
                          src={activeRide.driver.photo_url || 'https://via.placeholder.com/60'}
                          alt={activeRide.driver.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/30"
                        />
                        <div className="flex-1">
                          <p className="font-bold text-lg">{activeRide.driver.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="text-yellow-400">★</span>
                            <span>{activeRide.driver.rating}</span>
                            <span>•</span>
                            <span>{activeRide.driver.total_rides} Fahrten</span>
                          </div>
                        </div>
                        <button className="p-3 bg-green-500/20 rounded-full text-green-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Vehicle Info */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Fahrzeug</p>
                          <p className="font-semibold">{activeRide.driver.vehicle?.model}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-sm">Kennzeichen</p>
                          <p className="font-mono font-bold text-cyan-400">{activeRide.driver.vehicle?.plate}</p>
                        </div>
                      </div>
                      
                      {/* ETA */}
                      {activeRide.driver.eta_minutes && activeRide.status !== 'started' && (
                        <div className="mt-4 p-3 bg-cyan-500/10 rounded-xl text-center">
                          <p className="text-cyan-400 font-bold text-2xl">{activeRide.driver.eta_minutes} Min</p>
                          <p className="text-sm text-gray-400">bis zur Ankunft</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Route Info */}
                  <div className="p-4 bg-[#111] rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                      <div>
                        <p className="text-gray-400 text-sm">Abholung</p>
                        <p className="font-medium">{activeRide.pickup?.address || 'Startpunkt'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                      <div>
                        <p className="text-gray-400 text-sm">Ziel</p>
                        <p className="font-medium">{activeRide.dropoff?.address || 'Zielpunkt'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fare Info */}
                  <div className="p-4 bg-[#111] rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Geschätzter Preis</span>
                      <span className="text-2xl font-bold text-cyan-400">
                        €{(activeRide.final_fare || activeRide.fare_estimate || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-gray-500">
                      <span>{activeRide.distance_km} km</span>
                      <span>~{activeRide.duration_min} Min</span>
                      <span>{activeRide.vehicle_name}</span>
                    </div>
                  </div>

                  {/* Demo Controls */}
                  {activeRide.status !== 'completed' && activeRide.status !== 'cancelled' && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <p className="text-yellow-400 text-sm font-medium mb-3">Demo Steuerung:</p>
                      <div className="flex gap-2 flex-wrap">
                        {activeRide.status === 'accepted' && (
                          <button onClick={simulateDriverArrival} className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm">
                            Fahrer kommt
                          </button>
                        )}
                        {activeRide.status === 'arriving' && (
                          <button onClick={simulateStartTrip} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm">
                            Fahrt starten
                          </button>
                        )}
                        {activeRide.status === 'started' && (
                          <button onClick={simulateCompleteTrip} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">
                            Fahrt beenden
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Live Chat + Split during active ride */}
                  {!['completed', 'cancelled'].includes(activeRide.status) && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        data-testid="taxi-livechat-btn"
                        onClick={() => setShowLiveChat(true)}
                        className="py-3 bg-[#121218] border border-[#00C2FF]/40 text-[#00C2FF] rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >💬 Chat mit Fahrer</button>
                      <button
                        data-testid="taxi-split-btn"
                        onClick={() => {
                          setSplitRideId(activeRide.ride_id);
                          setSplitTotal(activeRide.final_fare || activeRide.fare_estimate || 0);
                          setShowSplit(true);
                        }}
                        className="py-3 bg-[#121218] border border-purple-500/40 text-purple-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      >👥 Split Pay</button>
                    </div>
                  )}

                  {/* Cancel Button */}
                  {!['completed', 'cancelled', 'started'].includes(activeRide.status) && (
                    <button
                      onClick={cancelRide}
                      disabled={loading}
                      className="w-full py-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-semibold"
                    >
                      {loading ? 'Wird storniert...' : 'Fahrt stornieren'}
                    </button>
                  )}

                  {/* Completed */}
                  {activeRide.status === 'completed' && (
                    <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                      <div className="text-5xl mb-4">✅</div>
                      <h3 className="text-xl font-bold text-emerald-400">Fahrt abgeschlossen!</h3>
                      <p className="text-gray-400 mt-2">Bezahlt: €{(activeRide.final_fare || activeRide.fare_estimate).toFixed(2)}</p>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          data-testid="taxi-rate-after-btn"
                          onClick={() => { setReviewRideId(activeRide.ride_id); setShowReview(true); }}
                          className="px-4 py-3 bg-yellow-500/20 text-yellow-400 rounded-xl font-bold"
                        >⭐ Bewerten</button>
                        <button
                          onClick={() => { setActiveRide(null); setView('book'); }}
                          className="px-4 py-3 bg-cyan-500 rounded-xl text-black font-semibold"
                        >Neue Fahrt</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🚕</div>
                  <p className="text-gray-400">Keine aktive Fahrt</p>
                  <button
                    onClick={() => setView('book')}
                    className="mt-4 px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl"
                  >
                    Fahrt buchen
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* HISTORY VIEW */}
          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <h3 className="font-semibold text-gray-300">Deine Fahrten</h3>
              
              {rideHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-gray-400">Noch keine Fahrten</p>
                </div>
              ) : (
                rideHistory.map((ride) => (
                  <div
                    key={ride.ride_id}
                    className="p-4 bg-[#111] rounded-xl border border-white/10"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">{ride.dropoff?.address || 'Ziel'}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ride.created_at).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[ride.status]}`}>
                        {STATUS_LABELS[ride.status]}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{VEHICLE_ICONS[ride.vehicle_type]}</span>
                        <span>{ride.vehicle_name}</span>
                        <span>•</span>
                        <span>{ride.distance_km} km</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-400">
                          €{(ride.final_fare || ride.fare_estimate || 0).toFixed(2)}
                        </span>
                        {ride.status === 'completed' && (
                          <button
                            data-testid={`taxi-review-btn-${ride.ride_id}`}
                            onClick={() => { setReviewRideId(ride.ride_id); setShowReview(true); }}
                            className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold"
                          >⭐</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>

      {/* Super-App Parity Modals */}
      <ReviewModal
        isOpen={showReview}
        onClose={() => setShowReview(false)}
        serviceType="taxi"
        serviceId={reviewRideId}
        onSubmit={() => fetchHistory && fetchHistory()}
      />
      <SplitPaymentModal
        isOpen={showSplit}
        onClose={() => setShowSplit(false)}
        type="taxi"
        itemId={splitRideId}
        totalAmount={splitTotal}
      />
      <AnimatePresence>
        {showLiveChat && activeRide?.ride_id && (
          <LiveChat
            rideId={activeRide.ride_id}
            userRole="passenger"
            onClose={() => setShowLiveChat(false)}
          />
        )}
      </AnimatePresence>

      {/* Driver Onboarding Modal */}
      <AnimatePresence>
        {showDriverOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              if (!onboardingSubmitting) {
                setShowDriverOnboarding(false);
                setOnboardingSuccess(false);
                setOnboardingForm({ name: '', email: '', phone: '', license_number: '', vehicle_type: 'standard', city: '', message: '' });
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0A0A0F] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
            >
              {!onboardingSuccess ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white">Als Fahrer bewerben</h2>
                      <p className="text-xs text-gray-400 mt-1">
                        {onboardingType === 'business' ? 'Unternehmer-Taxi' : 'Privat-Taxi'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!onboardingSubmitting) {
                          setShowDriverOnboarding(false);
                          setOnboardingForm({ name: '', email: '', phone: '', license_number: '', vehicle_type: 'standard', city: '', message: '' });
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                      disabled={onboardingSubmitting}
                    >
                      <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Vollständiger Name</label>
                      <input
                        type="text"
                        placeholder="Max Mustermann"
                        value={onboardingForm.name}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        data-testid="driver-onboard-name"
                        disabled={onboardingSubmitting}
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">E-Mail</label>
                      <input
                        type="email"
                        placeholder="max@example.com"
                        value={onboardingForm.email}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        data-testid="driver-onboard-email"
                        disabled={onboardingSubmitting}
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Telefonnummer</label>
                      <input
                        type="tel"
                        placeholder="+49 123 456789"
                        value={onboardingForm.phone}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        data-testid="driver-onboard-phone"
                        disabled={onboardingSubmitting}
                      />
                    </div>

                    {/* License */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Führerscheinnummer</label>
                      <input
                        type="text"
                        placeholder="B1234567890"
                        value={onboardingForm.license_number}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, license_number: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        data-testid="driver-onboard-license"
                        disabled={onboardingSubmitting}
                      />
                    </div>

                    {/* Vehicle Type */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Fahrzeugtyp</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['standard', 'premium', 'van'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setOnboardingForm(prev => ({ ...prev, vehicle_type: type }))}
                            disabled={onboardingSubmitting}
                            className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                              onboardingForm.vehicle_type === type
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                            }`}
                            data-testid={`driver-vehicle-${type}`}
                          >
                            {type === 'standard' ? 'Standard' : type === 'premium' ? 'Premium' : 'Van'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* City (optional) */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Stadt (optional)</label>
                      <input
                        type="text"
                        placeholder="z.B. Berlin"
                        value={onboardingForm.city}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        data-testid="driver-onboard-city"
                        disabled={onboardingSubmitting}
                      />
                    </div>

                    {/* Message (optional) */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Nachricht (optional)</label>
                      <textarea
                        placeholder="Zusätzliche Informationen..."
                        value={onboardingForm.message}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, message: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
                        data-testid="driver-onboard-message"
                        disabled={onboardingSubmitting}
                      />
                    </div>

                    {/* Submit Button */}
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                        {error}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        if (!onboardingForm.name || !onboardingForm.email || !onboardingForm.phone || !onboardingForm.license_number) {
                          setError('Bitte alle Pflichtfelder ausfüllen');
                          return;
                        }
                        setOnboardingSubmitting(true);
                        setError('');
                        try {
                          const res = await fetch(`${API}/api/taxi/driver/onboard`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              ...onboardingForm,
                              driver_type: onboardingType,
                            }),
                          });
                          if (res.ok) {
                            setOnboardingSuccess(true);
                          } else {
                            const errData = await res.json();
                            setError(errData.detail || 'Fehler bei der Bewerbung');
                          }
                        } catch (err) {
                          setError('Netzwerkfehler');
                        } finally {
                          setOnboardingSubmitting(false);
                        }
                      }}
                      disabled={onboardingSubmitting}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                      data-testid="driver-onboard-submit"
                    >
                      {onboardingSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Wird gesendet...
                        </span>
                      ) : 'Bewerbung absenden'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Bewerbung erfolgreich!</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    Wir prüfen deine Angaben und melden uns innerhalb von 24 Stunden.
                  </p>
                  <button
                    onClick={() => {
                      setShowDriverOnboarding(false);
                      setOnboardingSuccess(false);
                      setOnboardingForm({ name: '', email: '', phone: '', license_number: '', vehicle_type: 'standard', city: '', message: '' });
                    }}
                    className="px-6 py-3 bg-cyan-500 rounded-xl font-semibold text-black hover:bg-cyan-400 transition-colors"
                  >
                    Schließen
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <GroupOrderModal
        isOpen={showGroupRide}
        onClose={() => setShowGroupRide(false)}
        serviceType="taxi"
        details={{
          pickup,
          destination: dropoff,
          vehicle_type: selectedVehicle,
        }}
      />
    </div>
  );
}
