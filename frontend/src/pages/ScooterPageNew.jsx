import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Battery, Trophy, Star, Award, Target, X, Navigation } from 'lucide-react';
import { useI18n } from '../store/I18nContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API = process.env.REACT_APP_BACKEND_URL;

// Gamification Badges
const BADGES = [
  { id: 'first_ride', name: 'First Ride', icon: '🎉', desc: 'Complete your first ride', points: 10 },
  { id: 'eco_warrior', name: 'Eco Warrior', icon: '🌱', desc: 'Ride 10km', points: 50 },
  { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', desc: 'Reach 25km/h', points: 20 },
  { id: 'night_rider', name: 'Night Rider', icon: '🌙', desc: 'Ride after 10PM', points: 30 },
  { id: 'century', name: 'Century', icon: '💯', desc: 'Ride 100km total', points: 100 },
];

export default function ScooterPageNew({ onNavigate }) {
  const { t } = useI18n();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  
  const [scooters, setScooters] = useState([]);
  const [selectedScooter, setSelectedScooter] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [userStats, setUserStats] = useState({ totalKm: 0, rides: 0, points: 0, level: 1 });
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [showBadges, setShowBadges] = useState(false);
  const [userLocation, setUserLocation] = useState({ lat: 52.52, lng: 13.405 });

  useEffect(() => {
    initMap();
    getCurrentLocation();
    fetchScooters();
    fetchUserStats();
    checkActiveRide();
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstance.current) return;
    
    const map = L.map(mapRef.current, {
      center: [52.52, 13.405],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
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
          }
        }
      );
    }
  };

  const fetchScooters = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setScooters(data.scooters || []);
        renderScootersOnMap(data.scooters || []);
      }
    } catch {}
  };

  const renderScootersOnMap = (scootersList) => {
    if (!mapInstance.current) return;
    
    scootersList.forEach(scooter => {
      const batteryColor = scooter.battery >= 60 ? '#10b981' : scooter.battery >= 30 ? '#f59e0b' : '#ef4444';
      
      const icon = L.divIcon({
        className: 'scooter-marker',
        html: `
          <div style="position:relative;width:40px;height:40px;cursor:pointer;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:${batteryColor}20;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:${batteryColor};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/>
              </svg>
            </div>
            <div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);background:white;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:bold;color:${batteryColor};box-shadow:0 2px 4px rgba(0,0,0,0.2);white-space:nowrap;">
              ${scooter.battery}%
            </div>
          </div>
        `,
        iconSize: [40, 60],
        iconAnchor: [20, 30],
      });

      const marker = L.marker([scooter.lat, scooter.lng], { icon })
        .addTo(mapInstance.current)
        .on('click', () => setSelectedScooter(scooter));
    });
  };

  const fetchUserStats = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/stats`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserStats(data.stats || { totalKm: 0, rides: 0, points: 0, level: 1 });
        setEarnedBadges(data.badges || []);
      }
    } catch {}
  };

  const checkActiveRide = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/active-rental`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.rental) setActiveRide(data.rental);
      }
    } catch {}
  };

  const unlockScooter = async (scooterId) => {
    try {
      const res = await fetch(`${API}/api/scooter/unlock/${scooterId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRide(data.rental);
        setSelectedScooter(null);
      }
    } catch {}
  };

  const endRide = async () => {
    try {
      const res = await fetch(`${API}/api/scooter/end-rental/${activeRide.rental_id}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        
        // Check for new badges
        if (data.newBadges && data.newBadges.length > 0) {
          showBadgeAnimation(data.newBadges);
        }
        
        setActiveRide(null);
        fetchUserStats();
        fetchScooters();
      }
    } catch {}
  };

  const showBadgeAnimation = (badges) => {
    // TODO: Show celebration animation
    setEarnedBadges(prev => [...prev, ...badges]);
  };

  if (activeRide) {
    return <ActiveRideView ride={activeRide} onEnd={endRide} stats={userStats} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Fullscreen Map */}
      <div ref={mapRef} className="absolute inset-0 z-0" />
      
      {/* Top Stats Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate?.('/')}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center"
          >
            <X size={20} className="text-gray-800" />
          </motion.button>
          
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBadges(true)}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] text-white font-bold text-sm flex items-center gap-2"
            >
              <Trophy size={16} />
              Lvl {userStats.level} · {userStats.points}pts
            </motion.button>
          </div>
        </div>
      </div>

      {/* Scooter Details Sheet */}
      <AnimatePresence>
        {selectedScooter && (
          <motion.div
            initial={{ y: 400 }}
            animate={{ y: 0 }}
            exit={{ y: 400 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-[#0B0B0F] rounded-t-3xl shadow-2xl p-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Scooter #{selectedScooter.scooter_id}</h3>
                  <p className="text-gray-400 text-sm">{selectedScooter.distance}m away</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedScooter(null)}
                  className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
                >
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>

              <div className="flex items-center gap-4 p-4 bg-[#121218] rounded-2xl">
                <Battery size={32} className={`${selectedScooter.battery >= 60 ? 'text-green-400' : selectedScooter.battery >= 30 ? 'text-yellow-400' : 'text-red-400'}`} />
                <div className="flex-1">
                  <p className="text-white font-medium">{selectedScooter.battery}% Battery</p>
                  <p className="text-gray-500 text-xs">~{Math.floor(selectedScooter.battery / 5)}km range</p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => unlockScooter(selectedScooter.scooter_id)}
                className="w-full py-4 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] rounded-full text-white font-bold"
              >
                Unlock for €1.00 + €0.19/min
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badges Modal */}
      <AnimatePresence>
        {showBadges && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowBadges(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-[#0B0B0F] rounded-3xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Achievements</h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowBadges(false)}
                  className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
                >
                  <X size={16} className="text-gray-400" />
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {BADGES.map((badge) => {
                  const earned = earnedBadges.includes(badge.id);
                  return (
                    <motion.div
                      key={badge.id}
                      whileHover={{ scale: 1.05 }}
                      className={`p-4 rounded-2xl text-center space-y-2 ${
                        earned ? 'bg-gradient-to-br from-[#00C2FF]/20 to-[#7B2CFF]/20' : 'bg-[#121218] opacity-50'
                      }`}
                    >
                      <div className="text-4xl">{badge.icon}</div>
                      <p className="text-white text-sm font-medium">{badge.name}</p>
                      <p className="text-gray-500 text-xs">{badge.desc}</p>
                      {earned && <p className="text-[#00C2FF] text-xs font-bold">+{badge.points}pts</p>}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveRideView({ ride, onEnd, stats }) {
  const [elapsed, setElapsed] = useState(0);
  const [cost, setCost] = useState(1.0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
      setCost(1.0 + (elapsed / 60) * 0.19);
    }, 1000);
    return () => clearInterval(timer);
  }, [elapsed]);

  return (
    <div className="h-screen w-full bg-[#0B0B0F] flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center space-y-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-8xl"
          >
            🛴
          </motion.div>
          <h2 className="text-3xl font-bold text-white">{Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}</h2>
          <p className="text-2xl font-bold text-[#00C2FF]">€{cost.toFixed(2)}</p>
        </div>
        
        <div className="bg-[#121218] rounded-2xl p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Speed</span>
            <span className="text-white font-bold">12 km/h</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Distance</span>
            <span className="text-white font-bold">2.3 km</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Points earned</span>
            <span className="text-[#00C2FF] font-bold">+{Math.floor(elapsed / 10)}pts</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onEnd}
          className="w-full py-4 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] rounded-full text-white font-bold"
        >
          End Ride & Lock
        </motion.button>
      </motion.div>
    </div>
  );
}
