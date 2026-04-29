import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Clock, Star, ChevronRight, X, Zap, User, Phone, Car } from 'lucide-react';
import { useI18n } from '../store/I18nContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const API = process.env.REACT_APP_BACKEND_URL;

const VEHICLE_TYPES = [
  { 
    id: 'economy', 
    name: 'Economy', 
    icon: Car, 
    capacity: 4, 
    priceMultiplier: 1.0, 
    color: '#00C2FF',
    eta: '2-4 min' 
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    icon: Star, 
    capacity: 4, 
    priceMultiplier: 1.5, 
    color: '#7B2CFF',
    eta: '3-6 min' 
  },
  { 
    id: 'van', 
    name: 'Van', 
    icon: User, 
    capacity: 7, 
    priceMultiplier: 1.8, 
    color: '#00AEEF',
    eta: '5-8 min' 
  },
];

export default function TaxiPageNew({ onNavigate }) {
  const { t } = useI18n();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('economy');
  const [fareEstimate, setFareEstimate] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [userLocation, setUserLocation] = useState({ lat: 52.52, lng: 13.405 });
  const [showDestInput, setShowDestInput] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initMap();
    getCurrentLocation();
    fetchRecentTrips();
    fetchSavedPlaces();
    checkActiveRide();
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstance.current) return;
    
    const map = L.map(mapRef.current, {
      center: [52.52, 13.405],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);
    
    mapInstance.current = map;
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (mapInstance.current) {
            mapInstance.current.setView([loc.lat, loc.lng], 15);
            L.marker([loc.lat, loc.lng]).addTo(mapInstance.current);
          }
        },
        () => {}
      );
    }
  };

  const fetchRecentTrips = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/my-rides?limit=5`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRecentTrips(data.rides || []);
      }
    } catch {}
  };

  const fetchSavedPlaces = async () => {
    setSavedPlaces([
      { id: 1, name: 'Home', address: 'Hauptstraße 123, Berlin', icon: '🏠' },
      { id: 2, name: 'Work', address: 'Alexanderplatz 1, Berlin', icon: '💼' },
    ]);
  };

  const checkActiveRide = async () => {
    try {
      const res = await fetch(`${API}/api/taxi/active-ride`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.ride) setActiveRide(data.ride);
      }
    } catch {}
  };

  const estimateFare = async () => {
    if (!destination) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/taxi/estimate-fare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pickup: pickup || 'Current Location',
          destination,
          vehicle_type: selectedVehicle,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFareEstimate(data);
      }
    } catch {}
    setLoading(false);
  };

  const requestRide = async () => {
    if (!destination) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/taxi/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pickup: pickup || 'Current Location',
          destination,
          vehicle_type: selectedVehicle,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRide(data.ride);
        setShowDestInput(false);
      }
    } catch {}
    setLoading(false);
  };

  const selectRecentTrip = (trip) => {
    setPickup(trip.pickup);
    setDestination(trip.destination);
    setShowDestInput(true);
    estimateFare();
  };

  if (activeRide) {
    return <ActiveRideView ride={activeRide} onCancel={() => setActiveRide(null)} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Fullscreen Map */}
      <div ref={mapRef} className="absolute inset-0 z-0" />
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate?.('/')}
          className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center"
        >
          <X size={20} className="text-gray-800" />
        </motion.button>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {!showDestInput && (
          <motion.div
            initial={{ y: 400 }}
            animate={{ y: 0 }}
            exit={{ y: 400 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-[#0B0B0F] rounded-t-3xl shadow-2xl"
          >
            <div className="p-6 space-y-4">
              {/* Where To Input */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDestInput(true)}
                className="w-full p-4 bg-[#121218] rounded-2xl flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#00C2FF]/20 flex items-center justify-center">
                  <Navigation size={20} className="text-[#00C2FF]" />
                </div>
                <span className="text-white font-medium">Where to?</span>
              </motion.button>

              {/* Saved Places */}
              {savedPlaces.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Saved</p>
                  {savedPlaces.map((place) => (
                    <motion.button
                      key={place.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setDestination(place.address);
                        setShowDestInput(true);
                      }}
                      className="w-full p-3 bg-[#121218] rounded-xl flex items-center gap-3"
                    >
                      <span className="text-2xl">{place.icon}</span>
                      <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium">{place.name}</p>
                        <p className="text-gray-500 text-xs">{place.address}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-600" />
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Recent Trips - 1-Tap Rebooking */}
              {recentTrips.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Recent</p>
                  {recentTrips.slice(0, 3).map((trip, idx) => (
                    <motion.button
                      key={idx}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectRecentTrip(trip)}
                      className="w-full p-3 bg-[#121218] rounded-xl flex items-center gap-3"
                    >
                      <Clock size={16} className="text-gray-500" />
                      <div className="flex-1 text-left">
                        <p className="text-white text-sm">{trip.destination}</p>
                        <p className="text-gray-500 text-xs">€{trip.total_cost?.toFixed(2)}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-600" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Destination Input Sheet */}
        {showDestInput && (
          <motion.div
            initial={{ y: 400 }}
            animate={{ y: 0 }}
            exit={{ y: 400 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-[#0B0B0F] rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Choose Ride</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowDestInput(false)}
                  className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
                >
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>

              {/* Pickup & Destination */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00C2FF]/20 flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-[#00C2FF]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Pickup location"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className="flex-1 bg-[#121218] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#7B2CFF]/20 flex items-center justify-center flex-shrink-0">
                    <Navigation size={16} className="text-[#7B2CFF]" />
                  </div>
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      if (e.target.value) estimateFare();
                    }}
                    className="flex-1 bg-[#121218] text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2CFF]/50"
                  />
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Select Vehicle</p>
                {VEHICLE_TYPES.map((vehicle) => (
                  <motion.button
                    key={vehicle.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedVehicle(vehicle.id);
                      if (destination) estimateFare();
                    }}
                    className={`w-full p-4 rounded-2xl flex items-center gap-4 transition ${
                      selectedVehicle === vehicle.id
                        ? 'bg-gradient-to-r from-[#00C2FF]/20 to-[#7B2CFF]/20 ring-2 ring-[#00C2FF]'
                        : 'bg-[#121218]'
                    }`}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${vehicle.color}20` }}
                    >
                      <vehicle.icon size={24} style={{ color: vehicle.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">{vehicle.name}</p>
                      <p className="text-gray-500 text-xs">{vehicle.eta} away</p>
                    </div>
                    {fareEstimate && (
                      <div className="text-right">
                        <p className="text-white font-bold">€{(fareEstimate.base_fare * vehicle.priceMultiplier).toFixed(2)}</p>
                        <p className="text-gray-500 text-xs">{fareEstimate.duration} min</p>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Book Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={requestRide}
                disabled={!destination || loading}
                className={`w-full py-4 rounded-full font-bold text-white transition ${
                  destination && !loading
                    ? 'bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF]'
                    : 'bg-gray-700 opacity-50'
                }`}
              >
                {loading ? 'Requesting...' : fareEstimate ? `Book for €${(fareEstimate.base_fare * VEHICLE_TYPES.find(v => v.id === selectedVehicle).priceMultiplier).toFixed(2)}` : 'Request Ride'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveRideView({ ride, onCancel }) {
  return (
    <div className="h-screen w-full bg-[#0B0B0F] flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center space-y-2">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#00C2FF] to-[#7B2CFF] flex items-center justify-center"
          >
            <Car size={40} className="text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white">Ride Active</h2>
          <p className="text-gray-400">Your driver is on the way</p>
        </div>
        
        <div className="bg-[#121218] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-700" />
            <div>
              <p className="text-white font-medium">{ride.driver_name || 'Driver'}</p>
              <div className="flex items-center gap-1">
                <Star size={14} className="text-yellow-400" fill="currentColor" />
                <span className="text-sm text-gray-400">4.9</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className="text-[#00C2FF] font-medium">{ride.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">ETA</span>
              <span className="text-white font-medium">5 min</span>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          className="w-full py-4 bg-red-500/20 text-red-400 rounded-full font-medium"
        >
          Cancel Ride
        </motion.button>
      </motion.div>
    </div>
  );
}
